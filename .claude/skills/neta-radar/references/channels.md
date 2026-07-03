# 監視チャンネル台帳（YouTube 定点監視・Step 1-B）

`node scripts/fetch-youtube.mjs latest <channelId> 10` で巡回する対象。
⚠️ **channelId は必ず実測で埋める**（`fetch-youtube.mjs search "<チャンネル名>" 3` の結果の
`channelId` をコピー。推測・記憶で書かない＝別チャンネル誤認は記事の根拠が崩れる事故）。
増減はこのファイルだけ編集すればよい（SKILL.md 側は台帳を参照するだけ）。

| チャンネル | channelId | 競技 | 拾うもの | 足切り目安 |
| --- | --- | --- | --- | --- |
| MLB（公式） | UCoLrcjPV5PbUrUyXq5mjc_A | mlb | ハイライト以外のバズ枠（珍プレー・名場面集・密着）。定常ハイライトは jp-games の領分＝除外 | comment 中央値の2倍 |
| RIZIN（公式） | 未実測（初回に search で確認して記入） | mma | 大会ハイライト・煽り映像の人気枠 | comment 中央値の2倍 |
| UFC（公式） | 未実測（初回に search で確認して記入） | mma | 日本人ファイター絡み・KO集・ナンバー大会 | comment 中央値の2倍 |
| Top Rank Boxing | 未実測（初回に search で確認して記入） | boxing | 井上尚弥ら注目興行のハイライト | comment 中央値の2倍 |
| DAZN Boxing | 未実測（初回に search で確認して記入） | boxing | 興行ハイライト・記者会見バズ | comment 中央値の2倍 |
| Matchroom Boxing | 未実測（初回に search で確認して記入） | boxing | 興行ハイライト | comment 中央値の2倍 |
| House of Highlights | 未実測（初回に search で確認して記入） | mlb | MLB 珍プレー・バズ切り抜き（過去に dodgers 回で実績） | viewCount 上位2本 |

## Reddit 巡回先（Step 1-D の「買い物リスト」・村山に注文する定番 URL）
API 承認待ちのため自動で読めない。注文するときはこの URL を添えて「開いて全選択コピペ」まで案内する。
- r/baseball（top/day）: https://old.reddit.com/r/baseball/top/?t=day
- r/mlb（top/day）: https://old.reddit.com/r/mlb/top/?t=day
- r/Boxing（top/day・興行週は top/week）: https://old.reddit.com/r/Boxing/top/?t=day
- r/MMA（top/day・UFC 週末は top/week）: https://old.reddit.com/r/MMA/top/?t=day
