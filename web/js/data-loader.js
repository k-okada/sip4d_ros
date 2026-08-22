class DataLoader {
    constructor() {
        this.geojsonData = null;
        this.metadata = null;
        this.imageDirectory = null;
        this.zipFilename = null;
        this.imageMap = new Map();
        this.zipInstance = null;
    }

    async loadFromZip(zipFile) {
        try {
            // NOTE: This requires JSZip library to be loaded
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip ライブラリが読み込まれていません');
            }

            // ファイル名を保存
            this.zipFilename = zipFile.name;

            const zip = new JSZip();
            const zipData = await JSZip.external.Promise.resolve(zipFile).then(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(file);
                });
            });

            await zip.loadAsync(zipData);

            // メタデータを読み込む
            const metaFile = zip.file('sip4d_zip_meta.json');
            if (metaFile) {
                const metaText = await metaFile.async('text');
                this.metadata = JSON.parse(metaText);
            }

            // GeoJSON を読み込む（images/features.geojson または他の .geojson ファイル）
            let geojsonText = null;

            // まず images/features.geojson を探す
            let geoFile = zip.file('images/features.geojson');
            if (geoFile) {
                geojsonText = await geoFile.async('text');
            } else {
                // 他の .geojson ファイルを探す
                const geojsonFiles = Object.keys(zip.files).filter(name =>
                    name.endsWith('.geojson')
                );
                if (geojsonFiles.length > 0) {
                    geojsonText = await zip.file(geojsonFiles[0]).async('text');
                }
            }

            if (geojsonText) {
                this.geojsonData = JSON.parse(geojsonText);
            } else {
                console.warn('GeoJSON ファイルが見つかりません');
                this.geojsonData = { type: 'FeatureCollection', features: [] };
            }

            // 画像ディレクトリを特定
            const imageDirs = new Set();
            Object.keys(zip.files).forEach(name => {
                if (/\.(jpg|jpeg|png)$/i.test(name)) {
                    const dir = name.substring(0, name.lastIndexOf('/'));
                    if (dir) imageDirs.add(dir);
                }
            });

            this.imageDirectory = imageDirs.size > 0 ? Array.from(imageDirs)[0] : null;
            this.zipInstance = zip;

            return {
                metadata: this.metadata,
                geojsonData: this.geojsonData,
                imageDirectory: this.imageDirectory
            };
        } catch (error) {
            console.error('ZIP ファイルの読み込みに失敗しました:', error);
            throw error;
        }
    }

    async getImageUrl(imagePath) {
        if (!this.zipInstance) {
            throw new Error('ZIP ファイルが読み込まれていません');
        }

        try {
            const file = this.zipInstance.file(imagePath);
            if (!file) {
                return null;
            }

            const blob = await file.async('blob');
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error(`画像の読み込みに失敗しました: ${imagePath}`, error);
            return null;
        }
    }

    getFeatureImage(feature) {
        if (!feature.properties) {
            return null;
        }

        // ファイル名プロパティから画像を取得
        const filename = feature.properties.filename;
        if (!filename) {
            return null;
        }

        // imageDirectory がない場合（サンプルデータ）
        if (!this.imageDirectory) {
            return `data/${filename}`;
        }

        return `${this.imageDirectory}/${filename}`;
    }

    formatMetadata() {
        if (!this.metadata) return '';

        const {
            code = '-',
            title = '-',
            creator = '-',
            informationDate = '-',
            flag = '試験',
            disaster = '-',
            payloadType = '-'
        } = this.metadata;

        return `
            <p><strong>コード:</strong> ${code}</p>
            <p><strong>タイトル:</strong> ${title}</p>
            <p><strong>著作者:</strong> ${creator}</p>
            <p><strong>情報日時:</strong> ${informationDate}</p>
            <p><strong>ペイロード:</strong> ${payloadType}</p>
            <p><strong>フラグ:</strong> ${flag}</p>
        `;
    }
}
