# MLB Data Site

日本人向け MLB データまとめサイト。WAR 以外の現代的な指標（wRC+, xwOBA, FIP, Stuff+, OAA など）に基づいて選手・チームをランク付けします。

## セットアップ

```bash
npm install
npm run dev
# http://localhost:3000 を開く
```

## データ更新

データ更新は Claude に依頼してください（例: 「打者ランキングを最新に更新して」）。
更新ロジックと出力フォーマットは [CLAUDE.md](./CLAUDE.md) を参照。

## デプロイ

Vercel にこのリポジトリを連携すれば自動デプロイされます。`main` ブランチに push すると本番、それ以外のブランチはプレビュー URL が発行されます。

## 海外の反応（Reddit まとめ）

`/threads` は、英語が読めない日本のファン向けに、野球系 subreddit（r/baseball など）の
盛り上がった**公開スレ**から数件のコメントを抜粋して日本語訳・要約するコーナーです。
各まとめは**抜粋のみ**を載せ、必ず**元スレへリンク**します（全文転載はしません）。

- 型定義: [`src/types/thread.ts`](./src/types/thread.ts)
- 取得スクリプト: [`scripts/fetch-reddit.mjs`](./scripts/fetch-reddit.mjs)
- 運用手順: [`scripts/threads-update.md`](./scripts/threads-update.md)

### Reddit Data API usage (for reviewers)

This project accesses the Reddit Data API in a **non-commercial, read-only,
low-volume** manner:

- **Read-only.** Only `GET` listing/comment endpoints (e.g. `/r/baseball/top`,
  thread permalinks). No posting, commenting, voting, messaging, or moderation.
- **Low volume.** Curation is manual — on the order of a few to a few dozen reads
  per day, far below the 100 queries/minute limit. No bulk crawling or dataset
  collection.
- **Attribution + link-back.** Every digest shows only a short excerpt of selected
  comments with a Japanese translation and **always links to the source thread**.
- **No AI/ML training.** Reddit data is never used to train or evaluate any model.
- **Non-commercial.** The site is not monetized. Authenticates as a single
  account via a "script" OAuth app.

Credentials are provided via environment variables and are never committed
(`.env*` is gitignored). See [`scripts/fetch-reddit.mjs`](./scripts/fetch-reddit.mjs).

## ディレクトリ

- `src/app/[locale]/` … i18n 配下のページ（ja / en）
- `data/` … スクレイプ済みランキングデータ（JSON）／`data/threads/` … 海外の反応まとめ
- `messages/` … i18n 翻訳ファイル
- `src/lib/metrics.ts` … 指標カタログ
- `scripts/` … データ更新スクリプトと手順メモ

詳細は [CLAUDE.md](./CLAUDE.md) を参照。
