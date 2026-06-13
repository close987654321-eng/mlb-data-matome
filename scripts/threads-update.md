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
