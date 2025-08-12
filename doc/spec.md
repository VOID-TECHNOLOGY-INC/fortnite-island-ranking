まず要点だけ。

* 対象データ：公式の **Fortnite Data API**（公開・認証不要・過去7日分、10分/1時間/24時間の集計）を利用。取得指標は *Unique Players, Peak CCU, Plays, Minutes Played/Per Player, Favorites, Recommends, Retention D1/D7*。([Epic Games Developers][1], [create.fortnite.com][2])
* 目的：**「今いちばん盛り上がっている島」をリアルタイムに可視化**し、改善や宣伝の意思決定を高速化。クリエイターの収益（Engagement Payout）と直結。([Epic Games Developers][3], [create.fortnite.com][4])
* 主要機能：ランキング（総合/ジャンル別/新着）、急上昇検知、島比較、リテンション監視、アラート、週報自動生成。
* 技術概要：フロント（React/Vue）＋軽量APIサーバ（Node/TS 等）。**APIレート制御＆キャッシュ**（10分粒度に合わせたTTL）。([Epic Games Developers][1])

---

# ミニダッシュボード 仕様書（Fortnite「盛り上がり」特化）

## 1. 背景と目的

* Epicは**島のエンゲージメント指標を公開**し、クリエイターのデータ駆動運用を推進。ダッシュボードで「盛り上がり＝到達/定着/同時接続」を素早く把握し、更新やプロモ判断を最適化する。([create.fortnite.com][2])
* クリエイター収益はエンゲージメント基準の**Engagement Payout**に連動。重要指標の即時可視化は収益機会の最大化に直結。([Epic Games Developers][3], [Epic Games' Fortnite][5])

## 2. 想定ユーザー

* UEFN/クリエイター、パブリッシャー、アナリスト、コミュニティ運営。
* ユースケース：島の改修タイミング判断、宣伝枠配分、成功事例のリバースエンジニアリング、スポンサー報告。

## 3. 主要KPI（APIが返す一次指標）

* **Unique Players, Peak CCU, Plays, Minutes Played, Minutes per Player, Favorites, Recommends, Retention D1/D7**（いずれも**過去7日まで**、**10分/1時間/24時間**の時間窓）。([Epic Games Developers][1], [create.fortnite.com][2])

## 4. 「盛り上がり」指標（合成スコア）

* **HypeScore（0–100）**＝標準化した *UniquePlayers・PeakCCU・MinutesPerPlayer・D1Retention・Recommends* の加重平均

  * 例重み：0.30, 0.25, 0.20, 0.15, 0.10（調整可能）
  * 目的：*到達×同接×滞在×翌日定着×推奨* を一目で比較。
* 10分窓の**前時点比**・**24h移動変化率**も併記（急上昇検知用）。※API更新粒度に合わせる。([Epic Games Developers][1])

## 5. 機能要件

1. **トップ島ランキング**

   * 総合/ジャンル（タグ）/新着で並び替え
   * 並び替えキー：HypeScore, UniquePlayers, PeakCCU, D1/D7
   * 期間：Now-10m / 1h / 24h（直近）＋履歴チャート（最大7日）([Epic Games Developers][1])
2. **急上昇アラート（Surge）**

   * 10分窓でHypeScoreが一定閾値↑、またはUniquePlayers/PeakCCUのσ外上振れで通知（Discord Webhook/Email）。
3. **島詳細ページ**

   * 指標の時系列（10m/1h/24h）・Retentionファネル（D1→D7）・Favorites/ Recommends 推移、リリースマーカー入力欄（手動）
   * *Discover* 連携の参考ルール（例：一部行で**D1が上位10%優先**等）をTips表示。([Epic Games Developers][6])
4. **島比較（最大4件）**

   * 指標のレーダー/ライン比較、HypeScore分解寄与。
5. **週報PDF/CSV**

   * 主要KPI、上位/急上昇島、改善提案（自動コメント）。

## 6. データ取得・API仕様（外部仕様）

* **データ元**：Fortnite Data API（Swagger 公開、認証不要、レート制限あり、**履歴は7日まで**、公開＆ディスカバリー対象の島のみ）([Epic Games Developers][1], [create.fortnite.com][2], [api.fortnite.com][7])
* **代表エンドポイント例**（Swagger 記載の構成に準拠）

  * **一覧**：`GET /islands`（島の基本メタデータ、ページング/検索/タグ）
  * **詳細**：`GET /islands/{code}`（名称・クリエイター等の詳細）
  * **指標**：`GET /islands/{code}/metrics?window=10m|1h|24h&from=ISO8601&to=ISO8601`
  * **制約**：7日より過去は取得不可／一部島でFavorites/Recommends非対応の可能性。([CRAN][8])
    ※実際のパス名・クエリは**Swaggerの定義を優先**。([api.fortnite.com][7])

## 7. 非機能要件

* **遅延**：ユーザー操作→初回描画 1.5s以内（キャッシュ命中時 500ms以内）
* **スループット**：同時100ユーザーで快適
* **可用性**：99.5%/月
* **国際化**：ja/en 切替

## 8. アーキテクチャ

* フロント：React/Next.js（SSG＋ISR）or Vue/Nuxt
* BFF/API：Node.js（Express/Fastify, TS）
* **キャッシュ方針**：

  * エッジ/サーバーキャッシュTTL＝**10分**（10m窓の更新周期に整合）
  * 1h/24h窓はTTL長め（5–15分）。ユーザー手動リフレッシュ有り。([Epic Games Developers][1])
* ストレージ：時系列（ClickHouse/Timescale いずれか）※7日履歴＋派生スコアを保存
* メッセージング：急上昇検知用にキュー（Kafka/Cloud PubSub）
* 認証：閲覧は公開/限定リンク選択。管理画面はSSO。

## 9. ランキング・検知ロジック（擬似式）

* **HypeScore**

  * Z標準化：`z(metric) = (x - μ)/σ`（同一窓/カテゴリ内）
  * `score = 0.30*z(UniquePlayers) + 0.25*z(PeakCCU) + 0.20*z(MinutesPerPlayer) + 0.15*z(RetentionD1) + 0.10*z(Recommends)`
* **急上昇**

  * `Δ10m = score(t) - score(t-10m)` が +1.0 以上、または `UniquePlayers` が rolling 24h 移動平均の +3σ で**Surge**判定。

## 10. 画面設計（主要UI）

* **Home**：

  * 上部：総合トップ20（HypeScore順、窓切替：10m/1h/24h）
  * 中段：急上昇タイル、ジャンル別トップ、Discoverヒント（D1やMinutes/Playerのベンチマーク）([Epic Games Developers][6])
  * 下段：注目の新着（公開後7日未満の島）
* **Island Detail**：KPIカード、時系列、Retentionファネル、Favorites/Recommends、比較追加ボタン
* **Compare**：4島までの重ね描画（ライン/レーダー）

## 11. 運用・アラート

* 監視：API失敗率/遅延、キャッシュヒット率、レート制限到達
* 通知：Discord/Email（HypeScore急騰、Retention急落、データ欠測）

## 12. 品質・制約・法務

* **データは公開島のみ**。非公開・未掲載島は対象外。([Epic Games Developers][1])
* **7日制限**により長期分析は外部保管が前提。([Epic Games Developers][1], [api.fortnite.com][7])
* レート制限を踏まえ、**集約・キャッシュ**で呼び出し最適化（公式がレート制限の存在を明示）。([Epic Games Developers][1])
* Engagement PayoutやCreator Economy 2.0の方針に反しない利用（転用時の表記/出典明記）。([create.fortnite.com][4])

## 13. 開発ロードマップ（例）

* **v0.1**：トップ/詳細の基本KPIと10m窓ランキング
* **v0.2**：HypeScore導入・急上昇検知・比較
* **v0.3**：週報PDF/CSV、通知
* **v0.4**：タグ自動クラスタリング、Discover最適化Tipsの実装（D1/分プレ基準の経験則）([Epic Games Developers][6])

## 14. 参考（一次情報）

* **Fortnite Data API 概要/仕様**（公開・無認証・10m/1h/24h・7日・指標一覧・レート制限あり）([Epic Games Developers][1])
* **公式告知（全クリエイター島まで拡張、2025/6/9）**([create.fortnite.com][2])
* **Swagger UI（エンドポイント定義）**([api.fortnite.com][7])
* **補足（RパッケージのAPIパス例と制約の要約）**※実装確認に有用。([CRAN][8])

---

必要なら、この仕様をそのまま**要件定義→UIワイヤー→TypeScriptのBFF雛形**まで落とし込みます。たとえば Next.js + Fastify + Redis キャッシュでの最小構成、Islandコード検索・メトリクス取得の具体API呼び出しも書けます。どう進めましょう？

[1]: https://dev.epicgames.com/documentation/en-us/fortnite/using-fortnite-data-api-in-fortnite?utm_source=chatgpt.com "Fortnite Data API Overview"
[2]: https://create.fortnite.com/news/fortnite-data-api-unlocks-more-island-insights-for-creators?utm_source=chatgpt.com "Fortnite Data API Unlocks More Island Insights for Creators"
[3]: https://dev.epicgames.com/documentation/en-us/fortnite/engagement-payout-in-fortnite-creative?utm_source=chatgpt.com "Engagement Payout in Fortnite Creative"
[4]: https://create.fortnite.com/news/introducing-the-creator-economy-2-0?utm_source=chatgpt.com "Introducing Creator Economy 2.0"
[5]: https://www.fortnite.com/engagement-program-payout-terms?lang=en-US&utm_source=chatgpt.com "Engagement Program Payout Terms"
[6]: https://dev.epicgames.com/documentation/en-us/fortnite/how-discover-works?utm_source=chatgpt.com "How Discover Works | Fortnite Documentation"
[7]: https://api.fortnite.com/ecosystem/v1/docs?utm_source=chatgpt.com "Swagger UI"
[8]: https://cran.r-project.org/web/packages/fortniteR/readme/README.html?utm_source=chatgpt.com "README - fortniteR"

