# 「海外の反応」まとめ更新手順（Claude 向け）

Reddit の盛り上がったスレや YouTube 動画のコメント欄を日本語まとめ
（5ch まとめ風＝コメント翻訳中心）にする。対象は **MLB / ボクシング / MMA** の3競技。
出力は `data/threads/{sport}/{id}.json`（型は `src/types/thread.ts` の `Thread`）。

## 競技と取得元

| sport    | 主な取得元                                  |
| -------- | ------------------------------------------- |
| `mlb`    | r/baseball, r/mlb, YouTube（MLB 公式）      |
| `boxing` | r/Boxing                                    |
| `mma`    | r/MMA, r/ufc, YouTube（RIZIN 公式・人気枠） |

（`src/lib/sports.ts` が正。競技を増やすときはまずここに追加する）

## 既知の落とし穴

- **未認証の `www.reddit.com/.json` / `api.reddit.com` / 公開ミラーはこの環境の IP から
  403 で全滅する**。WebFetch も reddit.com は拒否。
- 確実に取れるのは公式 OAuth（script アプリ）だけ = `scripts/fetch-reddit.mjs`。
  ただし **Reddit API は 2025/11 から事前承認制**。承認が
  下りるまでは「ユーザーがスレ本文・コメントをコピペ → Claude が翻訳・整形」の**手動運用**。

## 手順（YouTube・自動化済み）

```sh
# 動画 URL から人気順コメントを取得（要 YOUTUBE_API_KEY、.env.local に置く）
node scripts/fetch-youtube.mjs comments <動画URL>
```

- 生の取得 JSON は `_local/queue/` に置き**コミットしない**（YouTube API 規約のデータ保存制限）。
- 記事は `format: "youtube"` を付ける（表示が author そのまま＋👍 likeCount になる）。
  詳細は matome スキル R7+。
- 動画検索: `node scripts/fetch-youtube.mjs search "<クエリ>" [本数] --channel <ID>`（試合ハイライトの同定）。

## 手順（日本人選手の出場試合を漏れなく＝jp-games スキル）

```sh
node scripts/fetch-mlb-stats.mjs games                       # 既定=直近に終わった ET の slate
node scripts/fetch-mlb-stats.mjs games 2026-06-21 --json     # 指定日(ET)の出場試合＋記事化済みか（機械処理用）
node scripts/fetch-mlb-stats.mjs games 2026-06-15 2026-06-21 # 期間でバックフィル（漏れの遡及埋め）
```

- 日本人選手が出場した全試合を列挙し、各試合が**記事化済みか**（`existingArticle`）を返す。`null` が未記事化＝対象。
- そこから先（公式ハイライトを日付一致で同定→videoId で二重作成ガード→matome 委譲）は **`jp-games` スキル**が正。
  狙いは選手ハブ /player の充実（記事の選手名タグで各選手ページに自動で集まる）。

## 手順（MLB 成績を記事にそえる・編集時の味付け）

```sh
node scripts/fetch-mlb-stats.mjs jp 2026-06-19 --json  # 指定日(ET)に出場した日本人選手 → Thread.stats 配列
node scripts/fetch-mlb-stats.mjs player 大谷 --json     # 1 選手だけ（"大谷"/"Ohtani"/660271）
node scripts/fetch-mlb-stats.mjs jp                     # 今季ダッシュボード（人が読む形・節目チェック）
```

- MLB公式 Stats API（キー不要・無料）から取得。`--json` の出力を記事の `Thread.stats` にそのまま貼ると、
  `summaryJa` 直下の専用ボックス（この試合／今季／節目バッジ）で表示される（matome スキル **R10**）。
  MLB の試合まとめ・「海外ファンと見る」で効く。⚠️ 日付は**現地(ET)基準**＝JST の試合日と1日ズレることあり。
- ⚠️ **サイト本体（SSG）はこの API を叩かない**。規約が「個人・非商用・非バルク」なので恒常データ源には
  しない＝あくまで編集時取得。記事に残すのは**成績の数値だけ**（公知の事実で著作権の対象外）。
  MLB のロゴ・選手写真・中継映像・成績表の丸ごと転載はしない。取得できなければ省略（捏造しない）。

## 手順（Reddit・API 承認後）

```sh
# 1) 今週の人気スレを一覧して対象を選ぶ（競技ごとに subreddit を変える）
node scripts/fetch-reddit.mjs list r/baseball week 8   # 例: MLB

# 2) 選んだスレの本文+上位コメントを取得
node scripts/fetch-reddit.mjs thread <permalink-or-url> 40
```

## 手順（Reddit・手動運用・当面こちら）

> 記事の編集ルール（コメントの抜粋・並べ方・翻訳・タイトル・要約）は **`matome` スキル**
> （`.claude/skills/matome/SKILL.md`）が正。要点: R1 繋がりを持たせて並べる /
> R2 最後はオチ / R3 抜粋は 15〜30 件 / R4 フック引用 / R5 メディア1点 /
> R6 シリーズ / R7 インタビュー / R8 タイトル / R9 要約。記事ページは配列順そのまま表示する。
> ネタ選定の比重（MLB 7 : ボクシング 2.5 : MMA 0.5）もスキル側に記載。

1. ユーザーが Reddit のスレ URL とコメント（人気順で数件）を貼る。
2. Claude が `matome` スキルに従って `Thread` 形式へ翻訳・編集して保存:
   - `sport` = `mlb` / `boxing` / `mma`、ファイルは `data/threads/{sport}/{id}.json`
   - `id` = `{YYYY-MM-DD}-{英語スラッグ}`
   - `comments` は人気＋面白いものを**抜粋**（全件転載しない）。`bodyEn` 原文と `bodyJa`
     訳を両方入れ、特に良いものは `isHighlight: true`
   - `summaryJa` にスレの流れ・論点を要約。`tags` は日本語（選手名・話題）
   - `sourceUrl` は必ず元スレ URL（送客＝引用要件）

## 著作権の方針（必ず守る）

- 全コメント網羅・全文転載はしない。**抜粋 + 翻訳 + 元スレ送客**の編集物にする。
- 原文 `bodyEn` を併記して翻訳の透明性を保つ。
- メディアは恒久 URL 参照が原則。ローカルに置くのは恒久 URL が無い場合のみ、
  **`public/media/` 限定＋ `credit` 必須**（CLAUDE.md §4.5）。`data/` 配下にはコミットしない。

## 公開後（更新 Ping ＝ 2 本）

記事をコミット → push → Vercel デプロイが**完了してから**、新着一覧・検索エンジンへ
即反映させるため Ping を送る（静的サイトなので自動では飛ばない）。**デプロイ完了後に**叩く
（前に叩くと古い内容を取りに来る）。

### 1. 検索エンジンへ即インデックス通知（IndexNow）

```bash
node scripts/ping-indexnow.mjs --latest 3   # 直近で公開した本数を指定
```

- Bing / Yandex / Naver ほかへ「今すぐクロールして」と通知（**Google は IndexNow 非対応**＝
  Google には効かない。Google は sitemap＋GSC で拾うのを待つ）。新記事の発見を早める最大の一手。
- 鍵は `public/27fa7757849be83b905ec59e275d4e5e.txt`（公開トークン・本番200で検証済み）。設定不要で動く。
- `--latest N`＝直近N記事＋その競技一覧＋トップ / `--all`＝全件（初回一括投入用）/ パス・URL 直指定も可 / `--dry`＝送信せず確認。
- 受理は HTTP 200/202。送りすぎは不要なので、その回に公開した本数だけ `--latest` で送る。

### 2. ブログランキングへ更新 Ping（にほんブログ村ほか）

```bash
node scripts/ping-blogmura.mjs
```

- 前提: ブログ村マイページで「Ping送信/記事反映」を有効化＋RSS(`feed.xml`)登録済み。
- `BLOGMURA_PING_URL`（あなた専用・非公開）は `.env.local` に置く。`.env*` は gitignore 済み。
