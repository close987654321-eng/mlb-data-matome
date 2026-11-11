#!/usr/bin/env node
/**
 * ストーブリーグの「その日の状態」を data/stove-history.json に積む（1日1件・変わった日だけ）。
 *
 * なぜ要るか: stove-league.json は毎朝上書きされる＝「どの球団の関心がいつ報じられ、最後にどこと契約したか」
 * 「予想契約と実際の差」は、日ごとの状態を残しておかないと後から出せない（賞レースのボードの履歴と同じ考え）。
 * 契約が出そろった後に「報じられた球団と実際」「予想と実額」を並べる材料で、年を越すほど効く。
 * いまは積むだけ＝画面には出さない。
 *
 * 残すもの（選手ごと・data にある値の写しだけ）:
 *   s … 状態（open＝未契約／qo-offered・qo-accepted・qo-declined／signed・re-signed・stayed・retired／posting／opt-out・club-option）
 *   team … 決着した球団（英語の短縮名） y・m … 契約の年数と総額（百万ドル）
 *   suitors … 関心が報じられた球団（英語の短縮名）
 *   proj … 他社の予想契約（年数・百万ドル）
 * NPB組の関心球団は npbPlayers.ts（TypeScript）にある＝ここでは拾わない（board の行の状態だけ残る）。
 *
 * 使い方:
 *   node scripts/stove-history.mjs              # きょう（JST）の状態を足す。前回と同じなら書かない
 *   node scripts/stove-history.mjs --backfill   # git の履歴から、過去の日の状態を埋める（初回だけ）
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = 'data/stove-league.json';
const OUT = path.join(ROOT, 'data', 'stove-history.json');

const jstDay = (d = new Date()) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** カタログ1つ → 選手ごとの状態。キーは MLB の選手ID（無い NPB 組は slug）。 */
function snapshot(cat) {
  const out = {};
  const put = (key, v) => {
    const clean = Object.fromEntries(Object.entries(v).filter(([, x]) => x != null && !(Array.isArray(x) && !x.length)));
    out[key] = { ...(out[key] ?? {}), ...clean };
  };
  const state = (route, outcome, qo) =>
    outcome ? outcome.kind : qo ? `qo-${qo.status}` : route === 'fa' ? 'open' : route;
  const names = (list) => (list ?? []).map((x) => x.en).filter(Boolean).sort();
  for (const b of cat.board ?? []) {
    put(String(b.mlbId ?? b.prospectSlug ?? b.nameEn), {
      name: b.nameEn,
      rank: b.rank,
      s: state(b.route, b.outcome, b.qo),
      team: b.outcome?.team?.en,
      y: b.outcome?.years,
      m: b.outcome?.usdM,
      suitors: names(b.suitors),
      proj: b.projection ? { y: b.projection.years, m: b.projection.usdM } : undefined,
    });
  }
  // 去就の欄（日本人・外国人の主役）は関心球団と決着の正＝board の行に上書きで重ねる。
  const bySlug = new Map((cat.board ?? []).filter((b) => b.jpSlug).map((b) => [b.jpSlug, String(b.mlbId)]));
  for (const j of [...(cat.japanese ?? []), ...(cat.stars ?? [])]) {
    const key = bySlug.get(j.slug) ?? starKey(cat, j.slug) ?? j.slug;
    put(key, {
      slug: j.slug,
      s: j.outcome ? j.outcome.kind : out[key]?.s ?? (j.route === 'fa' ? 'open' : j.route),
      team: j.outcome?.team?.en,
      y: j.outcome?.years,
      m: j.outcome?.usdM,
      suitors: names(j.suitors),
    });
  }
  return out;
}

/** stars[] の slug → board の選手ID（players.ts の同じ行から引く）。 */
let playersSrc;
function starKey(cat, slug) {
  playersSrc ??= readFileSync(path.join(ROOT, 'src/lib/players.ts'), 'utf8');
  const id = playersSrc.match(new RegExp(`slug:\\s*'${slug}',[^\\n]*?mlbId:\\s*(\\d+)`))?.[1];
  return id && (cat.board ?? []).some((b) => String(b.mlbId) === id) ? id : null;
}

function load() {
  if (!existsSync(OUT)) return { season: null, days: [] };
  return JSON.parse(readFileSync(OUT, 'utf8'));
}

function save(h) {
  writeFileSync(OUT, `${JSON.stringify(h, null, 1)}\n`);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

if (process.argv.includes('--backfill')) {
  // その日の最後のコミットの中身を、その日の状態とする（コミット日時は JST に直す）。
  const log = execFileSync('git', ['log', '--reverse', '--format=%H %cI', '--', SRC], { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const byDay = new Map();
  for (const line of log) {
    const [hash, iso] = line.split(' ');
    byDay.set(jstDay(new Date(iso)), hash);
  }
  const days = [];
  let season = null;
  for (const [date, hash] of [...byDay.entries()].sort()) {
    let cat;
    try {
      cat = JSON.parse(execFileSync('git', ['show', `${hash}:${SRC}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    } catch {
      continue;
    }
    season = cat.season;
    const players = snapshot(cat);
    if (days.length && same(days.at(-1).players, players)) continue;
    days.push({ date, players });
  }
  // 作業ツリーの中身（まだコミットしていない変更）も、きょうの状態として比べる。
  const cur = JSON.parse(readFileSync(path.join(ROOT, SRC), 'utf8'));
  const players = snapshot(cur);
  if (!days.length || !same(days.at(-1).players, players)) {
    const today = jstDay();
    if (days.at(-1)?.date === today) days[days.length - 1] = { date: today, players };
    else days.push({ date: today, players });
  }
  save({ season: cur.season ?? season, days });
  console.log(`backfill: ${days.length}日ぶん（${days[0]?.date}〜${days.at(-1)?.date}）`);
} else {
  const cat = JSON.parse(readFileSync(path.join(ROOT, SRC), 'utf8'));
  const h = load();
  // 年が替わったら積み直す（前の年のぶんは git の履歴に残る）。
  if (h.season !== cat.season) {
    h.season = cat.season;
    h.days = [];
  }
  const players = snapshot(cat);
  const last = h.days.at(-1);
  if (last && same(last.players, players)) {
    console.log('変化なし＝書かない');
  } else {
    const today = jstDay();
    if (last?.date === today) h.days[h.days.length - 1] = { date: today, players };
    else h.days.push({ date: today, players });
    save(h);
    console.log(`stove-history: ${today} を記録（計${h.days.length}日）`);
  }
}
