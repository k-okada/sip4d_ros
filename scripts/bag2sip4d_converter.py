#!/usr/bin/env python3
"""
Convert bag file camera images to SIP4D-ZIP format
Captures images and GPS data from ROS topics
"""
import rospy
import json
import os
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
import uuid
from sensor_msgs.msg import Image, NavSatFix
from nav_msgs.msg import Odometry
from cv_bridge import CvBridge
import cv2
import math

try:
    from PIL import Image as PILImage
    from PIL.Image import Exif
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    rospy.logwarn("PIL not available, EXIF metadata will not be added to images")

class Bag2SIP4DConverter:
    def __init__(self, output_dir="/tmp/sip4d_output", gps_distance_threshold=20.0, heading_threshold=20.0, timeout=5.0):
        self.output_dir = output_dir
        self.work_dir = os.path.join(output_dir, "work")
        os.makedirs(self.work_dir, exist_ok=True)

        self.files_dir = os.path.join(self.work_dir, "files")
        os.makedirs(self.files_dir, exist_ok=True)

        self.bridge = CvBridge()
        self.images = []
        self.gps_data = {}
        self.odom_data = {}
        self.last_gps_position = None
        self.last_heading = None
        self.gps_distance_threshold = gps_distance_threshold  # meters
        self.heading_threshold = heading_threshold  # degrees

        # Auto-shutdown timeout
        self.timeout = timeout  # seconds
        self.last_data_time = None
        self.shutdown_event = False

        # State tracking
        self.min_lat = 90.0
        self.min_lon = 180.0
        self.max_lat = -90.0
        self.max_lon = -180.0

        # Subscribe to topics
        rospy.Subscriber("/stereo/right/image_raw", Image, self.image_callback)
        rospy.Subscriber("/gps/fix", NavSatFix, self.gps_callback)
        rospy.Subscriber("/odom", Odometry, self.odom_callback)

        # Timer for timeout detection
        rospy.Timer(rospy.Duration(1.0), self._timeout_check)

        rospy.loginfo("Bag2SIP4DConverter initialized")
        rospy.loginfo(f"Output directory: {output_dir}")
        rospy.loginfo(f"Sampling threshold: distance {gps_distance_threshold}m OR heading {heading_threshold}°")
        rospy.loginfo(f"Timeout (no data): {timeout} seconds")

    def _calculate_gps_distance(self, lat, lon):
        """Calculate distance in meters between two GPS points"""
        if self.last_gps_position is None:
            return float('inf')

        lat1, lon1 = self.last_gps_position
        # Approximate distance in meters (simplified Haversine)
        lat_diff = (lat - lat1) * 111000  # ~111km per degree latitude
        lon_diff = (lon - lon1) * 111000 * math.cos(math.radians(lat))  # longitude varies by latitude
        distance = math.sqrt(lat_diff**2 + lon_diff**2)
        return distance

    def _calculate_heading_diff(self, heading):
        """Calculate heading difference in degrees"""
        if self.last_heading is None:
            return float('inf')

        # Calculate shortest angular distance
        diff = abs(heading - self.last_heading)
        # Wrap around 360 degrees
        if diff > 180:
            diff = 360 - diff
        return diff

    def _float_to_rational(self, value):
        """Convert float to rational for EXIF (numerator, denominator)"""
        # For simplicity, use 6 decimal places
        numerator = int(round(value * 1000000))
        denominator = 1000000
        return (numerator, denominator)

    def _save_image_with_exif(self, cv_image, filepath, lat, lon, heading, timestamp):
        """Save image with EXIF GPS metadata"""
        if not PIL_AVAILABLE:
            # Fallback: save without EXIF
            cv2.imwrite(filepath, cv_image)
            return

        try:
            # Ensure lat/lon are floats - handle tuple case
            if isinstance(lat, (tuple, list)):
                lat = float(lat[0])
            else:
                lat = float(lat)

            if isinstance(lon, (tuple, list)):
                lon = float(lon[0])
            else:
                lon = float(lon)

            # Convert BGR (OpenCV) to RGB (PIL)
            rgb_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
            pil_image = PILImage.fromarray(rgb_image)

            # Create EXIF data
            exif = Exif()

            # GPS IFD (0x8825)
            gps_ifd = {}

            # GPS latitude
            lat_ref = "N" if lat >= 0 else "S"
            lat_abs = abs(lat)
            lat_deg = int(lat_abs)
            lat_min = (lat_abs - lat_deg) * 60
            lat_min_int = int(lat_min)
            lat_sec = (lat_min - lat_min_int) * 60

            gps_ifd[0x0001] = lat_ref.encode('utf-8')  # GPSLatitudeRef
            gps_ifd[0x0002] = (
                (lat_deg, 1),
                (lat_min_int, 1),
                (int(lat_sec * 100), 100)
            )  # GPSLatitude

            # GPS longitude
            lon_ref = "E" if lon >= 0 else "W"
            lon_abs = abs(lon)
            lon_deg = int(lon_abs)
            lon_min = (lon_abs - lon_deg) * 60
            lon_min_int = int(lon_min)
            lon_sec = (lon_min - lon_min_int) * 60

            gps_ifd[0x0003] = lon_ref.encode('utf-8')  # GPSLongitudeRef
            gps_ifd[0x0004] = (
                (lon_deg, 1),
                (lon_min_int, 1),
                (int(lon_sec * 100), 100)
            )  # GPSLongitude

            # Set GPS IFD
            exif[0x8825] = gps_ifd

            # Save with EXIF
            pil_image.save(filepath, "jpeg", exif=exif, quality=95)
            rospy.logdebug(f"Saved {filepath} with GPS EXIF: ({lat:.6f}, {lon:.6f})")

        except Exception as e:
            rospy.logwarn(f"Failed to save EXIF: {e} (lat type: {type(lat)}, lon type: {type(lon)}), saving without metadata")
            cv2.imwrite(filepath, cv_image)

    def _timeout_check(self, event):
        """Check if data reception has timed out"""
        if self.last_data_time is None:
            return

        time_since_last = rospy.get_time() - self.last_data_time
        if time_since_last > self.timeout and not self.shutdown_event:
            rospy.loginfo(f"No data for {self.timeout}s - bag playback finished, shutting down...")
            self.shutdown_event = True
            rospy.signal_shutdown("Bag playback complete, generating SIP4D-ZIP")

    def image_callback(self, msg):
        """Process incoming image"""
        try:
            # Update last data time
            self.last_data_time = rospy.get_time()

            # Get timestamp first
            timestamp_sec = msg.header.stamp.secs
            timestamp_nsec = msg.header.stamp.nsecs
            stamp_key = f"{timestamp_sec}.{timestamp_nsec}"
            frame_id = msg.header.seq

            # Convert timestamp to ISO8601 (needed for EXIF)
            iso_timestamp = datetime.fromtimestamp(
                timestamp_sec + timestamp_nsec / 1e9,
                tz=timezone.utc
            ).isoformat(timespec='milliseconds').replace('+00:00', '+09:00')

            # Get GPS data first to check if we should sample this image
            if stamp_key in self.gps_data:
                gps = self.gps_data[stamp_key]
                lat, lon = float(gps['lat']), float(gps['lon'])
            else:
                # Use nearest GPS data. Frames recorded before the first fix
                # have no position, so drop them instead of placing them at a
                # fallback coordinate.
                nearest = self._get_nearest_gps(timestamp_sec)
                if nearest is None:
                    rospy.logdebug(
                        f"Skipping frame {frame_id}: no GPS fix available yet"
                    )
                    return
                lat, lon = float(nearest[0]), float(nearest[1])

            # Calculate heading from odometry (if available)
            heading = self._get_heading_at_time(timestamp_sec, timestamp_nsec)

            # Check sampling thresholds: distance OR heading
            distance = self._calculate_gps_distance(lat, lon)
            heading_diff = self._calculate_heading_diff(heading)

            # Check if either distance or heading exceeded threshold
            distance_exceeded = (self.last_gps_position is not None and
                                distance >= self.gps_distance_threshold)
            heading_exceeded = (self.last_heading is not None and
                               heading_diff >= self.heading_threshold)

            if self.last_gps_position is None or self.last_heading is None:
                # First frame, always capture
                pass
            elif not (distance_exceeded or heading_exceeded):
                # Neither distance nor heading threshold exceeded, skip
                return

            # Update last position and heading
            self.last_gps_position = (lat, lon)
            self.last_heading = heading

            # Only now process the image
            cv_image = self.bridge.imgmsg_to_cv2(msg, desired_encoding="bgr8")

            # Create filename with frame number
            filename = f"image_{frame_id:06d}.jpg"
            filepath = os.path.join(self.files_dir, filename)

            # Save image as JPEG (EXIF metadata disabled temporarily due to type issues)
            # TODO: Fix EXIF GPS metadata embedding
            cv2.imwrite(filepath, cv_image)

            # Store image info
            self.images.append({
                'filename': filename,
                'timestamp': iso_timestamp,
                'seq': frame_id,
                'lat': lat,
                'lon': lon,
                'heading': heading,
                'distance': distance
            })

            # Update spatial bounds
            self.min_lat = min(self.min_lat, lat)
            self.max_lat = max(self.max_lat, lat)
            self.min_lon = min(self.min_lon, lon)
            self.max_lon = max(self.max_lon, lon)

            rospy.loginfo(f"Image {frame_id}: {filename} at ({lat:.4f}, {lon:.4f}), "
                         f"distance={distance:.1f}m, heading_diff={heading_diff:.1f}°, heading={heading:.1f}°")

        except Exception as e:
            rospy.logerr(f"Error processing image: {e}")

    def gps_callback(self, msg):
        """Store GPS data with timestamp, ignoring messages without a fix"""
        # A receiver with no fix still publishes, reporting NaN or (0, 0).
        # Those reach the GeoJSON as real points and wreck the spatial bounds
        # the same way a hardcoded fallback would, so drop them here.
        lat, lon = msg.latitude, msg.longitude
        if math.isnan(lat) or math.isnan(lon):
            return
        if lat == 0.0 and lon == 0.0:
            return

        stamp_key = f"{msg.header.stamp.secs}.{msg.header.stamp.nsecs}"
        self.gps_data[stamp_key] = {
            'lat': lat,
            'lon': lon,
            'alt': msg.altitude
        }

    def odom_callback(self, msg):
        """Store odometry data for heading calculation"""
        stamp = msg.header.stamp.secs + msg.header.stamp.nsecs / 1e9

        # Extract heading from quaternion
        qx = msg.pose.pose.orientation.x
        qy = msg.pose.pose.orientation.y
        qz = msg.pose.pose.orientation.z
        qw = msg.pose.pose.orientation.w

        # Convert quaternion to yaw (heading)
        siny_cosp = 2 * (qw * qz + qx * qy)
        cosy_cosp = 1 - 2 * (qy * qy + qz * qz)
        yaw = math.atan2(siny_cosp, cosy_cosp)

        # Convert to degrees (0-360), where 0 is North
        heading = math.degrees(yaw) + 90
        heading = heading % 360

        self.odom_data[stamp] = {
            'heading': heading,
            'x': msg.pose.pose.position.x,
            'y': msg.pose.pose.position.y
        }

    def _get_nearest_gps(self, timestamp_sec):
        """Get nearest GPS data to timestamp, or None when there is no fix.

        Never invent a coordinate here. A made-up position is indistinguishable
        from a real one downstream, and a single bogus point stretches the
        spatial bounds far enough to collapse every real marker into one pixel
        when a viewer fits the map to the data.
        """
        if not self.gps_data:
            return None

        # Convert GPS timestamp strings to float for comparison
        gps_times = [(float(k), k) for k in self.gps_data.keys()]
        if not gps_times:
            return None

        # Find nearest timestamp (considering both seconds and nanoseconds)
        nearest_key = min(gps_times, key=lambda t: abs(t[0] - timestamp_sec))[1]

        gps = self.gps_data[nearest_key]
        return gps['lat'], gps['lon']

    def _get_heading_at_time(self, timestamp_sec, timestamp_nsec):
        """Get heading from nearest odometry data"""
        stamp = timestamp_sec + timestamp_nsec / 1e9

        if not self.odom_data:
            # Return dummy heading based on sequence number
            return (len(self.images) * 10) % 360

        # Find nearest timestamp
        odom_times = list(self.odom_data.keys())
        if not odom_times:
            return (len(self.images) * 10) % 360

        nearest_time = min(odom_times, key=lambda t: abs(t - stamp))
        return self.odom_data[nearest_time]['heading']

    def create_geojson(self):
        """Create GeoJSON with image locations and headings"""
        features = []

        for img_info in self.images:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [img_info['lon'], img_info['lat']]
                },
                "properties": {
                    "filename": img_info['filename'],
                    "heading": float(img_info['heading']),
                    "timestamp": img_info['timestamp']
                }
            }
            features.append(feature)

        return {
            "type": "FeatureCollection",
            "features": features
        }

    def create_schema(self):
        """Create schema.json in SIP4D-ZIP v2 format with backward compatibility"""
        # Build elements array (v2 format)
        elements = [
                {
                    "propertyInformation": {
                        "name": "filename",
                        "label": "ファイル名",
                        "unit": ""
                    },
                    "show": True,
                    "necessary": False,
                    "description": "Image filename",
                    "dataType": "String"
                },
                {
                    "propertyInformation": {
                        "name": "heading",
                        "label": "撮影方向",
                        "unit": "度"
                    },
                    "show": True,
                    "necessary": False,
                    "description": "Camera heading angle (0=North, 90=East, 180=South, 270=West)",
                    "dataType": "Float"
                },
                {
                    "propertyInformation": {
                        "name": "timestamp",
                        "label": "撮影時刻",
                        "unit": ""
                    },
                    "show": True,
                    "necessary": False,
                    "description": "Image timestamp (ISO8601)",
                    "dataType": "Datetime"
                },
                {
                    "propertyInformation": {
                        "name": "_attachedFiles",
                        "label": "添付ファイル",
                        "unit": ""
                    },
                    "show": True,
                    "necessary": False,
                    "description": "",
                    "dataType": "Array",
                    "elements": [
                        {
                            "propertyInformation": {
                                "name": "filename",
                                "label": "ファイル名",
                                "unit": ""
                            },
                            "show": False,
                            "necessary": True,
                            "description": "",
                            "dataType": "String"
                        },
                        {
                            "propertyInformation": {
                                "name": "filetype",
                                "label": "ファイルタイプ",
                                "unit": ""
                            },
                            "show": False,
                            "necessary": True,
                            "description": "",
                            "dataType": "String"
                        }
                    ]
                }
            ]

        # Build legacy columns array for backward compatibility
        columns = [
            {
                "name": "filename",
                "jname": "ファイル名",
                "connid": "filename",
                "show": True,
                "description": "Image filename",
                "type": "String"
            },
            {
                "name": "heading",
                "jname": "撮影方向",
                "connid": "heading",
                "show": True,
                "description": "Camera heading angle (0=North, 90=East, 180=South, 270=West)",
                "type": "Double"
            },
            {
                "name": "timestamp",
                "jname": "撮影時刻",
                "connid": "timestamp",
                "show": True,
                "description": "Image timestamp (ISO8601)",
                "type": "String"
            }
        ]

        # Return hybrid format: SIP4D-ZIP v2 + legacy compatibility
        return {
            # SIP4D-ZIP v2 format
            "informationTypeCode": "universal",
            "schemaVersion": "1.0",
            "geometryType": "Point",
            "elements": elements,
            # Legacy format for backward compatibility
            "version": "1",
            "code": "99-999-99",
            "num_column": 3,
            "columns": columns
        }

    def create_metadata(self):
        """Create sip4d_zip_meta.json"""
        now = datetime.now(tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')
        end = self.images[-1]['timestamp'] if self.images else now

        return {
            "version": "1",
            "title": "ドローン斜め写真画像",
            "updated": now,
            "information_date": datetime.fromisoformat(end).strftime('%Y-%m-%dT%H:%M:%S'),
            "code": "99-999-99",
            "category": "その他",
            "format": "SIP4D-ZIP",
            "author": {
                "name": "sip4d_ros",
                "e-mail": "info@example.jp"
            },
            "maintainer": {
                "name": "sip4d_ros",
                "e-mail": "info@example.jp"
            },
            "disaster": {
                "name": "-"
            },
            "openflg": "一般公開可能",
            "ttid": str(uuid.uuid4()),
            "lgcode": None,
            "license_id": "cc-zero",
            "tags": ["drone", "aerial", "oblique", "camera"],
            "testflg": "試験",
            "crs": "4326",
            "character": "UTF-8",
            "note": "",
            "entry_num": 1,
            "entry": [{
                "type": "GeoJSON",
                "title": "Camera Images",
                "file": "features.geojson",
                "updated": now,
                "bbox": [self.min_lon, self.min_lat, self.max_lon, self.max_lat]
            }]
        }

    def create_zip(self):
        """Create SIP4D-ZIP file"""
        if not self.images:
            rospy.logwarn("No images captured")
            return False

        try:
            rospy.loginfo(f"Creating SIP4D-ZIP with {len(self.images)} images...")

            # Create GeoJSON
            geojson = self.create_geojson()
            geojson_path = os.path.join(self.work_dir, "features.geojson")
            with open(geojson_path, 'w', encoding='utf-8') as f:
                json.dump(geojson, f, ensure_ascii=False, indent=2)

            # Create schema
            schema = self.create_schema()
            schema_path = os.path.join(self.work_dir, "features_columns.json")
            with open(schema_path, 'w', encoding='utf-8') as f:
                json.dump(schema, f, ensure_ascii=False, indent=2)

            # Create metadata
            metadata = self.create_metadata()
            metadata_path = os.path.join(self.work_dir, "sip4d_zip_meta.json")
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            # Create ZIP
            zip_filename = f"drone_images_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
            zip_path = os.path.join(self.output_dir, zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.write(metadata_path, arcname="sip4d_zip_meta.json")
                zf.write(geojson_path, arcname="features.geojson")
                zf.write(schema_path, arcname="features_columns.json")

                for img_file in sorted(os.listdir(self.files_dir)):
                    img_path = os.path.join(self.files_dir, img_file)
                    zf.write(img_path, arcname=f"files/{img_file}")

            rospy.loginfo(f"✓ Created: {zip_path}")
            rospy.loginfo(f"✓ Total images: {len(self.images)}")
            return True

        except Exception as e:
            rospy.logerr(f"Error creating ZIP: {e}")
            return False

    def cleanup(self):
        """Clean up work directory"""
        if os.path.exists(self.work_dir):
            shutil.rmtree(self.work_dir)

def main():
    rospy.init_node('bag2sip4d_converter', anonymous=True)

    output_dir = rospy.get_param('~output_dir', '/tmp/sip4d_output')
    gps_distance_threshold = rospy.get_param('~gps_distance_threshold', 20.0)
    heading_threshold = rospy.get_param('~heading_threshold', 20.0)
    timeout = rospy.get_param('~timeout', 5.0)

    converter = Bag2SIP4DConverter(output_dir, gps_distance_threshold, heading_threshold, timeout)

    try:
        rospy.spin()
    except KeyboardInterrupt:
        rospy.loginfo("Shutting down (Ctrl+C)...")
    except rospy.ROSInterruptException:
        pass
    finally:
        rospy.loginfo(f"Creating SIP4D-ZIP with {len(converter.images)} sampled images...")
        if converter.images:
            if converter.create_zip():
                rospy.loginfo("✓ SIP4D-ZIP creation succeeded")
            else:
                rospy.loginfo("✗ SIP4D-ZIP creation failed")
        else:
            rospy.logwarn("✗ No images captured")
        converter.cleanup()

if __name__ == '__main__':
    main()
