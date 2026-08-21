/**
 * SIP4D-ZIP データロード機能
 */

class DataLoader {
    constructor() {
        this.data = null;
        this.metadata = null;
        this.features = [];
        this.imageMap = new Map();
    }

    /**
     * ZIP ファイルからデータを抽出
     */
    async loadZipFile(file) {
        try {
            // JSZip ライブラリを動的にロード
            if (typeof JSZip === 'undefined') {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
            }

            const zip = new JSZip();
            const zipData = await zip.loadAsync(file);

            // メタデータロード
            const metaFile = zipData.file('sip4d_zip_meta.json');
            if (metaFile) {
                const metaContent = await metaFile.async('string');
                this.metadata = JSON.parse(metaContent);
                console.log('メタデータ:', this.metadata);
            }

            // GeoJSON ロード
            const geoJsonFile = zipData.file('images/features.geojson');
            if (geoJsonFile) {
                const geoJsonContent = await geoJsonFile.async('string');
                const geoJson = JSON.parse(geoJsonContent);
                this.features = geoJson.features || [];
                console.log('地物:', this.features.length);
            }

            // 画像ファイルをマップに登録
            zipData.folder('images/files').forEach((relativePath, file) => {
                if (relativePath.match(/\.(jpg|jpeg|png|gif)$/i)) {
                    file.async('blob').then(blob => {
                        const url = URL.createObjectURL(blob);
                        this.imageMap.set(relativePath, url);
                    });
                }
            });

            return {
                metadata: this.metadata,
                features: this.features,
                imageCount: this.imageMap.size
            };

        } catch (error) {
            console.error('ZIP ファイル読み込みエラー:', error);
            throw error;
        }
    }

    /**
     * 外部スクリプトをロード
     */
    loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 地物の画像 URL を取得
     */
    getImageUrl(feature) {
        if (!feature.properties || !feature.properties._attachedFiles) {
            return null;
        }

        const attachedFiles = Array.isArray(feature.properties._attachedFiles)
            ? feature.properties._attachedFiles
            : [feature.properties._attachedFiles];

        if (attachedFiles.length > 0) {
            const filename = attachedFiles[0].filename;
            return this.imageMap.get(`images/files/${filename}`) ||
                   this.imageMap.get(filename);
        }

        return null;
    }

    /**
     * メタデータ情報を取得
     */
    getMetadataInfo() {
        if (!this.metadata) return '';

        const info = [
            `タイトル: ${this.metadata.title || 'N/A'}`,
            `バージョン: ${this.metadata.version || 'N/A'}`,
            `地物数: ${this.features.length}`,
            `更新日時: ${this.metadata.updated || 'N/A'}`
        ];

        return info.join('<br>');
    }
}

// グローバルオブジェクトとして公開
window.dataLoader = new DataLoader();
