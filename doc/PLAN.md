# Fortnite Island Ranking Dashboard v2 実装計画

## 1. 目的

本計画は [SPEC2.md](./SPEC2.md) を、現行コードベースの構造に沿って実装可能なタスクへ分解したものである。対象は UI/UX 改善のための設計と段階実装であり、認証、通知本実装、7日超の履歴保存は含めない。

## 2. 前提

### 2.1 維持する前提

- フロントエンドは `web/` 配下の React + Vite + SWR + React Router を継続利用する
- バックエンドは `functions/` 配下の Firebase Functions + Express を継続利用する
- データ一次ソースは Fortnite Data API を継続利用する
- AI リサーチは廃止せず、定量情報の補助へ再配置する

### 2.2 現行コードから見た制約

- `web/src/pages/Home.tsx` は `/api/islands` を直接呼び、画面状態を URL に保持していない
- `web/src/pages/IslandDetail.tsx` は AI リサーチのみを表示し、既存の `/api/islands/:code/metrics` を使っていない
- `web/src/pages/Compare.tsx` は未実装で、比較状態の保持機構もない
- `functions/src/index.ts` に API ロジックが集中しているため、v2 実装前に責務分割が必要
- スタイルは `web/src/styles.css` が中心で、Tailwind 風クラスと通常 CSS が混在している

### 2.3 計画上の基本方針

1. API 正規化と画面状態管理を先に整える
2. ホームを先に刷新し、一覧の判断力を上げる
3. 次に詳細を定量データ中心へ移す
4. 比較と Watchlist は基盤が整ってから追加する
5. HypeScore は Phase 0 で計算基盤を実装し、Phase 1 以降で UI に段階反映する

## 3. 実装フェーズ

### Phase 0: 基盤整備

#### ゴール

- v2 で使う API 契約、状態管理、スコア計算基盤を先に固定する
- 以降の UI 実装が `functions/src/index.ts` の肥大化や URL 不整合に引きずられない状態を作る

#### バックエンドタスク

- P0-01: 既存 API の返却形式を棚卸しし、v2 で使う共通レスポンス型を定義する
  - 対象候補: `DashboardResponse`, `RankedIslandSummary`, `IslandOverviewResponse`, `CompareResponse`
- P0-02: `functions/src/index.ts` からデータ取得・整形ロジックを切り出す
  - 追加候補: `functions/src/lib/fortnite.ts`, `functions/src/lib/metrics.ts`, `functions/src/lib/hypeScore.ts`, `functions/src/lib/dashboard.ts`
- P0-03: HypeScore 計算関数を実装する
  - 欠損値の重み再配分
  - window 単位の正規化
  - 内訳表示用の component breakdown を返せるようにする
- P0-04: スナップショット値と差分値の計算ユーティリティを作る
  - latest value
  - previous window delta
  - 24h delta
  - missing / empty series の正規化
- P0-05: `/api/top-islands` を v2 用の基盤 API として拡張する
  - `metrics.uniquePlayers` だけでなく、必要 KPI と deltas を段階的に返せるようにする
  - `/api/dashboard` の内部データソースとして再利用できる形に寄せる
- P0-06: dashboard 系キャッシュキーを整理する
  - `window`, `sort`, `tags`, `creator`, `query`, `view` を含む
  - 部分成功時の degraded flag も返却できるようにする

#### フロントエンドタスク

- P0-07: URL クエリを単一状態ソースにするための helper / hook を追加する
  - `window`
  - `tab`
  - `sort`
  - `query`
  - `tags`
  - `creator`
  - `view`
- P0-08: localStorage helper を追加する
  - compare list
  - watchlist
  - recently viewed islands
- P0-09: API client を v2 用に整理する
  - `fetchDashboard`
  - `fetchIslandOverview`
  - `fetchCompare`
  - 既存 `fetchIslandMetrics`, `fetchIslandResearch` との役割分離
- P0-10: 共通 UI 状態コンポーネントを追加する
  - loading skeleton
  - error state
  - empty state
  - toast / live region
- P0-11: スタイリング方針を整理する
  - Tailwind 風クラスに依存しない形へ寄せる
  - `styles.css` にレイアウトトークン、カード、テーブル、モバイル用ルールを追加する

#### テストタスク

- P0-12: Functions の unit test を追加する
  - HypeScore
  - delta 計算
  - empty series
  - partial failure fallback
- P0-13: URL state / localStorage helper の unit test を追加する

#### Phase 0 完了条件

- dashboard / overview / compare に必要な型と helper が揃っている
- HypeScore 計算がサーバー側で再利用可能
- URL クエリと localStorage の責務が整理されている

### Phase 1: ホームダッシュボード

#### ゴール

- ホームで「Top」「Rising」「なぜ注目か」が分かる状態にする
- 一覧を単なるリンク集から判断用画面へ変える

#### バックエンドタスク

- P1-01: `GET /api/dashboard` を追加する
  - ranking
  - rising
  - highRetention
  - highRecommend
  - updatedAt
  - degraded / partial metadata
- P1-02: dashboard warm 処理を追加または `warmTopIslands` を拡張する
- P1-03: タグ / クリエイター / ソート条件でフィルタできるようデータ整形を拡張する

#### フロントエンドタスク

- P1-04: `Home` を `/api/dashboard` ベースに置き換える
- P1-05: フィルタバーを実装する
  - 期間切替
  - 検索
  - ソート
  - タグ
  - クリエイター
  - Reset
- P1-06: 検索デバウンスと 2 文字未満ガイドを実装する
- P1-07: `Top` / `Rising` タブを実装する
- P1-08: サマリーカード群を実装する
  - Top Islands
  - Rising Now
  - Most Retained
  - Most Recommended
- P1-09: ランキング表示を table / cards へ分離する
  - desktop: table を既定
  - mobile: cards を既定
- P1-10: ランキング行に操作導線を追加する
  - 詳細
  - 比較に追加
  - Watchlist 追加
  - コードコピー
- P1-11: 空状態とエラー状態を原因別に出し分ける
- P1-12: 更新時刻、データ取得元、期間説明を常時表示する

#### ファイル単位の主な作業対象

- `web/src/pages/Home.tsx`
- `web/src/components/RankingTable.tsx`
- `web/src/components/` 配下の新規 Home 用コンポーネント
- `web/src/lib/api.ts`
- `web/src/lib/types.ts`
- `web/src/styles.css`
- `functions/src/index.ts` または分割後の `functions/src/lib/*`

#### テストタスク

- P1-13: Home の主要 UI state を E2E で検証する
  - URL 反映
  - デバウンス
  - タブ切替
  - 空状態
  - コピー成功表示

#### Phase 1 完了条件

- ユーザーがホームだけで Top と Rising を区別できる
- 検索、フィルタ、ソート状態が URL に保存される
- モバイルでランキングが情報欠落なく読める

### Phase 2: 詳細ページ再設計

#### ゴール

- 詳細ページを AI 要約中心から KPI / チャート中心へ移す
- 共有 URL と最近見た島の導線を追加する

#### バックエンドタスク

- P2-01: `GET /api/islands/:code/overview` を追加する
  - basic
  - tags
  - kpis
  - deltas
  - related
  - researchStatus
- P2-02: `overview` で必要なメトリクス集約処理を実装する
- P2-03: related islands の抽出ロジックを追加する
  - same tag
  - same creator
  - similar top islands

#### フロントエンドタスク

- P2-04: `IslandDetail` の初回データソースを `fetchIslandOverview` に切り替える
- P2-05: ヒーロー領域を再構成する
  - title
  - code
  - creator
  - tags
  - compare / watchlist / share actions
- P2-06: KPI サマリーカードを追加する
- P2-07: 変化サマリーを追加する
  - latest delta
  - 24h delta
  - surge badge
- P2-08: メトリクスチャートを追加する
  - 1 指標表示
  - 最大 2 指標重ね表示
  - window 再切替
- P2-09: AI リサーチ領域を詳細下部へ再配置する
  - 「参考情報」明記
  - updatedAt 表示
- P2-10: recently viewed を保存し、ホームの補助エリアと連携する
- P2-11: share URL に `window` を含めてコピーする

#### ファイル単位の主な作業対象

- `web/src/pages/IslandDetail.tsx`
- `web/src/components/` 配下の KPI card / chart / tag list / related list
- `web/src/lib/api.ts`
- `web/src/lib/types.ts`
- `functions/src/index.ts` または分割後の `functions/src/lib/*`

#### テストタスク

- P2-12: 詳細 E2E を拡張する
  - KPI が AI より先に出る
  - チャート描画
  - share URL
  - related islands

#### Phase 2 完了条件

- 詳細ページの主役が KPI とチャートになっている
- AI リサーチなしでも主要判断ができる
- 共有 URL から同じ window 状態が復元される

### Phase 3: Compare / Watchlist

#### ゴール

- 比較と追跡を日常操作として成立させる
- ホームと詳細に閉じない再訪導線を用意する

#### バックエンドタスク

- P3-01: `GET /api/compare` を追加する
  - 2〜4 codes を受け取る
  - summary / metric series / normalized scores を返す
- P3-02: compare 向けの HypeScore breakdown と metric normalization を返す

#### フロントエンドタスク

- P3-03: compare state を URL + localStorage の二重保持で実装する
- P3-04: ホーム / 詳細 / Watchlist から compare 追加導線を実装する
- P3-05: `Compare` ページを実装する
  - selection summary
  - KPI comparison table
  - line chart
  - radar chart
  - score breakdown
- P3-06: 2 島未満時の empty guidance を実装する
- P3-07: Watchlist UI を実装する
  - add / remove
  - 上限 30 件
  - reverse chronological
- P3-08: ホーム上に Watchlist 入口と recently viewed を配置する

#### ファイル単位の主な作業対象

- `web/src/pages/Compare.tsx`
- `web/src/components/` 配下の compare / watchlist / action buttons
- `web/src/lib/api.ts`
- `web/src/lib/types.ts`
- `web/src/router.tsx`
- `functions/src/index.ts` または分割後の `functions/src/lib/*`

#### テストタスク

- P3-09: Compare / Watchlist の E2E を追加する
  - compare persistence
  - watchlist persistence
  - compare from home/detail

#### Phase 3 完了条件

- 2〜4 島で安定して比較できる
- Watchlist が再訪時にも残る
- compare URL を共有できる

### Phase 4: 仕上げと運用準備

#### ゴール

- v2 を継続利用しやすい品質へ引き上げる
- 計測とアクセシビリティを含めて運用可能な状態にする

#### タスク

- P4-01: i18n 文言を全画面で見直す
  - `Search`, `Top Islands` などの未翻訳解消
  - HypeScore β 説明
  - AI リサーチの補助表現
- P4-02: live region と keyboard navigation を整備する
- P4-03: コピー成功、エラー、更新成功の通知をスクリーンリーダー対応にする
- P4-04: 計測イベントを定義し、送信ポイントを実装する
- P4-05: cache TTL と warm 対象を実測で調整する
- P4-06: README と画面仕様の更新を行う
- P4-07: 回帰 E2E と Functions unit test を増強する

#### Phase 4 完了条件

- 主要導線に未翻訳文言が残っていない
- WCAG AA 相当の基本要件を満たす
- 主要イベントが計測できる

## 4. ワークストリーム別タスク一覧

### 4.1 API / データ整形

- W1-01: Fortnite API のレスポンスを snapshot / series / delta に正規化する
- W1-02: dashboard / overview / compare で共通利用する island summary builder を作る
- W1-03: HypeScore と breakdown を共通利用できるようにする
- W1-04: partial failure 時も配列構造を壊さないようにする
- W1-05: scheduler warm の対象を `top-islands` から `dashboard` 系へ広げる

### 4.2 フロント状態管理

- W2-01: URL query parser / serializer を追加する
- W2-02: compare / watchlist / recent の localStorage schema を固定する
- W2-03: SWR key 設計を統一する
- W2-04: optimistic UI を使わず、まずは整合性優先で更新する

### 4.3 UI コンポーネント

- W3-01: Home summary cards
- W3-02: Filter bar
- W3-03: Ranking table
- W3-04: Ranking cards
- W3-05: KPI cards
- W3-06: Metrics chart
- W3-07: Compare charts
- W3-08: Empty / error / toast components

### 4.4 品質保証

- W4-01: Functions unit test を endpoint 単位ではなく utility 単位で厚くする
- W4-02: Playwright はホーム、詳細、比較、watchlist の 4 導線を優先する
- W4-03: モバイル viewport の回帰を追加する

## 5. 依存関係

1. HypeScore 計算と API 正規化が終わるまで、ホームの最終 UI は固定しない
2. URL state helper ができるまで、Home / Detail / Compare の state 実装は開始しない
3. `overview` API ができるまで、詳細ページの KPI と related islands は着手しない
4. compare state と `GET /api/compare` が揃うまで、Compare UI は仮実装に留める
5. Watchlist は compare state と同じ localStorage 基盤の上に載せる

## 6. 実装順の推奨

1. Phase 0 を完了させる
2. Phase 1 の Home を先に出す
3. Phase 2 の Detail を出す
4. Phase 3 の Compare / Watchlist を出す
5. Phase 4 で polish と計測を入れる

この順番にする理由は、最も大きい UX 改善がホームと詳細に集中しており、Compare と Watchlist はその基盤が安定してから追加した方が手戻りが少ないためである。

## 7. リスクと対策

### R1. Fortnite API のレート制限

- 対策: dashboard 系は warm 対象にし、overview / compare はキャッシュと部分成功を前提にする

### R2. HypeScore の納得感不足

- 対策: β 表記、算出内訳、欠損時の扱いを UI 上で明示する

### R3. `functions/src/index.ts` の肥大化

- 対策: v2 着手前に helper module へ分割する

### R4. モバイルでの情報過多

- 対策: mobile first では cards と filter drawer を優先し、table は desktop 主体にする

## 8. Definition of Done

- [SPEC2.md](./SPEC2.md) の Phase 0 から Phase 4 までの要件が、順序付きの実装単位として追える
- ホーム、詳細、比較、watchlist の各導線に対応する API / UI / state / test タスクが明記されている
- 現行コードベースでどのファイル群に変更が入るかを見積もれる
- `SPEC2.md` とフェーズ順、比較条件、API 役割が矛盾していない
