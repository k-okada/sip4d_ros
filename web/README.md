# SIP4D-ZIP ビューア

防災画像データ（SIP4D-ZIP形式）をブラウザで可視化するWebサービスです。

## 機能

- **地図上での画像位置表示**: GeoJSONデータから抽出した画像位置をマーカーで表示
- **撮影方向の可視化**: マーカーの色で撮影方向（方位角）を表示
  - 🔴 赤：北（0°）
  - 🟠 オレンジ：東（90°）
  - 🔵 青：南（180°）
  - 🟢 緑：西（270°）
- **写真プレビュー**: マーカークリックで写真を画面右側に表示
- **メタデータ表示**: コード、タイトル、著作者などの情報を左パネルに表示
- **ZIP形式データの直接読み込み**: ブラウザ側で ZIP を解凍して使用

## セットアップ

### 必要なファイル構造

```
web/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── data-loader.js
│   └── map-leaflet.js
├── data/
│   └── sample.geojson (optional)
└── README.md
```

### インストール

1. **ローカルサーバーで実行** (Python):
```bash
cd web
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開く

2. **または別のウェブサーバーで実行**:
   - Node.js: `npx http-server`
   - Ruby: `ruby -run -ehttpd . -p8000`

## 使い方

### 1. ZIP ファイルをアップロード

- 「ZIP ファイルをアップロード」ボタンをクリック
- SIP4D-ZIP形式のZIPファイルを選択
- ブラウザが自動的に解凍してデータを読み込みます

### 2. マップで画像を確認

- マップ上のマーカーをクリック
- 左パネルに詳細情報（座標、時刻、方向）が表示
- 右パネルに画像が表示されます

### 3. マップの操作

- **ズーム**: スクロールホイール、または +/- ボタン
- **パン**: マウスドラッグ
- **レイヤー切り替え**: 右上のレイヤーコントロール（地図/衛星画像）

## 必要なライブラリ

本アプリケーションは CDN から以下のライブラリを読み込みます：

- **Leaflet.js**: オープンソース地図ライブラリ
- **JSZip**: ブラウザ側での ZIP 操作ライブラリ
- **OpenStreetMap / Esri**: 地図タイルデータ

すべてインターネット接続時に CDN から自動読み込みされます。

## SIP4D-ZIP形式について

本ビューアが対応している形式：

```
sip4d-zip.zip
├── sip4d_zip_meta.json       # メタデータ
├── schema.json               # スキーマ定義
├── images/
│   ├── features.geojson      # 画像位置情報
│   └── [images].jpg          # 実際の画像ファイル
```

## トラブルシューティング

### 画像が表示されない場合

- ZIP内の画像フォルダ構造を確認
- ファイル名が properties.filename と一致しているか確認
- ブラウザの開発者ツール（F12）でコンソールエラーを確認

### 地図が表示されない場合

- インターネット接続を確認
- ブラウザキャッシュをクリア（Ctrl+Shift+Delete）
- 別のブラウザで試す

### ZIP読み込みエラーが出る場合

- ファイルが正しい SIP4D-ZIP 形式か確認
- ブラウザのコンソール（F12）でエラーメッセージを確認
- ファイルサイズが大きい場合は少し待つ

## 開発者向け

### カスタマイズ

#### マーカーの色を変更
`js/map-leaflet.js` の `getColorByHeading()` 関数を編集

#### 地図デフォルト位置を変更
`js/map-leaflet.js` の `initializeMap()` で `defaultCenter` を変更

#### メタデータ表示項目を追加
`js/data-loader.js` の `formatMetadata()` 関数を編集

#### スタイルを変更
`css/style.css` を編集

## ライセンス

このプロジェクトは SIP4D-ROS パッケージの一部です。

## 関連リンク

- [SIP4D-ZIP仕様](https://github.com/MIERUNE/sip4d-zip-spec)
- [Leaflet.js](https://leafletjs.com/)
- [OpenStreetMap](https://www.openstreetmap.org/)
