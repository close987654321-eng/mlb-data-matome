# 「海外の反応」まとめ更新手順（Claude 向け）

Reddit の盛り上がったスレを日本語まとめ（5ch まとめ風＝コメント翻訳中心）にする。
対象は **MLB / ボクシング / UFC** の3競技。
出力は `data/threads/{sport}/{id}.json`（型は `src/types/thread.ts` の `Thread`）。

## 競技と取得元

| sport    | subreddit            |
| -------- | -------------------- |
| `mlb`    | r/baseball, r/mlb    |
| `boxing` | r/Boxing             |
| `ufc`    | r/MMA, r/ufc         |

（`src/lib/sports.ts` が正。競技を増やすときはまずここに追加する）

## 既知の落とし穴

- **未認証の `www.reddit.com/.json` / `api.reddit.com` / 公開ミラーはこの環境の IP から
  403 で全滅する**。WebFetch も reddit.com は拒否。
- 確実に取れるのは公式 OAuth（script アプリ）だけ = `scripts/fetch-reddit.mjs`。
  ただし **Reddit API は 2025/11 から事前承認制**（[[reddit-api-approval-gate]]）。承認が
  下りるまでは「ユーザーがスレ本文・コメントをコピペ → Claude が翻訳・整形」の**手動運用**。

## 手順（API 承認後）

```sh
# 1) 今週の人気スレを一覧して対象を選ぶ（競技ごとに subreddit を変える）
node scripts/fetch-reddit.mjs list r/baseball week 8   # 例: MLB

# 2) 選んだスレの本文+上位コメントを取得
node scripts/fetch-reddit.mjs thread <permalink-or-url> 40
```

## 手順（手動運用・当面こちら）

> 記事の編集ルール（コメントの抜粋・並べ方・翻訳）は **`matome` スキル**
> （`.claude/skills/matome/SKILL.md`）が正。要点: R1 繋がりを持たせて並べる /
> R2 最後はオチ / R3 抜粋は 15〜30 件。記事ページは配列順そのまま表示する。

1. ユーザーが Reddit のスレ URL とコメント（人気順で数件）を貼る。
2. Claude が `matome` スキルに従って `Thread` 形式へ翻訳・編集して保存:
   - `sport` = `mlb` / `boxing` / `ufc`、ファイルは `data/threads/{sport}/{id}.json`
   - `id` = `{YYYY-MM-DD}-{英語スラッグ}`
   - `comments` は人気＋面白いものを**抜粋**（全件転載しない）。`bodyEn` 原文と `bodyJa`
     訳を両方入れ、特に良いものは `isHighlight: true`
   - `summaryJa` にスレの流れ・論点を要約。`tags` は日本語（選手名・話題）
   - `sourceUrl` は必ず元スレ URL（送客＝引用要件）

## 著作権の方針（必ず守る）

- 全コメント網羅・全文転載はしない。**抜粋 + 翻訳 + 元スレ送客**の編集物にする。
- 原文 `bodyEn` を併記して翻訳の透明性を保つ。
- 画像・ロゴはコミットしない。
