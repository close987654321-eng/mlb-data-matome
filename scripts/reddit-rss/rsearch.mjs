// Reddit 公開RSSの検索エンドポイントでスレを探す（未認証・自己申告UA）。
// old.reddit の search HTML は 2026-08-20 時点でログイン壁（302 /login?reason=lor2）に変わったのでこちら。
const UA = 'MatomeMLBKaigai/1.0 (+https://matome-mlb-kaigai.jp)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#32;/g, ' ');

function parse(xml) {
  const out = [];
  for (const b of xml.split('<entry>').slice(1)) {
    const title = dec((b.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? '');
    const link = (b.match(/<link href="([^"]+)"/) ?? [])[1] ?? '';
    const updated = (b.match(/<updated>([^<]+)<\/updated>/) ?? [])[1] ?? '';
    const cat = (b.match(/<category term="([^"]+)"/) ?? [])[1] ?? '';
    out.push({ title, link, updated: updated.slice(0, 16), sub: cat });
  }
  return out;
}

// 引数: 'sub|query|t' の並び（sub 空なら全体検索）
const gap = Number(process.env.GAP ?? 20000);
let i = 0;
for (const spec of process.argv.slice(2)) {
  const [sub, q, t = 'year', sort = 'new'] = spec.split('|');
  const base = sub ? `https://www.reddit.com/r/${sub}/search.rss?restrict_sr=on&` : 'https://www.reddit.com/search.rss?';
  const url = `${base}q=${encodeURIComponent(q)}&sort=${sort}&t=${t}&limit=50`;
  if (i++) await sleep(gap);
  let res = await fetch(url, { headers: { 'user-agent': UA } });
  for (let w = 20000; !res.ok && (res.status === 429 || res.status === 403) && w <= 80000; w *= 2) {
    await sleep(w);
    res = await fetch(url, { headers: { 'user-agent': UA } });
  }
  if (!res.ok) { console.log(`\n== [${q}] ${sub || 'all'} HTTP ${res.status} ==`); continue; }
  const rows = parse(await res.text());
  console.log(`\n== [${q}] ${sub || 'all'} t=${t} (${rows.length}) ==`);
  for (const r of rows) console.log(`  ${r.updated}  r/${r.sub}  ${r.title}\n     ${r.link}`);
}
