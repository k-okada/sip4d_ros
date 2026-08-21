/**
 * メインアプリケーション初期化
 */

document.addEventListener('DOMContentLoaded', () => {
    // ファイルアップロード処理
    const uploadBtn = document.getElementById('uploadBtn');
    const zipUpload = document.getElementById('zipUpload');
    const dataInfo = document.getElementById('dataInfo');

    uploadBtn.addEventListener('click', () => {
        zipUpload.click();
    });

    zipUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'ロード中...';

            // ZIP ファイルをロード
            const result = await window.dataLoader.loadZipFile(file);

            // データ情報を表示
            const info = window.dataLoader.getMetadataInfo();
            dataInfo.innerHTML = info || '<p style="color: #999;">メタデータなし</p>';

            // マップにマーカーを追加
            window.mapManager.addFeaturesAsMarkers(window.dataLoader.features);

            uploadBtn.disabled = false;
            uploadBtn.textContent = 'ZIP ファイルをアップロード';

            console.log('ロード完了:', result);
        } catch (error) {
            console.error('エラー:', error);
            dataInfo.innerHTML = `<p style="color: #e74c3c;">エラー: ${error.message}</p>`;
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'ZIP ファイルをアップロード';
        }
    });

    // 画像プレビュー閉じるボタン
    const closePreview = document.getElementById('closePreview');
    const imagePreview = document.getElementById('imagePreview');

    closePreview.addEventListener('click', () => {
        imagePreview.style.display = 'none';
    });

    // Esc キーでプレビューを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            imagePreview.style.display = 'none';
        }
    });

    console.log('SIP4D-ZIP ビューア起動完了');
});
