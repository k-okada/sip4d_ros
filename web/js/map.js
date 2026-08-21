/**
 * Google Maps 統合
 */

class MapManager {
    constructor() {
        this.map = null;
        this.markers = [];
        this.infoWindows = [];
        this.selectedMarker = null;
        this.init();
    }

    /**
     * マップを初期化
     */
    init() {
        const defaultCenter = { lat: 35.6762, lng: 139.6503 }; // 東京

        this.map = new google.maps.Map(document.getElementById('map'), {
            zoom: 13,
            center: defaultCenter,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: true,
            zoomControl: true
        });

        // マップクリック時に情報窓を閉じる
        this.map.addListener('click', () => this.closeAllInfoWindows());
    }

    /**
     * GeoJSON 地物からマーカーを追加
     */
    addFeaturesAsMarkers(features) {
        this.clearMarkers();

        features.forEach((feature, index) => {
            const coords = feature.geometry.coordinates;
            const position = { lat: coords[1], lng: coords[0] };
            const props = feature.properties || {};

            // マーカーを作成
            const marker = new google.maps.Marker({
                position: position,
                map: this.map,
                title: props.filename || `地物 ${index}`,
                icon: this.getMarkerIcon(props.heading)
            });

            // マーカークリック時の処理
            marker.addListener('click', () => this.onMarkerClick(marker, feature));

            // マウスオーバー時に情報を表示
            marker.addListener('mouseover', () => {
                this.showInfoWindow(marker, feature);
            });

            this.markers.push(marker);
        });

        // マップをすべてのマーカーに合わせてズーム
        this.fitBounds();
    }

    /**
     * マーカーアイコンを取得（向き情報を使用）
     */
    getMarkerIcon(heading) {
        // 向きに基づいて異なる色を使用
        const color = this.getColorByHeading(heading);

        return {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: color,
            fillOpacity: 0.8,
            strokeColor: '#fff',
            strokeWeight: 2
        };
    }

    /**
     * 向きに基づいて色を決定
     */
    getColorByHeading(heading) {
        if (!heading) return '#667eea'; // デフォルト紫

        heading = heading % 360;

        if (heading < 45 || heading >= 315) return '#e74c3c'; // 北 - 赤
        if (heading < 135) return '#f39c12'; // 東 - オレンジ
        if (heading < 225) return '#27ae60'; // 南 - 緑
        return '#3498db'; // 西 - 青
    }

    /**
     * マーカークリック時の処理
     */
    onMarkerClick(marker, feature) {
        this.selectedMarker = marker;
        this.showDetailInfo(feature);
    }

    /**
     * 情報窓を表示（マウスオーバー用）
     */
    showInfoWindow(marker, feature) {
        this.closeAllInfoWindows();

        const props = feature.properties || {};
        const content = `
            <div style="padding: 10px; max-width: 250px;">
                <h4 style="margin: 0 0 8px 0; color: #667eea;">${props.filename || '無題'}</h4>
                <p style="margin: 4px 0; font-size: 12px;">
                    <strong>時刻:</strong> ${props.timestamp || 'N/A'}<br>
                    <strong>方向:</strong> ${props.heading ? props.heading.toFixed(1) + '°' : 'N/A'}<br>
                    <strong>座標:</strong> ${feature.geometry.coordinates[1].toFixed(4)}, ${feature.geometry.coordinates[0].toFixed(4)}
                </p>
            </div>
        `;

        const infoWindow = new google.maps.InfoWindow({ content });
        infoWindow.open(this.map, marker);
        this.infoWindows.push(infoWindow);
    }

    /**
     * 詳細情報を表示（サイドバーに）
     */
    showDetailInfo(feature) {
        const props = feature.properties || {};
        const coords = feature.geometry.coordinates;

        let htmlContent = '';

        // 基本情報
        if (props.filename) {
            htmlContent += `<div class="property">
                <div class="property-name">ファイル名</div>
                <div class="property-value">${props.filename}</div>
            </div>`;
        }

        if (props.timestamp) {
            htmlContent += `<div class="property">
                <div class="property-name">撮影時刻</div>
                <div class="property-value">${props.timestamp}</div>
            </div>`;
        }

        if (props.heading) {
            htmlContent += `<div class="property">
                <div class="property-name">撮影方向</div>
                <div class="property-value">${props.heading.toFixed(1)}°</div>
            </div>`;
        }

        // 座標
        htmlContent += `<div class="property">
            <div class="property-name">座標</div>
            <div class="property-value">
                緯度: ${coords[1].toFixed(6)}<br>
                経度: ${coords[0].toFixed(6)}
            </div>
        </div>`;

        // 画像プレビュー
        const imageUrl = window.dataLoader.getImageUrl(feature);
        if (imageUrl) {
            htmlContent += `<div class="property">
                <div class="property-name">画像</div>
                <div class="property-value">
                    <img src="${imageUrl}" style="width: 100%; border-radius: 4px; cursor: pointer; margin-top: 8px;"
                         onclick="document.getElementById('previewImage').src=this.src; document.getElementById('imagePreview').style.display='block';">
                </div>
            </div>`;
        }

        document.getElementById('featureInfo').innerHTML = htmlContent;
    }

    /**
     * すべての情報窓を閉じる
     */
    closeAllInfoWindows() {
        this.infoWindows.forEach(iw => iw.close());
        this.infoWindows = [];
    }

    /**
     * マーカーをすべて削除
     */
    clearMarkers() {
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
        this.closeAllInfoWindows();
    }

    /**
     * マップをすべてのマーカーに合わせてズーム
     */
    fitBounds() {
        if (this.markers.length === 0) return;

        const bounds = new google.maps.LatLngBounds();
        this.markers.forEach(marker => {
            bounds.extend(marker.getPosition());
        });

        this.map.fitBounds(bounds, { padding: 50 });
    }
}

// グローバルオブジェクトとして公開
window.mapManager = new MapManager();
