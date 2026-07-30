# 海外の反応まとめ — Claude 向けプロジェクトガイド

このリポジトリは「**海外の反応まとめサイト**」です。**MLB・ボクシング・MMA（UFC・RIZIN）**
の海外掲示板（Reddit）や YouTube で盛り上がったスレ・動画を、現地ファンの生のコメントつきで
日本語まとめ（5ch まとめ風＝コメント翻訳中心）にして、英語が読めない日本のファンに届けます。

> 沿革: 元は「MLB データまとめ（指標ランキング）」だったが、2026-06 に「海外の反応まとめ」へ
> 方向転換。旧来の打者/投手/チーム/指標ページとデータは撤去済み。2026-06-13 にカテゴリ
> `ufc` → `mma` へ改名（RIZIN を扱うため。旧 `/ufc` URL は next.config.mjs で 301 転送）。
> 同日、2号店（matome-anime）で実証済みの YouTube 運用（fetch-youtube.mjs ＋
> `format:"youtube"`）を移植。

---

## 1. 技術スタック

| 項目         | 採用                              |
| ------------ | --------------------------------- |
| Framework    | Next.js 15 (App Router)           |
| Language     | TypeScript (strict)               |
| Styling      | Tailwind CSS                      |
| i18n         | next-intl（日本語=デフォルト / 英語） |
| Data Storage | `data/threads/` 配下の静的 JSON   |
| Hosting      | Vercel                            |

データベースは使いません。まとめは JSON として `data/` にコミットし、ビルド時に読み込んで
SSG します。

---

## 2. ディレクトリ構成

```
.
├── CLAUDE.md
├── AGENTS.md                    # 他エージェント向けの薄いポインタ（内容はここに複製しない）
├── README.md
├── .claude/skills/              # matome / jp-games / neta-radar / x-post / x-share / kpi-weekly（各 SKILL.md + references/）
├── data/
│   └── threads/
│       ├── mlb/{id}.json        # MLB のまとめ（1スレ1ファイル）
│       ├── boxing/{id}.json     # ボクシング
│       ├── mma/{id}.json        # MMA（UFC・RIZIN）
│       └── npb/{id}.json        # NEXT MLB（NPB の MLB 注目株）
├── messages/{ja,en}.json        # i18n
├── src/
│   ├── app/[locale]/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # 新着（全競技横断）
│   │   ├── [sport]/page.tsx         # 競技ごとの一覧
│   │   ├── [sport]/[id]/page.tsx    # まとめ個別
│   │   ├── watch/                   # 「海外ファンと見る」ハブ（動画つき記事）
│   │   ├── player/ + player/[slug]/ # 日本人選手ハブ（成績・徹底分析・滞在5分の検索母艦）
│   │   ├── ranking/ + allstar/      # 日本人選手ランキング／オールスター特設
│   │   ├── prospects/               # NEXT MLB ハブ（NPB 注目株）
│   │   └── tag/[tag]/ + search/ + columns/ + p/[page]/  # タグ・検索・コラム・ページネーション
│   ├── components/
│   │   ├── ThreadCard.tsx
│   │   └── LocaleSwitcher.tsx
│   ├── lib/
│   │   ├── data.ts              # JSON 読み込みヘルパ
│   │   └── sports.ts            # 競技カタログ（ラベル・subreddit・絵文字）
│   └── types/
│       ├── thread.ts           # まとめの型
│       └── common.ts
└── scripts/
    ├── fetch-youtube.mjs       # YouTube コメント取得（要 YOUTUBE_API_KEY・2号店から移植）
    ├── fetch-mlb-stats.mjs     # 日本人選手の成績・出場試合レーダー・snapshot（§4.1）
    ├── og-thumb.mjs / check-discover-images.mjs  # OG 画像の生成・監査（§4.5）
    ├── fetch-reddit.mjs        # Reddit OAuth 取得スクリプト（承認待ち）
    ├── backfill-video-meta.mjs # 動画記事に publishedAt/videoTitle を後追い投入（JSON-LD VideoObject 用）
    ├── ping-indexnow.mjs       # 公開直後の即時インデックス通知（無人公開CIから自動実行）
    └── threads-update.md       # 更新手順
```

---

## 3. 競技（カテゴリ）

`src/lib/sports.ts` が唯一の正。競技を増減するときは必ずここから。

| sport    | ラベル       | 主な取得元                                  |
| -------- | ------------ | ------------------------------------------- |
| `mlb`    | MLB          | r/baseball, r/mlb, YouTube（MLB 公式）      |
| `boxing` | ボクシング   | r/Boxing                                    |
| `mma`    | MMA          | r/MMA, r/ufc, YouTube（RIZIN 公式・人気枠） |
| `npb`    | NEXT MLB     | NPB の MLB 注目株（`/prospects` ハブと連動） |

---

## 4. まとめ更新プロトコル（Claude 向け）

まとめ記事を作る編集ルール（コメントの抜粋・並べ方・翻訳・タイトル・要約・成績ボックス・タグ =
**R1〜R12**）と**狙う検索クエリ5クラス・ネタ選定の比重**の唯一の正は **`matome` スキル**
（`.claude/skills/matome/SKILL.md`）。「まとめ作って」等で発動する。本章は概要と出力仕様のみ＝
ルールの値・詳細をここに複製しない。
日本人選手の**出場試合を漏れなく**記事化する段取り（出場試合の洗い出し→公式ハイライト同定→重複検知→
matome 委譲）は **`jp-games` スキル**（`.claude/skills/jp-games/SKILL.md`）。「今日の日本人選手の試合
まとめて」等で発動し、選手ハブ /player を出場試合の動画記事で充実させる。
ネタの**発見**（YouTube 定点監視・MLB ライバル枠・興行カレンダー・Reddit 巡回注文）は **`neta-radar`
スキル**（`.claude/skills/neta-radar/SKILL.md`）。「今日のネタある？」「ネタ探して」等で発動し、候補
チケットを出して matome / jp-games に委譲する（記事化はしない）。
X（Twitter）への配信は **`x-post` スキル**（ポスト本文＝中の人ボイス・リンク無し）と
**`x-share` スキル**（サイト資産の配信パッケージ・成績カード画像）が正。
データ形式・運用の詳細は [`scripts/threads-update.md`](./scripts/threads-update.md)。要点:

### 4.1 データ取得

- **YouTube（自動化済み）**: `node scripts/fetch-youtube.mjs comments <動画URL>` で人気順
  コメントを取得（要 `YOUTUBE_API_KEY`、`.env.local` に置く。API は無料枠で足りる）。
  生の取得 JSON は `_local/queue/` に置き、**コミットしない**（YouTube API 規約のデータ保存
  制限。記事に残すのは抜粋のみ）。MLB 公式ハイライト・RIZIN 公式が主用途。`search "<クエリ>" [本数]
  --channel <ID>` で動画検索もできる（試合ハイライトの同定＝`jp-games` スキルが使う）。
- **日本人選手の出場試合レーダー（jp-games）**: `node scripts/fetch-mlb-stats.mjs games [ETの試合日]
  [--json]` で「日本人選手が出場した全試合」と**記事化済みか**を列挙（既定=ET昨日／期間指定でバックフィル）。
  `existingArticle:null` が未記事化＝作成対象。詳細は `jp-games` スキル（公式ハイライトの日付一致同定・
  重複検知・matome 委譲まで）。
- **Reddit（手動）**: 未認証の `.json` / `api.reddit.com` / 公開ミラーはこの環境の IP から
  403 で全滅（WebFetch も reddit.com 拒否）。公式 OAuth（`scripts/fetch-reddit.mjs`）は
  **2025/11 から事前承認制**で承認待ち。
  → 当面は **手動運用**（ユーザーがスレ URL とコメントを貼り、Claude が翻訳・整形）。
- **MLB 成績（編集時の味付け用）**: `node scripts/fetch-mlb-stats.mjs jp <ETの試合日> --json` で
  日本人 MLB 選手の成績を `Thread.stats` 配列として取得（MLB公式 Stats API・キー不要）。記事は
  `summaryJa` 直下の専用ボックス（`StatBox`）で「この試合／今季／節目」を表示（matome R10）。載せる対象は
  ドジャース戦＝日本人だけ／他の試合＝主役スターなら外国人も可（正は matome R10・2026-07-03 拡張）。日付は
  現地(ET)基準＝JST と1日ズレることあり。⚠️ **サイト本体（Next.js ランタイム）は API を叩かない**＝
  読むのは静的JSON（`data/jp-players-stats.json`）だけ。記事に残すのは**数値だけ**（公知の事実）。ロゴ/写真/中継/表組みは転載しない。
  - 選手ハブ /player 用の `snapshot` は **GitHub Actions（`.github/workflows/refresh-stats.yml`）で「試合がある時間帯だけ毎時」**
    自動取得→変化があればコミット（Vercel 自動デプロイ）。これは編集時取得の延長＝**サイト本体ではなく CI が叩く**運用。
    API規約「個人・非商用・非バルク」を踏まえ、デッドな時間帯は回さず低頻度に抑える（恒常的な全時間データ源にはしない）。
    取得失敗・名簿異常時は書かずに失敗（既存JSONを保持）。手動更新は `node scripts/fetch-mlb-stats.mjs snapshot`。
  - **守備＋走力（Statcast / Baseball Savant）**: snapshot は statsapi の伝統的守備に加え、`baseballsavant.mlb.com`
    のリーダーボード CSV から **OAA（守備範囲）・守備run（FRV相当）・送球 最速mph・走力 ft/s** を取得（MLB公式・
    キー不要）。OAA等は守備位置に就く野手のみ＝投手/DH には付かない（大谷は走力のみ）。Savant 取得が失敗しても
    コア（statsapi）スナップショットは壊さずその指標だけ欠落させて続行。法務 posture は statsapi と同じ（公知の数値だけ）。
  - **試合結果（`Thread.game`・記事の主役データ）**: `node scripts/fetch-mlb-stats.mjs backfill-games --apply` で
    公式スケジュール（`hydrate=linescore,decisions`）＋ boxscore から **最終スコア・回ごとの得点と H/E/残塁・
    その試合時点の勝敗と地区順位・勝敗投手/セーブ・本塁打の打者と今季号数** を記事 JSON に埋める。記事は要約直下の
    **試合結果ボックス**（`GameBox`＝線スコア表＋公式ロゴ直リンク＋本塁打＋カード生成ボタン）で表示し、
    `SportsEvent` 構造化データにも出す（正は matome R10+）。
    **検索結果のタイトル/説明文もこのデータから自動生成する**＝`src/lib/gameSeo.ts`。「対戦カード＋スコア＋日付」を
    前に出してクリックされない問題（1記事で 7,713表示/3クリック＝CTR 0.04%）に当てる施策で、記事本文の見出しは触らない。
    **選手名の日本語表記**は `src/lib/playerNames.ts` が正＝カタログ（`players.ts`＝日本人選手・ハブリンクつき）→
    `data/player-names-ja.json`（公式英語表記→カタカナの手当て表）→ 英語のまま、の順で解決する。記事 JSON には
    公式英語表記だけ持つ（表記の正を1か所に寄せる）。未収録の選手は英語で出るだけなので、気づいた時に
    `node scripts/check-player-names.mjs` で洗い出してカタカナを足す（既存記事も次のビルドから直る）。
    ⚠️ **順位・勝敗はその試合終了時点の値を焼き込む**（`leagueRecord` と日付指定 standings）。`data/standings.json`
    ＝常に最新 を記事に出すと、7月の試合の記事が9月には違う順位を表示してしまうため。**サイト本体は
    静的JSONを読むだけ**（API を叩かない）という posture は他と同じ。

### 4.2 出力フォーマット

`data/threads/{sport}/{id}.json`（型は `src/types/thread.ts` の `Thread`）:

```json
{
  "id": "2026-06-10-why-no-second-ohtani",
  "sport": "mlb",
  "subreddit": "r/baseball",
  "sourceUrl": "https://www.reddit.com/r/baseball/comments/.../",
  "fetchedAt": "2026-06-10T12:00:00+09:00",
  "title": { "en": "...", "ja": "..." },
  "summaryJa": "スレの流れ・論点の要約",
  "flair": "Discussion",
  "totalComments": 147,
  "media": { "kind": "image", "url": "https://i.redd.it/xxxx.jpg", "credit": "u/foo · r/baseball" },
  "tags": ["大谷翔平", "二刀流"],
  "comments": [
    { "author": "user", "score": 87, "bodyEn": "...", "bodyJa": "...", "isHighlight": true }
  ]
}
```

- `format`（`"reddit"` / `"interview"` / `"youtube"`）の使い分け・表示仕様は **matome スキルの
  R7 / R7+ が唯一の正**。`score` は実測値のみ（**捏造しない**）

### 4.2+ 検索・AEO の構造化データ（2026-07-30 監査で整備）

記事ページの JSON-LD は `Organization` / `NewsArticle` / `BreadcrumbList` に加えて次を出す。
値は**実測値がある記事だけ**に出す＝取れていないものは出さない（捏造しない・§4.4）。

- **`VideoObject`**: 動画記事（全492本中460本＝93%）を動画リッチリザルト／Google 動画タブの対象にする。
  必須の `uploadDate` は `media.publishedAt`（YouTube API 実測）から取る。取り忘れは
  `node scripts/backfill-video-meta.mjs` で未設定分だけ一括投入（`--dry-run` で下見）。
- **`comment`（Comment型・上限10件）**: 「海外ファンは何と言ったか」という AEO のクエリ形に直接答える。
  フック／ハイライト優先＋スコア順。全件入れると JSON-LD が本文より重くなるので上限で抑える。
- **`dateModified`**: `updatedAt`（あれば）→ 無ければ `fetchedAt`。公開後に直したら `updatedAt` を立てる。
- ⚠️ **Next の Metadata は `openGraph` / `twitter` を置換する**（マージしない）。ページ側でこれらを
  書くときは `images` を必ず渡す（`src/lib/site.ts` の `OG_IMAGES` / `OG_IMAGES_TW`）。渡し忘れると
  layout の og.png が消えて **og:image が1枚も無いページ**になり、Discover の大画像枠にも X のカードにも
  載らない（2026-07-30 に121ページで発生＝タグLP107本＋競技LP等）。`opengraph-image.tsx` を持つ
  ルート（player / ranking / mvp / cy-young）は Next が自動注入するので不要。
- 薄い自動生成面の posture は一本化: 薄記事（`threadIndex`）・薄タグLP（`tagIndex`）・
  ページネーション（`PAGINATED_ROBOTS`）・`/tags`・`/search`・`/en` は **noindex + follow**、
  かつ **sitemap にも載せない**（robots と sitemap の言い分を必ず一致させる）。RSS も同様に薄記事を外す。

### 4.3 更新時に必ずやること

保存前チェックリストは **matome スキルの手順（Step 1〜7）が唯一の正**。要点だけ:
`sourceUrl` 実在＝必ず送客／コメントは抜粋＋`bodyEn`/`bodyJa` 両方／`fetchedAt` は JST。

### 4.4 やってはいけないこと

- コメントを「推測」「捏造」で埋める（実在する発言だけを訳す）
- 全文転載・全コメント網羅（著作権配慮。抜粋＋翻訳＋送客の編集物にする）
- Reddit データを AI/ML 学習に使う（Reddit の規約・申請内容に反する）
- **「ニキ」表現（「海外ニキ」「◯◯ニキ」等）を本文・タイトル・コメント訳に使う**＝NG。海外の反応者の
  呼称は「海外ファン」「現地ファン」「海外の人たち」で統一（看板シリーズも「海外◯◯ファンと見る」）

### 4.5 メディア（画像・動画）の扱い

サムネ差別化のため記事ごとに `media`（`src/types/thread.ts` の `ThreadMedia`）を1点添える。
優先順位は **恒久URL ＞ ローカルコミット**：

- **動画**: YouTube / Streamable の**視聴URL**を `kind:"video"` で。自動で公式 iframe 埋め込みになる。
  期限つきの署名URL（`packaged-media.redd.it` / `preview.redd.it` 等）は**失効するので使わない**。
  - **OG/Discover 画像**: 動画記事の OG は `ogCover`（`src/lib/media.ts`）が `maxresdefault`(1280px) を使うが、
    MLB公式でも稀に maxres が無く、その時ストック写真（球場）に倒れて「OGだけ球場」になる。記事保存後に
    `node scripts/og-thumb.mjs <id>` を走らせると、公式サムネ中央16:9を切り出した 1280×720 のローカル OG を
    `public/media/{id}-og.jpg` に作り `thumbUrl` を入れる（matome R5）。`--all` で全記事の取りこぼしを一括修正、
    `node scripts/check-discover-images.mjs` で 1200px 基準を監査できる。
- **画像（URL）**: `i.redd.it` / `i.imgur.com` の**直リンク**を `kind:"image"` で。ホストを増やすときは
  `next.config.mjs` の `remotePatterns` に追加。
- **画像（ローカル）**: 恒久URLが無い場合のみ `public/media/{id}-{slug}.{png,jpg}` に置き、
  `url:"/media/..."` で参照する（`remotePatterns` 不要）。← §4.4 の旧「画像コミット禁止」を緩和。
  - ⚠️ ファイルは **`public/media/` だけ**。`data/` 配下にはコミットしない。
  - `credit`（出典）を必ず添える。中継フレーム/報道写真は著作権に配慮し、引用の範囲＋送客で運用。
  - 巨大ファイルを置かない（適度に圧縮）。ロゴ等のサイト素材は従来どおり `public/` 直下。

### 4.6 シリーズ（看板 watch-along 企画「海外ファンと見る」）

確実に毎試合作る固定企画（例: **海外ドジャースファンと見る**）は記事に `series` を付ける。
運用ルール（タイトル定型化・バッジ・`/watch` ハブ掲載・動画必須・JSON の書き方）は
**matome スキル R6 が唯一の正**。シリーズ定義（接頭辞・自軍名・バッジ）は
`src/lib/series.ts` の `SERIES` が唯一の正＝新シリーズはまずここに足す。

---

## 5. i18n ルール

- デフォルトロケールは `ja`、英語は `en`
- ユーザー可視文字列は `messages/{locale}.json`
- まとめ本文（タイトル訳・要約・コメント訳）はデータ側（JSON）に持つ
- 競技ラベルは `src/lib/sports.ts`（`labelJa` / `labelEn`）

---

## 6. コード規約

- TypeScript strict
- サーバーコンポーネントをデフォルトに、クライアント化は最小限
- データ読み込みは `src/lib/data.ts` 経由（`fs.readFile` を直接呼ばない）
- Tailwind ユーティリティで完結。`*.module.css` は作らない
- コメントは「なぜ」を書く

---

## 7. よくある依頼パターン

| ユーザー依頼例                        | Claude のアクション                                       |
| ------------------------------------- | -------------------------------------------------------- |
| 「このスレでまとめ作って」＋URL＋コメント | §4 の手順で `data/threads/{sport}/{id}.json` を作成       |
| 「ボクシングのまとめ追加して」        | `data/threads/boxing/` に追加                            |
| 「競技を追加したい（例: NBA）」       | `src/lib/sports.ts` に追加 → `data/threads/{sport}/` を作る |
| 「英語版の文言がおかしい」            | `messages/en.json` を修正                                |

---

## 8. 収益化ロードマップ（2026-06-13 合意・実装は順次）

> ⚠️ **2026-06-24 上位方針転換**: PV 換金（AdSense/VOD）は天井が低いと判断し、
> 「無人メディア工場＋AI駆動PM本人」の商品化（MVP=note「らく」）を主戦線に変更。
> 正はメモリ `monetization-pivot-productize-machine`。以下はサイト側の器の整備＝二次戦線として継続。

方針: **AdSense（土台）＋ VOD アフィリエイト（ブースター）**。流入の主戦場は検索より
**Google Discover**（高頻度更新・1200px 以上の画像・独自ドメインが条件）。

実装待ちタスク（優先順）:

1. ~~独自ドメイン取得 → Vercel 接続~~ ✅ **完了（2026-06-13）**。`matome-mlb-kaigai.jp` を
   お名前.com で取得 → dnsv.jp ネームサーバー＋A レコード（216.198.79.1）で Vercel に接続、
   https 自動発行まで確認済み。コード側の正規 URL もこのドメイン（`src/lib/site.ts`・
   `sitemap.ts`・`robots.ts`）。残: 商用＝広告掲載のため Vercel は厳密には Pro が必要。
2. ~~sitemap.ts / RSS フィード / タグページ~~ ✅ **実装済み（2026-06-13）**。`src/app/sitemap.ts`・
   `src/app/feed.xml/route.ts`（RSS 2.0・直近50件・ブログ村/アンテナ登録用）・
   `src/app/[locale]/tag/[tag]/page.tsx`。RSS 自動検出は layout の metadata.alternates。
3. ~~プライバシーポリシー・運営者情報・問い合わせページ~~ ✅ **実装済み（2026-06-13）**。
   `/about`・`/privacy`・`/contact`（`src/lib/legal.ts` がコンテンツの正・`LegalArticle` で描画）。
   ⚠️ **公開前に2点差し替え**: `CONTACT_FORM_URL`（Google フォーム URL）と、必要なら
   `OPERATOR_NAME`。フッターに運営者情報/プライバシー/問い合わせ/RSS のリンクを設置済み。
4. ~~記事下の sport 別 VOD CTA コンポーネント~~ ✅ **実装済み（2026-06-23頃）**。`src/lib/vod.ts`
   （`VOD_OFFERS`）＋ `src/components/VodCta.tsx`。当面は公式視聴サービスの案内。ASP 提携確定後は
   `VOD_OFFERS` の `href` をアフィリエイトリンクに差し替えるだけで全記事に反映される。
5. 自動化スキル: matome 拡張（X 下書き・タグ正規化・関連リンク同時生成）→ ~~kpi-weekly~~
   ✅ **実装済み（2026-07-02）**＝`.claude/skills/kpi-weekly/`＋`scripts/fetch-kpi.mjs`
   （GA4/GSC をサービスアカウントで取得。初回セットアップは同スキル references/setup.md・
   Google 側の鍵発行が済むまでは実行するとセットアップ案内を出して止まる）→
   ~~neta-radar~~ ✅ **実装済み（2026-07-03）**＝`.claude/skills/neta-radar/`（YouTube 定点監視
   `fetch-youtube.mjs latest`＋MLB ライバル枠＋興行カレンダー＋Reddit 巡回注文。Reddit API 承認後に本領）
   → money-page（興行の「視聴方法×海外の反応」成約ページ）

---

## 9. 将来やる予定（メモ）

- Reddit API 承認後、`scripts/fetch-reddit.mjs` で取得を半自動化
- 競技の追加（NBA / サッカー 等）
