#!/usr/bin/env node
/**
 * 賞の受賞者を MLB 公式（statsapi の awards/{id}/recipients）から取り、src/lib/boardSeo.ts の
 * AWARD_RESULTS.{roy,cy,mvp}.winners に書き込む。新人王・サイヤング・MVP の3ボードは winners が入ると
 * 説明文・最終候補欄・FAQ が受賞者の表示に切り替わる（boardSeo.ts）。
 *
 * 使い方:
 *   node scripts/award-winners.mjs            # 下見（取れた受賞者と、最終候補に入っているかを表示するだけ）
 *   node scripts/award-winners.mjs --apply    # 書き込む（最終候補に居ない ID は書かずに失敗する）
 *   node scripts/award-winners.mjs --json     # 機械向け
 *
 * 守り:
 * - 受賞者は AWARD_RESULTS に登録した最終候補（各リーグ3人）の中にいるはず。居なければ書かずに exit 1
 *   （statsapi の取り違え・年の取り違えを本番に出さない）。
 * - まだ発表前の賞（statsapi が "Object not found" を返す）は飛ばす＝何度走らせてもよい。
 * - すでに同じ受賞者が書かれていれば何もしない。違う受賞者が書かれていたら書き換えずに exit 1。
 * - 書き込んだ日は updatedAt（JST の日付）に入れる＝sitemap の lastmod と構造化データの更新日が動く。
 *
 * 法務 posture は fetch-mlb-stats.mjs と同じ（MLB公式の公開データを編集時に読むだけ。サイト本体は叩かない）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'src/lib/boardSeo.ts');
const AWARDS = [
  { kind: 'roy', league: 'AL', id: 'ALROY' },
  { kind: 'roy', league: 'NL', id: 'NLROY' },
  { kind: 'cy', league: 'AL', id: 'ALCY' },
  { kind: 'cy', league: 'NL', id: 'NLCY' },
  { kind: 'mvp', league: 'AL', id: 'ALMVP' },
  { kind: 'mvp', league: 'NL', id: 'NLMVP' },
];
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const JSON_OUT = args.includes('--json');

const src = readFileSync(FILE, 'utf8');
const year = Number(src.match(/export const AWARD_RESULTS[\s\S]*?\n {2}year: (\d{4}),/)?.[1]);
if (!year) {
  console.error('AWARD_RESULTS.year が読めない（boardSeo.ts の書式が変わった？）');
  process.exit(1);
}

/** boardSeo.ts から賞ごとのブロック（`  roy: {` 〜 次の `  },`）を切り出す。 */
function block(text, kind) {
  const re = new RegExp(`\\n {2}${kind}: \\{\\n[\\s\\S]*?\\n {2}\\},`);
  const m = text.match(re);
  if (!m) throw new Error(`${kind} のブロックが見つからない`);
  return m[0];
}
function finalistsOf(text, kind) {
  const m = block(text, kind).match(/finalists: \{ AL: \[([\d, ]+)\], NL: \[([\d, ]+)\] \}/);
  if (!m) throw new Error(`${kind} の finalists が読めない`);
  const ids = (s) => s.split(',').map((x) => Number(x.trim()));
  return { AL: ids(m[1]), NL: ids(m[2]) };
}
function winnersOf(text, kind) {
  const m = block(text, kind).match(/winners: \{([^}]*)\}/);
  const out = {};
  for (const [, lg, id] of (m?.[1] ?? '').matchAll(/(AL|NL): (\d+)/g)) out[lg] = Number(id);
  return out;
}

async function recipient(awardId) {
  const url = `https://statsapi.mlb.com/api/v1/awards/${awardId}/recipients?season=${year}`;
  const res = await fetch(url);
  if (res.status === 404) return null; // 発表前（"Object not found"）
  if (!res.ok) throw new Error(`${awardId} ${res.status}`);
  const j = await res.json();
  const r = (j.awards ?? []).find((a) => Number(a.season) === year);
  return r?.player?.id ? { playerId: r.player.id, name: r.player.nameFirstLast, date: r.date } : null;
}

const results = [];
for (const a of AWARDS) {
  const fin = finalistsOf(src, a.kind)[a.league];
  const current = winnersOf(src, a.kind)[a.league] ?? null;
  let got = null;
  let error = null;
  try {
    got = await recipient(a.id);
  } catch (e) {
    error = e.message;
  }
  results.push({
    ...a,
    year,
    announced: Boolean(got),
    playerId: got?.playerId ?? null,
    name: got?.name ?? null,
    date: got?.date ?? null,
    inFinalists: got ? fin.includes(got.playerId) : null,
    current,
    error,
  });
}

if (JSON_OUT) console.log(JSON.stringify(results, null, 2));
else {
  for (const r of results) {
    const state = r.error
      ? `取得失敗 ${r.error}`
      : !r.announced
        ? '未発表'
        : `${r.name}（${r.playerId}・${r.date}）${r.inFinalists ? '最終候補に一致' : '★最終候補に居ない'}${r.current ? `／登録済み ${r.current}` : ''}`;
    console.log(`${r.id.padEnd(6)} ${state}`);
  }
}

const bad = results.filter((r) => r.announced && !r.inFinalists);
const conflict = results.filter((r) => r.announced && r.current && r.current !== r.playerId);
if (bad.length || conflict.length) {
  for (const r of bad) console.error(`✗ ${r.id}: ${r.name}（${r.playerId}）は登録した最終候補に居ない＝書かない`);
  for (const r of conflict) console.error(`✗ ${r.id}: 登録済み ${r.current} と公式 ${r.playerId} が違う＝書き換えない`);
  process.exit(1);
}

if (!APPLY) process.exit(0);

let text = src;
let changed = 0;
for (const kind of ['roy', 'cy', 'mvp']) {
  const fresh = results.filter((r) => r.kind === kind && r.announced && !r.current);
  if (!fresh.length) continue;
  const merged = { ...winnersOf(text, kind) };
  for (const r of fresh) merged[r.league] = r.playerId;
  const lit = Object.keys(merged).length
    ? `{ ${['AL', 'NL'].filter((lg) => merged[lg]).map((lg) => `${lg}: ${merged[lg]}`).join(', ')} }`
    : '{}';
  const before = block(text, kind);
  const after = before.replace(/winners: \{[^}]*\}/, `winners: ${lit}`);
  text = text.replace(before, after);
  changed += fresh.length;
}
if (!changed) {
  console.log('新しく書く受賞者は無い');
  process.exit(0);
}
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
text = text.replace(/(\n {2}updatedAt: ')\d{4}-\d{2}-\d{2}(',)/, `$1${today}$2`);
writeFileSync(FILE, text);
console.log(`書き込み: ${changed}件（updatedAt=${today}）`);
