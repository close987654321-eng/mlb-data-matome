# 海外の反応まとめ — Claude 向けプロジェクトガイド

このリポジトリは「**海外の反応まとめサイト**」です。**MLB・ボクシング・UFC** の海外掲示板
（主に Reddit）で盛り上がったスレッドを、現地ファンの生のコメントつきで日本語まとめ
（5ch まとめ風＝コメント翻訳中心）にして、英語が読めない日本のファンに届けます。

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

データベースは使いません。まとめは JSON として `data/` にコミットし、ビルド時に読み込んで
SSG します。

---

## 2. ディレクトリ構成

```
.
├── CLAUDE.md
├── README.md
├── data/
│   └── threads/
│       ├── mlb/{id}.json        # MLB のまとめ（1スレ1ファイル）
│       ├── boxing/{id}.json     # ボクシング
│       └── ufc/{id}.json        # UFC
├── messages/{ja,en}.json        # i18n
├── src/
│   ├── app/[locale]/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # 新着（全競技横断）
│   │   ├── [sport]/page.tsx         # 競技ごとの一覧
│   │   └── [sport]/[id]/page.tsx    # まとめ個別
│   ├── components/
│   │   ├── ThreadCard.tsx
│   │   └── LocaleSwitcher.tsx
│   ├── lib/
│   │   ├── data.ts              # JSON 読み込みヘルパ
│   │   └── sports.ts            # 競技カタログ（ラベル・subreddit・絵文字）
│   └── types/
│       ├── thread.ts           # まとめの型
│       └── common.ts
└── scripts/
    ├── fetch-reddit.mjs        # Reddit OAuth 取得スクリプト
    └── threads-update.md       # 更新手順
```

---

## 3. 競技（カテゴリ）

`src/lib/sports.ts` が唯一の正。競技を増減するときは必ずここから。

| sport    | ラベル       | 取得元 subreddit     |
| -------- | ------------ | -------------------- |
| `mlb`    | MLB          | r/baseball, r/mlb    |
| `boxing` | ボクシング   | r/Boxing             |
| `ufc`    | UFC          | r/MMA, r/ufc         |

---

## 4. まとめ更新プロトコル（Claude 向け）

まとめ記事を作る編集ルール（コメントの抜粋・並べ方・翻訳）は **`matome` スキル**
（`.claude/skills/matome/SKILL.md`）が正。「まとめ作って」等で発動する。
データ形式・運用の詳細は [`scripts/threads-update.md`](./scripts/threads-update.md)。要点:

### 4.1 データ取得

- ソースは Reddit。**未認証の `.json` / `api.reddit.com` / 公開ミラーはこの環境の IP から
  403 で全滅**（WebFetch も reddit.com 拒否）。確実なのは公式 OAuth（`scripts/fetch-reddit.mjs`）。
- ただし **Reddit API は 2025/11 から事前承認制**で、承認が下りるまでは取得できない。
  → 当面は **手動運用**（ユーザーがスレ URL とコメントを貼り、Claude が翻訳・整形）。

### 4.2 出力フォーマット

`data/threads/{sport}/{id}.json`（型は `src/types/thread.ts` の `Thread`）:

```json
{
  "id": "2026-06-10-why-no-second-ohtani",
  "sport": "mlb",
  "subreddit": "r/baseball",
  "sourceUrl": "https://www.reddit.com/r/baseball/comments/.../",
  "fetchedAt": "2026-06-10T12:00:00+09:00",
  "title": { "en": "...", "ja": "..." },
  "summaryJa": "スレの流れ・論点の要約",
  "flair": "Discussion",
  "totalComments": 147,
  "media": { "kind": "image", "url": "https://i.redd.it/xxxx.jpg", "credit": "u/foo · r/baseball" },
  "tags": ["大谷翔平", "二刀流"],
  "comments": [
    { "author": "user", "score": 87, "bodyEn": "...", "bodyJa": "...", "isHighlight": true }
  ]
}
```

### 4.3 更新時に必ずやること

- [ ] `sport` はフォルダと一致（`data/threads/{sport}/`）
- [ ] `id` は `{YYYY-MM-DD}-{英語スラッグ}` の kebab-case
- [ ] `sourceUrl` は実在する元スレ URL（**必ず送客**＝引用要件）
- [ ] コメントは**抜粋**（全件転載しない）。`bodyEn` 原文と `bodyJa` 訳を両方入れる
- [ ] 良いコメントに `isHighlight: true`
- [ ] 画像／動画があれば `media`（URL 参照・`credit` 必須。ファイルはコミットしない）
- [ ] `fetchedAt` は JST（ISO8601）

### 4.4 やってはいけないこと

- コメントを「推測」「捏造」で埋める（実在する発言だけを訳す）
- 全文転載・全コメント網羅（著作権配慮。抜粋＋翻訳＋送客の編集物にする）
- Reddit データを AI/ML 学習に使う（Reddit の規約・申請内容に反する）

### 4.5 メディア（画像・動画）の扱い

サムネ差別化のため記事ごとに `media`（`src/types/thread.ts` の `ThreadMedia`）を1点添える。
優先順位は **恒久URL ＞ ローカルコミット**：

- **動画**: YouTube / Streamable の**視聴URL**を `kind:"video"` で。自動で公式 iframe 埋め込みになる。
  期限つきの署名URL（`packaged-media.redd.it` / `preview.redd.it` 等）は**失効するので使わない**。
- **画像（URL）**: `i.redd.it` / `i.imgur.com` の**直リンク**を `kind:"image"` で。ホストを増やすときは
  `next.config.mjs` の `remotePatterns` に追加。
- **画像（ローカル）**: 恒久URLが無い場合のみ `public/media/{id}-{slug}.{png,jpg}` に置き、
  `url:"/media/..."` で参照する（`remotePatterns` 不要）。← §4.4 の旧「画像コミット禁止」を緩和。
  - ⚠️ ファイルは **`public/media/` だけ**。`data/` 配下にはコミットしない。
  - `credit`（出典）を必ず添える。中継フレーム/報道写真は著作権に配慮し、引用の範囲＋送客で運用。
  - 巨大ファイルを置かない（適度に圧縮）。ロゴ等のサイト素材は従来どおり `public/` 直下。

### 4.6 シリーズ（看板 watch-along 企画「海外ニキと見る」）

確実に毎試合作る固定企画（例: **海外ドジャースニキと見る**＝大谷／ドジャースの試合ハイライト
＋現地ファンのコメント）は、記事に `series` を付ける。付けると次が自動で効く:

- **タイトル定型化**: `海外ドジャースニキと見る 2026.6.10 ドジャース vs パイレーツ` を自動生成
  （`title.ja/en` は表示時に上書きされる。凝らなくてよい）
- **シリーズバッジ**: カード・記事に表示
- **`/watch` ハブ掲載**: 「海外ニキと見る」総合ページにシリーズ単位で並ぶ

```json
"series": { "id": "dodgers", "date": "2026-06-10", "opponent": { "ja": "パイレーツ", "en": "Pirates" } }
```

- シリーズ定義（接頭辞・自軍名・バッジ）は `src/lib/series.ts` の `SERIES` が**唯一の正**。
  新シリーズ（例: ヤンキースニキと見る）を増やすときはまずここに足す。
- `date` は試合日（`fetchedAt` とは別物）。シリーズ記事は**動画必須**（watch-along 表示）。
- **`/watch` ハブは「動画つき記事ぜんぶ」を載せる**（`media.kind:"video"` が条件）。固定シリーズは
  シリーズ単位の枠＋定型タイトル＋バッジで出し、`series` 無しの単発動画まとめ（ジャイアンツの
  名勝負など）は「注目の試合」枠に新着順で出る（タイトルは自由）。
- 動画つきだがハブに載せたくない記事は今のところ無い（動画＝watch-along＝ハブ掲載）。編集ルールは matome §R6。

---

## 5. i18n ルール

- デフォルトロケールは `ja`、英語は `en`
- ユーザー可視文字列は `messages/{locale}.json`
- まとめ本文（タイトル訳・要約・コメント訳）はデータ側（JSON）に持つ
- 競技ラベルは `src/lib/sports.ts`（`labelJa` / `labelEn`）

---

## 6. コード規約

- TypeScript strict
- サーバーコンポーネントをデフォルトに、クライアント化は最小限
- データ読み込みは `src/lib/data.ts` 経由（`fs.readFile` を直接呼ばない）
- Tailwind ユーティリティで完結。`*.module.css` は作らない
- コメントは「なぜ」を書く

---

## 7. よくある依頼パターン

| ユーザー依頼例                        | Claude のアクション                                       |
| ------------------------------------- | -------------------------------------------------------- |
| 「このスレでまとめ作って」＋URL＋コメント | §4 の手順で `data/threads/{sport}/{id}.json` を作成       |
| 「ボクシングのまとめ追加して」        | `data/threads/boxing/` に追加                            |
| 「競技を追加したい（例: NBA）」       | `src/lib/sports.ts` に追加 → `data/threads/{sport}/` を作る |
| 「英語版の文言がおかしい」            | `messages/en.json` を修正                                |

---

## 8. 将来やる予定（メモ）

- Reddit API 承認後、`scripts/fetch-reddit.mjs` で取得を半自動化
- 競技の追加（NBA / サッカー 等）
- 画像なしでの OGP・カード見栄え改善
- 過去まとめのアーカイブ / タグ一覧ページ
