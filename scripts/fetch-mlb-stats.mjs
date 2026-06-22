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
 *   node scripts/fetch-mlb-stats.mjs jp [season]               # 日本人選手ぜんぶの今季成績＋所属
 *   node scripts/fetch-mlb-stats.mjs jp YYYY-MM-DD             # 指定日に出場した選手の成績（その日＋今季）
 *   node scripts/fetch-mlb-stats.mjs player <名前 or ID> [season]
 *   …いずれも末尾に --json を付けると Thread.stats にそのまま貼れる JSON 配列で出力。
 *
 * 例:
 *   node scripts/fetch-mlb-stats.mjs jp 2026-06-21            # 6/21 の各選手（人が読む形）
 *   node scripts/fetch-mlb-stats.mjs jp 2026-06-21 --json     # 6/21 のボックス用 JSON
 *   node scripts/fetch-mlb-stats.mjs player 大谷 --json
 */

const BASE = 'https://statsapi.mlb.com/api/v1';

/** 当年（JST）。season 省略時のデフォルト。Date を使うのは引数省略時のフォールバックだけ。 */
function defaultSeason() {
  return new Date().getFullYear();
}

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
 * type='season'（今季累計）/ 'byDateRange'（date 指定日のみ）。
 * 角括弧は %5B/%5D に必ずエンコードする（生 [] だと API が空応答を返す）。
 */
async function fetchStats(ids, season, { date } = {}) {
  const type = date ? 'byDateRange' : 'season';
  const range = date ? `startDate=${date},endDate=${date},` : '';
  const hydrate = `currentTeam,stats(group=%5Bhitting,pitching%5D,type=${type},${range}season=${season})`;
  const data = await getJson(`${BASE}/people?personIds=${ids.join(',')}&hydrate=${hydrate}`);
  return data.people ?? [];
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
  return `${s.wins}勝${s.losses}敗 防御率${s.era} ${s.strikeOuts}奪三振（${s.inningsPitched}回）`;
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

const HEADER_NOTE = [
  '※ 出典: MLB公式 Stats API。数値は公知の事実（著作権の対象外）。',
  '※ 記事に書くのは数値だけ。MLBのロゴ/写真/中継映像/表組みの転載はしない。サイト本体はAPIを叩かない（編集時取得）。',
].join('\n');

/** Thread.stats に貼れる 1 レコードを組み立てる。datePerson があれば today＋節目を付ける。 */
function toStatRecord(seasonPerson, datePerson) {
  const rec = { player: jpName(seasonPerson), team: teamJa(seasonPerson) };
  if (datePerson) {
    const today = dayLine(datePerson);
    if (today) rec.today = today;
    // その日に本塁打を打っていれば「今季N号」を節目として添える（季の通算HRから）
    const dh = pickSplit(datePerson, 'hitting');
    const sh = pickSplit(seasonPerson, 'hitting');
    if (dh && dh.homeRuns && sh && sh.homeRuns) rec.note = `今季${sh.homeRuns}号`;
  }
  const season = seasonLine(seasonPerson);
  if (season) rec.season = season;
  return rec;
}

async function runJp(season, { date, asJson } = {}) {
  const ids = await fetchJapanesePlayers(season);
  if (!ids.length) return console.error(`${season} の日本人選手が見つからない`);
  const seasonPeople = await fetchStats(ids, season);
  const byId = new Map(seasonPeople.map((p) => [p.id, p]));

  if (date) {
    const datePeople = await fetchStats(ids, season, { date });
    const played = datePeople.filter((p) => pickSplit(p, 'hitting') || pickSplit(p, 'pitching'));
    if (asJson) {
      const recs = played.map((dp) => toStatRecord(byId.get(dp.id) ?? dp, dp));
      return console.log(JSON.stringify(recs, null, 2));
    }
    console.log(`【${date} の成績】日本人MLB選手 ${played.length}名が出場`);
    console.log(HEADER_NOTE + '\n');
    if (!played.length) return console.log('（この日に出場した日本人選手は確認できず）');
    for (const dp of played) {
      const sp = byId.get(dp.id) ?? dp;
      console.log(`${jpName(sp)}（${teamJa(sp)}）`);
      console.log(`  この試合: ${dayLine(dp)}`);
      const s = seasonLine(sp);
      if (s) console.log(`  今季: ${s}`);
    }
    return;
  }

  // 今季ダッシュボード
  if (asJson) {
    const recs = seasonPeople.map((sp) => toStatRecord(sp));
    return console.log(JSON.stringify(recs, null, 2));
  }
  console.log(`【日本人MLB選手 今季成績】${season}シーズン（${seasonPeople.length}名）`);
  console.log(HEADER_NOTE + '\n');
  for (const sp of seasonPeople) {
    const s = seasonLine(sp);
    console.log(`${jpName(sp)} ─ ${teamJa(sp)}`);
    console.log(`  ${s || '（今季出場記録なし）'}`);
  }
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
  const people = await fetchStats(ids, season);
  if (asJson) {
    return console.log(JSON.stringify(people.map((p) => toStatRecord(p)), null, 2));
  }
  console.log(HEADER_NOTE + '\n');
  for (const p of people) {
    console.log(`${jpName(p)} ─ ${teamJa(p)}`);
    console.log(`  ${seasonLine(p) || '（今季出場記録なし）'}`);
  }
}

async function main() {
  const raw = process.argv.slice(2);
  const asJson = raw.includes('--json');
  const [cmd, arg, arg2] = raw.filter((a) => a !== '--json');
  if (cmd === 'jp') {
    if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
      await runJp(Number(arg.slice(0, 4)), { date: arg, asJson });
    } else {
      await runJp(arg ? Number(arg) : defaultSeason(), { asJson });
    }
  } else if (cmd === 'player' && arg) {
    await runPlayer(arg, arg2 ? Number(arg2) : defaultSeason(), { asJson });
  } else {
    console.error(
      [
        '使い方:',
        '  node scripts/fetch-mlb-stats.mjs jp [season]        # 日本人選手の今季成績一覧',
        '  node scripts/fetch-mlb-stats.mjs jp YYYY-MM-DD      # 指定日の各選手の成績',
        '  node scripts/fetch-mlb-stats.mjs player <名前|ID> [season]',
        '  （末尾に --json で Thread.stats 用の JSON 配列を出力）',
      ].join('\n'),
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
