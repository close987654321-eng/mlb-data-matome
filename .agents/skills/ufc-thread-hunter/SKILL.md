---
name: ufc-thread-hunter
description: r/MMA と r/ufc から日本人読者に刺さりそうな人気スレを探し、候補を採点・選定して、上位コメントを抜粋翻訳し data/threads/ufc/{id}.json を作成する。平良達郎、朝倉海、堀口恭司、UFCタイトル戦、P4P、王者交代、KO・一本、契約、階級論争、海外ファンの賛否が割れるMMA海外反応記事を自動化するときに使う。
---

# UFC スレ探索・記事化スキル

`r/MMA` / `r/ufc` の人気スレから、日本人読者に受けやすいものを選び、`matome` ルールで
`data/threads/ufc/{id}.json` を作る。

## 使う場面

- 「UFCで日本人受けするスレを探して記事にして」
- 「r/MMA / r/ufc から候補を選んでまとめて」
- 平良達郎、朝倉海、堀口恭司、日本人・日本開催・RIZIN出身選手の海外反応を探す
- タイトル戦、王者交代、P4P、階級論争、KO・一本、判定、契約、レジェンド比較で記事候補を選ぶ

記事の編集・翻訳・コメント配列は `matome` スキルの R1〜R4 を必ず使う。

## 取得元

- `r/MMA`
- `r/ufc`

Reddit 取得は既存スクリプトを使う:

```sh
node scripts/fetch-reddit.mjs list r/MMA week 20
node scripts/fetch-reddit.mjs list r/ufc week 20
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
  - トップページ、UFC一覧、必要ならサイト内の個別記事を確認する。
  - 同じ Reddit `sourceUrl`、同じ話題、同じ選手・試合・発言・記録の焼き直しは避ける。
- 公開待ち: `data/threads/ufc/*.json`
  - `id`、`sourceUrl`、`title.ja` / `title.en`、`tags` を確認する。
  - 未コミット・未公開でも、すでに JSON が存在するものは候補から外す。
- 判断が近い場合:
  - 既存記事と同じニュースでも、別スレでコメントの論点が明確に違う場合だけ採用してよい。
  - その場合は `summaryJa` で既存記事との差分が読者に伝わるようにする。

### 強い加点

- 日本・日本人関連:
  - 平良達郎 / Tatsuro Taira / Taira
  - 朝倉海 / Kai Asakura / Asakura
  - 堀口恭司 / Kyoji Horiguchi / Horiguchi
  - RIZIN、PRIDE、日本開催、日本人選手のUFC評価
- 日本で関心が強い選手・テーマ:
  - Islam Makhachev、Ilia Topuria、Alex Pereira、Jon Jones、Tom Aspinall
  - Conor McGregor、Khabib Nurmagomedov、Sean O'Malley、Max Holloway
- 話題:
  - タイトル戦、王者交代、P4P、階級上げ・階級下げ
  - KO、一本、判定議論、レフェリー、採点、ドーピング
  - 歴代比較、GOAT 論争、引退、契約、ファイトマネー

### 記事向き加点

- コメント数が多く、賛否やツッコミが割れている
- コメント同士が会話としてつながる
- 日本人読者に伝わりやすい驚き・皮肉・称賛・大喜利がある
- ただの速報ではなく、海外ファンの感情が見える
- 最後にオチとして使えるコメントがある

### 減点・除外

- 試合映像・画像だけでコメントに議論がない
- リークや噂だけでソースURLが弱い
- 過度な罵倒、差別、政治化で読み物にしにくい
- 日本人読者への説明コストが高すぎる内輪ネタ
- ソースURLが不明確、または転載元へ送客できない

## 推奨ワークフロー

1. `r/MMA` と `r/ufc` の `week` 上位 20 件を取得する。
2. `https://mlb-data-matome.vercel.app/` と `data/threads/ufc/*.json` を見て、公開済み・公開待ち記事と被る候補を除外する。
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
7. `data/threads/ufc/{YYYY-MM-DD}-{english-slug}.json` に保存する。
8. `node -e` などで JSON 構文を確認し、可能なら `npm run build` / `npm run typecheck` を実行する。

## 記事化ルール

- `sport` は必ず `ufc`。
- `subreddit` は実際の取得元（`r/MMA` or `r/ufc`）。
- `sourceUrl` は Reddit の実在URL。
- `id` は `{YYYY-MM-DD}-{english-slug}`。
- `tags` は日本語中心。例: `["平良達郎", "UFC", "P4P"]`。
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
