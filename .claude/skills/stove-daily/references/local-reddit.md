# 手元の定期実行：ストーブリーグの反応記事（Reddit）

クラウドの毎朝6時の実行（`../SKILL.md`）は Reddit に届かない（Reddit がクラウドの通信元を 403 で断る）。
この手順は**村山さんの Mac の定期実行（毎朝7時半・アプリが開いている朝だけ）**が回し、
大きな動きがあった日に**1日1本まで**、Reddit の海外の反応を記事にして公開する。
編集ルールの正は `.claude/skills/matome/SKILL.md`、Reddit の取り方の正は `scripts/reddit-rss/README.md`。

## 絶対ルール

1. **コメントは1文字も創作しない**。原文・投稿者名・コメントURLは `scripts/reddit-rss/pick.mjs` がダンプから機械コピーする（手で写さない）。
   自分で書くのは訳（`ja`）と、記事の題・要約・タグだけ。訳で情報を足さない。
2. **1日1本まで**。対象が無い日は何も作らず、何もコミットしない（通知も送らない）。
3. 迷ったら作らない（対象かどうか曖昧・スレが見つからない・コメントが15件に届かない・検査やビルドが通らない）。
   そのときは作らなかった理由を通知に1行で書く。
4. 「ニキ」は使わない（「海外ファン」）。和文と英数字のあいだに半角スペースを入れない。
5. 作業は**専用の作業フォルダ（git worktree）**で行う。村山さんの作業中のフォルダ（`~/dev/stores/MLBデータまとめ`）のファイルは書き換えない。

## 手順

### 0. 準備
```bash
cd ~/dev/stores/MLBデータまとめ && git fetch origin main -q
WT=~/dev/stores/.stove-reddit-wt
git worktree remove --force "$WT" 2>/dev/null; git branch -D stove-reddit 2>/dev/null
git worktree add -q -b stove-reddit "$WT" origin/main && cd "$WT"
```
以降はすべて `$WT` の中で作業する。今日（JST）は `TZ=Asia/Tokyo date +%F`。

### 1. 対象の出来事を決める（無ければ終了）
直近48時間に、次のどれかがあったかを data から読む（報道の検索はしない＝6時の実行が済ませている）。
- `data/stove-league.json` の `japanese[]`・`stars[]` の `outcome`（契約・残留）か、`timeline` の先頭が
  QOの回答・オプトアウトの決定・契約の合意
- `src/lib/npbPlayers.ts` の `postingWatch.steps` に新しい `filed`（申請）・`signed`（契約）
- `data/stove-league.json` の `board[]` で順位10位以内の選手の `outcome`、または `data/stove-moves.json` で
  その選手の `signing` / `trade`
- ロックアウト入り・妥結（`data/stove-lockout.json` の `status` が変わった）

**すでに記事がある出来事は対象外**: `data/threads/mlb/`・`data/threads/npb/` に、その選手名のタグと
`ストーブリーグ` のタグを持ち、`fetchedAt` がその出来事の日以降の記事があれば作らない。
対象が複数あれば、日本人 ＞ 外国人の主役 ＞ FA上位10人 の順で1つだけ選ぶ。**1つも無ければ手順6（片づけ）へ**。

### 2. Reddit に届くか（1回だけ）
`GAP=20000 node scripts/reddit-rss/rsearch.mjs 'baseball|"<英語名>"|week|top'` を1回。結果が取れなければ（403・429 が続く）
記事を作らず、通知に「Reddit に届かない」と書いて手順6へ。
⚠️ **板を指定しない全体検索（`'|"<英語名>"|…'`）は 403 になる**（2026-11-11 実測。板の中の検索と板のフィードは通る）＝必ず板を指定する。
検索を続けて打つと 429 になる＝20秒以上あけて直列で、1回の実行で検索は5回まで。

### 3. スレを選んでコメントを取る
- 検索: `'baseball|"<英語名>"|week|top'` と `'<関係球団の板>|<姓>|week|top'`（球団の板＝Dodgers・CHICubs・NewYorkMets・Torontobluejays など）。直列で回す。
- その出来事を語っているスレを2〜4本選び、`GAP=20000 node scripts/reddit-rss/rfeed.mjs '<スレURL>/.rss?limit=100' > /tmp/stove-dump-N.txt`。
- 出来事より前の日付のスレ・別の話題のスレは使わない。

### 4. 記事を作る
- 15〜30件を選び、訳だけ書いた `picks.json` を作って
  `node scripts/reddit-rss/pick.mjs picks.json /tmp/stove-dump-*.txt > /tmp/stove-comments.json`。
  pick.mjs が弾いたコメント（原文と一致しない）は使わない。
- `data/threads/mlb/<JST日付>-<英語スラッグ>.json`（NPB組は `npb/`）を matome の R1〜R11 どおりに書く。
  `format:"reddit"`・`score:0`・各コメントに `sourceUrl`・`fetchedAt` は**いまの実時刻**（`TZ=Asia/Tokyo date +%FT%T+09:00`）。
  タグ＝選手名（カタログの表記）＋球団名＋`ストーブリーグ`＋`FA`（NPB組は `ポスティング`・労使は `ロックアウト`）＋`海外の反応`。
- ファンが挙げた数字（成績・金額）は、statsapi と `stove-league.json` の出典つきの値で当てる。合わない発言は使わない。
- 要約（`summaryJa`）に書く事実は、`stove-league.json` に出典つきで載っていることだけ。

### 5. 検査と公開
1. `node scripts/check-stove-league.mjs` が ✓。
2. `npm ci` → `npm run build:gate`（10分ほど。バックグラウンドで起動して終了を待つ）。通ったときだけ次へ。
3. `git add data/threads && git commit -m "feat(threads): <出来事>の海外の反応（ストーブリーグ・手元の定期実行）"`
   → `git push origin HEAD:main`。競合したら `git pull --rebase origin main` してやり直す（最大3回）。
   コミットするのは**新しい記事1本だけ**（ほかのファイルを変えていたら戻す）。

### 6. 片づけと通知
```bash
cd ~/dev/stores/MLBデータまとめ && git worktree remove --force ~/dev/stores/.stove-reddit-wt; git branch -D stove-reddit
rm -f /tmp/stove-dump-*.txt /tmp/stove-comments.json
```
記事を作った日・作ろうとして止めた日だけ、Slack の自分宛DM（channel_id `U07D5DRCULF`）に日本語で1通:
出来事／使ったスレ（URL）／コメントの件数／記事のURL（`https://matome-mlb-kaigai.jp/mlb/<id>`）／検査・ビルド・push の結果。
止めた日は理由を1行。対象が無かった日は送らない。
