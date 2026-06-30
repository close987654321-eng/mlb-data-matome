---
name: jp-games
description: 日本人MLB選手が出場した試合を漏れなく洗い出し、その試合のYouTubeハイライト（MLB公式）を見つけて「海外ファンと見る」まとめ記事にする。選手ハブ /player を出場試合の動画記事で充実させるのが目的。MLB公式スケジュール＋出場記録から「未記事化の試合」を一覧（ギャップ表）し、未記事化分を matome スキルで記事化する。「今日の日本人選手の試合まとめて」「出場試合を漏れなく」「日本人選手の試合レーダー」「未記事化の試合」「{選手名}の出た試合まとめて」などで発動。記事の編集ルールそのものは matome スキルが正。
---

# 日本人選手の出場試合レーダー（jp-games）

日本人MLB選手が**出場した試合を1試合も漏らさず**洗い出し、その試合の **MLB公式 YouTube
ハイライト**を見つけて「海外ファンと見る」まとめ記事にする。狙いは選手ハブ `/player/[slug]` の
充実 —— 記事は選手名タグ（or 成績ボックス）で自動的に各選手ページに集まる（`threadsOf`）。

> 記事の中身（コメントの抜粋・並べ方・翻訳・タイトル・要約・成績ボックス）の作り方は **matome
> スキル（R1〜R10）が唯一の正**。このスキルは「どの試合を・どの動画で作るか」を漏れなく決め、
> matome に渡す**段取り**を担当する。編集ルールをここに複製しない。

## このスキルが解く問題
- 「出場したのに記事化していない試合」を**機械的に**見つける（人手だと漏れる）。
- 連戦（同カードが数日続く）でも**正しい1試合の動画**を取り違えない。
- 既に作った試合を**二重に作らない**。

---

## 全体フロー

### Step 1 — ギャップ表を出す（漏れの可視化）
対象日(ET)の「日本人選手が出場した全試合」と、各試合が**記事化済みか**を一覧する。

```sh
# 最新（直近に終わった ET の slate＝既定でET昨日）
node scripts/fetch-mlb-stats.mjs games

# 日付指定（ET基準・YYYY-MM-DD）／期間でまとめてバックフィル
node scripts/fetch-mlb-stats.mjs games 2026-06-21
node scripts/fetch-mlb-stats.mjs games 2026-06-15 2026-06-21   # 漏れの遡及埋め
node scripts/fetch-mlb-stats.mjs games 2026-06-21 --json       # 機械処理用（このスキルは基本これ）
```

出力（`--json`）の各試合に入る主なキー:
- `existingArticle` … **これが `null` の試合だけが「未記事化」**＝今回の作成対象。
- `jpPlayers` … この試合に出た日本人選手（`player`＝日本語名 / `team` / `today`＝その試合の成績）。
- `etDate`（ET試合日）/ `gameDateJst`（JST＝記事 id・series.date に使う）/ `titleDateUS`（"6/21/26"＝動画同定キー）。
- `seriesId`（watch-along シリーズを持つ自軍なら入る。例 `dodgers`）/ `selfTeamJa` / `opponentJa`。
- `suggestedId`（推奨記事 id）/ `searchQuery`（YouTube 検索語）/ `matchup`（スコア入り）。

**ユーザーへの提示**: 未記事化の試合を表で見せ、どれを記事化するか確認する。
- 「全部」と言われたら未記事化を全部作る。指定があればその試合だけ。
- 何も指定が無ければ、未記事化を新しい順に挙げ、上から作るか確認する（量はユーザーが決める＝
  「ギャップ表は全選手・記事化は都度選ぶ」方針）。ボクシング/MMA との比重（matome の MLB 7）には収まる。

**📌 静かな試合も作る（完全網羅優先・2026-06-22 村山決定）**: 日本人選手が無安打・1打席だけ・
コメント欄に本人への言及ゼロ——でも**出場していれば記事化する**（選手ページ充実が目的なので漏らさない）。
このとき**作るか否かをいちいち聞かない**。ただし中身は**正直に**:
- **海外の反応をその選手のものに捏造しない**。コメントが相手チーム中心ならそのまま相手チームの試合
  まとめとして編集し（matome R1〜R2 の流れ・オチは実コメントで作る）、選手はタグ＋成績ボックスで
  ページに載せる（タグ＝紐付けであって「本人が話題」の意味ではない）。
- **タイトル・要約は実際に盛り上がった話題に合わせる**（R8/R9）。本人が話題でないのに「{選手名}に
  海外驚愕」等にしない（Discover の煽り厳罰・本文不一致＝CLAUDE.md §8）。成績ボックスの本人の数字は
  そのまま出す（0安打でも `war` 必須＝R10）。`summaryJa` に本人の出場を1句そえてよい（例:「{選手}は
  1打席のみで快音なし」）。

### Step 2 — 未記事化の試合の「正しい動画」を確定する
未記事化の各試合について、MLB公式チャンネルからハイライトを探し、**タイトル中の日付で同定**する。

```sh
node scripts/fetch-youtube.mjs search "<その試合の searchQuery>" 5 --channel UCoLrcjPV5PbUrUyXq5mjc_A
```

- `UCoLrcjPV5PbUrUyXq5mjc_A` は **MLB公式チャンネル**（"… Full Game Highlights (M/D/YY) | MLB Highlights" を出す出どころ）。
- **採用ルール**: 結果のうち `channel` が `MLB` で、`title` に **`(titleDateUS)` がそのまま含まれる**動画を選ぶ
  （例: `(6/21/26)`）。連戦だと同カードが何本も並ぶので、**日付一致でしか確定しない**。
- ⚠️ **その日付の動画が無ければ「まだ未投稿」**＝記事化しない。別カードの動画や前後日で代用しない・
  捏造しない（CLAUDE.md §4.4）。ギャップ表に「動画待ち」として残し、後でもう一度回す。
- **二重作成の最終ガード**（id の日付規約ブレ対策）: 採用した videoId が既存記事に無いか確認する。
  ```sh
  grep -rl "<videoId>" data/threads/mlb/    # ヒットしたら作成済み＝スキップ
  ```

### Step 3 — matome で記事化する
確定した動画とコメントから、**matome スキル（R1〜R10）に従って** `data/threads/mlb/{id}.json` を作る。
このスキルからの**束縛（どの値を使うか）**だけ示す:

```sh
# コメント（人気順）を取得 → matome R7+（format:"youtube"）で抜粋・翻訳
node scripts/fetch-youtube.mjs comments "<採用した動画URL>"

# 成績ボックス（matome R10）：その日の出場者の Thread.stats を取得し、この試合の選手だけ残す
node scripts/fetch-mlb-stats.mjs jp <etDate> --json        # その日の全出場者
# （watch-along で自軍だけに絞るなら）jp <etDate> --team <selfTeamJa> --json
```

記事 JSON への束縛:
- `id` = `suggestedId`（`{gameDateJst}-{自軍slug}-vs-{相手slug}`）。`sport` = `"mlb"`。
- `format` = `"youtube"`、`sourceUrl` = `media.url` = 採用した動画 URL（= 送客）。`subreddit` = `"YouTube"`。
- `series` … `seriesId` があれば付ける（matome R6）。`{ "id": seriesId, "date": gameDateJst, "opponent": { ja: opponentJa, en: <相手英語名> } }`。
  → タイトルは定型自動生成される（`title.ja/en` は保険でよい）。`seriesId` が無い単発の試合は matome R8 でタイトルを作る。
- `tags` … **両チームの日本語名＋この試合の日本人選手全員（`jpPlayers[].player`）＋活躍した現地選手＋`"海外の反応"`**。
  → 出場選手を全員タグに入れることで、その試合が**各選手ページに載る**（このスキルの目的）。
- `stats` … `jp <etDate> --json` の出力から、**この試合の `jpPlayers` に一致する選手だけ**を残す（無関係な選手は削る）。
  WAR は全選手必須・投手は WHIP 必須（matome R10）。
- `media` … `{ "kind": "video", "url": <動画URL>, "credit": "MLB（YouTube公式ハイライト）" }`（R5）。
  - **Discover 画像（1200px 足切り）**: 公式ハイライトに `maxresdefault`（1280px）があれば
    `media.thumbUrl` に `https://i.ytimg.com/vi/<videoId>/maxresdefault.jpg` を**明示**する（実サムネ＝
    クリックされやすい）。maxres が無い動画（720p 未満）は **thumbUrl を付けない**——`ogCover` が
    自動で 1600px の競技ストックに倒し Discover 適格を保つ（`src/lib/media.ts`。480px の hqdefault には
    倒さない）。maxres の有無は `node -e` で実寸確認するか、`fetch-youtube search` 後に判定する。
- コメント抜粋・並べ・翻訳・`isHook`・`summaryJa`・`title` は **matome の R1〜R10 をそのまま適用**。

### Step 4 — X 集客の下書きを出す（流入の生命線＝仕組み化）
記事を作ったら**そのつど** X（@アカウント）用のポスト下書きを `_local/x-posts.md` に貯める（現在の流入の
6〜7割が X。新記事ごとに必ず1ポスト）。送客あり版＝**本文（中の人の声でネタバレしない掴み1行）＋改行＋
記事URL** `https://matome-mlb-kaigai.jp/mlb/{id}`。声の作り方は `x-post` スキル（固定キャラ「中の人」）に従う。
- 日次でまとめて投げる運用なら「今日の日本人選手の結果＋海外の反応」を1本に束ねてもよい。
- `_local/` は gitignore 済み＝コミットしない（下書き置き場）。

作成後は matome と同じ運用（任意で `npm run build` 確認 → コミット → デプロイ後 ping。手順は `scripts/threads-update.md`）。

---

## 必ず守ること
- **漏らさず＝ギャップ表が真実**。`existingArticle: null` を作り切れば漏れゼロ。動画未投稿は「待ち」として残し再走する。
- **捏造しない**: 日付一致の公式動画が無ければ作らない。コメント・成績も実在する値だけ（matome R10 の法務ガード＝公知の数値だけ／サイト本体は API を叩かない）。
- **取り違えない**: 動画は必ず `titleDateUS`（M/D/YY）一致で確定。連戦の別日を掴まない。
- **二重に作らない**: `existingArticle` ＋ videoId の `grep` の二段で確認。
- **日付の基準**: `games` の引数と `jp <date>` は **ET（試合日）**。記事 id・`series.date` は **JST**（= `gameDateJst`）。`titleDateUS` は ET（動画タイトルと同じ）。混同しない。
- **ダブルヘッダー**: 同カードが同日2試合のときは `doubleHeader:true`/`gameNumber` が付く。その日の成績(`jp`)は2試合合算なので、記事は1本に束ねるかユーザーに確認する（box score の手作業が要る）。

## 関連
- 記事の編集ルール: `matome` スキル（`.claude/skills/matome/SKILL.md`）。
- シリーズ定義: `src/lib/series.ts`（`seriesId` の対応＝唯一の正）。新球団のシリーズはまずそこへ。
- 選手カタログ: `src/lib/players.ts`（タグ→選手ページの紐付け）。新しい日本人選手が出たら 1 行足す。
- 取得元スクリプト: `scripts/fetch-mlb-stats.mjs`（`games`/`jp`）・`scripts/fetch-youtube.mjs`（`search`/`comments`）。
