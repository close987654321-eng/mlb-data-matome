#!/usr/bin/env node
/**
 * MLB 公式 Stats API から「日本人選手の成績」を取得し、記事に貼れる形で出力する。
 * matome 記事（特に MLB の試合まとめ / 海外ニキと見る）に、その日の打席結果や今季の節目を
 * 成績ボックス（Thread.stats / matome R10）でそえるための編集時ツール。
 *
 * 認証: 不要・無料（statsapi.mlb.com はキー登録なしで叩ける）。
 *
 * ⚠️ 使い方の前提（法務・著作権）:
 *   - これは「編集時に Claude が手元で叩く」ツール。**サイト本体（Next.js/SSG）はこの API を叩かない**。
 *     statsapi.mlb.com の規約は「個人・非商用・非バルク利用のみ許可」（gdx.mlb.com/components/copyright.txt）。
 *     恒常的に商用サイトのデータ源として叩くのは規約違反になりうる。
 *   - 記事に残すのは **成績の数値だけ**（打率・本塁打数・防御率などは公知の事実＝著作権の対象外。
 *     C.B.C. v. MLBAM 2008 ほか）。MLB のロゴ・選手写真・中継映像・表組みの丸ごと転載はしない。
 *   - 取得した生 JSON はコミットしない。記事 JSON に書くのは抜粋した数値のみ。
 *   - 数値を「推測」で埋めない。取得できなければその選手の成績は省略する（捏造禁止＝CLAUDE.md §4.4）。
 *
 * 使い方:
 *   node scripts/fetch-mlb-stats.mjs jp [season]               # 日本人選手ぜんぶの今季成績＋順位
 *   node scripts/fetch-mlb-stats.mjs jp YYYY-MM-DD             # 指定日(ET)に出場した選手の成績（この試合＋今季＋前回比＋順位）
 *   node scripts/fetch-mlb-stats.mjs player <名前 or ID> [season]
 *   …共通オプション: --json（Thread.stats 用 JSON 配列で出力） / --team <名前>（所属で絞る・watch-along 用）
 *
 * 例:
 *   node scripts/fetch-mlb-stats.mjs jp 2026-06-20 --json                  # 6/20 のボックス用 JSON
 *   node scripts/fetch-mlb-stats.mjs jp 2026-06-20 --team ドジャース --json  # ドジャースの日本人だけ（watch-along）
 *   node scripts/fetch-mlb-stats.mjs player 大谷 --json
 */

const BASE = 'https://statsapi.mlb.com/api/v1';

/** 当年（JST）。season 省略時のデフォルト。 */
function defaultSeason() {
  return new Date().getFullYear();
}
/** 指定日(YYYY-MM-DD)の前日を返す。前回比の基準（試合前日までの累計）に使う。 */
function prevDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
/** その年の累計を取る byDateRange の開始日（開幕より前＝レギュラーシーズン全体を拾う）。 */
const seasonStart = (season) => `${season}-03-01`;

/**
 * API は日本語名を返さないため、ID → 日本語表記の対応表を手元に持つ（唯一のローカル知識）。
 * ここに無い選手は API の英語名（fullName）で出す。新たに昇格した日本人選手が出たら 1 行足す。
 * 「誰が現役か」は API（sports/players の birthCountry==='Japan'）が常に最新を返すので、この表は
 * “表記のため”だけ。ズレても英語名で表示されるので壊れない。
 */
const JP_NAMES = {
  660271: '大谷翔平',
  808967: '山本由伸',
  808963: '佐々木朗希',
  684007: '今永昇太',
  673540: '千賀滉大',
  673548: '鈴木誠也',
  807799: '吉田正尚',
  579328: '菊池雄星',
  673513: '松井裕樹',
  608372: '菅野智之',
  672960: '岡本和真',
  808959: '村上宗隆',
  837227: '今井達也',
  807747: '西田陸羽',
};

/** MLB 30 球団の英語名 → 短い日本語名。マイナー球団など未収録は英語名のまま返す。 */
const TEAM_JA = {
  'Arizona Diamondbacks': 'ダイヤモンドバックス',
  'Atlanta Braves': 'ブレーブス',
  'Baltimore Orioles': 'オリオールズ',
  'Boston Red Sox': 'レッドソックス',
  'Chicago Cubs': 'カブス',
  'Chicago White Sox': 'ホワイトソックス',
  'Cincinnati Reds': 'レッズ',
  'Cleveland Guardians': 'ガーディアンズ',
  'Colorado Rockies': 'ロッキーズ',
  'Detroit Tigers': 'タイガース',
  'Houston Astros': 'アストロズ',
  'Kansas City Royals': 'ロイヤルズ',
  'Los Angeles Angels': 'エンゼルス',
  'Los Angeles Dodgers': 'ドジャース',
  'Miami Marlins': 'マーリンズ',
  'Milwaukee Brewers': 'ブルワーズ',
  'Minnesota Twins': 'ツインズ',
  'New York Mets': 'メッツ',
  'New York Yankees': 'ヤンキース',
  'Oakland Athletics': 'アスレチックス',
  Athletics: 'アスレチックス',
  'Philadelphia Phillies': 'フィリーズ',
  'Pittsburgh Pirates': 'パイレーツ',
  'San Diego Padres': 'パドレス',
  'San Francisco Giants': 'ジャイアンツ',
  'Seattle Mariners': 'マリナーズ',
  'St. Louis Cardinals': 'カージナルス',
  'Tampa Bay Rays': 'レイズ',
  'Texas Rangers': 'レンジャーズ',
  'Toronto Blue Jays': 'ブルージェイズ',
  'Washington Nationals': 'ナショナルズ',
};

const RANK_MAX = 30; // この順位以内のときだけ「MLB○位」を出す（下位の順位はノイズなので出さない）

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'matome-mlb-kaigai/editor' } });
  if (!res.ok) throw new Error(`MLB API ${res.status}: ${url}`);
  return res.json();
}

/** その年に MLB 在籍した全選手から birthCountry==='Japan' を抽出（API が常に最新を返す） */
async function fetchJapanesePlayers(season) {
  const data = await getJson(`${BASE}/sports/1/players?season=${season}`);
  return (data.people ?? []).filter((p) => p.birthCountry === 'Japan').map((p) => p.id);
}

/**
 * 指定 ID 群の成績を 1 リクエストでまとめ取得。
 * - {date}        … その1日（byDateRange の単日）
 * - {start,end}   … 期間累計（前回比の基準＝開幕〜前日 などに使う）
 * - 省略          … 今季累計（type=season）
 * 角括弧は %5B/%5D に必ずエンコードする（生 [] だと API が空応答を返す）。
 */
async function fetchStats(ids, season, { date, start, end } = {}) {
  let type = 'season';
  let range = '';
  if (date) {
    type = 'byDateRange';
    range = `startDate=${date},endDate=${date},`;
  } else if (start && end) {
    type = 'byDateRange';
    range = `startDate=${start},endDate=${end},`;
  }
  const hydrate = `currentTeam,stats(group=%5Bhitting,pitching%5D,type=${type},${range}season=${season})`;
  const data = await getJson(`${BASE}/people?personIds=${ids.join(',')}&hydrate=${hydrate}`);
  return data.people ?? [];
}

/**
 * WAR（sabermetrics）を personId → {hit, pit} で返す。
 * ⚠️ MLB API の sabermetrics は startDate/endDate を無視し「今季累計」しか返さない。
 *    ＝ WAR の「試合ごとの増減（前回比）」は取得できない。表示するのは今季の値のみ。
 */
async function fetchWar(ids, season) {
  const hydrate = `stats(group=%5Bhitting,pitching%5D,type=sabermetrics,season=${season})`;
  const data = await getJson(`${BASE}/people?personIds=${ids.join(',')}&hydrate=${hydrate}`);
  const map = new Map();
  for (const p of data.people ?? []) {
    map.set(p.id, { hit: pickSplit(p, 'hitting')?.war, pit: pickSplit(p, 'pitching')?.war });
  }
  return map;
}

/** 各指標の MLB 順位表（personId → rank）。本塁打／防御率（規定到達）／奪三振。 */
async function fetchRanks(season) {
  const one = async (category, statGroup) => {
    const url = `${BASE}/stats/leaders?leaderCategories=${category}&statGroup=${statGroup}&sportId=1&season=${season}&limit=60`;
    const d = await getJson(url);
    const leaders = d.leagueLeaders?.[0]?.leaders ?? [];
    return new Map(leaders.map((x) => [x.person.id, Number(x.rank)]));
  };
  const [hr, era, k] = await Promise.all([
    one('homeRuns', 'hitting'),
    one('earnedRunAverage', 'pitching'),
    one('strikeouts', 'pitching'),
  ]);
  return { hr, era, k };
}

const jpName = (p) => JP_NAMES[p.id] ?? p.fullName;
const teamJa = (p) => TEAM_JA[p.currentTeam?.name] ?? p.currentTeam?.name ?? '';

/** stats 配列から hitting / pitching の split（その粒度の1件）を取り出す */
function pickSplit(person, group) {
  const block = (person.stats ?? []).find((s) => s.group?.displayName === group);
  return block?.splits?.[0]?.stat ?? null;
}

function hitterSeason(s) {
  return `打率${s.avg} ${s.homeRuns}本 ${s.rbi}打点 OPS${s.ops}（${s.gamesPlayed}試合）`;
}
function pitcherSeason(s) {
  return `${s.wins}勝${s.losses}敗 防御率${s.era} WHIP${s.whip} ${s.strikeOuts}奪三振（${s.inningsPitched}回）`;
}
/** その日 1 試合分の打者ライン（"4打数2安打1本塁打1打点"） */
function hitterDay(s) {
  const parts = [`${s.atBats}打数${s.hits}安打`];
  if (s.doubles) parts.push(`${s.doubles}二塁打`);
  if (s.triples) parts.push(`${s.triples}三塁打`);
  if (s.homeRuns) parts.push(`${s.homeRuns}本塁打`);
  if (s.rbi) parts.push(`${s.rbi}打点`);
  if (s.baseOnBalls) parts.push(`${s.baseOnBalls}四球`);
  if (s.stolenBases) parts.push(`${s.stolenBases}盗塁`);
  if (s.strikeOuts) parts.push(`${s.strikeOuts}三振`);
  return parts.join(' ');
}
/** その日 1 試合分の投手ライン（"6.0回 4安打 2自責 8奪三振"） */
function pitcherDay(s) {
  const parts = [`${s.inningsPitched}回 ${s.hits}安打 ${s.earnedRuns}自責 ${s.strikeOuts}奪三振`];
  if (s.baseOnBalls) parts.push(`${s.baseOnBalls}四球`);
  if (s.homeRuns) parts.push(`被弾${s.homeRuns}`);
  return parts.join(' ');
}

/** 二刀流（打＋投の両方に出場記録）なら投/打を明示、片方だけならラベル無し。 */
function seasonLine(person) {
  const h = pickSplit(person, 'hitting');
  const p = pickSplit(person, 'pitching');
  const hit = h && h.gamesPlayed ? hitterSeason(h) : null;
  const pit = p && p.gamesPlayed ? pitcherSeason(p) : null;
  if (hit && pit) return `投 ${pit} / 打 ${hit}`;
  return pit ?? hit ?? '';
}
function dayLine(person) {
  const h = pickSplit(person, 'hitting');
  const p = pickSplit(person, 'pitching');
  const hit = h ? hitterDay(h) : null;
  const pit = p ? pitcherDay(p) : null;
  if (hit && pit) return `投 ${pit} / 打 ${hit}`;
  return pit ?? hit ?? '';
}

/** ".963"→".969" の差を "+.006" 形式（先頭の0を落とす・3桁）にする。OPS/打率など率指標用。 */
function signedRate(curr, prev) {
  const diff = Number(curr) - Number(prev);
  return (diff >= 0 ? '+' : '-') + Math.abs(diff).toFixed(3).replace(/^0/, '');
}
/** 防御率の差。"+0.13" / "-0.02"（先頭桁は残す・2桁）。 */
function signedEra(curr, prev) {
  const diff = Number(curr) - Number(prev);
  return (diff >= 0 ? '+' : '-') + Math.abs(diff).toFixed(2);
}

/** 前回比＝この試合で今季成績がどれだけ動いたか（試合当日までの累計 − 前日までの累計）。 */
function deltaString(cumPerson, prevPerson, datePerson) {
  const parts = [];
  const dh = pickSplit(datePerson, 'hitting');
  const dp = pickSplit(datePerson, 'pitching');
  if (dh) {
    const a = pickSplit(cumPerson, 'hitting');
    const b = pickSplit(prevPerson, 'hitting');
    if (a?.ops && b?.ops) parts.push(`OPS ${signedRate(a.ops, b.ops)}`);
  }
  if (dp) {
    const a = pickSplit(cumPerson, 'pitching');
    const b = pickSplit(prevPerson, 'pitching');
    if (a?.era && b?.era) parts.push(`防御率 ${signedEra(a.era, b.era)}`);
    // WHIP も前回比を出す（WAR と違い WHIP は byDateRange で日付が効く＝差分が取れる）
    if (a?.whip && b?.whip) parts.push(`WHIP ${signedEra(a.whip, b.whip)}`);
  }
  return parts.join(' / ');
}

/** 今季 WAR（二刀流は投＋打の合計＋内訳）。役割は出場記録から判定。 */
function warStringFor(person, saber) {
  if (!saber) return '';
  const isHit = pickSplit(person, 'hitting')?.gamesPlayed;
  const isPit = pickSplit(person, 'pitching')?.gamesPlayed;
  // 表示は小数1桁。二刀流の合計は「先に各桁を丸めてから足す」＝内訳と合計を必ず一致させる
  const r1 = (v) => Math.round(v * 10) / 10;
  const hw = typeof saber.hit === 'number' ? r1(saber.hit) : null;
  const pw = typeof saber.pit === 'number' ? r1(saber.pit) : null;
  if (isHit && isPit && hw != null && pw != null) {
    return `${(hw + pw).toFixed(1)}（投${pw.toFixed(1)} / 打${hw.toFixed(1)}）`;
  }
  if (isPit && pw != null) return pw.toFixed(1);
  if (isHit && hw != null) return hw.toFixed(1);
  return '';
}

/** MLB 順位（RANK_MAX 位以内のみ）。打者=本塁打、投手=防御率(規定到達)→無ければ奪三振。 */
function rankString(person, ranks) {
  if (!ranks) return '';
  const parts = [];
  const h = pickSplit(person, 'hitting');
  const p = pickSplit(person, 'pitching');
  if (h?.gamesPlayed) {
    const r = ranks.hr.get(person.id);
    if (r && r <= RANK_MAX) parts.push(`本塁打 MLB${r}位`);
  }
  if (p?.gamesPlayed) {
    const re = ranks.era.get(person.id);
    if (re && re <= RANK_MAX) parts.push(`防御率 MLB${re}位`);
    else {
      const rk = ranks.k.get(person.id);
      if (rk && rk <= RANK_MAX) parts.push(`奪三振 MLB${rk}位`);
    }
  }
  return parts.join(' / ');
}

const HEADER_NOTE = [
  '※ 出典: MLB公式 Stats API。数値は公知の事実（著作権の対象外）。',
  '※ 記事に書くのは数値だけ。MLBのロゴ/写真/中継映像/表組みの転載はしない。サイト本体はAPIを叩かない（編集時取得）。',
].join('\n');

/**
 * Thread.stats に貼れる 1 レコードを組み立てる。
 * seasonPerson … 表示する今季成績（指定日モードでは「その試合終了時点までの累計」）
 * opts.datePerson/prevPerson … 指定日モードのその日 / 前日まで累計（today・note・delta 用）
 * opts.ranks … 順位表
 */
function toStatRecord(seasonPerson, { datePerson, prevPerson, ranks, saber } = {}) {
  const rec = { player: jpName(seasonPerson), team: teamJa(seasonPerson) };
  if (datePerson) {
    const today = dayLine(datePerson);
    if (today) rec.today = today;
    const dh = pickSplit(datePerson, 'hitting');
    const sh = pickSplit(seasonPerson, 'hitting');
    if (dh && dh.homeRuns && sh && sh.homeRuns) rec.note = `今季${sh.homeRuns}号`;
  }
  const season = seasonLine(seasonPerson);
  if (season) rec.season = season;
  const war = warStringFor(seasonPerson, saber);
  if (war) rec.war = war;
  if (datePerson && prevPerson) {
    const d = deltaString(seasonPerson, prevPerson, datePerson);
    if (d) rec.delta = d;
  }
  const rank = rankString(seasonPerson, ranks);
  if (rank) rec.rank = rank;
  return rec;
}

const matchesTeam = (person, q) =>
  !q ||
  teamJa(person).includes(q) ||
  (person.currentTeam?.name ?? '').toLowerCase().includes(q.toLowerCase());

function printRecord(rec) {
  console.log(`${rec.player}（${rec.team}）${rec.note ? ` ★${rec.note}` : ''}`);
  if (rec.today) console.log(`  この試合: ${rec.today}`);
  if (rec.season) console.log(`  今季: ${rec.season}`);
  if (rec.war) console.log(`  WAR: ${rec.war}`);
  if (rec.delta) console.log(`  前回比: ${rec.delta}`);
  if (rec.rank) console.log(`  ランク: ${rec.rank}`);
}

async function runJp(season, { date, asJson, team } = {}) {
  const ids = await fetchJapanesePlayers(season);
  if (!ids.length) return console.error(`${season} の日本人選手が見つからない`);
  const [ranks, saberMap] = await Promise.all([fetchRanks(season), fetchWar(ids, season)]);

  if (date) {
    const [todayPeople, cumPeople, prevPeople] = await Promise.all([
      fetchStats(ids, season, { date }),
      fetchStats(ids, season, { start: seasonStart(season), end: date }),
      fetchStats(ids, season, { start: seasonStart(season), end: prevDay(date) }),
    ]);
    const cumById = new Map(cumPeople.map((p) => [p.id, p]));
    const prevById = new Map(prevPeople.map((p) => [p.id, p]));
    const played = todayPeople
      .filter((p) => pickSplit(p, 'hitting') || pickSplit(p, 'pitching'))
      .filter((p) => matchesTeam(cumById.get(p.id) ?? p, team));
    const recs = played.map((dp) =>
      toStatRecord(cumById.get(dp.id) ?? dp, {
        datePerson: dp,
        prevPerson: prevById.get(dp.id),
        ranks,
        saber: saberMap.get(dp.id),
      }),
    );
    if (asJson) return console.log(JSON.stringify(recs, null, 2));
    console.log(`【${date}(ET) の成績】日本人MLB選手 ${recs.length}名${team ? `（${team}）` : ''}が出場`);
    console.log(HEADER_NOTE + '\n');
    if (!recs.length) return console.log('（この日に出場した日本人選手は確認できず）');
    recs.forEach(printRecord);
    return;
  }

  // 今季ダッシュボード
  const seasonPeople = (await fetchStats(ids, season)).filter((p) => matchesTeam(p, team));
  const recs = seasonPeople.map((sp) => toStatRecord(sp, { ranks, saber: saberMap.get(sp.id) }));
  if (asJson) return console.log(JSON.stringify(recs, null, 2));
  console.log(`【日本人MLB選手 今季成績】${season}シーズン（${recs.length}名）`);
  console.log(HEADER_NOTE + '\n');
  recs.forEach(printRecord);
}

async function runPlayer(query, season, { asJson } = {}) {
  let ids;
  if (/^\d+$/.test(query)) {
    ids = [Number(query)];
  } else {
    const jpHit = Object.entries(JP_NAMES).find(([, ja]) => ja.includes(query));
    if (jpHit) {
      ids = [Number(jpHit[0])];
    } else {
      const data = await getJson(`${BASE}/people/search?names=${encodeURIComponent(query)}`);
      ids = (data.people ?? []).map((p) => p.id).slice(0, 5);
      if (!ids.length) return console.error(`選手が見つからない: ${query}`);
    }
  }
  const [ranks, saberMap] = await Promise.all([fetchRanks(season), fetchWar(ids, season)]);
  const people = await fetchStats(ids, season);
  const recs = people.map((p) => toStatRecord(p, { ranks, saber: saberMap.get(p.id) }));
  if (asJson) return console.log(JSON.stringify(recs, null, 2));
  console.log(HEADER_NOTE + '\n');
  recs.forEach(printRecord);
}

async function main() {
  const raw = process.argv.slice(2);
  const asJson = raw.includes('--json');
  let team = null;
  const pos = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '--json') continue;
    if (raw[i] === '--team') {
      team = raw[++i];
      continue;
    }
    pos.push(raw[i]);
  }
  const [cmd, arg, arg2] = pos;
  if (cmd === 'jp') {
    if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
      await runJp(Number(arg.slice(0, 4)), { date: arg, asJson, team });
    } else {
      await runJp(arg ? Number(arg) : defaultSeason(), { asJson, team });
    }
  } else if (cmd === 'player' && arg) {
    await runPlayer(arg, arg2 ? Number(arg2) : defaultSeason(), { asJson });
  } else {
    console.error(
      [
        '使い方:',
        '  node scripts/fetch-mlb-stats.mjs jp [season]        # 日本人選手の今季成績一覧',
        '  node scripts/fetch-mlb-stats.mjs jp YYYY-MM-DD      # 指定日(ET)の各選手の成績',
        '  node scripts/fetch-mlb-stats.mjs player <名前|ID> [season]',
        '  共通: --json（Thread.stats 用 JSON） / --team <名前>（所属で絞る）',
      ].join('\n'),
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
