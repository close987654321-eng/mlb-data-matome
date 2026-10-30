// 任意の Reddit 公開RSS（一覧 or スレのコメント）を取って人が読める形で吐く。
const UA = 'MatomeMLBKaigai/1.0 (+https://matome-mlb-kaigai.jp)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#32;/g, ' ');
const gap = Number(process.env.GAP ?? 20000);
let i = 0;
for (const url of process.argv.slice(2)) {
  if (i++) await sleep(gap);
  let res = await fetch(url, { headers: { 'user-agent': UA } });
  for (let w = 20000; !res.ok && (res.status === 429 || res.status === 403) && w <= 80000; w *= 2) {
    await sleep(w); res = await fetch(url, { headers: { 'user-agent': UA } });
  }
  if (!res.ok) { console.log(`\n#### ${url} HTTP ${res.status}`); continue; }
  const xml = await res.text();
  const feedTitle = dec((xml.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? '');
  const entries = xml.split('<entry>').slice(1);
  console.log(`\n#### ${feedTitle}  [${entries.length}]  ${url}`);
  for (const b of entries) {
    const author = (b.match(/<name>([^<]+)<\/name>/) ?? [])[1] ?? '';
    const title = dec((b.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? '');
    const updated = ((b.match(/<updated>([^<]+)<\/updated>/) ?? [])[1] ?? '').slice(0, 16);
    const link = (b.match(/<link href="([^"]+)"/) ?? [])[1] ?? '';
    const raw = (b.match(/<content type="html">([\s\S]*?)<\/content>/) ?? [])[1] ?? '';
    const content = dec(dec(raw)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/submitted by.*$/, '').trim();
    console.log(`- [${updated}] ${author} | ${title.slice(0, 90)}\n  ${content.slice(0, 700)}\n  ${link}`);
  }
}
