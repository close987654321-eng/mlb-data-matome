# 海外の反応 — MLB / ボクシング / UFC

英語が読めなくても、海外掲示板（Reddit）で盛り上がったスレを、現地ファンの生の
コメントつきで日本語まとめにして読めるサイト。対象は **MLB・ボクシング・UFC** の3競技。

各まとめは**抜粋＋翻訳＋元スレへのリンク**で構成し、全文転載はしません。

## セットアップ

```bash
npm install
npm run dev
# http://localhost:3000 を開く
```

## まとめの追加・更新

Claude に依頼してください（例: 「このスレでまとめ作って」＋ Reddit のスレURL）。
記事の編集ルール（抜粋・並べ方・翻訳・タイトル・要約）は
[.claude/skills/matome/SKILL.md](./.claude/skills/matome/SKILL.md)、
更新ロジックと手順は [scripts/threads-update.md](./scripts/threads-update.md)、
出力フォーマットの型は [src/types/thread.ts](./src/types/thread.ts) を参照。

データは競技ごとに `data/threads/{sport}/{id}.json` に置きます（`sport` = `mlb` /
`boxing` / `ufc`）。

## デプロイ

Vercel にこのリポジトリを連携すれば自動デプロイされます。`main` に push で本番、
それ以外のブランチはプレビュー URL。

## ディレクトリ

- `src/app/[locale]/` … i18n 配下のページ（ja / en）
  - `page.tsx` … 新着（全競技横断）
  - `[sport]/page.tsx` … 競技ごとの一覧
  - `[sport]/[id]/page.tsx` … まとめ個別ページ
- `data/threads/{sport}/` … まとめ JSON（1スレ1ファイル）
- `src/lib/sports.ts` … 競技カタログ（ラベル・subreddit・絵文字）
- `src/lib/data.ts` … JSON 読み込みヘルパ
- `messages/` … i18n 翻訳ファイル
- `scripts/` … Reddit 取得スクリプトと手順メモ

### Reddit Data API usage (for reviewers)

This project accesses the Reddit Data API in a **non-commercial, read-only,
low-volume** manner. It reads public posts/comments from a few sports subreddits
(r/baseball, r/Boxing, r/MMA, etc.), and each digest shows only a short excerpt of
selected comments with a Japanese translation and **always links back to the source
thread**. No posting/voting/moderation, no bulk crawling, no AI/ML training on
Reddit data. Credentials are provided via environment variables and never committed
(`.env*` is gitignored). See [scripts/fetch-reddit.mjs](./scripts/fetch-reddit.mjs).

詳細な運用ルールは [CLAUDE.md](./CLAUDE.md) を参照。
