## Fortnite Island Ranking Dashboard

Firebase Hosting + Functions で動作する、Fortnite Data API を用いた島ランキング・ダッシュボードの最小実装です。日本語/英語切替対応。

### セットアップ

1) Firebase CLI をインストールし、ログインしてください。

```bash
npm i -g firebase-tools
firebase login
```

2) 依存関係のインストール。

```bash
# フロント
cd web && npm i && cd ..
# Functions
cd functions && npm i && cd ..
```

3) モックで起動（外部API未接続でも動作確認可能）。

```bash
cd functions && cp .env.example .env && cd ..
# Vite の開発サーバ（/api を Functions エミュレータにプロキシ）
cd web && VITE_FIREBASE_PROJECT_ID=your-firebase-project-id npm run dev
# 別ターミナルで Functions/Hosting エミュレータ
firebase emulators:start
```

4) 本番APIに切替する場合は、`functions/.env` で `USE_MOCK=0` に変更し、必要に応じて `FORTNITE_API_BASE` を調整してください。Swagger は `https://api.fortnite.com/ecosystem/v1/docs` を参照。
   - フロントで Functions エンドポイントに合わせるため `web/.env` に `VITE_FIREBASE_PROJECT_ID=your-firebase-project-id` を設定可能。

### デプロイ

```bash
# ビルド
cd web && npm run build && cd ..

# デプロイ
firebase deploy
```

### 構成

- `web/`: Vite + React + TS。i18n（react-i18next）、SWR、簡易チャート（Recharts）
- `functions/`: Firebase Functions v2 + Express。/api 配下で Fortnite API をプロキシ。10分TTLキャッシュ。`USE_MOCK=1` でモックJSONを返却。
- `firebase.json`: Hosting と Functions のルーティング

### 仕様メモ

- ランキングは HypeScore（0–100）でソート。標準化 + 重み付け（0.30, 0.25, 0.20, 0.15, 0.10）
- 時間窓: 10m/1h/24h。TTL は 10m を基準に設定
- 週次/通知などは将来拡張


