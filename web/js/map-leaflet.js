class MapManager {
    constructor(mapElementId) {
        this.mapElement = document.getElementById(mapElementId);
        this.map = null;
        this.markers = [];
        this.geojsonData = null;
        this.dataLoader = null;
        this.selectedMarker = null;
    }

    initializeMap() {
        // デフォルト位置（日本）
        const defaultCenter = [36.2048, 138.2529];

        this.map = L.map(this.mapElement).setView(defaultCenter, 10);

        // タイルレイヤーを追加（OpenStreetMap）
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            maxNativeZoom: 18
        }).addTo(this.map);

        // 衛星画像レイヤーを追加（USGS Satellite）
        const satelliteLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 18,
                maxNativeZoom: 17
            }
        );

        // レイヤーコントロール
        L.control.layers(
            {
                '地図': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap',
                    maxZoom: 19,
                    maxNativeZoom: 18
                }),
                '衛星画像': satelliteLayer
            }
        ).addTo(this.map);

        satelliteLayer.addTo(this.map);
    }

    addMarkersFromGeoJSON(geojsonData, dataLoader) {
        this.geojsonData = geojsonData;
        this.dataLoader = dataLoader;

        if (!geojsonData || !geojsonData.features) {
            console.warn('有効な GeoJSON データがありません');
            return;
        }

        const group = L.featureGroup();

        geojsonData.features.forEach((feature, index) => {
            if (feature.geometry.type === 'Point') {
                const [coord1, coord2] = feature.geometry.coordinates;
                // データが実は[lat, lng]で保存されている可能性があるため、そのまま使う
                const lat = coord1;
                const lng = coord2;
                const heading = feature.properties?.heading || 0;

                // マーカーアイコンを作成
                const color = this.getColorByHeading(heading);
                const icon = L.icon({
                    iconUrl: this.createMarkerSVG(color),
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                    popupAnchor: [0, -16],
                    className: 'custom-marker'
                });

                const marker = L.marker([lat, lng], { icon })
                    .on('click', () => this.selectMarker(marker, feature))
                    .on('mouseover', () => this.onMarkerHover(marker, feature))
                    .on('mouseout', () => this.onMarkerLeave(marker));

                marker.featureData = feature;
                marker.featureIndex = index;

                this.markers.push(marker);
                group.addLayer(marker);
            }
        });

        group.addTo(this.map);

        // すべてのマーカーが見えるように地図をズーム
        if (this.markers.length > 0) {
            this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    }

    selectMarker(marker, feature) {
        // 前のマーカーをリセット
        if (this.selectedMarker) {
            this.selectedMarker.setOpacity(0.8);
        }

        this.selectedMarker = marker;
        marker.setOpacity(1);

        // 詳細情報を表示
        this.showFeatureDetails(feature);

        // 地図をマーカーにパン
        this.map.panTo(marker.getLatLng());
    }

    getColorByHeading(heading) {
        if (heading >= 315 || heading < 45) return '#FF0000'; // 北 - 赤
        else if (heading >= 45 && heading < 135) return '#FFAA00'; // 東 - オレンジ
        else if (heading >= 135 && heading < 225) return '#0066FF'; // 南 - 青
        else if (heading >= 225 && heading < 315) return '#00AA00'; // 西 - 緑
        return '#808080'; // グレー（デフォルト）
    }

    createMarkerSVG(color) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="12" r="6" fill="white" opacity="0.3"/>
        </svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
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
                // 左パネルの詳細情報エリアに画像を表示
                const imageContainer = document.getElementById('featureImageContainer');
                const img = document.getElementById('featureImage');
                img.src = imageUrl;
                imageContainer.style.display = 'block';
            }
        } catch (error) {
            console.error('画像の読み込みに失敗しました:', error);
        }
    }

    clearMarkers() {
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
    }

    fitBounds() {
        if (this.markers.length === 0) return;
        const group = L.featureGroup(this.markers);
        this.map.fitBounds(group.getBounds());
    }

    async onMarkerHover(marker, feature) {
        const filename = feature.properties?.filename || 'Image';

        // マーカー上に画像を表示
        if (this.dataLoader) {
            const imagePath = this.dataLoader.getFeatureImage(feature);
            if (imagePath) {
                try {
                    const imageUrl = await this.dataLoader.getImageUrl(imagePath);
                    if (imageUrl) {
                        // popup コンテンツを作成
                        const popupContent = `
                            <div style="width: 280px; padding: 8px; text-align: center;">
                                <img src="${imageUrl}" style="width: 100%; height: auto; border-radius: 8px; max-height: 300px;">
                                <p style="margin-top: 8px; font-size: 12px; color: #666;">${filename}</p>
                            </div>
                        `;

                        marker.setPopupContent(popupContent);
                        marker.openPopup();
                    }
                } catch (error) {
                    console.error('画像読み込みエラー:', error);
                }
            }
        }
    }

    onMarkerLeave(marker) {
        marker.closePopup();
    }
}
