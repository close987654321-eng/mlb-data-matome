# データ更新手順（Claude 用詳細メモ）

`CLAUDE.md` §3 の運用ルールを補足する作業手順書。

## 0. 前提

- 対象シーズンは `data/season-{YYYY}/`。新シーズンを開ける場合はディレクトリごと新規作成。
- 数値が取れなかった指標は `null`。0 や "-" を入れない。

## 1. 打者ランキング (batters.json)

優先順:

1. **FanGraphs Batting Leaders**
   `https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&qual=y&season={YYYY}`
   取得対象: `fWAR`, `wRC+`, `wOBA`, `xwOBA`, `Barrel%`, `HardHit%`, `OPS`, `BsR`,
   `Clutch`, `WPA` （勝負強さ系。FanGraphs Leaders の "Win Probability" タブで取得可能）

2. **Baseball-Reference Batting WAR**
   `https://www.baseball-reference.com/leaders/WAR_bat.shtml`
   取得対象: `bWAR`

3. **Baseball Savant**
   `https://baseballsavant.mlb.com/leaderboard/expected_statistics`
   `https://baseballsavant.mlb.com/leaderboard/statcast`
   取得対象: Statcast 系の補完（`xwOBA`, `Barrel%`, `HardHit%` の原典）

最低 30 名（fWAR 上位）を取り込む。

## 2. 投手ランキング (pitchers.json)

1. **FanGraphs Pitching Leaders**
   `https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&qual=y&season={YYYY}`
   取得: `fWAR`, `FIP`, `xFIP`, `SIERA`, `Stuff+`, `Location+`, `K-BB%`

2. **Baseball-Reference Pitching WAR**
   `https://www.baseball-reference.com/leaders/WAR_pitch.shtml`
   取得: `bWAR`

最低 30 名（fWAR 上位）を取り込む。

## 3. チームランキング (teams.json)

1. **FanGraphs Team Leaders**
   `https://www.fangraphs.com/leaders/team`
   30 球団分。`fWAR` (打+投の合算)、`wRC+` (チーム打撃)、`FIP` (チーム投手)。

## 4. 日本人選手特集 (japanese-players/{YYYY}.json)

対象: MLB 在籍の日本人選手全員。たとえ少出場でも掲載する。
更新元は §1〜§2 と同じだが、ID をハードコードで持っておくほうが安全。

現役（2026 年想定）: Shohei Ohtani / Yoshinobu Yamamoto / Roki Sasaki / Yu Darvish /
Seiya Suzuki / Masataka Yoshida / Shota Imanaga / Kodai Senga / Tomoyuki Sugano など。
（実際の名簿は FanGraphs の "Splits → Birth Country=Japan" で確認）

`name.ja` はカタカナ姓・名形式（例: "オオタニ・ショウヘイ"）。

## 5. meta.json

```json
{
  "updatedAt": "{JSTのISO8601}",
  "sources": {
    "fWAR":   { "url": "...", "fetchedAt": "..." },
    "wRC+":   { "url": "...", "fetchedAt": "..." },
    "FIP":    { "url": "...", "fetchedAt": "..." },
    "Stuff+": { "url": "...", "fetchedAt": "..." }
  },
  "notes": "fangraphs leaders がJS依存で取得不可だったため XXX にフォールバック等"
}
```

## 6. 動作確認

更新後は:

```bash
npm run typecheck
npm run dev
```

で http://localhost:3000 を開いて主要ページが描画されることを確認する。
