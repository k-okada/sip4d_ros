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

    // Close preview button
    const closePreview = document.getElementById('closePreview');
    closePreview.addEventListener('click', () => {
        document.getElementById('imagePreview').style.display = 'none';
    });

    // Image preview click to enlarge
    const previewImage = document.getElementById('previewImage');
    previewImage.addEventListener('click', () => {
        window.open(previewImage.src, '_blank');
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

        // Display metadata
        if (result.metadata) {
            dataInfo.innerHTML = `
                <strong>✅ データを読み込みました</strong>
                ${dataLoader.formatMetadata()}
                <p><strong>フィーチャー数:</strong> ${result.geojsonData?.features?.length || 0}</p>
            `;
        } else {
            dataInfo.innerHTML = `
                <strong>✅ データを読み込みました</strong>
                <p><strong>フィーチャー数:</strong> ${result.geojsonData?.features?.length || 0}</p>
            `;
        }

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
            mapManager.addMarkersFromGeoJSON(geojsonData, dataLoader);

            const dataInfo = document.getElementById('dataInfo');
            dataInfo.innerHTML = `
                <strong>✅ サンプルデータを読み込みました</strong>
                <p><strong>フィーチャー数:</strong> ${geojsonData.features?.length || 0}</p>
            `;
        }
    } catch (error) {
        console.log('サンプルデータは利用できません:', error.message);
    }
}
