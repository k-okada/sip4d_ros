class MapManager {
    constructor(mapElementId) {
        this.mapElement = document.getElementById(mapElementId);
        this.map = null;
        this.markers = [];
        this.geojsonData = null;
        this.dataLoader = null;
        this.selectedMarker = null;
        this.infoWindows = [];
    }

    initializeMap() {
        // デフォルト位置（日本）
        const defaultCenter = { lat: 36.2048, lng: 138.2529 };

        this.map = new google.maps.Map(this.mapElement, {
            zoom: 10,
            center: defaultCenter,
            mapTypeId: 'satellite',
            fullscreenControl: true,
            zoomControl: true,
            mapTypeControl: true,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: false
        });
    }

    addMarkersFromGeoJSON(geojsonData, dataLoader) {
        this.geojsonData = geojsonData;
        this.dataLoader = dataLoader;

        if (!geojsonData || !geojsonData.features) {
            console.warn('有効な GeoJSON データがありません');
            return;
        }

        const bounds = new google.maps.LatLngBounds();

        geojsonData.features.forEach((feature, index) => {
            if (feature.geometry.type === 'Point') {
                const [lng, lat] = feature.geometry.coordinates;
                const position = { lat, lng };

                bounds.extend(position);

                const marker = new google.maps.Marker({
                    position,
                    map: this.map,
                    title: feature.properties?.filename || `マーカー ${index + 1}`,
                    icon: this.getMarkerIcon(feature),
                    optimized: false
                });

                marker.featureData = feature;
                marker.featureIndex = index;

                marker.addListener('click', () => {
                    this.selectMarker(marker);
                });

                marker.addListener('mouseover', () => {
                    this.showPreview(marker);
                });

                this.markers.push(marker);
            }
        });

        // すべてのマーカーが見えるように地図をズーム
        if (this.markers.length > 0) {
            this.map.fitBounds(bounds, 50);
        }

        // フィーチャーリストを表示
        this.displayFeatureList();
    }

    selectMarker(marker) {
        // 前のマーカーを非選択
        if (this.selectedMarker) {
            this.selectedMarker.setAnimation(null);
        }

        this.selectedMarker = marker;
        marker.setAnimation(google.maps.Animation.BOUNCE);

        // 詳細情報を表示
        this.showFeatureDetails(marker.featureData);

        // 地図をマーカーにパン
        this.map.panTo(marker.getPosition());
    }

    getMarkerIcon(feature) {
        // 方位角によって色分け
        const heading = feature.properties?.heading || 0;
        let color = 'FF0000'; // デフォルト赤

        if (heading >= 315 || heading < 45) color = 'FF0000'; // 北 - 赤
        else if (heading >= 45 && heading < 135) color = 'FFAA00'; // 東 - オレンジ
        else if (heading >= 135 && heading < 225) color = '0066FF'; // 南 - 青
        else if (heading >= 225 && heading < 315) color = '00AA00'; // 西 - 緑

        return {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: `#${color}`,
            fillOpacity: 0.8,
            strokeColor: '#fff',
            strokeWeight: 2
        };
    }

    showFeatureDetails(feature) {
        const featureInfoDiv = document.getElementById('featureInfo');
        let html = `<h3>${feature.properties?.filename || 'Information'}</h3>`;

        if (feature.properties) {
            html += `
                <div class="feature-property">
                    <div class="property-label">座標</div>
                    <div class="property-value">
                        ${feature.geometry.coordinates[1].toFixed(6)}, 
                        ${feature.geometry.coordinates[0].toFixed(6)}
                    </div>
                </div>
            `;

            if (feature.properties.heading !== undefined) {
                html += `
                    <div class="feature-property">
                        <div class="property-label">撮影方向</div>
                        <div class="property-value">${feature.properties.heading.toFixed(1)}°</div>
                    </div>
                `;
            }

            if (feature.properties.timestamp) {
                html += `
                    <div class="feature-property">
                        <div class="property-label">撮影時刻</div>
                        <div class="property-value">${feature.properties.timestamp}</div>
                    </div>
                `;
            }
        }

        featureInfoDiv.innerHTML = html;

        // 画像をプレビュー表示
        if (this.dataLoader) {
            const imagePath = this.dataLoader.getFeatureImage(feature);
            if (imagePath) {
                this.loadImagePreview(imagePath);
            }
        }
    }

    async loadImagePreview(imagePath) {
        try {
            const imageUrl = await this.dataLoader.getImageUrl(imagePath);
            if (imageUrl) {
                const preview = document.getElementById('imagePreview');
                const img = document.getElementById('previewImage');
                img.src = imageUrl;
                preview.style.display = 'block';
            }
        } catch (error) {
            console.error('画像の読み込みに失敗しました:', error);
        }
    }

    showPreview(marker) {
        // マウスオーバー時の簡易プレビュー（オプション）
        const title = marker.getTitle();
        marker.setTitle(`${title} (クリックで詳細表示)`);
    }

    clearMarkers() {
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
        this.infoWindows.forEach(iw => iw.close());
        this.infoWindows = [];
    }

    fitBounds() {
        if (this.markers.length === 0) return;

        const bounds = new google.maps.LatLngBounds();
        this.markers.forEach(marker => bounds.extend(marker.getPosition()));
        this.map.fitBounds(bounds);
    }

    displayFeatureList() {
        const listContainer = document.getElementById('featureList');
        if (!listContainer) {
            // フィーチャーリスト用のコンテナを作成
            const newContainer = document.createElement('div');
            newContainer.id = 'featureList';
            newContainer.className = 'feature-list-container';
            document.querySelector('.sidebar').appendChild(newContainer);
            this.displayFeatureList(); // 再帰呼び出し
            return;
        }

        let html = '<h3>📍 GPS 画像位置</h3>';
        html += '<div class="feature-list">';

        if (!this.geojsonData || this.geojsonData.features.length === 0) {
            html += '<p style="color: #999;">フィーチャーがありません</p>';
        } else {
            this.geojsonData.features.forEach((feature, index) => {
                const filename = feature.properties?.filename || `画像 ${index + 1}`;
                const timestamp = feature.properties?.timestamp || '-';
                const [lng, lat] = feature.geometry.coordinates;
                const heading = feature.properties?.heading || 0;

                // 方向のテキスト表現
                let directionText = '不明';
                if (heading >= 315 || heading < 45) directionText = '北';
                else if (heading >= 45 && heading < 135) directionText = '東';
                else if (heading >= 135 && heading < 225) directionText = '南';
                else if (heading >= 225 && heading < 315) directionText = '西';

                html += `
                    <div class="feature-list-item" data-index="${index}" onclick="mapManager.selectMarker(mapManager.markers[${index}])">
                        <div class="feature-list-item-header">
                            <strong>${filename}</strong>
                            <span class="direction-badge">${directionText}</span>
                        </div>
                        <div class="feature-list-item-meta">
                            <div>📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
                            <div>🕐 ${timestamp}</div>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        listContainer.innerHTML = html;
    }
}
