これからFortniteの公式/サードパーティの「Fortnite Data API」の実態と利用手順を素早く確認し、キー取得方法や主要エンドポイント、React/TypeScriptからの実装例までまとめます。まずは最新のAPIプロバイダ情報をウェブで確認します。
Ran tool

これからワークスペース内に既存のAPI呼び出しや関連処理があるかを素早く確認します。そのうえで、Fortnite Data APIの概要、エンドポイント、サンプルコード（TypeScript/React）と環境変数の設定方法、CORSやレート制限などの注意点までまとめて提示します。
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool
Ran tool

これから公式ドキュメントで具体的なエンドポイントURL、クエリパラメータ、レート制限やCORSの要件を特定し、最小限のTypeScript実装例をまとめます。
Ran tool

これから公式ドキュメント内の具体的なエンドポイントURLやクエリパラメータ名を特定するために、関連するページを一気に調べます。
Ran tool

### どの「Fortnite Data API」を使いたいかで分かれます
- **Epic公式: Fortnite Data API（島のパフォーマンス指標）**
  - 対象: クリエイター島やEpic制作体験の「プレイ時間・プレイ数・お気に入り・おすすめ・ユニークプレイヤー・ピークCCU・D1/D7リテンション」など
  - 期間/粒度: 最大過去7日、粒度は10分/1時間/24時間
  - 認証: なし（公開API）
  - ドキュメント: [Epic公式ドキュメント（日本語）](https://dev.epicgames.com/documentation/ja-jp/fortnite/using-fortnite-data-api-in-fortnite?utm_source=openai)
- **サードパーティ: Fortnite-API.com / FortniteAPI.io（アイテムショップやコスメ等）**
  - 対象: ニュース、コスメ、ショップ、チャレンジ等（島メトリクスではない）
  - 認証: APIキー要（各サービスで取得）

以下、公式「Fortnite Data API」（島メトリクス）の使い方を簡潔にまとめます。

### 公式 Fortnite Data API（島メトリクス）の基本
- **取得できる主な指標**
  - minutesPlayed, minutesPerPlayer, plays, favorites, recommends, peakCcu, uniquePlayers, retentionD1, retentionD7
- **クエリの窓口**
  - 期間は現在から最大7日遡り
  - 粒度は 10分・1時間・24時間（ドキュメント上のパラメータを指定）
- **対象**
  - 公開されていてゲーム内で見つけられる島のみ
- **レート制限**
  - 公平性のため基本的なレート制限あり（詳細はドキュメント参照）
- **CORS**
  - 原則フロントから直接叩けます（万一ブロック時はプロキシを検討）

### 使い方（最小例）
- 手順
  1) 公式ドキュメントでエンドポイントとクエリパラメータを確認  
  2) `islandCode`（例: 0000-0000-0000）と期間・粒度を決める  
  3) `fetch` でJSONを取得してグラフや表に可視化

- curlの雛形（エンドポイントはドキュメントの実URLで置換）
```bash
curl -s "https://<公式ベースURL>/islands/<ISLAND_CODE>/metrics?metric=plays&bucket=HOUR&start=2025-08-04T00:00:00Z&end=2025-08-11T00:00:00Z"
```

- TypeScript（React/Vite）最小実装例の雛形
```ts
// utils/fortniteDataApi.ts
const BASE_URL = "https://<公式ベースURL>"; // 公式ドキュメントの実URLで置換

export type TimeBucket = "TEN_MINUTE" | "HOUR" | "DAY";
export type Metric =
  | "minutesPlayed" | "minutesPerPlayer" | "plays" | "favorites"
  | "recommends" | "peakCcu" | "uniquePlayers" | "retentionD1" | "retentionD7";

export type SeriesPoint = { timestamp: string; value: number };

export async function fetchIslandMetric(
  islandCode: string,
  metric: Metric,
  bucket: TimeBucket,
  startISO: string,
  endISO: string
): Promise<SeriesPoint[]> {
  const url = new URL(`${BASE_URL}/islands/${encodeURIComponent(islandCode)}/metrics`);
  url.searchParams.set("metric", metric);
  url.searchParams.set("bucket", bucket);
  url.searchParams.set("start", startISO); // ISO 8601 UTC
  url.searchParams.set("end", endISO);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // 公式レスポンス仕様に合わせてここで整形
  return data.series as SeriesPoint[];
}
```

- 呼び出し例
```ts
import { fetchIslandMetric } from "./utils/fortniteDataApi";

const now = new Date();
const endISO = now.toISOString();
const startISO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

const points = await fetchIslandMetric("0000-0000-0000", "plays", "HOUR", startISO, endISO);
```

### よくある注意点
- **時刻はUTC/ISO 8601**で渡す（`toISOString()`を使用）
- **バケット粒度と期間の整合**を取る（例: 7日×HOURはOK、10分粒度はレスポンス量増）
- **404/204**: 島コードが非公開・見つからない場合
- **レート制限**: 429時は指数バックオフでリトライ
- **差異**: クリエイターポータル表示と計算タイミングの違いで値が微差することあり

### Vite/Reactでの実装小ワザ
- 速度最適化: 直近7日の同一クエリは`sessionStorage`やキャッシュキーで短期キャッシュ
- 表示: ラインチャートは`chart.js`や`recharts`が手軽
- 国際化: 既存の`i18n`にキーを追加（例: `metrics.plays` 等）

### サードパーティAPIを使いたい場合（アイテム・ニュースなど）
- 代表例
  - `fortnite-api.com`（無料/キー不要が多い）
  - `fortniteapi.io`（要APIキー）
- 使い分け
  - 島メトリクス＝公式Data API
  - コスメ/ショップ/ニュース＝サードパーティAPI

必要なら、実URLに合わせた`utils/fortniteDataApi.ts`の具体実装（レスポンス型含む）や、`Home/IslandDetail/Compare`ページへの組み込みコードもこちらで用意します。どのAPI（公式島メトリクス or サードパーティ）から始めますか？