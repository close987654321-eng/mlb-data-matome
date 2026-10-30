// rfeed のダンプから、指定したコメントの author / 本文を機械コピーして Thread.comments を組む（使い方は README.md）。
// 手打ちしない＝転記ミスが捏造になるのを防ぐため（memory reddit-rss-scan-route）。
// 使い方: node pick.mjs <picks.json> <dump1.txt> [dump2.txt ...] > comments.json
// picks.json: [{ "id": "phoymea", "ja": "訳", "isHook": true, "isHighlight": true, "en": "（任意）原文を部分抜粋するとき" }]
import fs from 'fs';

const [picksPath, ...dumps] = process.argv.slice(2);
const map = new Map();
for (const d of dumps) {
  const lines = fs.readFileSync(d, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^- \[[^\]]+\] \/u\/(\S+) \|/);
    if (!m) continue;
    const body = (lines[i + 1] ?? '').replace(/^  /, '');
    const link = (lines[i + 2] ?? '').trim();
    const id = (link.match(/\/([a-z0-9]+)\/$/) ?? [])[1];
    if (id) map.set(id, { author: m[1], body, link });
  }
}
const picks = JSON.parse(fs.readFileSync(picksPath, 'utf8'));
const out = [];
for (const p of picks) {
  const c = map.get(p.id);
  if (!c) { console.error(`MISSING ${p.id}`); process.exitCode = 1; continue; }
  if (c.body.length >= 700 && !p.en) console.error(`TRUNCATED? ${p.id} (${c.body.length} chars)`);
  if (p.en && !c.body.includes(p.en)) { console.error(`EXCERPT NOT FOUND ${p.id}`); process.exitCode = 1; }
  // cut: 原文の先頭から指定の語句までで切る（手で写さずに部分抜粋するため）
  if (p.cut) {
    const i = c.body.indexOf(p.cut);
    if (i < 0) { console.error(`CUT NOT FOUND ${p.id}`); process.exitCode = 1; }
    else p.en = c.body.slice(0, i + p.cut.length);
  }
  const row = { author: c.author, score: 0 };
  if (p.isHook) row.isHook = true;
  if (p.isHighlight) row.isHighlight = true;
  row.sourceUrl = c.link;
  row.bodyEn = p.en ?? c.body;
  row.bodyJa = p.ja;
  out.push(row);
}
console.log(JSON.stringify(out, null, 2));
