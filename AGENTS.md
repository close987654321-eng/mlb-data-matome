# 海外の反応まとめ — Codex 向けプロジェクトガイド

このリポジトリは「**海外の反応まとめサイト**」です。**MLB・ボクシング・UFC** の海外掲示板
（主に Reddit）で盛り上がったスレッドを、現地ファンの生のコメントつきで日本語まとめ
（5ch まとめ風＝コメント翻訳中心）にして、英語が読めない日本のファンに届けます。

運用ルールの詳細は [`CLAUDE.md`](./CLAUDE.md) と内容を共有します（Codex / Claude 共通）。

> 沿革: 元は「MLB データまとめ（指標ランキング）」だったが、2026-06 に「MLB・ボクシング・
> UFC の海外の反応まとめ」へ方向転換。旧来の打者/投手/チーム/指標ページとデータは撤去済み。

---

## 1. 技術スタック

| 項目         | 採用                              |
| ------------ | --------------------------------- |
| Framework    | Next.js 15 (App Router)           |
| Language     | TypeScript (strict)               |
| Styling      | Tailwind CSS                      |
| i18n         | next-intl（日本語=デフォルト / 英語） |
| Data Storage | `data/threads/` 配下の静的 JSON   |
| Hosting      | Vercel                            |

---

## 2. ディレクトリ構成

```
data/threads/{mlb,boxing,ufc}/{id}.json   # まとめ（1スレ1ファイル）
src/app/[locale]/page.tsx                 # 新着（全競技横断）
src/app/[locale]/[sport]/page.tsx         # 競技ごとの一覧
src/app/[locale]/[sport]/[id]/page.tsx    # まとめ個別
src/lib/sports.ts                         # 競技カタログ（唯一の正）
src/lib/data.ts                           # JSON 読み込みヘルパ
src/types/thread.ts                       # まとめの型
messages/{ja,en}.json                     # i18n
scripts/fetch-reddit.mjs                  # Reddit OAuth 取得
scripts/threads-update.md                 # 更新手順
```

---

## 3. 競技（カテゴリ）

`src/lib/sports.ts` が唯一の正。

| sport    | ラベル     | subreddit          |
| -------- | ---------- | ------------------ |
| `mlb`    | MLB        | r/baseball, r/mlb  |
| `boxing` | ボクシング | r/Boxing           |
| `ufc`    | UFC        | r/MMA, r/ufc       |

---

## 4. まとめ更新の要点（詳細は scripts/threads-update.md）

- ソースは Reddit。**未認証 `.json` はこの環境の IP から 403**。確実なのは公式 OAuth
  だが **Reddit API は 2025/11 から事前承認制**。承認まで当面は**手動運用**
  （ユーザーがスレ URL とコメントを貼り、翻訳・整形）。
- 出力は `data/threads/{sport}/{id}.json`（型 `src/types/thread.ts` の `Thread`）。
- 必須: `sport`（フォルダと一致）/ `id` = `{YYYY-MM-DD}-{slug}` / 実在する `sourceUrl`（送客）。
- コメントは**抜粋**（全件転載しない）、`bodyEn` 原文と `bodyJa` 訳を両方、良いものに
  `isHighlight: true`。
- 禁止: コメントの捏造 / 全文転載 / 画像・ロゴのコミット / Reddit データの AI/ML 学習利用。

---

## 5. コード規約

- TypeScript strict。サーバーコンポーネント既定、クライアント化は最小限。
- データ読み込みは `src/lib/data.ts` 経由（`fs.readFile` 直叩き禁止）。
- Tailwind ユーティリティで完結。`*.module.css` は作らない。
- ユーザー可視文字列は `messages/{locale}.json`。競技ラベルは `src/lib/sports.ts`。
