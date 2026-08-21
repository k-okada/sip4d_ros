let mapManager = null;
let dataLoader = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize components
    mapManager = new MapManager('map');
    dataLoader = new DataLoader();

    // Initialize map
    mapManager.initializeMap();

    // Setup event listeners
    setupEventListeners();

    // Load sample data if available
    loadSampleData();
});

function setupEventListeners() {
    // Upload button
    const uploadBtn = document.getElementById('uploadBtn');
    const zipUpload = document.getElementById('zipUpload');

    uploadBtn.addEventListener('click', () => {
        zipUpload.click();
    });

    zipUpload.addEventListener('change', handleZipUpload);

    // Sidebar resizer
    setupSidebarResizer();
}

function setupSidebarResizer() {
    const resizer = document.getElementById('sidebarResizer');
    const sidebar = document.querySelector('.sidebar');
    const panelData = document.getElementById('panelData');
    const panelDetail = document.getElementById('panelDetail');

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        const startY = e.clientY;
        const startDataHeight = panelData.offsetHeight;

        const handleMouseMove = (e) => {
            if (!isResizing) return;

            const delta = e.clientY - startY;
            const newDataHeight = Math.max(120, Math.min(startDataHeight + delta, sidebar.offsetHeight - 220));

            panelData.style.maxHeight = newDataHeight + 'px';
        };

        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
}

async function handleZipUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const zipFile = files[0];
    const uploadBtn = document.getElementById('uploadBtn');
    const dataInfo = document.getElementById('dataInfo');

    try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'ロード中...';

        // Load ZIP file
        const result = await dataLoader.loadFromZip(zipFile);

        // Clear existing markers
        mapManager.clearMarkers();

        // Add new markers
        if (result.geojsonData) {
            mapManager.addMarkersFromGeoJSON(result.geojsonData, dataLoader);
        }

        // Display metadata and image list
        let metadataHtml = `<strong>✅ データを読み込みました</strong>`;

        if (dataLoader.zipFilename) {
            metadataHtml += `<p><strong>ファイル:</strong> ${dataLoader.zipFilename}</p>`;
        }

        const featureCount = result.geojsonData?.features?.length || 0;
        metadataHtml += `<p><strong>フィーチャー数:</strong> ${featureCount}</p>`;

        if (result.metadata) {
            metadataHtml += dataLoader.formatMetadata();
        }

        // Add feature list
        if (featureCount > 0) {
            metadataHtml += `<h3 style="margin-top: 15px; font-size: 14px;">📸 画像リスト</h3>`;
            metadataHtml += `<div class="feature-list" style="max-height: 200px; overflow-y: auto;">`;

            result.geojsonData.features.forEach((feature, index) => {
                const filename = feature.properties?.filename || `画像 ${index + 1}`;
                const heading = feature.properties?.heading || 0;
                let directionText = '不明';
                if (heading >= 315 || heading < 45) directionText = '北';
                else if (heading >= 45 && heading < 135) directionText = '東';
                else if (heading >= 135 && heading < 225) directionText = '南';
                else if (heading >= 225 && heading < 315) directionText = '西';

                metadataHtml += `
                    <div class="feature-list-item" onclick="mapManager.markers[${index}] && mapManager.markers[${index}].fireEvent('click')">
                        <div style="cursor: pointer; padding: 8px; background: #f9f9f9; border-radius: 4px; margin-bottom: 4px; border-left: 3px solid var(--primary-color);">
                            <strong>${filename}</strong>
                            <span style="float: right; font-size: 12px; color: #666;">${directionText}</span>
                        </div>
                    </div>
                `;
            });

            metadataHtml += `</div>`;
        }

        dataInfo.innerHTML = metadataHtml;

        // Debug info to console
        console.log('=== SIP4D-ZIP ロード完了 ===');
        console.log(`ファイル: ${dataLoader.zipFilename}`);
        console.log(`フィーチャー数: ${featureCount}`);
        console.log(`マーカー数: ${mapManager.markers.length}`);
        console.log(`画像ディレクトリ: ${result.imageDirectory}`);
        console.log('Features:', result.geojsonData.features);

        uploadBtn.textContent = 'ZIP ファイルをアップロード';
        uploadBtn.disabled = false;

        // Reset file input
        event.target.value = '';
    } catch (error) {
        console.error('Upload error:', error);
        dataInfo.innerHTML = `<strong style="color: red;">❌ エラー:</strong> ${error.message}`;
        uploadBtn.textContent = 'ZIP ファイルをアップロード';
        uploadBtn.disabled = false;
    }
}

async function loadSampleData() {
    // Check if sample data exists locally
    try {
        const response = await fetch('data/sample.geojson');
        if (response.ok) {
            const geojsonData = await response.json();

            // ダミー画像を生成（小さな画像をBase64で作成）
            const dummyImageBlob = await generateDummyImage();
            const dummyImageUrl = URL.createObjectURL(dummyImageBlob);

            // dataLoaderにダミー画像を追加
            if (!dataLoader.imageMap) dataLoader.imageMap = new Map();
            dataLoader.imageMap.set('data/sample_image.jpg', dummyImageUrl);

            mapManager.addMarkersFromGeoJSON(geojsonData, dataLoader);

            const dataInfo = document.getElementById('dataInfo');
            dataInfo.innerHTML = `
                <strong>✅ サンプルデータを読み込みました</strong>
                <p><strong>フィーチャー数:</strong> ${geojsonData.features?.length || 0}</p>
                <h3 style="margin-top: 15px; font-size: 14px;">📸 画像リスト</h3>
                <div class="feature-list">
                    <div class="feature-list-item" onclick="mapManager.markers[0] && mapManager.markers[0].fireEvent('click')">
                        <div style="cursor: pointer; padding: 8px; background: #f9f9f9; border-radius: 4px; margin-bottom: 4px; border-left: 3px solid var(--primary-color);">
                            <strong>sample_image.jpg</strong>
                            <span style="float: right; font-size: 12px; color: #666;">東</span>
                        </div>
                    </div>
                </div>
            `;

            console.log('=== サンプルデータ読み込み完了 ===');
            console.log('フィーチャー数: 1');
            console.log('マーカー数:', mapManager.markers.length);
        }
    } catch (error) {
        console.log('サンプルデータは利用できません:', error.message);
    }
}

/**
 * ダミー画像を生成（グラデーション付き）
 */
async function generateDummyImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;

    const ctx = canvas.getContext('2d');

    // グラデーション背景
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1e40af');
    gradient.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // テキスト
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SIP4D-ZIP Sample', canvas.width / 2, canvas.height / 2 - 40);

    ctx.font = '24px Arial';
    ctx.fillText('東京 / 35.7°N 139.7°E', canvas.width / 2, canvas.height / 2 + 40);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}
