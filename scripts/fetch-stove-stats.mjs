#!/usr/bin/env node
/**
 * ストーブリーグ（/stove-league）の「数値と動き」を MLB公式 Stats API から取りに行く。
 *
 * なぜ要るか:
 *   FA注目選手の表は編集判断（誰を載せるか・状況・ひと言）を data/stove-league.json に人が書くが、
 *   **今季成績と「どこと契約したか」は機械で取る**（NEXT MLB の npb-prospects-stats と同じ割り方）。
 *   人が成績を写すと転記ミスが出るし、契約の速報を人が追いかけると反映が遅れる＝鮮度が信頼の面で遅れが致命傷。
 *
 * 取るもの（1回の実行で statsapi 2コール）:
 *   - 今季成績（レギュラーシーズン・移籍組は合算）と所属球団の並び … /people?personIds=…&hydrate=stats
 *   - オフの動き（FA宣言・FA契約・トレード・再契約・引退）… /transactions?startDate=…（日付範囲で後から遡れる）
 *   ⚠️ サイト本体は API を叩かない（CLAUDE.md §4.1）。読むのはここで書き出す静的JSONだけ。
 *   ⚠️ 契約の年数・金額は statsapi に無い＝報道を見て人が data/stove-league.json の outcome に書く。
 *
 * 使い方:
 *   node scripts/fetch-stove-stats.mjs          # data/stove-league-stats.json を更新
 *   node scripts/fetch-stove-stats.mjs --dry    # 書かずに動きだけ表示
 *
 * 対象は data/stove-league.json の board[].mlbId と japanese[]（slug → src/lib/players.ts の mlbId）＝カタログが唯一の正。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://statsapi.mlb.com/api/v1';
const ROOT = process.cwd();
const SRC = path.join(ROOT, 'data', 'stove-league.json');
const OUT = path.join(ROOT, 'data', 'stove-league-stats.json');
const DRY = process.argv.includes('--dry');

/** オフの動きとして拾う取引。マイナー降格や IL 移動は載せない（表の「いまどこにいるか」に関係しない）。 */
const MOVES = new Set(['Signed as Free Agent', 'Declared Free Agency', 'Signed', 'Trade', 'Retired', 'Released']);

function loadJpIds() {
  const src = readFileSync(path.join(ROOT, 'src/lib/players.ts'), 'utf8');
  const bySlug = new Map();
  for (const m of src.matchAll(/slug:\s*'([^']+)',\s*nameJa:\s*'[^']+',\s*nameEn:\s*'[^']+',\s*mlbId:\s*(\d+)/g)) {
    bySlug.set(m[1], Number(m[2]));
  }
  return bySlug;
}

async function api(endpoint, params) {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0, wait = 1500; attempt < 4; attempt++, wait *= 2) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error(`statsapi ${endpoint} failed`);
}

/** JST の「YYYY-MM-DD HH:mm」。他の取得スクリプトの asOf と同じ形。 */
function jstStamp(d = new Date()) {
  const j = new Date(d.getTime() + 9 * 3600 * 1000);
  return j.toISOString().slice(0, 16).replace('T', ' ');
}

const pickHitting = (s) => ({
  g: s.gamesPlayed,
  pa: s.plateAppearances,
  avg: s.avg,
  hr: s.homeRuns,
  rbi: s.rbi,
  sb: s.stolenBases,
  obp: s.obp,
  ops: s.ops,
});
const pickPitching = (s) => ({
  g: s.gamesPlayed,
  gs: s.gamesStarted,
  w: s.wins,
  l: s.losses,
  sv: s.saves,
  ip: s.inningsPitched,
  era: s.era,
  so: s.strikeOuts,
  bb: s.baseOnBalls,
  whip: s.whip,
});

/** 移籍組は球団別の行と合算行（team 無し）が返る。合算を優先し、無ければ唯一の行。 */
function seasonLine(group, pick) {
  if (!group?.splits?.length) return { line: null, teams: [] };
  const teams = group.splits.filter((sp) => sp.team?.id).map((sp) => sp.team.id);
  const total = group.splits.find((sp) => !sp.team) ?? group.splits[0];
  return { line: pick(total.stat), teams };
}

async function main() {
  const cat = JSON.parse(readFileSync(SRC, 'utf8'));
  const season = cat.season;
  const jpIds = loadJpIds();
  const ids = new Set();
  for (const b of cat.board) if (b.mlbId) ids.add(b.mlbId);
  for (const j of cat.japanese) {
    const id = jpIds.get(j.slug);
    if (!id) throw new Error(`players.ts に ${j.slug} が無い`);
    ids.add(id);
  }

  const hydrate = `stats(group=[hitting,pitching],type=[season],season=${season},gameType=R),currentTeam`;
  const people = (await api('people', { personIds: [...ids].join(','), hydrate })).people ?? [];
  if (people.length !== ids.size) throw new Error(`選手の取得数が合わない（${people.length}/${ids.size}）`);

  // オフの起点＝レギュラーシーズン最終日の翌日。ワールドシリーズ前の動き（ポストシーズン敗退組の引退表明など）も拾う。
  const startDate = cat.offseasonFrom ?? `${season}-09-29`;
  const endDate = new Date().toISOString().slice(0, 10);
  const tx = (await api('transactions', { startDate, endDate, sportId: 1 })).transactions ?? [];

  // 今季の最終所属は「最初に取った時点の currentTeam」を据え置く。statsapi の球団別の行は球団ID順で
  // 時系列ではなく、currentTeam はオフに契約すると新球団へ変わる＝FA解禁前（ワールドシリーズ中）に
  // 取った値をこのファイルに残して、以後は上書きしない。
  let prev = {};
  try {
    prev = JSON.parse(readFileSync(OUT, 'utf8')).players ?? {};
  } catch {
    prev = {};
  }

  const players = {};
  for (const p of people) {
    const groups = Object.fromEntries((p.stats ?? []).map((st) => [st.group.displayName, st]));
    const hit = seasonLine(groups.hitting, pickHitting);
    const pit = seasonLine(groups.pitching, pickPitching);
    // 投手の打撃成績（DH制で打席ゼロ）を拾わないよう、打席がある時だけ打撃行を残す。
    const hitting = hit.line && hit.line.pa > 0 ? hit.line : null;
    const pitching = pit.line && Number(pit.line.ip) > 0 ? pit.line : null;
    const lastTeamId = prev[p.id]?.lastTeamId ?? p.currentTeam?.id ?? null;
    const seen = [...new Set([...(pitching ? pit.teams : []), ...(hitting ? hit.teams : [])])];
    // 最終所属を末尾に＝表は「A → B」と移籍順に読める（2球団までなら順序はこれで確定する）。
    const teams = lastTeamId && seen.includes(lastTeamId) ? [...seen.filter((t) => t !== lastTeamId), lastTeamId] : seen;
    const moves = tx
      .filter((t) => t.person?.id === p.id && MOVES.has(t.typeDesc))
      .map((t) => ({
        date: t.date ?? t.effectiveDate,
        type: t.typeDesc,
        toTeamId: t.toTeam?.id ?? null,
        fromTeamId: t.fromTeam?.id ?? null,
        desc: t.description,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    players[p.id] = {
      name: p.fullName,
      birthDate: p.birthDate,
      age: p.currentAge,
      pos: p.primaryPosition?.abbreviation,
      // 今季の所属（移籍順・最後が最終所属）。オフの移籍は moves 側で表す。
      teamIds: teams.length ? teams : lastTeamId ? [lastTeamId] : [],
      lastTeamId,
      hitting,
      pitching,
      moves,
    };
  }

  const out = { asOf: jstStamp(), season, movesFrom: startDate, players };
  const moved = Object.values(players).filter((p) => p.moves.length);
  console.log(`選手 ${people.length}人・オフの動き ${moved.length}人（${startDate}〜${endDate}）`);
  for (const p of moved) for (const m of p.moves) console.log(`  ${m.date}  ${p.name}  ${m.type}  ${m.desc}`);
  if (DRY) return;
  // 中身（成績・動き）が前回と同じなら書かない＝CI が3時間ごとに回っても、動きが無い日はコミットもデプロイも起きない。
  // asOf は「最後に中身が変わった時刻」として読む（画面の表記もそれに合わせている）。
  if (JSON.stringify(prev) === JSON.stringify(players)) {
    console.log('変化なし＝書かない');
    return;
  }
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
