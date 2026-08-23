#!/usr/bin/env node
/**
 * MLB の移籍・契約（トランザクション）を取りに行く＝オフシーズンの記事ネタの背骨。
 *
 * なぜ要るか:
 *   11月〜2月中旬はMLBの試合が無く、jp-games / jp-daily の燃料が止まる。だが**検索需要は止まらない**
 *   ＝オフのMLBは「FA宣言 → ウィンターミーティング → 契約」の季節で、日本人選手や大物が動くたびに
 *   「◯◯ 移籍 海外の反応」「◯◯ 契約 現地の反応」が跳ねる。試合ハイライトより競合も薄い。
 *   このスクリプトはその「何が起きたか」を毎朝1コールで出し、matome / neta-radar に渡す（記事化はしない）。
 *
 * データ源: MLB公式 Stats API の /transactions（キー不要・日付範囲で後から遡れる）。
 *   ⚠️ サイト本体は API を叩かない方針は他と同じ＝ここは編集時取得のスクリプト。
 *   ⚠️ 記事に残すのは数値と事実だけ（公知の事実）。ロゴ・写真・表組みは転載しない（CLAUDE.md §4.1）。
 *
 * 使い方:
 *   node scripts/fetch-transactions.mjs                      # 直近7日（ET）
 *   node scripts/fetch-transactions.mjs 2026-11-06           # 日付指定
 *   node scripts/fetch-transactions.mjs 2026-12-01..2026-12-15  # 期間（ウィンターミーティング等）
 *   オプション: --json（構造化出力） --all（全タイプ＝マイナー登録抹消まで） --limit N（既定80）
 *
 * 出力の並び: 注目度の高い順 → 日付の新しい順。注目度は
 *   ★★★ 日本人選手（src/lib/players.ts のカタログ）
 *   ★★  今季の成績が大物水準（打者 HR20+ か OPS.800+／投手 ERA3.50未満かつ規定に近いIP）
 *   ★   それ以外
 * 「記事あり」列は、その選手の日本語表記がタグに入った既存記事の最新日付＝重複記事を書かないための目印。
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://statsapi.mlb.com/api/v1';
const ROOT = process.cwd();

/** 記事ネタになりうる取引の種類。--all を付けるとこの絞りを外す。 */
const NOTEWORTHY = new Set([
  'Trade',
  'Signed as Free Agent',
  'Declared Free Agency',
  'Signed',
  'Claimed Off Waivers',
  'Released',
  'Retired',
  'Designated for Assignment',
]);

/** 種類ごとの重み（同じ注目度なら「動きの大きさ」が上に来るように）。 */
const TYPE_WEIGHT = {
  Trade: 5,
  'Signed as Free Agent': 5,
  'Declared Free Agency': 4,
  Signed: 4,
  Retired: 3,
  'Claimed Off Waivers': 2,
  Released: 2,
  'Designated for Assignment': 1,
};

const TYPE_JA = {
  Trade: 'トレード',
  'Signed as Free Agent': 'FA契約',
  'Declared Free Agency': 'FA宣言',
  Signed: '契約',
  Retired: '引退',
  'Claimed Off Waivers': 'ウェーバー獲得',
  Released: '自由契約',
  'Designated for Assignment': 'DFA',
};

/* ------------------------------------------------------------------ カタログ読み込み */

/** src/lib/teams.ts を唯一の正として MLB30球団の teamId → 日本語名を引く。 */
function loadTeams() {
  const src = readFileSync(path.join(ROOT, 'src/lib/teams.ts'), 'utf8');
  const byId = new Map();
  const re = /^ {2}([^\s:]+):\s*\{\s*id:\s*(\d+),/gm;
  for (const m of src.matchAll(re)) byId.set(Number(m[2]), m[1]);
  if (byId.size !== 30) throw new Error(`teams.ts の解釈に失敗（${byId.size}球団）`);
  return byId;
}

/** src/lib/players.ts を唯一の正として日本人選手の mlbId → 日本語名を引く。 */
function loadJpPlayers() {
  const src = readFileSync(path.join(ROOT, 'src/lib/players.ts'), 'utf8');
  const byId = new Map();
  const re = /nameJa:\s*'([^']+)',\s*nameEn:\s*'[^']+',\s*mlbId:\s*(\d+)/g;
  for (const m of src.matchAll(re)) byId.set(Number(m[2]), m[1]);
  if (byId.size === 0) throw new Error('players.ts から日本人選手を1人も読めなかった');
  return byId;
}

/** 公式英語表記 → カタカナ（src/lib/playerNames.ts と同じ手当て表を共有する）。 */
function loadNamesJa() {
  try {
    return new Map(Object.entries(JSON.parse(readFileSync(path.join(ROOT, 'data/player-names-ja.json'), 'utf8'))));
  } catch {
    return new Map();
  }
}

/**
 * 既存記事のタグ → その表記が出てくる最新記事の日付。
 * 「この選手はもう書いたか」を見て重複記事を防ぐ（jp-games の existingArticle と同じ役割）。
 */
function articleDatesByTag() {
  const latest = new Map();
  const dir = path.join(ROOT, 'data', 'threads');
  for (const sport of readdirSync(dir)) {
    const sub = path.join(dir, sport);
    for (const f of readdirSync(sub)) {
      if (!f.endsWith('.json')) continue;
      let t;
      try {
        t = JSON.parse(readFileSync(path.join(sub, f), 'utf8'));
      } catch {
        continue;
      }
      const date = (t.id ?? '').slice(0, 10);
      for (const tag of t.tags ?? []) {
        if (!latest.has(tag) || latest.get(tag) < date) latest.set(tag, date);
      }
    }
  }
  return latest;
}

/* ---------------------------------------------------------------------- API */

async function api(endpoint, params) {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`statsapi ${endpoint} ${res.status}`);
  return res.json();
}

/**
 * 選手の今季成績を**まとめて**引く（personIds は1コールで複数可＝選手ごとに叩かない）。
 * 大物かどうかの判定にしか使わないので、打者は HR/OPS、投手は ERA/IP だけ見る。
 */
async function fetchSeasonStats(ids, season) {
  const out = new Map();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 40) chunks.push(ids.slice(i, i + 40));
  for (const chunk of chunks) {
    const data = await api('people', {
      personIds: chunk.join(','),
      hydrate: `stats(group=[hitting,pitching],type=[season],season=${season})`,
    });
    for (const p of data.people ?? []) {
      const stat = {};
      for (const group of p.stats ?? []) {
        const s = group.splits?.[0]?.stat;
        if (!s) continue;
        if (group.group?.displayName === 'hitting') {
          stat.hr = Number(s.homeRuns ?? 0);
          stat.ops = Number(s.ops ?? 0);
          stat.pa = Number(s.plateAppearances ?? 0);
        } else if (group.group?.displayName === 'pitching') {
          stat.era = Number(s.era ?? NaN);
          stat.ip = Number(s.inningsPitched ?? 0);
        }
      }
      out.set(p.id, { nameEn: p.fullName, ...stat });
    }
  }
  return out;
}

/**
 * 今季成績から「大物」かを粗く判定する（記事の優先順位づけにしか使わない）。
 *
 * ⚠️ サンプル下限を必ず噛ませる: 打席の少ない選手は OPS が簡単に 1.000 を超えるので、
 * これが無いと「2試合しか出ていない control 選手」が大物として上位に並ぶ（初回実行で実際に発生）。
 */
function isBigName(stat) {
  if (!stat) return false;
  const pa = stat.pa ?? 0;
  if (pa >= 250 && ((stat.hr ?? 0) >= 20 || (stat.ops ?? 0) >= 0.8)) return true;
  if (Number.isFinite(stat.era) && stat.era < 3.5 && (stat.ip ?? 0) >= 80) return true;
  return false;
}

/** 率の表示（OPS=.930 / 1.167、防御率=3.20）。桁を落とすと別の数字に見えるので必ず固定桁で出す。 */
const fmtOps = (v) => (v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''));
const fmtEra = (v) => v.toFixed(2);

/* -------------------------------------------------------------------- 本体 */

const etToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const all = args.includes('--all');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 80;
  const range = args.find((a) => /^\d{4}-\d{2}-\d{2}/.test(a));

  const to = range ? (range.includes('..') ? range.split('..')[1] : range) : etToday();
  const from = range ? (range.includes('..') ? range.split('..')[0] : range) : shiftDate(to, -6);

  const teams = loadTeams();
  const jp = loadJpPlayers();
  const namesJa = loadNamesJa();
  const articleDates = articleDatesByTag();

  const data = await api('transactions', { startDate: from, endDate: to });
  const raw = data.transactions ?? [];

  // MLB30球団が絡む取引だけ（マイナー間の移動はネタにならない）。
  const rows = raw.filter((t) => {
    const inMlb = teams.has(t.toTeam?.id) || teams.has(t.fromTeam?.id);
    return inMlb && (all || NOTEWORTHY.has(t.typeDesc));
  });

  const ids = [...new Set(rows.map((t) => t.person?.id).filter(Boolean))];
  const season = Number(to.slice(0, 4));
  const stats = ids.length ? await fetchSeasonStats(ids, season) : new Map();

  const items = rows.map((t) => {
    const id = t.person?.id;
    const nameEn = t.person?.fullName ?? '';
    const nameJa = jp.get(id) ?? namesJa.get(nameEn) ?? nameEn;
    const stat = stats.get(id);
    const tier = jp.has(id) ? 3 : isBigName(stat) ? 2 : 1;
    return {
      date: t.date,
      type: t.typeDesc,
      typeJa: TYPE_JA[t.typeDesc] ?? t.typeDesc,
      playerId: id,
      nameEn,
      nameJa,
      isJp: jp.has(id),
      fromTeamJa: teams.get(t.fromTeam?.id) ?? null,
      toTeamJa: teams.get(t.toTeam?.id) ?? null,
      stat: stat ?? null,
      tier,
      // 同じ選手で既に記事があるか＝重複回避の目印（無ければ null）
      lastArticle: articleDates.get(nameJa) ?? null,
      description: t.description ?? '',
    };
  });

  items.sort(
    (a, b) =>
      b.tier - a.tier ||
      (TYPE_WEIGHT[b.type] ?? 0) - (TYPE_WEIGHT[a.type] ?? 0) ||
      b.date.localeCompare(a.date),
  );
  const shown = items.slice(0, limit);

  if (asJson) {
    console.log(JSON.stringify({ from, to, total: items.length, items: shown }, null, 2));
    return;
  }

  console.error(`MLB トランザクション ${from} 〜 ${to}（ET）: ${items.length}件（全${raw.length}件から抽出）\n`);
  for (const it of shown) {
    const star = '★'.repeat(it.tier).padEnd(3, ' ');
    const move = it.fromTeamJa && it.toTeamJa ? `${it.fromTeamJa} → ${it.toTeamJa}` : (it.toTeamJa ?? it.fromTeamJa ?? '');
    const s = it.stat;
    const line = s
      ? [
          s.hr != null && (s.pa ?? 0) > 0 ? `${s.hr}本 OPS${fmtOps(s.ops ?? 0)}（${s.pa}打席）` : null,
          // 野手の緊急登板（数回だけ投げて防御率が二桁）は出さない＝ネタの判断を濁らせるだけ
          Number.isFinite(s.era) && (s.ip ?? 0) >= 10 ? `防${fmtEra(s.era)} ${s.ip}回` : null,
        ]
          .filter(Boolean)
          .join(' / ')
      : '';
    console.log(`${star} ${it.date}  ${it.typeJa.padEnd(6, '　')}  ${it.nameJa}${it.isJp ? '（日本人）' : ''}`);
    console.log(`      ${move}${line ? `  [${line}]` : ''}${it.lastArticle ? `  ※記事あり(${it.lastArticle})` : ''}`);
  }
  if (items.length > shown.length) {
    console.error(`\n（残り ${items.length - shown.length}件は --limit で表示。全タイプは --all）`);
  }
  // 日本語表記が無い＝記事に英語のまま出る選手。冬のFA・移籍記事は外国人が主役になるので、
  // ここが溜まっていたら data/player-names-ja.json にカタカナを足してから書く（check-player-names.mjs）。
  const missing = [...new Set(shown.filter((it) => it.nameJa === it.nameEn).map((it) => it.nameEn))];
  if (missing.length) {
    console.error(`\n⚠️ カタカナ未収録 ${missing.length}人（記事に英語のまま出る）: ${missing.join('、')}`);
    console.error('   → data/player-names-ja.json に足す（node scripts/check-player-names.mjs で全体を洗い出せる）');
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
