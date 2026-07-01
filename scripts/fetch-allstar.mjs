/**
 * オールスター投票候補（ballot）＋各候補の今季打撃成績を取得して data/allstar-ballot.json に書き出す。
 *
 *   node scripts/fetch-allstar.mjs
 *
 * MLB公式 Stats API の allStarBallot（リーグ×守備位置の投票候補）を hydrate で1コール/リーグに束ね、
 * currentTeam（ロゴ用 id）と season 打撃成績（OPS/本塁打/打率/打席）を一括取得する（＝非バルク・2コール）。
 * ⚠️ 投票数フィールドは公式APIに存在しない（ballot/finalVote/hydrate すべてに無い）。よって投票数は載せず、
 * 「成績で争いを見せる＋公式ballotへ送客」方針（[[traffic-max-ranking-hub]]）。数値は公知の事実のみ。
 * 法務 posture は fetch-mlb-stats.mjs と同じ（statsapi・キー不要・個人/非商用/非バルク）。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const BASE = 'https://statsapi.mlb.com/api/v1';
const LEAGUES = { AL: 103, NL: 104 };
const SEASON = Number(process.argv[2]) || 2026;
const BALLOT_URL = 'https://www.mlb.com/all-star/ballot';

// 日本人選手（id→表記・ハブ slug）。src/lib/players.ts の非 rival 日本人と一致させる。ballot 上で強調＋ハブ送客に使う。
const JP = {
  660271: { ja: '大谷翔平', slug: 'shohei-ohtani' },
  808959: { ja: '村上宗隆', slug: 'munetaka-murakami' },
  672960: { ja: '岡本和真', slug: 'kazuma-okamoto' },
  673548: { ja: '鈴木誠也', slug: 'seiya-suzuki' },
  807799: { ja: '吉田正尚', slug: 'masataka-yoshida' },
  663457: { ja: 'ヌートバー', slug: 'lars-nootbaar' },
};

// 守備位置の表示順とラベル（ballot は野手のみ＝投手は投票対象外）。
const POS_ORDER = ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH'];
const PER_POS = 6; // 各ポジションで成績上位いくつを載せるか（日本人は圏外でも必ず含める）

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

async function fetchLeague(leagueId) {
  const url =
    `${BASE}/league/${leagueId}/allStarBallot?season=${SEASON}` +
    `&hydrate=currentTeam,stats(group=[hitting],type=[season],season=${SEASON})`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ballot ${leagueId} HTTP ${res.status}`);
  const json = await res.json();
  return json.people || [];
}

// 選手 → 表示用の1行（複数stintは打席最多のsplitを主とする）。
function toEntry(p) {
  const splits = p.stats?.[0]?.splits ?? [];
  const split = [...splits].sort((a, b) => (num(b.stat?.plateAppearances) ?? 0) - (num(a.stat?.plateAppearances) ?? 0))[0];
  const st = split?.stat ?? {};
  const jp = JP[p.id];
  return {
    id: p.id,
    name: p.fullName,
    pos: p.primaryPosition?.abbreviation ?? '?',
    teamId: p.currentTeam?.id ?? null,
    team: p.currentTeam?.name ?? null,
    ops: num(st.ops),
    hr: num(st.homeRuns),
    avg: num(st.avg),
    pa: num(st.plateAppearances),
    ...(jp ? { jp: true, ja: jp.ja, slug: jp.slug } : {}),
  };
}

async function main() {
  const leagues = {};
  for (const [lg, id] of Object.entries(LEAGUES)) {
    const people = await fetchLeague(id);
    const entries = people.map(toEntry);
    const positions = {};
    for (const pos of POS_ORDER) {
      const pool = entries.filter((e) => e.pos === pos);
      // OPS 降順（成績で「争い」を並べる）。欠損は末尾。順位を確定してから間引く（日本人の真の順位を保つ）。
      pool.sort((a, b) => (b.ops ?? -1) - (a.ops ?? -1));
      pool.forEach((e, idx) => { e.rank = idx + 1; });
      const top = pool.slice(0, PER_POS);
      // 日本人が圏外なら末尾に必ず足す（強調対象を落とさない）。
      for (const e of pool) if (e.jp && !top.includes(e)) top.push(e);
      if (top.length) positions[pos] = { total: pool.length, players: top };
    }
    leagues[lg] = { positions };
  }

  // fetchedAt / asOf（JST）。通常の node スクリプトなので Date は使える。
  const jst = new Date(Date.now() + 9 * 3600 * 1000).toISOString();
  const out = {
    season: SEASON,
    fetchedAt: jst.replace('Z', '+09:00'),
    asOf: jst.slice(0, 16).replace('T', ' '),
    ballotUrl: BALLOT_URL,
    leagues,
  };
  const file = path.join(process.cwd(), 'data', 'allstar-ballot.json');
  await fs.writeFile(file, JSON.stringify(out, null, 2) + '\n');

  const jpOnBallot = [];
  for (const [lg, l] of Object.entries(leagues))
    for (const [pos, d] of Object.entries(l.positions))
      for (const p of d.players) if (p.jp) jpOnBallot.push(`${lg}/${pos} ${p.ja}(OPS ${p.ops})`);
  console.log(`✓ data/allstar-ballot.json（${SEASON}・${out.asOf} JST）`);
  console.log(`  日本人 ballot: ${jpOnBallot.join(' / ') || 'なし'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
