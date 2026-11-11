---
name: stove-daily
description: ストーブリーグ（/stove-league）の毎朝の更新。日本人選手の去就と FA 注目選手の報道を集めて data/stove-league.json を最新にし、労使交渉の動きを data/stove-lockout.json に足し、大きな動きがあれば Reddit の海外の反応を記事にする。毎朝6:00 JST のクラウド定期実行がこの手順を回す。手元で「ストーブリーグ更新して」「FAの最新情報を反映して」と言われたときも同じ手順。
---

# ストーブリーグの毎朝更新（stove-daily）

`/stove-league`（オフの入口）・`/stove-league/fa`（FAランキングと契約状況）・`/stove-league/lockout`（ロックアウト）・
`/prospects`（メジャー挑戦する日本人）と、日本人選手の選手LP（`/player/{slug}` の「今オフの去就」）を**毎朝その時点の事実**にする。
外国人の主役（`stars[]`＝今オフはスクーバル）の選手LPも同じ欄で追う。`/stove-league/guide`（用語）の「今オフの実例」は
`board[].qo`・`outcome`・`dates[]` の再表示＝ここを正しく保てば用語のページも合う。
`/stove-league/moves`（移籍情報）と球団LPの「補強」の欄は取引記録から自動で組まれる＝ここでは書かない（契約の年数・金額だけ `board[].outcome` から引く）。
仕組みの全体は CLAUDE.md §4.1「ストーブリーグ」。ここは毎朝の段取りだけを書く。

**担当の割り方（崩さない）**
- 成績・FA宣言・どこと契約したか（球団名）＝ `scripts/fetch-stove-stats.mjs` が statsapi から自動で取る（3時間ごとの CI もある）
- 30球団の契約・トレード・ウェーバー・自由契約の一覧＝ `scripts/fetch-stove-moves.mjs` が同じく自動で取る（`data/stove-moves.json`・**人は触らない**）
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
   ただし**公式の動き（手順1）と、時制が古くなった文（手順3の読み直し）は「動き」に数える**＝報道が無い日でも直す。
   2026-10-30 の初回実行は、FA宣言が statsapi に出ていたのに「動きなし」と判断し、
   「ワールドシリーズ終了の翌日にFAになる」（もうFAなのに未来形）を残したまま `checkedAt` だけ進めた。
   **「動きなし」と書けるのは、手順1の2本が成功し、手順2の最低限の検索を全部やった日だけ**。
   2026-10-31 の実行は statsapi に届かず（`fetch failed`）、検索も2回だけで「動きなし」とした。

## 手順

### 0. 準備
`git checkout main && git pull --ff-only`。`npm ci`。今日（JST）を `TZ=Asia/Tokyo date +%F` で取る。
`data/stove-league.json` を読み、`japanese[]`（MLB組）・`board[]`（FA注目30人）・`dates[]`、
`src/lib/npbPlayers.ts` の `postingWatch` を持つ選手（NPB組）を確認する。

### 1. 公式の動き（機械）
- `node scripts/fetch-stove-stats.mjs` … 30人＋日本人の FA宣言・契約（球団名）を `data/stove-league-stats.json` に反映。
  出力の「オフの動き」を控える。🚨 statsapi が失敗したら推測で補わず、そのことを最後の通知に書く（手順2以降は続けてよい）。
  失敗した日の通知は結果を「一部失敗（公式の動きは未確認）」とし、「動きなし」とは書かない。
- `node scripts/fetch-stove-moves.mjs` … 移籍情報（`/stove-league/moves`）と球団LPの補強の欄の元データ。中身が同じなら書かない。
  出力の先頭に並ぶ「注目選手の動き」は、手順2で報道（契約の年数・金額）を探す相手の一覧として使う。
- `node scripts/fetch-transactions.mjs <昨日>..<今日>` … 30人以外も含めた大きな動き（日本人は ★★★）。
- **日本人選手（`japanese[]`）の公式の動きは、報道が無くても手順3で必ず文章に反映する**。
  `data/stove-league-stats.json` の `players[mlbId].moves` を見て、`timeline` にまだ無い動き
  （`Declared Free Agency`＝FAになった／`Signed Free Agent`＝契約／`Trade`／`Released` など）があれば、
  `timeline` の先頭に1件足し（出典 `https://www.mlb.com/transactions`・`sourceName`「MLB公式（取引記録）」）、
  `headline` / `window` を書き直す。statsapi の `date` は米国東部の日付＝そのまま使い、文中では「米国時間10月29日」と書く。
- ワールドシリーズの決着（`data/postseason.json` の `champion`）、オプトアウト・QO の期限（日程表）を過ぎたかも、ここで確かめる。
- NPB組の文に「日本シリーズの終了後」など NPB の日程に依る言い方があれば、`curl -sL -A 'Mozilla/5.0' https://npb.jp/nippons/<年>/` で
  決着を確かめ、終わっていれば実日付で書き直す（2026年は10月28日に終わったのに、11月1日の実行は「終了後になる見込み」を残した）。
  期限を過ぎたのに結果が分からない選手は、手順2で必ず結果を探す。

### 2. 報道の確認（WebSearch / WebFetch）
次の順で、**直近48時間**の報道を探す。1人あたり1〜2回の検索で足りる。

**最低限の検索（省かない・まとめて1回で済ませない）**。検索した語は通知に並べる。
⚠️ **日本人（MLB組・NPB組）の検索は WebSearch の `mode: "extended"` で行う**。`standard` は数日前の記事しか返さないことがあり、
2026-11-01 の実行は佐藤輝明の10月29〜31日の報道（MLB機構がロックアウト中に交渉期間を止めない方針・阪神が受付初日に申請する見通し）を
取りこぼして「新しい報道なし」とした。結果に直近48時間の記事が出たら、見出しで済ませず本文を開く。
1. MLB組の日本人（`japanese[]`）: **1人ずつ** `"<英語名>" free agent` / `"<英語名>" opt out` など＋日本語で `<日本語名> FA` か `<日本語名> 去就`。
   オプトアウト権の選手は「opt out」の決定、FA の選手は QO（クオリファイング・オファー）の提示・受諾、関心球団、契約。
   **外国人の主役（`stars[]`）も同じ扱いで1人ずつ**（`"Tarik Skubal" free agent`＋`スクーバル FA`）。欄の書き方は `japanese[]` と同じ
   （`timeline` 先頭に追加・`headline` / `window` をいまの状態に・`suitors` は球団名を挙げた報道だけ・決着は `outcome`＋`board[]` の同じ選手にも）。
   `stars[]` に選手を足すのは人の判断（選手LPと成績データが要る）＝定期実行では増やさない。
2. NPB組（ポスティング・海外FA）: `postingWatch` のある選手を1人ずつ `<日本語名> ポスティング`（海外FA組は `<日本語名> 海外FA`）。
   正式な申請（posted）・交渉期限・契約。`npbPlayers.ts` の `postingWatch` を更新する。
3. FA注目30人: `MLB free agent signings` と `qualifying offer` で1回ずつ＋上位10人のうち報道の多い選手を名前で。
   契約・トレード・QO・オプトアウトの決定。
4. 制度・日程: `MLB CBA lockout` と `MLB ロックアウト` で1回ずつ（労使交渉・ロックアウト・ウィンターミーティングの開催可否）。
   拾った動きは手順3の「ロックアウト」の欄へ（`data/stove-lockout.json`）。

WebFetch で本文を開き、**書かれていることだけ**を拾う（見出しだけで判断しない）。

**届く媒体（クラウド・2026-10-31 実測）**: 実行環境の通信許可に、MLB.com・MLB Trade Rumors・ESPN・CBS・SI・NBC・NY Post・
Yahoo（米国・日本）・日刊スポーツ・スポニチ・報知・サンスポ・デイリー・Full-Count・時事・日経・Newsweek・Just Baseball・NPB が入っている。
- 日刊スポーツは WebFetch が取得を断る（`unable to fetch`）。`curl -sL -A 'Mozilla/5.0' <URL>` で HTML を取って本文を読む。
- AP（apnews.com）は AP 側が 403 を返す。同じ出来事を報じた別の媒体を使う。
- The Athletic など一覧に無い媒体は届かない（`ENOTFOUND`）。そのときは:
  1. 同じ出来事を報じた、上の一覧の媒体を探して開く。
  2. どれも開けなければ、WebSearch の結果に**引用として出た文**に書かれた事実（誰が・何を・いつ）だけを書き、
     通知の「書かなかった話／本文未確認」に URL を挙げる。要約文だけを根拠に、年数・金額・球団名を書かない。

### 3. データを書き換える（`data/stove-league.json`）
- `japanese[].timeline`: 新しい報道を**先頭に**足す（`date`・`ja`・`en`・`source`・`sourceName`）。同じ出来事を二重に足さない。
- `japanese[].headline` / `window`: **いまの状態**に書き直す（例: FA になった後に「翌日にFAになる」を残さない／判断期限が過ぎたら結果を書く）。
  `headline` は選手LPの説明文と検索結果にも使う＝1〜2文で「いまどうなっているか」。
- **毎回、全員の `headline` / `window`（と NPB組の `postingWatch.headline`）を今日の日付で読み直す**（報道の有無に関係なく）。
  - 過ぎた出来事を未来形で書いていないか（「FAになる」「〜日後に決める」「期限を迎える」）
  - 「ワールドシリーズ終了から5日後」のような相対の言い方は、決着後は**日本時間の実日付**に直す
    （日程表の実日付と同じ値。例: 「日本時間11月3日午前7時」。英語は「Nov. 3 at 7 a.m. Japan time (Nov. 2, 4 p.m. CT)」）
  - 見つけたら直し、その選手の `asOf` を今日にする（中身が変わった扱い）。
- `dates[]`: 報道で日付・時刻が確定した期限は、`afterWs` から固定の `date`（日本時間）＋`time` に直す
  （QO の受諾期限は「提示から何日」と決まっておらず、年ごとに MLB が日付を決める＝2026年は米中部11月17日午後3時＝日本時間11月18日午前6時）。
- `suitors`: 球団名を挙げた報道があれば足す（日本語の球団名は `src/lib/teams.ts` の短縮名）。
- `marketValue`: 記者・媒体が出した数字だけ（出典つき）。
- **決着**（契約・残留・再契約）: `outcome`＝`{ kind, date, team:{ja,en}, ja, en, source, sourceName }`。`ja` に年数・金額。
  `board[]` の同じ選手にも同じ `outcome` を入れる。オプトアウトせず残る選手は `kind:"stayed"`。
- `board[].note`: 状況が変わった選手だけ1文直す（契約したら契約内容に）。**全員の note も今日の日付で読み直す**
  （「FAになる見込み」「QOを出さないとの見方」のように、結果が出た後も予定の言い方が残りやすい）。
- 中身を変えた選手は `japanese[].asOf`（外国人の主役は `stars[].asOf`）を今日に。何か1つでも変えたらトップの `asOf` を今日に。**`checkedAt` は毎回今日**。
- NPB組は `src/lib/npbPlayers.ts` の `postingWatch`（`asOf`・`headline`・`timeline`・`suitors`・`level`）を同じ規律で更新。
  手続きが進んだら **`steps`**（`approved`＝容認／`filed`＝申請／`talks`＝MLBが受理して交渉開始／`declared`＝海外FA権の行使表明／
  `signed`＝契約）に日本時間の日付を足す。`/prospects` の表はこの値で「容認 → 申請 → 交渉開始」を並べる＝timeline に出典がある出来事だけ書く。
  **`until`＝交渉期限（日本時間の日付）**は、報道が期限の日時を書いたときだけ入れる（「45日」から自分で数えない）。
  期限を過ぎた朝は結果（契約＝`signed`／不成立）を必ず探し、`headline` を書き直す。

#### ロックアウト（`/stove-league/lockout`・`data/stove-lockout.json`）
労使協定は**日本時間12月2日午後1時59分**（米東部12月1日午後11時59分）に切れる。そこへ向けて毎朝ここも見る。
- `timeline`: 新しい動き（提案・声明・交渉の日程・期限の延長・ロックアウト入り・妥結）を**先頭に**足す（`date`＝日本時間・`ja`・`en`・`source`・`sourceName`）。
  誰が言ったか・何を提案したか・数字を、記事に書かれたとおりに書く。「〜が有力」「〜とみられている」は**媒体がそう書いたとき**だけ、媒体名を主語にして書く。
- `headline`: いまの状態の1〜2文（題の下・検索結果の説明文・FAQの1問目に使う）。動きがあった日は書き直す。
- **`status`** は事実が起きた朝に切り替える（題と見出しの言い方が変わる）:
  `pending`（期限の前）→ `on`（MLBがロックアウトを発表した）→ `ended`（新しい協定で合意した）。
  期限を過ぎたのに `pending` のままだと検査が警告を出す。期限が延びた・交渉を続けることで合意した、という報道なら `pending` のまま `headline` と `deadlineNote`、日程表の `cba` を直す。
- `issues`（争点）: 提案の数字が変わったら、その争点の文を書き直す（古い数字は「最初の提案は◯◯だった」と残してよい）。
- `japan`（日本人選手への影響）: ポスティングの交渉期間・FAの契約・WBCなど、**報道が日本人や制度に触れたとき**だけ直す。自分で影響を推し量って書かない。
- `history`（過去のロックアウト）: 触らない（年が替わるまで動かない）。
- 中身を1つでも変えたら `asOf` を今日に。**`checkedAt` は毎回今日**（`stove-league.json` と同じ規律）。
- ロックアウト中（`status:"on"`）は FA の契約・トレードが止まる＝`fetch-stove-moves.mjs` の新しい行が出なくなるのは正常。

#### 移籍情報（`/stove-league/moves`）と球団LPの補強の欄
- 行は `data/stove-moves.json`（MLB公式の取引記録）から自動で組まれる＝**このファイルを手で書き換えない**。
- 契約の年数・金額は取引記録に無い。**FA注目30人の契約は `board[].outcome` に書けば、移籍情報の行にも出典つきで出る**。
  30人の外の選手は条件を書く欄が無い＝書かない（球団名と「契約」「マイナー契約」だけが自動で出る）。
- 球団LPの「関心が報じられている選手」は `japanese[].suitors`・`postingWatch.suitors`・`board[].suitors` の球団名から逆引きする＝
  球団名は必ず `src/lib/teams.ts` の短縮名（「ドジャース」「ブルージェイズ」）で書く。表記がずれるとその球団のLPに出ない。

#### FA一覧（`/stove-league/fa`）の欄（2026-11-10〜）
FA注目30人の表は専用ページに分かれた。`board[]` の次の欄がその表の中身＝毎朝ここも見る。
- **QOの回答**（`board[].qo`）: 提示は `{"status":"offered"}`。受諾・拒否が報じられたら
  `{"status":"accepted"|"declined","date":"<日本時間>","source":"<URL>","sourceName":"<媒体>"}` に書き換える。
  回答期限（日程表の `qo-accept`）を過ぎた朝は、**全員の回答を必ず探して埋める**（`offered` のまま残さない）。
  受諾した選手は元の球団に1年契約で残る＝`outcome`（`kind:"re-signed"`・`years:1`・`usdM:<QOの額>`）も入れる。
- **契約**（`board[].outcome`）: 文章（`ja`/`en`）に加えて、**年数 `years` と総額 `usdM`（百万ドル単位の数値。4年1億500万ドル → `105`）**を入れる。
  報道に年数・金額が無いときは `years`/`usdM` を書かない（球団名だけの決着でよい）。日本人は `japanese[].outcome` にも同じものを入れる。
- **関心球団**（外国人は `board[].suitors`＝`{ja,en,source,sourceName}` の配列）: 記事が球団名を挙げて関心・交渉を報じたときだけ。
  日本人の関心球団は従来どおり `japanese[].suitors` / `postingWatch.suitors`（表はそちらを読む）。
- **予想契約と別の順位**（`board[].projection`・`espnRank`）は発表時の値＝**書き換えない**（MLB Trade Rumors と ESPN が11月3日に出した数字。
  出どころはカタログの `projection`・`altRanking`）。契約が決まっても消さない＝あとで「予想と実際の差」を出すための記録。

### 4. 海外の反応の記事（大きな動きがあった日だけ・1日1本まで）
**対象**: 日本人（MLB組・NPB組）の契約・QO・オプトアウトの決定・正式なポスティング申請、または FA注目10位以内の契約。無ければこの手順は飛ばす。

⚠️ **クラウドからは Reddit が 403 を返す**（2026-10-31 実測。通信許可は通っているが、Reddit がクラウドの通信元を拒否する。RSS も old.reddit も同じ）。
最初に `curl -s -o /dev/null -w '%{http_code}' -A 'Mozilla/5.0' 'https://www.reddit.com/r/baseball/.rss'` を**1回だけ**実行し、
200 以外なら下の 1〜4 を飛ばして 5 へ（rfeed は 403 だと計140秒待ち直すので回さない）。

1. `GAP=20000 node scripts/reddit-rss/rsearch.mjs '|"<英語名>"|week|top' '<関係球団の板>|<姓>|week|top'` でスレを探す。
2. `GAP=20000 node scripts/reddit-rss/rfeed.mjs '<スレURL>/.rss?limit=100' > /tmp/dump.txt`（2〜4スレ）。
3. 訳だけ書いた picks.json を作り `node scripts/reddit-rss/pick.mjs picks.json /tmp/dump*.txt > /tmp/comments.json`。
4. 記事は `.claude/skills/matome/SKILL.md`（R1〜R11）どおり。`data/threads/mlb/<JST日付>-<英語スラッグ>.json`（NPB組は `npb/`）。
   15〜30件・`score:0`・各コメントに `sourceUrl`・タグに選手名＋球団名＋`ストーブリーグ`＋`FA`（NPBは`ポスティング`）＋`海外の反応`。
   `fetchedAt` は**いまの実時刻**。ファンが挙げた数字は statsapi で当てて、合わない発言は使わない。
   成績ボックスは `node scripts/fetch-mlb-stats.mjs player <mlbId> --json`。
5. 🚨 Reddit に届かない（403・接続できない）ときは記事を作らず、候補（出来事と、探すべき板・検索語）を通知に書く。
   手元のセッション（村山さんの端末）からは Reddit に届くので、そこで記事にする。
   **2026-11-11〜 手元の Mac の定期実行（毎朝7時半・`references/local-reddit.md`）が、この候補を1日1本まで自動で記事にする**
   ＝クラウド側は data を出典つきで正しく書くことに集中すればよい（手元の実行は data から対象の出来事を読む）。

### 5. 検査と公開
1. `node scripts/check-stove-league.mjs` が ✓（✗ は直す。直せないものは元に戻す）。
   `data/stove-lockout.json` と `postingWatch.steps` の日付も同じコマンドが見る。⚠ の警告は通知に写す。
2. `npm run build:gate`（通常の build はクラウドで EMFILE で落ちる）。通ったときだけ次へ。
   クラウドでは10分を超える＝Bash の `run_in_background` で起動し、終了の通知を待つ（`sleep` を重ねて待たない）。
3. `git add -A && git commit -m "chore(stove): ストーブリーグを毎朝更新（<JST日付>）" && git push origin main`
   （クラウドでは push が claude/** ブランチに振り替わり、`cloud-articles-automerge` が main に入れて公開する）。
   競合したら `git pull --rebase origin main` してやり直す（最大5回）。

### 6. 完了通知（必ず1通）
Slack の自分宛DM（channel_id `U07D5DRCULF`、失敗時は `slack_search_users` で探す）。日本語で:
- 実行日（JST）と結果（更新あり／動きなしで確認のみ／一部失敗／失敗）
- 手順1の2本の成否と、手順2で検索した語の一覧（最低限の検索を全部やったかが分かるように）
- 変えたこと（選手ごとに1行・出典の媒体名）と、`outcome` を入れた契約。時制だけ直した選手もそう書く
- ロックアウト（`stove-lockout.json`）に足した動きと、`status` を変えたならその理由（動きなしなら「動きなし」と1行）
- 書かなかった話（噂だけ・出典が弱い・食い違い）＝人が判断する用
- 作った記事（URL）か、作らなかった理由（大きな動きなし／Reddit に届かない）
- 検査・build・push の結果（失敗ならエラーの該当行）
