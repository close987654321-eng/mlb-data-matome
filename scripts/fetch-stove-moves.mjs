#!/usr/bin/env node
/**
 * 移籍情報（/stove-league/moves）と球団LPの「オフの欄」の元データを、MLB公式 Stats API の取引記録から作る。
 *
 * なぜ要るか:
 *   「mlb 移籍情報／移籍 一覧／移籍 最新」は、きょうまでに何が起きたかを日付順で探す検索。
 *   ストーブリーグの面は選手別の並びしか無く、表示がほぼ0だった（2026-11-10 の計測）。FA一覧（30人）の
 *   外で起きる契約・トレード・ウェーバーまで、人が追わずに載せるには取引記録から機械で作るしかない。
 *
 * 取るもの（statsapi）:
 *   - /transactions（オフの起点〜今日・1コール）… FA契約・トレード・ウェーバー獲得・自由契約・引退・FA宣言
 *   - /people（今季成績・まだ手元に無い選手だけ40人ずつ）… 「注目選手」かどうかの判定に使う
 *     ＝オフは成績が動かないので、一度取った選手は data/stove-moves.json の players に残して取り直さない
 *   ⚠️ サイト本体は API を叩かない（CLAUDE.md §4.1）。読むのはここで書き出す静的JSONだけ。
 *   ⚠️ 契約の年数・金額は statsapi に無い＝FA一覧の outcome（人が出典つきで書く）から画面側で引く。
 *
 * 使い方:
 *   node scripts/fetch-stove-moves.mjs          # data/stove-moves.json を更新（中身が同じなら書かない）
 *   node scripts/fetch-stove-moves.mjs --dry    # 書かずに件数だけ表示
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://statsapi.mlb.com/api/v1';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'stove-moves.json');
const DRY = process.argv.includes('--dry');

/** 載せる取引の種類 → このサイトでの区分。IL の移動・マイナーへの降格・40人枠の出し入れは載せない。 */
const KIND = {
  'Signed as Free Agent': 'signing',
  Signed: 'signing',
  Trade: 'trade',
  'Claimed Off Waivers': 'waiver',
  Released: 'released',
  Retired: 'retired',
  'Declared Free Agency': 'fa',
};

function loadTeamIds() {
  const src = readFileSync(path.join(ROOT, 'src/lib/teams.ts'), 'utf8');
  const ids = new Set([...src.matchAll(/^ {2}[^\s:]+:\s*\{\s*id:\s*(\d+),/gm)].map((m) => Number(m[1])));
  if (ids.size !== 30) throw new Error(`teams.ts の解釈に失敗（${ids.size}球団）`);
  return ids;
}

function loadJpIds() {
  const src = readFileSync(path.join(ROOT, 'src/lib/players.ts'), 'utf8');
  // players.ts には比較用の外国人（rival: true）も入っている＝日本人だけを数える。
  return new Set(
    [...src.matchAll(/nameJa:\s*'[^']+',\s*nameEn:\s*'[^']+',\s*mlbId:\s*(\d+)(?!\d)(?!,\s*rival:\s*true)/g)].map((m) => Number(m[1])),
  );
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

function jstStamp(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * 「注目選手」の粗い判定（fetch-transactions.mjs と同じ基準）。打席・投球回の下限を必ず噛ませる＝
 * 数試合だけ出た選手の OPS 1.000 を大物に数えない。
 */
function isBig(s) {
  if (!s) return false;
  if ((s.pa ?? 0) >= 250 && ((s.hr ?? 0) >= 20 || (s.ops ?? 0) >= 0.8)) return true;
  if (Number.isFinite(s.era) && s.era < 3.5 && (s.ip ?? 0) >= 80) return true;
  return false;
}

async function fetchStats(ids, season) {
  const out = {};
  for (let i = 0; i < ids.length; i += 40) {
    const data = await api('people', {
      personIds: ids.slice(i, i + 40).join(','),
      hydrate: `stats(group=[hitting,pitching],type=[season],season=${season},gameType=R)`,
    });
    for (const p of data.people ?? []) {
      const s = {};
      for (const g of p.stats ?? []) {
        // 移籍組は球団別の行と合算行（team 無し）が返る。合算を優先する。
        const sp = g.splits?.find((x) => !x.team) ?? g.splits?.[0];
        if (!sp?.stat) continue;
        if (g.group?.displayName === 'hitting') {
          s.hr = Number(sp.stat.homeRuns ?? 0);
          s.ops = Number(sp.stat.ops ?? 0);
          s.pa = Number(sp.stat.plateAppearances ?? 0);
        } else if (g.group?.displayName === 'pitching') {
          s.era = Number(sp.stat.era ?? NaN);
          s.ip = Number(sp.stat.inningsPitched ?? 0);
        }
      }
      out[p.id] = { nameEn: p.fullName, pos: p.primaryPosition?.abbreviation ?? null, big: isBig(s) };
    }
  }
  return out;
}

async function main() {
  const cat = JSON.parse(readFileSync(path.join(ROOT, 'data', 'stove-league.json'), 'utf8'));
  const season = cat.season;
  const teamIds = loadTeamIds();
  const jpIds = loadJpIds();
  const boardIds = new Set(cat.board.filter((b) => b.mlbId).map((b) => b.mlbId));

  // 起点＝ワールドシリーズ決着の翌日（FA解禁の日）。決着前・不明なら10月25日から拾っておく。
  let from = `${season}-10-25`;
  try {
    const ps = JSON.parse(readFileSync(path.join(ROOT, 'data', 'postseason.json'), 'utf8'));
    const ws = ps.season === season && ps.champion ? ps.series.find((s) => s.round === 'W') : null;
    const last = (ws?.games ?? []).filter((g) => g.state === 'Final').map((g) => g.etDate).sort().at(-1);
    if (last) from = addDays(last, 1);
  } catch {
    /* postseason.json が無ければ既定の起点 */
  }
  const to = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

  const raw = (await api('transactions', { startDate: from, endDate: to, sportId: 1 })).transactions ?? [];
  const rows = raw.filter((t) => KIND[t.typeDesc] && (teamIds.has(t.toTeam?.id) || teamIds.has(t.fromTeam?.id)));

  let prev = { players: {}, moves: [] };
  try {
    prev = JSON.parse(readFileSync(OUT, 'utf8'));
  } catch {
    /* 初回 */
  }

  // 成績は手元に無い選手だけ取りに行く（オフは値が動かない）。
  const ids = [...new Set(rows.map((t) => t.person?.id).filter(Boolean))];
  const missing = ids.filter((id) => !prev.players?.[id]);
  const fetched = missing.length ? await fetchStats(missing, season) : {};
  const players = {};
  for (const id of ids) {
    const p = fetched[id] ?? prev.players[id];
    if (p) players[id] = p;
  }

  const team = (t) => (teamIds.has(t?.id) ? t.id : null);
  const moves = [];
  // トレードは選手ごとに1行ずつ返る（説明文は同じ）＝日付と説明文でまとめて1件にする。
  const trades = new Map();
  for (const t of rows) {
    const kind = KIND[t.typeDesc];
    const date = t.date ?? t.effectiveDate;
    if (kind === 'trade') {
      const key = `${date}|${t.description}`;
      if (!trades.has(key)) trades.set(key, { id: `trade-${t.id}`, kind, date, desc: t.description ?? '', players: [], teamIds: [] });
      const m = trades.get(key);
      for (const id of [team(t.fromTeam), team(t.toTeam)]) if (id && !m.teamIds.includes(id)) m.teamIds.push(id);
      // 金銭・後日指名の行は person が無い。
      if (t.person?.id) {
        m.players.push({ id: t.person.id, nameEn: t.person.fullName, fromTeamId: team(t.fromTeam), toTeamId: team(t.toTeam) });
      }
      continue;
    }
    if (!t.person?.id) continue;
    // 自由契約・FA宣言は toTeam がその選手の居た球団（fromTeam は空）。契約・ウェーバーは toTeam が新しい球団。
    const left = kind === 'released' || kind === 'fa' || kind === 'retired';
    moves.push({
      id: String(t.id),
      kind,
      date,
      playerId: t.person.id,
      nameEn: t.person.fullName,
      fromTeamId: left ? (team(t.toTeam) ?? team(t.fromTeam)) : team(t.fromTeam),
      toTeamId: left ? null : team(t.toTeam),
      // マイナー契約かどうかは説明文にしか出ない。
      ...(kind === 'signing' && /minor league contract/i.test(t.description ?? '') ? { minor: true } : {}),
      desc: t.description ?? '',
    });
  }
  for (const m of trades.values()) {
    m.players.sort((a, b) => a.id - b.id);
    m.teamIds.sort((a, b) => a - b);
    moves.push(m);
  }

  // 注目度: 3＝日本人（players.ts）／2＝FA注目30人か、今季成績が大物の水準／1＝それ以外。
  const tierOf = (id) => (jpIds.has(id) ? 3 : boardIds.has(id) || players[id]?.big ? 2 : 1);
  for (const m of moves) {
    m.tier = m.kind === 'trade' ? Math.max(1, ...m.players.map((p) => tierOf(p.id))) : tierOf(m.playerId);
  }
  moves.sort((a, b) => b.date.localeCompare(a.date) || b.tier - a.tier || a.id.localeCompare(b.id));

  const count = (k) => moves.filter((m) => m.kind === k).length;
  console.log(
    `${from}〜${to}（米東部）: FA契約 ${count('signing')}（うちマイナー契約 ${moves.filter((m) => m.minor).length}）・トレード ${count('trade')}・ウェーバー ${count('waiver')}・自由契約 ${count('released')}・引退 ${count('retired')}・FA宣言 ${count('fa')}`,
  );
  for (const m of moves.filter((x) => x.tier >= 2 && x.kind !== 'fa').slice(0, 20)) {
    console.log(`  ${m.date}  ${m.kind}  ${m.kind === 'trade' ? m.desc : m.nameEn}`);
  }
  if (DRY) return;
  // 中身が前回と同じなら書かない＝3時間ごとに回っても、動きが無ければコミットもデプロイも起きない。
  if (JSON.stringify(prev.moves) === JSON.stringify(moves) && JSON.stringify(prev.players) === JSON.stringify(players)) {
    console.log('変化なし＝書かない');
    return;
  }
  writeFileSync(OUT, `${JSON.stringify({ asOf: jstStamp(), season, from, players, moves }, null, 1)}\n`);
  console.log(`wrote ${path.relative(ROOT, OUT)}（${moves.length}件）`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
