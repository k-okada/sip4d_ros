# SIP4D-ZIP ビューア

防災画像データを Google Maps 上で可視化する Web ベースのビューアです。

## セットアップ

### 1. Google Maps API キーの取得

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. Maps JavaScript API を有効化
4. API キーを生成

### 2. API キーの設定

`index.html` の以下の行を修正してください：

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY"></script>
```

`YOUR_API_KEY` をあなたの Google Maps API キーに置き換えます。

### 3. ローカルサーバーの起動

```bash
# Python 3 の場合
python -m http.server 8000

# または Python 2 の場合
python -m SimpleHTTPServer 8000
```

ブラウザで `http://localhost:8000` にアクセスします。

## 使用方法

### ファイルのアップロード

1. 「ZIP ファイルをアップロード」ボタンをクリック
2. SIP4D-ZIP ファイルを選択
3. データが地図上に表示されます

### マーカーの操作

- **マウスオーバー**: 画像情報が表示されます
- **クリック**: サイドバーに詳細情報が表示されます
- **画像クリック**: 大きなプレビューが表示されます

### 地図の操作

- **ズーム**: マウスホイール
- **パン**: ドラッグ
- **全体表示**: マーカーが自動的にズームされます

## ファイル構成

```
web/
├── index.html           # メインページ
├── README.md            # このファイル
├── css/
│   └── style.css        # スタイルシート
└── js/
    ├── main.js          # メインアプリケーション
    ├── data-loader.js   # ZIP データローダー
    └── map.js           # Google Maps 統合
```

## 機能

### データローディング
- SIP4D-ZIP v2 形式のファイル対応
- メタデータとメディアファイルの自動抽出
- GeoJSON 地物のパース

### 可視化
- GPS 座標によるマーカー配置
- 方向情報に基づく色分け表示
- インタラクティブなマーカー
- 画像プレビュー機能

### 地物データ表示
- タイムスタンプ
- GPS 座標（緯度・経度）
- カメラの撮影方向
- 添付画像

## トラブルシューティング

### ZIP ファイルが読み込めない

- ファイルが SIP4D-ZIP v2 形式であることを確認してください
- ブラウザコンソールでエラーメッセージを確認してください

### マップが表示されない

- Google Maps API キーが正しく設定されているか確認
- API キーが Maps JavaScript API に対応していることを確認
- ブラウザコンソールのエラーメッセージを確認

### 画像が表示されない

- ZIP ファイルに `images/files/` ディレクトリが含まれているか確認
- メタデータの `_attachedFiles` フィールドが正しく設定されているか確認

## ライセンス

本ツールは SIP4D-ZIP v2 を処理します。
