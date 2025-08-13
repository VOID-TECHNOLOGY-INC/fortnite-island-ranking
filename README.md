## Fortnite Island Ranking Dashboard

Firebase Hosting + Functions で動作する、Fortnite Island ランキング/詳細ビューアです。日本語/英語対応。

- ランキング（一覧）は Fortnite Ecosystem Data API を使用
- 各島の詳細（Island Status/概要/特徴/話題）は Perplexity AI による自動リサーチ結果を表示

参考: Swagger `https://api.fortnite.com/ecosystem/v1/docs/`

### セットアップ（ローカル）

1) Firebase CLI をインストールし、ログイン

```bash
npm i -g firebase-tools
firebase login
```

2) 依存関係インストール

```bash
# Frontend
cd web && npm i && cd ..
# Functions
cd functions && npm i && cd ..
```

3) 環境変数（Functions/.env）

```
# Fortniteモック利用: 1 でモック、0 で本番API
USE_MOCK=0

# Perplexity API（詳細ページの自動リサーチで使用）
PERPLEXITY_API_KEY=your_api_key
# 任意（利用可能なモデルID。未設定時は候補を順次フォールバック）
PERPLEXITY_MODEL=pplx-70b-online
```

4) 開発用起動（例）

```bash
# Hosting/Functions エミュレータ
firebase emulators:start

# 別ターミナルでフロント（Vite）
cd web
npm run dev
```

### デプロイ

```bash
# フロントのみ変更時（Hostingのみ）
npm run build --prefix web
firebase deploy --only hosting

# Functions のみ変更時（APIのみ）
npm run build --prefix functions
firebase deploy --only functions:api

# まとめて
firebase deploy
```

注意: Functions（第2世代）はビルド/コンテナ化/レジストリ反映/ローリング更新のため更新に時間を要します。未使用依存の削減や対象デプロイ（--only）で短縮可能です。

### ディレクトリ構成

- `web/`: Vite + React + TypeScript
  - i18n（react-i18next）/ SWR / marked + DOMPurify（Markdown表示）
  - UI: 3カラム（Island/ID/Creator）、IDコピー、バナー、favicon、言語ドロップダウン、ローディングスピナー
- `functions/`: Firebase Functions v2 + Express
  - Fortnite API プロキシ、Perplexity API 連携、簡易メモリキャッシュ
- `scripts/`, `doc/`, `e2e/` など

### フロントの使い方/仕様

- 検索プレースホルダは「Search」
- 期間ラベルは「期間/Period」、選択肢は 10m / 1h / 24h
- ランキング表は以下の3列
  - Island（島名。クリックで詳細へ）
  - ID（島コード。右にコピーアイコン）
  - Creator（制作者）
- 詳細ページ
  - 左上に戻る矢印アイコン
  - 「Auto research powered by Perplexity」注記
  - リサーチ中はスピナー付き Loading を表示

### API（Functions, /api 配下）

- GET `/api/islands`
  - クエリ: `window` 10m|1h|24h（デフォルト10m）, `query`（部分一致。2文字未満は上流検索に渡さず通常一覧）, `sort`（既定 hype）
  - レスポンス: `[{ code, name, creator, metrics? }]`
  - エラーハンドリング: 上流 400/404/422/429 は空配列を返却（UIで500にしない）

- GET `/api/top-islands`
  - 上位島を包括クロールし `uniquePlayers` でソート
  - Cloud Scheduler により10分おきにキャッシュ事前温め

- GET `/api/islands/:code/research?name=&lang=`
  - Perplexity API 経由でリサーチ。Markdown の固定見出しで返すようプロンプトを制御（Island Status / 状況・概要・特徴・話題、出典/Sources）
  - レスポンス: `{ summary: string, sources: {url,title?}[], updatedAt: string }`

### キャッシュ/スケジューラ

- メモリキャッシュ（`globalCache`）
  - 10m/1h/24h に応じたTTL
- スケジュール（`warmTopIslands`）
  - 10分おきに `/api/top-islands` を更新

### テスト

- Unit（Functions）: Vitest

```bash
cd functions
npm run test
```

- E2E（Web）: Playwright

```bash
npm run test:e2e
```

### 注意事項

- Fortnite API のメトリクスは `series/data/points/intervals` のいずれかで返るため汎用的に解釈
- Perplexity のモデルIDはプランにより利用可否が異なるため、`PERPLEXITY_MODEL` 未設定時は複数候補でフォールバック

