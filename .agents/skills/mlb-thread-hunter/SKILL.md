---
name: mlb-thread-hunter
description: r/mlb と r/baseball から日本人読者に刺さりそうな人気スレを探し、候補を採点・選定して、上位コメントを抜粋翻訳し data/threads/mlb/{id}.json を作成する。大谷翔平、山本由伸、村上宗隆、佐々木朗希、今永昇太、鈴木誠也、日本で関心が強い球団、MVP・サイ・ヤング・契約金・歴代比較・記録更新などのMLB海外反応記事を自動化するときに使う。
---

# MLB スレ探索・記事化スキル

r/mlb / r/baseball の人気スレから、日本人読者に受けやすいものを選び、`matome` ルールで
`data/threads/mlb/{id}.json` を作る。

## 使う場面

- 「MLBで日本人受けするスレを探して記事にして」
- 「r/mlb / r/baseball から候補を選んでまとめて」
- 大谷翔平、山本由伸、村上宗隆、佐々木朗希、今永昇太、鈴木誠也などの海外反応を探す
- MVP、サイ・ヤング、契約金、歴代比較、記録更新、球団人気で記事候補を選ぶ

記事の編集・翻訳・コメント配列は `matome` スキルの R1〜R4 を必ず使う。

## 取得元

- `r/mlb`
- `r/baseball`

Reddit 取得は既存スクリプトを使う:

```sh
node scripts/fetch-reddit.mjs list r/mlb week 20
node scripts/fetch-reddit.mjs list r/baseball week 20
node scripts/fetch-reddit.mjs thread <permalink-or-url> 60
```

注意:
- 未認証 `.json` はこの環境の IP から 403 になりやすい。
- `scripts/fetch-reddit.mjs` は Reddit OAuth 環境変数が必要。
- OAuth が使えない場合は、ユーザーに候補URLまたはコメント貼り付けを依頼し、手動運用に切り替える。

## 候補選定

人気順だけで選ばない。以下を合計して「日本人読者に刺さる順」に並べる。

### 重複チェック（必須）

記事化する前に、公開済みサイトとローカルの公開待ち記事の両方を確認し、既存記事と被るスレは除外する。

- 公開済み: `https://mlb-data-matome.vercel.app/`
  - トップページ、MLB一覧、必要ならサイト内の個別記事を確認する。
  - 同じ Reddit `sourceUrl`、同じ話題、同じ選手・発言・試合・記録の焼き直しは避ける。
- 公開待ち: `data/threads/mlb/*.json`
  - `id`、`sourceUrl`、`title.ja` / `title.en`、`tags` を確認する。
  - 未コミット・未公開でも、すでに JSON が存在するものは候補から外す。
- 判断が近い場合:
  - 既存記事と同じニュースでも、別スレでコメントの論点が明確に違う場合だけ採用してよい。
  - その場合は `summaryJa` で既存記事との差分が読者に伝わるようにする。

### 強い加点

- 日本人選手:
  - 大谷翔平 / Shohei Ohtani / Ohtani
  - 山本由伸 / Yoshinobu Yamamoto / Yamamoto
  - 村上宗隆 / Munetaka Murakami / Murakami
  - 佐々木朗希 / Roki Sasaki / Sasaki
  - 今永昇太 / Shota Imanaga / Imanaga
  - 鈴木誠也 / Seiya Suzuki / Suzuki
- 日本で関心が強い球団:
  - Dodgers / Los Angeles Dodgers / LAD
  - Cubs / Chicago Cubs / CHC
  - Padres / San Diego Padres / SD
  - White Sox / Chicago White Sox / CWS
- 話題:
  - MVP、Cy Young、契約金、年俸、トレード、FA、契約延長
  - 歴代比較、記録更新、殿堂入り、GOAT 論争
  - 日本人選手の米国評価、過大評価/過小評価、嫉妬、驚き、称賛

### 記事向き加点

- コメント数が多く、賛否やツッコミが割れている
- コメント同士が会話としてつながる
- 日本人読者に伝わりやすい驚き・皮肉・称賛・大喜利がある
- ただのニュースではなく、海外ファンの感情が見える
- 最後にオチとして使えるコメントがある

### 減点・除外

- スコアは高いがコメントが薄い、または内輪ネタすぎる
- 画像・動画だけでコメントに議論がない
- 日本人読者への説明コストが高すぎる
- ソースURLが不明確、または転載元へ送客できない
- コメントの大半が罵倒だけで、会話として読ませにくい

## 推奨ワークフロー

1. `r/mlb` と `r/baseball` の `week` 上位 20 件を取得する。
2. `https://mlb-data-matome.vercel.app/` と `data/threads/mlb/*.json` を見て、公開済み・公開待ち記事と被る候補を除外する。
3. 必要なら `day` / `month` も見る。速報なら `day`、普遍ネタなら `week` を優先。
4. 候補を 3〜5 件に絞り、各候補について:
   - タイトル
   - subreddit
   - スコア
   - コメント数
   - 日本人受け理由
   - 重複チェック結果
   - 懸念点
   を短く比較する。
5. 最有力候補のスレ本文と上位コメントを `thread` で取得する。
6. `matome` スキルに従い、15〜30 コメントを抜粋・翻訳する。
7. `data/threads/mlb/{YYYY-MM-DD}-{english-slug}.json` に保存する。
8. `node -e` などで JSON 構文を確認し、可能なら `npm run build` / `npm run typecheck` を実行する。

## 記事化ルール

- `sport` は必ず `mlb`。
- `subreddit` は実際の取得元（`r/mlb` or `r/baseball`）。
- `sourceUrl` は Reddit の実在URL。
- `id` は `{YYYY-MM-DD}-{english-slug}`。
- `tags` は日本語中心。例: `["大谷翔平", "ドジャース", "MVP"]`。
- `summaryJa` には、なぜ日本人読者が読む価値があるかも自然に入れる。
- `comments` は全件転載しない。抜粋・翻訳・送客の編集物にする。
- `bodyEn` と `bodyJa` を両方入れる。
- 1つだけ `isHook: true` を選び、数個だけ `isHighlight: true` を付ける。

## 候補比較メモの型

候補を選ぶときは、作業メモとして以下の形で考える。

```text
1. title
   url:
   subreddit:
   score/comments:
   日本人受け:
   記事向き:
   重複:
   懸念:
   判定:
```

ユーザーに逐一確認が必要な場合を除き、最有力候補を自分で選んで記事化まで進める。
