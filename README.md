## Fortnite Island Ranking Dashboard

Firebase Hosting + Functions で動作する、Fortnite Island 向けの発見・比較・追跡ダッシュボードです。フロントエンドは `web/`、API は `functions/` にあります。

### v2 の主な機能

- ホームダッシュボード
  - `Top` / `Rising` / `Watchlist`
  - 期間、検索、ソート、タグ、クリエイターの URL 同期
  - 比較追加、Watchlist 追加、コードコピー
- 島詳細
  - KPI カード
  - 時系列チャート
  - Related Islands
  - AI リサーチを補助情報として下部表示
- 比較
  - 2〜4 島の URL 共有可能な比較
  - KPI テーブル
  - トレンドチャート
  - レーダーチャート
- 継続利用
  - compare draft
  - watchlist
  - recent searches
  - recently viewed islands

### 技術構成

- `web/`
  - React + Vite + TypeScript
  - React Router
  - SWR
  - Recharts
  - Vitest + React Testing Library
- `functions/`
  - Firebase Functions + Express
  - Fortnite Data API 連携
  - Perplexity API 連携
  - Vitest
- `e2e/`
  - Playwright

### ディレクトリ

- `web/`: ダッシュボード UI
- `functions/`: API とデータ整形
- `e2e/`: E2E テスト
- `doc/`: 仕様と実装計画

### セットアップ

1. 依存関係をインストール

```bash
npm install --prefix web
npm install --prefix functions
npm install
```

2. `functions/.env` を作成

```bash
# Fortnite モック利用: 1 でモック、0 で本番 API
USE_MOCK=0

# AI リサーチ
PERPLEXITY_API_KEY=your_api_key
# 任意
PERPLEXITY_MODEL=pplx-70b-online
```

### ローカル開発

API を単体で動かす場合:

```bash
npm --prefix functions run dev
```

モック API を使う場合:

```bash
npm --prefix functions run dev:mock
```

フロントを動かす場合:

```bash
npm --prefix web run dev
```

E2E 用フロント:

```bash
npm --prefix web run dev:e2e
```

Firebase Emulator を使う場合:

```bash
firebase emulators:start
```

### API

- `GET /api/dashboard`
  - `window`, `sort`, `tags`, `creator`
  - ranking / rising / highRetention / highRecommend / facets / degraded
- `GET /api/islands`
  - `window`, `query`, `limit`
  - 自由入力検索
- `GET /api/islands/:code/overview`
  - `window`
  - island / kpis / deltas / hypeScore / related / series / researchStatus
- `GET /api/compare`
  - `window`, `codes`
  - islands / normalized scores / metric series
- `GET /api/islands/:code/metrics`
  - 互換用途の metric series
- `GET /api/islands/:code/research`
  - AI リサーチ本文と出典

### テスト

Functions unit test:

```bash
npm test --prefix functions
```

Web unit test:

```bash
npm test --prefix web
```

Build:

```bash
npm run build --prefix functions
npm run build --prefix web
```

E2E:

```bash
npm run test:e2e
```

Firebase / deployed smoke E2E:

```bash
npm run test:e2e:smoke
npm run test:e2e:firebase
```

### デプロイ

Hosting のみ:

```bash
npm run build --prefix web
firebase deploy --only hosting
```

Functions のみ:

```bash
npm run build --prefix functions
firebase deploy --only functions:api
```

まとめて:

```bash
firebase deploy
```

### 補足

- dashboard 系は `window` 単位でキャッシュし、検索は `/api/islands` に分離しています。
- compare / watchlist / recent state は `localStorage` に保持します。
- `npm run test:e2e` は mock fixture 前提の回帰 E2E、`npm run test:e2e:firebase` は Firebase 上の live data に追従する smoke E2E です。
