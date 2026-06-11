---
name: kaigai-matome-project
description: MLB・ボクシング・UFC の海外の反応まとめサイトを開発・運用する。Next.js 15、next-intl、data/threads 静的 JSON、競技カタログ、Reddit 手動運用、i18n、コード規約を踏まえて、このリポジトリの機能追加・修正・データ運用を行うときに使う。
---

# 海外の反応まとめ プロジェクトスキル

このリポジトリは、MLB・ボクシング・UFC の海外掲示板、主に Reddit の反応を日本語まとめにするサイト。
元は MLB 指標サイトだったが、2026-06 に「海外の反応まとめ」へ方向転換済み。

## 使う場面

- このリポジトリで機能追加、UI 修正、データ読み込み修正、i18n 修正を行う
- 競技カテゴリ、一覧、個別まとめページ、カード表示、タグ周りを触る
- Reddit まとめ JSON の運用ルールを確認しながら実装する

記事そのものを作る依頼は、既存の `matome` スキルを優先する。

## 技術スタック

- Framework: Next.js 15 App Router
- Language: TypeScript strict
- Styling: Tailwind CSS
- i18n: next-intl（日本語がデフォルト、英語あり）
- Data Storage: `data/threads/` 配下の静的 JSON
- Hosting: Vercel

## 主要ファイル

- `data/threads/{mlb,boxing,ufc}/{id}.json`: まとめデータ
- `src/app/[locale]/page.tsx`: 新着一覧（全競技横断）
- `src/app/[locale]/[sport]/page.tsx`: 競技別一覧
- `src/app/[locale]/[sport]/[id]/page.tsx`: まとめ個別
- `src/lib/sports.ts`: 競技カタログの唯一の正
- `src/lib/data.ts`: JSON 読み込みヘルパ
- `src/types/thread.ts`: まとめデータ型
- `messages/{ja,en}.json`: UI 文言
- `scripts/threads-update.md`: まとめ更新手順

## 競技カテゴリ

`src/lib/sports.ts` を唯一の正として扱う。

- `mlb`: MLB（r/baseball, r/mlb）
- `boxing`: ボクシング（r/Boxing）
- `ufc`: UFC（r/MMA, r/ufc）

競技を増減するときは、`src/lib/sports.ts`、`data/threads/{sport}/`、一覧やルーティングの影響を確認する。

## データ運用ルール

- ソースは Reddit。未認証 `.json` はこの環境の IP から 403 になりやすい。
- Reddit API は 2025/11 から事前承認制。承認まで当面は、ユーザーがスレ URL とコメントを貼る手動運用。
- 出力は `data/threads/{sport}/{id}.json`。型は `src/types/thread.ts` の `Thread`。
- 必須: `sport` はフォルダと一致、`id` は `{YYYY-MM-DD}-{slug}`、`sourceUrl` は実在する元スレ URL。
- コメントは抜粋のみ。`bodyEn` 原文と `bodyJa` 訳を両方入れる。
- 良いコメントには `isHighlight: true`、記事冒頭フックには必要に応じて `isHook: true`。
- 禁止: コメントの捏造、全文転載、画像・ロゴのコミット、Reddit データの AI/ML 学習利用。

## コード規約

- サーバーコンポーネントをデフォルトにし、クライアント化は最小限にする。
- データ読み込みは `src/lib/data.ts` 経由。`fs.readFile` をページやコンポーネントから直接呼ばない。
- Tailwind ユーティリティで完結させ、`*.module.css` は作らない。
- ユーザー可視文字列は `messages/{locale}.json` に置く。
- 競技ラベルは `src/lib/sports.ts` に集約する。
- コメントを書く場合は「なぜ」を短く書く。

## 作業手順

1. 触る領域に応じて `src/lib/sports.ts`、`src/lib/data.ts`、`src/types/thread.ts`、対象ページを読む。
2. 既存のデータ型と表示順を尊重して、最小範囲で実装する。
3. UI 文言を追加・変更する場合は `messages/ja.json` と `messages/en.json` を確認する。
4. まとめ JSON を追加・編集する場合は `matome` スキルと `scripts/threads-update.md` の規則に従う。
5. 可能なら `npm run build` か該当 lint/test を実行して確認する。
