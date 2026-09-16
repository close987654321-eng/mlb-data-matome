#!/usr/bin/env node
/**
 * NEXT MLB（NPB注目株）の成績を NPB 公式（npb.jp）から取りに行く。
 *
 * なぜ要るか:
 *   /prospects の選手LPは MLB公式 Stats API の外（statsapi は NPB を持たない）にあるため、成績を
 *   **手入力**していた。結果、2026-06-29 に入れた数値が 09-13 まで据え置かれ、ポスティング報道で
 *   読者が一番来る時期に「6月の成績が載ったLP」になっていた（`season.asOf` が証拠）。
 *   鮮度そのものが信頼になる面なので、取得を機械化して編集判断だけを人に残す。
 *
 * データ源: NPB公式（npb.jp）の
 *   - 個人年度別成績 /bis/players/{id}.html   → 年度別（通算の背骨・「{選手} 成績」クエリの受け皿）
 *   - リーダーズ     /bis/{year}/stats/l{b,p}_{cat}_{c,p}.html → リーグ内順位（タイトル争いの現在地）
 *   どちらも公知の数値だけを読む＝ロゴ・写真・表組みそのものは持ち出さない（CLAUDE.md §4.1 と同じ posture）。
 *   ⚠️ サイト本体（Next.js ランタイム）は npb.jp を叩かない。読むのは書き出した静的JSONだけ。
 *
 * 使い方:
 *   node scripts/fetch-npb-stats.mjs              # data/npb-prospects-stats.json を更新
 *   node scripts/fetch-npb-stats.mjs --dry        # 書かずに差分だけ見る
 *   node scripts/fetch-npb-stats.mjs --year 2026  # 対象シーズン（既定=今年）
 *
 * 選手の追加は src/lib/npbPlayers.ts に `npbId`（npb.jp の選手ID）を足すだけ＝カタログが唯一の正。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'npb-prospects-stats.json');
const UA = 'MatomeMLBKaigai/1.0 (+https://matome-mlb-kaigai.jp)';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const YEAR = Number(args[args.indexOf('--year') + 1]) || new Date().getFullYear();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 0, wait = 1500; attempt < 4; attempt++, wait *= 2) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.ok) return res.text();
    if (res.status === 404) throw new Error(`404 ${url}`);
    await sleep(wait);
  }
  throw new Error(`fetch failed: ${url}`);
}

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/　/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * 年度別成績テーブル1つ。投球回のセルは入れ子の <table class="table_inning">（整数と 1/3 の分数が
 * 別セル）なので、先に「158.2」の1値へ畳んでから列を読む＝畳まないと列がずれて打者成績と混ざる。
 */
function parseStatsTable(html) {
  const headHtml = html.match(/<thead>([\s\S]*?)<\/thead>/);
  if (!headHtml) return null;
  const head = [...headHtml[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]));
  const bodyStart = html.indexOf('<tbody>');
  if (bodyStart < 0) return null;
  const rows = [];
  for (const chunk of html.slice(bodyStart).split('<tr class="registerStats">').slice(1)) {
    const folded = chunk.replace(
      /<td>\s*<table class="table_inning">[\s\S]*?<\/table>\s*<\/td>/g,
      (cell) => {
        const whole = strip((cell.match(/<th>([\s\S]*?)<\/th>/) ?? [])[1] ?? '');
        const rest = cell.slice(cell.indexOf('</th>'));
        const frac = strip((rest.match(/<td>([\s\S]*?)<\/td>/) ?? [])[1] ?? '');
        return `<td>${whole}${frac}</td>`;
      },
    );
    const cells = [...folded.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    if (!cells.length) continue;
    if (!/^\d{4}$/.test(cells[0])) continue;
    rows.push(Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ''])));
  }
  return { head, rows };
}

/** 個人ページ（プロフィール＋年度別の投手/打者テーブル）。 */
async function fetchPlayer(npbId) {
  const html = await get(`https://npb.jp/bis/players/${npbId}.html`);
  const profile = {};
  for (const m of html.matchAll(/<th>([^<]+)<\/th>\s*<td>([\s\S]*?)<\/td>/g)) {
    const key = strip(m[1]);
    if (['ポジション', '投打', '身長／体重', '生年月日', '経歴', 'ドラフト'].includes(key)) {
      profile[key] = strip(m[2]);
    }
  }
  const pi = html.indexOf('id="tablefix_p"');
  const bi = html.indexOf('id="tablefix_b"');
  const pitching = pi >= 0 ? parseStatsTable(html.slice(pi, bi > pi ? bi : undefined)) : null;
  const batting = bi >= 0 ? parseStatsTable(html.slice(bi)) : null;
  return { profile, pitching, batting };
}

/** リーダーズ（打撃7部門・投手3部門）。名前は「佐藤輝明(神)」の形で返る。 */
const LEADER_CATS = [
  ['lb', 'avg', '打率', 'AVG'],
  ['lb', 'hr', '本塁打', 'HR'],
  ['lb', 'rbi', '打点', 'RBI'],
  ['lb', 'h', '安打', 'H'],
  ['lb', 'obp', '出塁率', 'OBP'],
  ['lb', 'slg', '長打率', 'SLG'],
  ['lb', 'sb', '盗塁', 'SB'],
  ['lp', 'era', '防御率', 'ERA'],
  ['lp', 'w', '勝利', 'W'],
  ['lp', 'so', '奪三振', 'SO'],
];

async function fetchLeaders(year) {
  const out = {};
  let asOf = '';
  for (const league of ['c', 'p']) {
    for (const [prefix, slug, ja, en] of LEADER_CATS) {
      const url = `https://npb.jp/bis/${year}/stats/${prefix}_${slug}_${league}.html`;
      let html;
      try {
        html = await get(url);
      } catch {
        continue; // 開幕前など、その部門がまだ無い時期は黙って飛ばす
      }
      const m = strip(html).match(/(\d{4})年(\d{1,2})月(\d{1,2})日 現在/);
      if (m) asOf = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
      const rows = [];
      for (const r of html.matchAll(/<tr class="ststats">([\s\S]*?)<\/tr>/g)) {
        const cells = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => strip(x[1]));
        if (cells.length >= 3 && /^\d+$/.test(cells[0])) {
          rows.push({ rank: Number(cells[0]), name: cells[1], value: cells[2] });
        }
      }
      out[`${league}-${prefix}-${slug}`] = {
        ja,
        en,
        league: league === 'c' ? 'CL' : 'PL',
        // 打者部門か投手部門か。投手も打席に立つので絞らないと平良海馬のLPに
        // 「安打 パ・リーグ150位」が出る（2026-09-16 実測）。
        kind: prefix === 'lb' ? 'batting' : 'pitching',
        url,
        rows,
      };
      await sleep(600);
    }
  }
  return { asOf, cats: out };
}

/** カタログ（TS）から slug と npbId だけを拾う＝TS を import せずに正を1か所に保つ（check-player-names.mjs と同じ手）。 */
function catalog() {
  const src = readFileSync(path.join(ROOT, 'src/lib/npbPlayers.ts'), 'utf8');
  const out = [];
  for (const block of src.split(/\n  \{\n/).slice(1)) {
    const slug = (block.match(/slug:\s*'([^']+)'/) ?? [])[1];
    const npbId = (block.match(/npbId:\s*'([^']+)'/) ?? [])[1];
    const nameJa = (block.match(/nameJa:\s*'([^']+)'/) ?? [])[1];
    if (slug && npbId) out.push({ slug, npbId, nameJa });
  }
  return out;
}

/**
 * リーダーズの氏名表記とカタログ名の突き合わせ。
 *
 * ⚠️ npb.jp は一部の漢字に CJK 互換漢字を使う（伊藤大海の「海」は U+FA45、常用の U+6D77 ではない）。
 * 生の比較だと一致せず、その選手だけ順位が空になる（2026-09-16 に伊藤で実測）。NFKC に正規化して比べる。
 * 部門の種別（打撃/投手）で絞るのは、投手も打席に立ってしまうため（平良海馬が「安打150位」を拾っていた）。
 */
const norm = (s) => s.normalize('NFKC');
function rankOf(cats, nameJa, kind) {
  const rows = [];
  const want = norm(nameJa);
  for (const [, cat] of Object.entries(cats)) {
    if (cat.kind !== kind) continue;
    const hit = cat.rows.find((r) => norm(r.name.replace(/\(.*\)$/, '')) === want);
    if (hit) rows.push({ ja: cat.ja, en: cat.en, league: cat.league, rank: hit.rank, value: hit.value, url: cat.url });
  }
  return rows;
}

const players = catalog();
if (!players.length) {
  console.error('npbPlayers.ts に npbId が1件もありません（カタログに npbId を足してください）');
  process.exit(1);
}

console.log(`NPB公式から取得: ${players.length}人 / ${YEAR}年`);
const leaders = await fetchLeaders(YEAR);
console.log(`リーダーズ ${Object.keys(leaders.cats).length} 部門（${leaders.asOf} 現在）`);

// npbFetchedAt（JSTの取得日）は CI の「今日はもう取った」ゲートが読む。asOf（リーダーズの
// 「◯月◯日現在」）は試合が無い日に動かないので、それを鍵にすると毎時 npb.jp を叩き続けてしまう。
const jstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const out = { npbFetchedAt: jstToday, asOf: leaders.asOf, season: YEAR, players: {} };
for (const p of players) {
  const raw = await fetchPlayer(p.npbId);
  const isPitcher = raw.profile['ポジション'] === '投手';
  const table = isPitcher ? raw.pitching : raw.batting;
  const rows = (table?.rows ?? []).filter((r) => r['所属球団']);
  const thisYear = rows.find((r) => r['年度'] === String(YEAR));
  out.players[p.slug] = {
    npbId: p.npbId,
    sourceUrl: `https://npb.jp/bis/players/${p.npbId}.html`,
    kind: isPitcher ? 'pitching' : 'batting',
    profile: raw.profile,
    // 年度別は「{選手} 成績」の受け皿。列は NPB 公式の見出しそのまま（訳さない＝表記の正は公式）。
    career: rows.map((r) =>
      isPitcher
        ? {
            year: r['年度'], team: r['所属球団'], g: r['登板'], w: r['勝利'], l: r['敗北'],
            sv: r['セーブ'], hld: r['H'], ip: r['投球回'], h: r['安打'], hr: r['本塁打'],
            bb: r['四球'], so: r['三振'], er: r['自責点'], era: r['防御率'],
          }
        : {
            year: r['年度'], team: r['所属球団'], g: r['試合'], pa: r['打席'], ab: r['打数'],
            h: r['安打'], hr: r['本塁打'], rbi: r['打点'], sb: r['盗塁'], bb: r['四球'],
            so: r['三振'], avg: r['打率'], slg: r['長打率'], obp: r['出塁率'],
          },
    ),
    season: thisYear ?? null,
    ranks: rankOf(leaders.cats, p.nameJa, isPitcher ? 'pitching' : 'batting'),
  };
  const r = out.players[p.slug];
  const top = r.ranks.filter((x) => x.rank <= 3).map((x) => `${x.ja}${x.rank}位(${x.value})`);
  console.log(
    `  ${p.nameJa.padEnd(6, '　')} ${r.career.length}年分 / 順位${r.ranks.length}部門${top.length ? ` … ${top.join('・')}` : ''}`,
  );
  await sleep(800);
}

if (DRY) {
  console.log('\n--dry: 書き込みませんでした');
} else {
  writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`\n→ ${path.relative(ROOT, OUT)}（${leaders.asOf} 現在）`);
}
