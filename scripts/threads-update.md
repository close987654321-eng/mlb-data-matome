# 「海外の反応」まとめ更新手順（Claude 向け）

Reddit の盛り上がったスレを日本語まとめ（5ch まとめ風＝コメント翻訳中心）にする。
出力は `data/threads/{season}/{id}.json`（型は `src/types/thread.ts` の `Thread`）。

## ソースと既知の落とし穴

- ソースは Reddit（r/baseball, r/mlb, 各チーム sub）。
- **未認証の `www.reddit.com/.json` / `api.reddit.com` / 公開ミラーはこの環境の IP から
  403 で全滅する**（FanGraphs は通るが Reddit は通らない）。WebFetch も reddit.com は拒否。
- 確実に取れるのは公式 OAuth（script アプリ）だけ。`scripts/fetch-reddit.mjs` がそれ。

## セットアップ（最初の 1 回・人間の操作が必要）

1. <https://www.reddit.com/prefs/apps> で "script" タイプのアプリを作成
2. 環境変数を設定（`.env.local` 等、コミット禁止）:
   `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USERNAME` /
   `REDDIT_PASSWORD` / `REDDIT_USER_AGENT`

## 手順

```sh
# 1) 今週の人気スレを一覧して、まとめる対象を選ぶ
node scripts/fetch-reddit.mjs list r/baseball week 8

# 2) 選んだスレの本文+上位コメントを取得
node scripts/fetch-reddit.mjs thread <permalink-or-url> 40
```

3. 取得 JSON を元に `Thread` 形式へ翻訳・編集して保存:
   - `id` = `{YYYY-MM-DD}-{英語スラッグ}`、ファイルは `data/threads/{season}/{id}.json`
   - `comments` は上位＋面白いものを **抜粋**（全件転載しない）。`bodyEn` 原文と
     `bodyJa` 訳を両方入れる。特に良いものは `isHighlight: true`
   - `summaryJa` にスレの流れ・論点を要約。`tags` は日本語（選手名・話題）
   - `sourceUrl` は必ず元スレ URL（送客＝引用要件）

## 著作権の方針（必ず守る）

- 全コメント網羅・全文転載はしない。**抜粋 + 翻訳 + 元スレ送客**の編集物にする。
- 原文 `bodyEn` を併記して翻訳の透明性を保つ。
- 画像・ロゴはコミットしない（CLAUDE.md §3.4 準拠）。

## サンプルの後始末

`data/threads/2026/2026-06-09-sample-demo.json` は表示確認用ダミー（`isSample: true`）。
本物が 1 件入ったら削除してよい。
