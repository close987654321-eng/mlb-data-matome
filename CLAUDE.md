# MLB Data Site — Claude 向けプロジェクトガイド

このリポジトリは「日本人向け MLB データまとめサイト」です。WAR 以外の現代的な指標
（wRC+, xwOBA, Barrel%, FIP, Stuff+, OAA など）に基づいて、選手・チームを
ランキング表示することを目的としています。参考サイト: <https://nobita-retire.com/2026-mlb-war/>

ユーザーは Claude にデータ更新と機能追加の両方を依頼します。本ドキュメントは
Claude がこのリポジトリで作業するための運用ルールです。

---

## 1. 技術スタック

| 項目          | 採用                              |
| ------------- | --------------------------------- |
| Framework     | Next.js 15 (App Router)           |
| Language      | TypeScript (strict)               |
| Styling       | Tailwind CSS                      |
| i18n          | next-intl (日本語=デフォルト/英語) |
| Data Storage  | `data/` 配下の静的 JSON ファイル  |
| Hosting       | Vercel                            |

データベースは使いません。ランキング元データは JSON として `data/` にコミット
し、ビルド時に読み込んで SSG します。

---

## 2. ディレクトリ構成

```
.
├── CLAUDE.md                # 本ファイル
├── README.md                # 人間向けの簡易説明
├── data/
│   ├── season-{YYYY}/
│   │   ├── batters.json     # 打者ランキング元データ
│   │   ├── pitchers.json    # 投手ランキング元データ
│   │   ├── teams.json       # チームランキング元データ
│   │   └── meta.json        # 各データの取得日時・ソースURL
│   └── japanese-players/
│       └── {YYYY}.json      # 日本人選手特集用
├── messages/
│   ├── ja.json              # 日本語翻訳
│   └── en.json              # 英語翻訳
├── src/
│   ├── app/[locale]/        # i18n ルーティング配下
│   │   ├── layout.tsx
│   │   ├── page.tsx         # トップ
│   │   ├── batters/page.tsx
│   │   ├── pitchers/page.tsx
│   │   ├── teams/page.tsx
│   │   ├── japanese/page.tsx
│   │   └── stats/[metric]/page.tsx   # 指標別解説+ランキング
│   ├── components/
│   ├── lib/
│   │   ├── data.ts          # JSON 読み込みヘルパ
│   │   └── metrics.ts       # 指標メタ情報（意味・出典・単位）
│   └── types/
│       └── mlb.ts           # 共通型
└── scripts/
    └── update-data.md       # データ更新の手順メモ
```

---

## 3. データ更新プロトコル（Claude 向け）

ユーザーが「データを更新して」「最新の打者ランキングに直して」等と依頼した場合、
以下の手順で実施します。

### 3.1 ソース優先順位

1. **FanGraphs Leaders** (`https://www.fangraphs.com/leaders/...`)
   — fWAR, wRC+, wOBA, xwOBA, Barrel%, FIP, xFIP, SIERA, Stuff+, Location+, BsR
   — 静的取得できる view: `type=8` (Dashboard), `type=24` (Statcast), `type=36` (Stuff+)
   — `team=0,ts` を付けるとチームレベルの集計 (`stats=bat/pit/fld`)
2. **FanGraphs 個別選手ページ** (`https://www.fangraphs.com/players/{slug}/{id}/stats/{batting|pitching}`)
   — 重要: leaderboard が JS-only の view でも、個別ページの Standard 統計テーブルは
     静的 HTML で返る。日本人選手など特定選手の取得はこちら経由が確実。
3. **ESPN Standings** (`https://www.espn.com/mlb/standings/_/season/YYYY`)
   — チーム W/L/RunDiff
4. **Baseball-Reference** (`https://www.baseball-reference.com/leaders/`)
   — bWAR (rWAR)。ただし 403 が返るケースが多い (UA制限)
5. **Baseball Savant** (`https://baseballsavant.mlb.com/leaderboard/...`)
   — OAA, Sprint Speed (の予定だが) leaderboard は全て JS-only で WebFetch では取れない

#### 既知の落とし穴
- FG Leaders で `type=14` を指定しても **Pitch Value / 100** が返り、WPA/Clutch は出ない
- Savant の leaderboard は CSV/JSON エンドポイント込みで JS から fetch する設計のため、
  静的 HTML には player rows が一切含まれない
- bWAR は B-Ref の leaderboard が UA ブロックされるため、現状は取得不可

### 3.2 出力フォーマット

`data/season-{YYYY}/batters.json` の例:

```json
{
  "season": 2026,
  "updatedAt": "2026-05-25T00:00:00+09:00",
  "players": [
    {
      "id": "judge-aaron",
      "name": { "en": "Aaron Judge", "ja": "アーロン・ジャッジ" },
      "team": "NYY",
      "position": "RF",
      "stats": {
        "fWAR": 4.2,
        "bWAR": 4.1,
        "wRC+": 185,
        "wOBA": 0.435,
        "xwOBA": 0.418,
        "Barrel%": 22.1,
        "HardHit%": 58.3,
        "OPS": 1.012
      }
    }
  ]
}
```

`meta.json` は必ず以下のキーを含めること:

```json
{
  "updatedAt": "ISO8601",
  "sources": {
    "fWAR":   { "url": "...", "fetchedAt": "ISO8601" },
    "wRC+":   { "url": "...", "fetchedAt": "ISO8601" },
    "xwOBA":  { "url": "...", "fetchedAt": "ISO8601" }
  },
  "notes": "JSレンダリングのためfangraphs leadersは取れず baseball-reference にフォールバック等"
}
```

### 3.3 更新時に必ずやること

- [ ] `updatedAt` を JST で更新
- [ ] 取得ソース URL を `meta.json` に記録（フォールバックも含めて）
- [ ] 既存の指標キーを変更する場合は `src/lib/metrics.ts` も合わせて更新
- [ ] 新しい選手 ID は `lastname-firstname` の kebab-case で統一
- [ ] 日本人選手は `name.ja` を「カタカナ姓・名」形式で（例: "オオタニ・ショウヘイ"）
- [ ] スクレイプに失敗 / 取得不能だった指標は `null` を入れて欠損を明示する
      （0 や空文字を入れてはいけない）

### 3.4 やってはいけないこと

- データを「推測」「補完」で埋める（実測値が取れない場合は `null`）
- 既存の JSON を一括で書き換える前に diff を見ずに上書きする
- 著作権上問題になり得る画像・ロゴをコミットする

---

## 4. 指標カタログ

`src/lib/metrics.ts` に各指標のメタ情報（意味・単位・出典・「高いほど良いか」）を
一元管理します。新しい指標を追加するときは必ずここから始めること。UI 側はこの
カタログを参照して説明文・並び順・矢印を出します。

中心指標:

- **WAR 系**: fWAR / bWAR / rWAR
- **打撃**: wRC+ / wOBA / xwOBA / Barrel% / HardHit% / OPS+
- **投球**: FIP / xFIP / SIERA / Stuff+ / Location+ / K-BB%
- **守備・走塁**: OAA / DRS / UZR / BsR / Sprint Speed
- **勝負強さ**: Clutch / WPA

---

## 5. i18n ルール

- デフォルトロケールは `ja`
- すべてのユーザー可視文字列は `messages/{locale}.json` に置く
- 選手名はデータ側 (`name.en` / `name.ja`) に持たせ、コンポーネントで切替
- チーム略称（NYY 等）は翻訳しない（共通表記）

---

## 6. コード規約

- TypeScript strict
- サーバーコンポーネントをデフォルトに、クライアント化は最小限
- データ読み込みは `src/lib/data.ts` 経由（`fs.readFile` を直接呼ばない）
- Tailwind ユーティリティで完結させる。`*.module.css` は原則作らない
- コメントは「なぜ」だけ書く（何をしているかは識別子で示す）

---

## 7. よくある依頼パターン

| ユーザー依頼例                      | Claude のアクション                                  |
| ----------------------------------- | ---------------------------------------------------- |
| 「データを最新にして」              | §3 の手順で各 JSON を更新                           |
| 「日本人選手ページに〇〇を追加」    | `data/japanese-players/{YYYY}.json` を更新           |
| 「Stuff+ ランキングのページ作って」 | `src/lib/metrics.ts` に登録 → `/stats/stuff-plus` 追加 |
| 「英語版の文言がおかしい」          | `messages/en.json` を修正                            |
| 「Vercel にデプロイしたい」         | README のデプロイ手順を参照 / 不足あれば追記         |

---

## 8. 将来やる予定（メモ）

- GitHub Actions による日次自動更新（現状は手動）
- 個別選手詳細ページ
- 過去シーズン比較ビュー
- Recharts によるグラフ可視化
