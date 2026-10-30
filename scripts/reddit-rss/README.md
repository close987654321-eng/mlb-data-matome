# Reddit 公開RSSで海外の反応を集める（未認証・自己申告UA）

公式 API は事前承認制で使えない（CLAUDE.md §4.1）。未認証の `.json` は 403 だが、**公開RSS**は通る
（2026-08-16 実測）。元は `_local/reddit-scan/`（手元専用）にあったものを、クラウドの定期実行
（ストーブリーグの毎朝更新＝`.claude/skills/stove-daily/SKILL.md`）からも使えるようにリポジトリへ移した。

```bash
# 1) スレを探す（'サブ|クエリ|期間|ソート'。サブ空で全体検索）。GAP=ミリ秒の間隔
GAP=20000 node scripts/reddit-rss/rsearch.mjs '|"Seiya Suzuki"|week|top' 'CHICubs|Suzuki|week|top'
# 2) スレのコメントを吐く（スレURLの末尾に .rss?limit=100）
GAP=20000 node scripts/reddit-rss/rfeed.mjs '<スレURL>/.rss?limit=100' > /tmp/dump.txt
# 3) 訳だけ書いた picks.json から、author・本文・コメントURLを機械コピーして comments を組む
node scripts/reddit-rss/pick.mjs picks.json /tmp/dump.txt > comments.json
```

- **原文は手で打たない**＝pick.mjs がダンプから機械コピーする（転記ミスが捏造になるため）。部分抜粋は
  `en`（厳密な部分文字列）か `cut`（先頭から指定語句まで）。rfeed は本文を700字で切る。
- RSS には票数が無い＝`score: 0` で保存する（表示側が0のとき票を出さない）。
- 板の数字は鵜呑みにしない＝statsapi で当ててから採る。
- 生のダンプはコミットしない（記事に残すのは抜粋＋翻訳＋送客のみ）。他社リーダーの UA を騙らない。
- 429/403 は 20→40→80 秒で粘る。検索→取得は直列（並べると 429 で遅くなる）。
