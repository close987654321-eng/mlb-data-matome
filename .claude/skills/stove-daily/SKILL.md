---
name: stove-daily
description: ストーブリーグ（/stove-league）の毎朝の更新。日本人選手の去就と FA 注目選手の報道を集めて data/stove-league.json を最新にし、大きな動きがあれば Reddit の海外の反応を記事にする。毎朝6:00 JST のクラウド定期実行がこの手順を回す。手元で「ストーブリーグ更新して」「FAの最新情報を反映して」と言われたときも同じ手順。
---

# ストーブリーグの毎朝更新（stove-daily）

`/stove-league`（オフの恒久ハブ）と、日本人選手の選手LP（`/player/{slug}` の「今オフの去就」）を**毎朝その時点の事実**にする。
仕組みの全体は CLAUDE.md §4.1「ストーブリーグ」。ここは毎朝の段取りだけを書く。

**担当の割り方（崩さない）**
- 成績・FA宣言・どこと契約したか（球団名）＝ `scripts/fetch-stove-stats.mjs` が statsapi から自動で取る（3時間ごとの CI もある）
- 報道の時系列・関心球団・相場・契約の中身（年数・金額）・状況の文章＝**この手順で人（エージェント）が書く**。必ず出典URLつき
- 海外の反応＝記事（`data/threads/`）。タグ `ストーブリーグ` を付ければハブに自動で並ぶ

## 絶対ルール

1. **報道に書かれた事実だけを書く**。推測・予想・「〜とみられる」の自作をしない。誰が言ったか（媒体名・記者名）を必ず添える。
   「関心」は**記事が球団名を挙げて報じたときだけ** `suitors` に足す（ファンの願望・ランキング記事の「行き先候補」は入れない）。
2. **出典は https のURL**。1つの事実に1つ以上。一次報道（MLB.com・MLB Trade Rumors・ESPN・The Athletic・AP・共同・日本の主要スポーツ紙）を優先。
   SNS の噂だけの話は書かない。The Athletic など読めない媒体は、引用している記事（MLBTR・Newsweek 等）を出典にして「The Athletic の◯◯記者によると」と書く。
3. **日付は日本時間**（`YYYY-MM-DD`）。米国の夕方〜夜の発表は日本時間では翌日になる。**未来の日付・時刻を書かない**（記事の `fetchedAt` も `date` コマンドで取った実時刻）。
4. **契約の年数・金額は報道の数字そのまま**（「◯年◯◯万ドル」）。報道で食い違うときは書いた媒体を明記するか、一致するまで書かない。
5. 和文と英数字のあいだに半角スペースを入れない（「5年8500万ドル」「MLB公式」）。「ニキ」は使わない（「海外ファン」）。
6. コメントは1文字も創作しない。Reddit の原文は `scripts/reddit-rss/pick.mjs` でダンプから機械コピーする（手で写さない）。
7. 動きが無い日は**事実の欄を書き換えない**。`checkedAt` だけ今日にする（`asOf` は中身が変わった日だけ進める）。

## 手順

### 0. 準備
`git checkout main && git pull --ff-only`。`npm ci`。今日（JST）を `TZ=Asia/Tokyo date +%F` で取る。
`data/stove-league.json` を読み、`japanese[]`（MLB組）・`board[]`（FA注目30人）・`dates[]`、
`src/lib/npbPlayers.ts` の `postingWatch` を持つ選手（NPB組）を確認する。

### 1. 公式の動き（機械）
- `node scripts/fetch-stove-stats.mjs` … 30人＋日本人の FA宣言・契約（球団名）を `data/stove-league-stats.json` に反映。
  出力の「オフの動き」を控える。🚨 statsapi が失敗したら推測で補わず、そのことを最後の通知に書く（手順2以降は続けてよい）。
- `node scripts/fetch-transactions.mjs <昨日>..<今日>` … 30人以外も含めた大きな動き（日本人は ★★★）。

### 2. 報道の確認（WebSearch / WebFetch）
次の順で、**直近48時間**の報道を探す。1人あたり1〜2回の検索で足りる。
1. MLB組の日本人（`japanese[]`）: `"<英語名>" free agent` / `"<英語名>" signs` / `<日本語名> FA` など。
   オプトアウト権の選手は「opt out」の決定、FA の選手は QO（クオリファイング・オファー）の提示・受諾、関心球団、契約。
2. NPB組（ポスティング・海外FA）: 正式な申請（posted）・交渉期限・契約。`npbPlayers.ts` の `postingWatch` を更新する。
3. FA注目30人: 契約・トレード・QO・オプトアウトの決定（`<名前> signs` / `MLB free agent signings`）。
4. 制度・日程: 労使交渉（CBA・ロックアウト）、ウィンターミーティングの開催可否。

WebFetch で本文を開き、**書かれていることだけ**を拾う（見出しだけで判断しない）。

### 3. データを書き換える（`data/stove-league.json`）
- `japanese[].timeline`: 新しい報道を**先頭に**足す（`date`・`ja`・`en`・`source`・`sourceName`）。同じ出来事を二重に足さない。
- `japanese[].headline` / `window`: **いまの状態**に書き直す（例: FA になった後に「翌日にFAになる」を残さない／判断期限が過ぎたら結果を書く）。
  `headline` は選手LPの説明文と検索結果にも使う＝1〜2文で「いまどうなっているか」。
- `suitors`: 球団名を挙げた報道があれば足す（日本語の球団名は `src/lib/teams.ts` の短縮名）。
- `marketValue`: 記者・媒体が出した数字だけ（出典つき）。
- **決着**（契約・残留・再契約）: `outcome`＝`{ kind, date, team:{ja,en}, ja, en, source, sourceName }`。`ja` に年数・金額。
  `board[]` の同じ選手にも同じ `outcome` を入れる。オプトアウトせず残る選手は `kind:"stayed"`。
- `board[].note`: 状況が変わった選手だけ1文直す（契約したら契約内容に）。
- 中身を変えた選手は `japanese[].asOf` を今日に。何か1つでも変えたらトップの `asOf` を今日に。**`checkedAt` は毎回今日**。
- NPB組は `src/lib/npbPlayers.ts` の `postingWatch`（`asOf`・`headline`・`timeline`・`suitors`・`level`）を同じ規律で更新。

### 4. 海外の反応の記事（大きな動きがあった日だけ・1日1本まで）
**対象**: 日本人（MLB組・NPB組）の契約・QO・オプトアウトの決定・正式なポスティング申請、または FA注目10位以内の契約。無ければこの手順は飛ばす。
1. `GAP=20000 node scripts/reddit-rss/rsearch.mjs '|"<英語名>"|week|top' '<関係球団の板>|<姓>|week|top'` でスレを探す。
2. `GAP=20000 node scripts/reddit-rss/rfeed.mjs '<スレURL>/.rss?limit=100' > /tmp/dump.txt`（2〜4スレ）。
3. 訳だけ書いた picks.json を作り `node scripts/reddit-rss/pick.mjs picks.json /tmp/dump*.txt > /tmp/comments.json`。
4. 記事は `.claude/skills/matome/SKILL.md`（R1〜R11）どおり。`data/threads/mlb/<JST日付>-<英語スラッグ>.json`（NPB組は `npb/`）。
   15〜30件・`score:0`・各コメントに `sourceUrl`・タグに選手名＋球団名＋`ストーブリーグ`＋`FA`（NPBは`ポスティング`）＋`海外の反応`。
   `fetchedAt` は**いまの実時刻**。ファンが挙げた数字は statsapi で当てて、合わない発言は使わない。
   成績ボックスは `node scripts/fetch-mlb-stats.mjs player <mlbId> --json`。
5. 🚨 Reddit に届かない（403・接続できない）ときは記事を作らず、候補（出来事と探したスレ）を通知に書く。

### 5. 検査と公開
1. `node scripts/check-stove-league.mjs` が ✓（✗ は直す。直せないものは元に戻す）。
2. `npm run build:gate`（通常の build はクラウドで EMFILE で落ちる）。通ったときだけ次へ。
3. `git add -A && git commit -m "chore(stove): ストーブリーグを毎朝更新（<JST日付>）" && git push origin main`
   （クラウドでは push が claude/** ブランチに振り替わり、`cloud-articles-automerge` が main に入れて公開する）。
   競合したら `git pull --rebase origin main` してやり直す（最大5回）。

### 6. 完了通知（必ず1通）
Slack の自分宛DM（channel_id `U07D5DRCULF`、失敗時は `slack_search_users` で探す）。日本語で:
- 実行日（JST）と結果（更新あり／動きなしで確認のみ／失敗）
- 変えたこと（選手ごとに1行・出典の媒体名）と、`outcome` を入れた契約
- 書かなかった話（噂だけ・出典が弱い・食い違い）＝人が判断する用
- 作った記事（URL）か、作らなかった理由（大きな動きなし／Reddit に届かない）
- 検査・build・push の結果（失敗ならエラーの該当行）
