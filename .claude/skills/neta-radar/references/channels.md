# 監視チャンネル台帳（YouTube 定点監視・Step 1-B）

`node scripts/fetch-youtube.mjs latest <channelId> 10` で巡回する対象。
⚠️ **channelId は必ず実測で埋める**（`fetch-youtube.mjs search "<チャンネル名>" 3` の結果の
`channelId` をコピー。推測・記憶で書かない＝別チャンネル誤認は記事の根拠が崩れる事故）。
増減はこのファイルだけ編集すればよい（SKILL.md 側は台帳を参照するだけ）。

channelId は 2026-07-03 に実測確定済み（`fetch-youtube.mjs search`＝UFC/TopRank、公式チャンネルページの
canonical リンク＝DAZN/Matchroom/HoH/RIZIN、全件 `fetch-youtube.mjs latest` で実コンテンツ解決を確認）。
⚠️ RIZIN は「RIZIN杯」(@RIZIN_official・別物) と紛らわしい＝正は @RIZIN_FF「RIZIN FIGHTING FEDERATION」。

| チャンネル | channelId | 競技 | 拾うもの | 足切り目安 |
| --- | --- | --- | --- | --- |
| MLB（公式） | UCoLrcjPV5PbUrUyXq5mjc_A | mlb | ハイライト以外のバズ枠（珍プレー・名場面集・密着）。定常ハイライトは jp-games の領分＝除外 | comment 中央値の2倍 |
| House of Highlights | UCqQo7ewe87aYAe7ub5UqXMw | mlb | MLB 珍プレー・バズ切り抜き・フルハイライト再編集 | viewCount 上位2本 |
| UFC（公式） | UCvgfXK4nTYKudb0rFR6noLA | mma | 日本人ファイター絡み・KO集・Free Fight・ナンバー大会 | comment 中央値の2倍 |
| RIZIN（公式） | UCZZ0UGjWsRdM8_5bsqtxYaQ | mma | 大会ハイライト・煽り映像の人気枠（LANDMARK 等） | comment 中央値の2倍 |
| Top Rank Boxing | UCbzRzJNHx7ZLlJML9BjZQVQ | boxing | 井上尚弥ら注目興行のフルファイト・ハイライト | comment 中央値の2倍 |
| DAZN Boxing | UCurvRE5fGcdUgCYWgh-BDsg | boxing | 興行ハイライト・記者会見/フェイスオフのバズ | comment 中央値の2倍 |
| Matchroom Boxing | UC7LReVje9aPB4B6XAsXX8WQ | boxing | 興行ハイライト・煽り | comment 中央値の2倍 |

> ℹ️ **クォータ運用の学び（2026-07-03）**: `search` は1回100ユニット＝1日約100回で上限（実際にこの初回
> セットアップ中に 429 到達）。ID の新規確認は search でなく**公式チャンネルページの canonical リンクを
> curl で読む**方が安く確実（`grep -oE 'rel="canonical" href=".*channel/UC[\w-]{22}"'`）。ページ内の最初の
> `"channelId"` は関連チャンネルの ID を拾う事故があるので canonical を使う。巡回本番の `latest` は
> playlistItems＝1ユニットで search とは別枠（429 中でも動く）。

## Reddit 巡回先（Step 1-D の「買い物リスト」・村山に注文する定番 URL）
API 承認待ちのため自動で読めない。注文するときはこの URL を添えて「開いて全選択コピペ」まで案内する。
- r/baseball（top/day）: https://old.reddit.com/r/baseball/top/?t=day
- r/mlb（top/day）: https://old.reddit.com/r/mlb/top/?t=day
- r/Boxing（top/day・興行週は top/week）: https://old.reddit.com/r/Boxing/top/?t=day
- r/MMA（top/day・UFC 週末は top/week）: https://old.reddit.com/r/MMA/top/?t=day
