# Reddit 深掘りスキャン手順（海外ファン同士のやり取りを採るための）

> 2026-08-23〜24 に実際に回して確立した手順。**狙うのは単独の名言ではなく「掛け合い」**＝
> 2〜4レスで完結する海外ファン同士のやり取り。これが x-post でも matome でも一番効く。
> スクリプトは `_local/reddit-scan/`（gitignore 済み・rscan / rthread / rsearch / rfeed / oldparse / toplist）。

## Step 0. 今日どのルートが通るか実測する（毎回・省略しない）

```sh
curl -s -o /dev/null -w "%{http_code}\n" -A 'Mozilla/5.0 ...' 'https://old.reddit.com/r/baseball/hot/'   # 302 = ログイン壁の日
curl -s -o /dev/null -w "%{http_code}\n" -A 'MatomeMLBKaigai/1.0 (+https://matome-mlb-kaigai.jp)' 'https://www.reddit.com/r/baseball/hot/.rss?limit=5'
```
- `.json` / `api.reddit.com` は**常に403**。叩かない。
- old.reddit の HTML が通る日だけ **▲スコアが取れる**（`oldparse.mjs`）。
- 302 `/login/?reason=lor2` に飛ぶ日は**公開RSSだけ**＝▲無しで回す。その日は**票の代わりに
  スレのタイトルとコメントの噛み合いで熱量を読む**。⚠️ **票が取れていない日は本文に票数を書かない**。

## Step 1. 板を選ぶ ＝ 大板でなく球団板

**コアな会話は r/baseball ではなく球団板にある。** r/baseball に出るのは記録・ハイライト・
ゲームスレで、掛け合いは球団板の内輪スレに埋まっている。所属は `data/jp-players-stats.json` の
`team` で確認してから板を決める（2026年: 大谷/山本/佐々木=r/Dodgers、誠也/今永=r/CHICubs、
千賀=r/NewYorkMets、吉田=r/redsox、岡本=r/Torontobluejays、村上=r/whitesox、今井=r/Astros、
菅野=r/ColoradoRockies、松井裕=r/Padres）。**r/NPB も第2の鉱脈**。

## Step 2. 探す ＝ 月間トップを選手名で引く

```sh
GAP=16000 node rsearch.mjs '{球団sub}|{選手名}|month|top' ...      # 検索RSS（複数まとめて）
GAP=16000 node rfeed.mjs 'https://www.reddit.com/r/{sub}/top.rss?t=week&limit=50'   # 一覧
```
返ってきたリストから、**ゲームスレ・ラインナップ・スタメン系を全部捨てる**。残った
「感想・考察・内輪スレ」だけが対象（08-18 誠也回の学びと同じ＝角度は考察スレにしか無い）。

## Step 3. 掘る ＝ コメントRSSは深さ優先＝連番が返信チェーン

```sh
GAP=16000 node rdump.mjs '<スレURL>.rss?limit=100' ...
```
`<entry>` は**深さ優先で並ぶ**ので、連番をそのまま読めばやり取りが復元できる（▲が無い日でも）。
⚠️ 親子の境目は取れない。**枝にぶら下がった逸話は、主語が誰か確定するまで使わない**。

## Step 4. 当たりスレの型（今回の実測で判明・これを探しに行く）

| 型 | 実例 |
| --- | --- |
| 球団公式が日本語で投稿したスレ | 岡本 俺は足が速いのだ（r/Torontobluejays） |
| 日本人ファンが板に書き込んだスレ | 日本は今朝11時、仕事中だけど応援してる（r/whitesox） |
| 選手の私的エピソード・内輪ネタ | ケサディーヤ／クラブハウスのビデ／登場曲を板が決める |
| 追悼・感謝の長文スレ | [Tribute] Masataka Yoshida gave his body...（r/redsox） |
| 「◯◯の豆知識：俺は彼が好き」型の愛でスレ | Fun fact about Shota Imanaga: I like him |
| レジェンドとの邂逅 | 今永×イチロー（r/CHICubs） |
| 日本のネットスラングが英語に渡っているスレ | ロストテクノロジー菅野／山本の言ってない名言集 |
| 事故・ハプニングを板が総出で処理するスレ | 千賀の初セーブ球を味方が客席へ投げ込んだ件 |

## Step 5. 濾す（ここで落とさないと後で事故る）

1. ⭐**日本語圏で既に流通しているネタは捨てる**。素材の面白さとは別の一次フィルタ
   （ウォシュレット／ビデは日本のまとめで既出だった＝2026-08-24 村山指摘）。
2. ⭐**板の数字は statsapi で当て直す**。ファンの神話化が混ざる（吉田回: 板の「ハムを痛めたまま
   34試合・.324」は実際は32試合・.308、語られた試合日も1日ズレていた）。
3. **原爆・9.11・人種の枝は落とす**。実測で毎回1〜2件は混ざる。
4. 賭けサイトのステマ・スパムを混ぜない（game-voices の実測で25%混入）。

## Step 6. 渡す

掛け合いは**2〜4レスの単位のまま**渡す（1レスに切ると面白さが消える）。素材は
`_local/reddit-scan/{テーマ}-{日付}.md` に**使わなかったものも全部**書き出す
（落とす作業は村山がやる＝x-post の「素材は先回りして削らない」と同じ）。
