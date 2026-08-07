#!/usr/bin/env node
/**
 * チームLPの「中の人メモ」を今日どのチームに書くべきか、候補と**裏の取れた事実だけ**を出す。
 *
 * なぜスクリプトにするか: メモは中の人（一人称「俺」）の声で書くので、書き手が数字を思い出しながら
 * 書くと捏造が混じる（連敗数を1つ間違える・順位を勘違いする）。ここで JSON から機械的に facts を
 * 引き切っておき、書き手は**印字された事実だけを言い換える**運用にする（matome の捏造禁止と同じ posture）。
 *
 * 読むのは既存の静的JSONだけ＝MLB API は叩かない:
 *   data/standings.json   … 順位・勝敗・ゲーム差・直近10試合・連勝連敗（CI が毎時更新）
 *   data/team-games.json  … 直近30日の全試合結果（CI が毎時更新）
 *   data/team-notes.json  … 既に書いたメモ（同じ試合に二重で書かないため）
 *
 * 使い方:
 *   node scripts/team-note-candidates.mjs            # 最新の試合日について候補3件
 *   node scripts/team-note-candidates.mjs 2026-08-05 # 日付指定
 *   node scripts/team-note-candidates.mjs --top 5
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const TEAM_SLUG = {
  108: 'angels', 109: 'dbacks', 110: 'orioles', 111: 'redsox', 112: 'cubs', 113: 'reds',
  114: 'guardians', 115: 'rockies', 116: 'tigers', 117: 'astros', 118: 'royals', 119: 'dodgers',
  120: 'nationals', 121: 'mets', 133: 'athletics', 134: 'pirates', 135: 'padres', 136: 'mariners',
  137: 'giants', 138: 'cardinals', 139: 'rays', 140: 'rangers', 141: 'bluejays', 142: 'twins',
  143: 'phillies', 144: 'braves', 145: 'whitesox', 146: 'marlins', 147: 'yankees', 158: 'brewers',
};
const DIV_JA = {
  AL: 'ア・リーグ', NL: 'ナ・リーグ',
  East: '東地区', Central: '中地区', West: '西地区',
};

const args = process.argv.slice(2);
const topIdx = args.indexOf('--top');
const TOP = topIdx >= 0 && args[topIdx + 1] ? Number(args[topIdx + 1]) : 3;
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

const standings = read('data/standings.json');
const schedule = read('data/team-games.json');
let notes = {};
try {
  notes = read('data/team-notes.json');
} catch {
  /* 初回 */
}

/** teamId → 順位行（+ 地区ラベル）。 */
const rankOf = new Map();
for (const d of standings.divisions ?? []) {
  for (const t of d.teams ?? []) {
    rankOf.set(t.id, { ...t, divJa: `${DIV_JA[d.league]}${DIV_JA[d.division]}` });
  }
}

const date = dateArg ?? schedule.games?.[0]?.d;
if (!date) {
  console.error('team-games.json に試合がありません');
  process.exit(1);
}

/** そのチーム視点の1試合（新しい順に取れるよう schedule の順序を保つ）。 */
function gamesOf(teamId) {
  return (schedule.games ?? [])
    .filter((g) => g.a === teamId || g.h === teamId)
    .map((g) => {
      const home = g.h === teamId;
      const oppId = home ? g.a : g.h;
      return {
        d: g.d,
        home,
        oppId,
        oppJa: rankOf.get(oppId)?.nameJa ?? String(oppId),
        s: home ? g.hs : g.as,
        os: home ? g.as : g.hs,
        no: g.no,
      };
    });
}

const cands = [];
for (const [id, slug] of Object.entries(TEAM_SLUG)) {
  const teamId = Number(id);
  const row = rankOf.get(teamId);
  if (!row) continue;
  const all = gamesOf(teamId);
  const today = all.filter((g) => g.d === date);
  if (today.length === 0) continue; // その日試合が無いチームは対象外
  // 同じ試合日に既にメモがあるなら書かない（二重投稿防止）
  if ((notes[slug] ?? []).some((n) => n.date === date)) continue;

  const g = today[0];
  const win = g.s > g.os;
  const margin = Math.abs(g.s - g.os);
  // 直近3試合が同じ相手＝スイープ（3連勝/3連敗）か
  const last3 = all.slice(0, 3);
  const sweptFor =
    last3.length === 3 && last3.every((x) => x.oppId === last3[0].oppId && x.s > x.os);
  const sweptBy =
    last3.length === 3 && last3.every((x) => x.oppId === last3[0].oppId && x.s < x.os);
  const streakN = Number((row.streak ?? '').slice(1)) || 0;
  const streakW = (row.streak ?? '').startsWith('W');

  let score = 0;
  const why = [];
  if (streakN >= 3) {
    score += 2;
    why.push(`${streakN}${streakW ? '連勝' : '連敗'}`);
  }
  if (sweptFor || sweptBy) {
    score += 2;
    why.push(`${last3[0].oppJa}を3タテ${sweptBy ? 'された' : ''}`);
  }
  if (row.rank === 1) {
    score += 1;
    why.push('地区首位');
  }
  if (margin === 1) {
    score += 1;
    why.push('1点差');
  }
  if (margin >= 8) {
    score += 1;
    why.push(`${margin}点差`);
  }
  if (score === 0) continue;

  cands.push({
    slug,
    nameJa: row.nameJa,
    date,
    score,
    why,
    facts: [
      `この試合: ${win ? '○' : '●'} ${g.s}-${g.os} ${g.oppJa}戦（${g.home ? 'ホーム' : 'ビジター'}）`,
      `順位: ${row.divJa}${row.rank === 1 ? '首位' : `${row.rank}位`} ${row.w}勝${row.l}敗 ゲーム差${row.gb}`,
      `直近10試合: ${row.last10 ?? '-'}${row.streak ? ` / ${streakN}${streakW ? '連勝' : '連敗'}中` : ''}`,
      `直近の並び: ${all.slice(0, 6).map((x) => `${x.d.slice(5)}${x.s > x.os ? '○' : '●'}${x.s}-${x.os}${x.oppJa}`).join(' ')}`,
    ],
  });
}

cands.sort((a, b) => b.score - a.score || a.nameJa.localeCompare(b.nameJa, 'ja'));
const picked = cands.slice(0, TOP);

console.log(`# 中の人メモ 候補（試合日 ${date}・上位${picked.length}件 / 対象${cands.length}件）`);
if (picked.length === 0) {
  console.log('候補なし（動きのあるチームが無い日＝書かなくてよい）');
}
for (const c of picked) {
  console.log(`\n## ${c.nameJa}  slug=${c.slug}  date=${c.date}  [${c.why.join('・')}]`);
  for (const f of c.facts) console.log(`  ${f}`);
}
console.log(
  [
    '',
    '---',
    'ここに印字された数値**だけ**を使って data/team-notes.json に追記する（思い出しで書かない）。',
    '声は .claude/skills/x-post（中の人・一人称「俺」）。カギカッコ・引用符・半角スペースは使わない。',
  ].join('\n'),
);
