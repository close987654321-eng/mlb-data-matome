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

import { writeFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://statsapi.mlb.com/api/v1';

/** 当年（JST）。season 省略時のデフォルト。 */
function defaultSeason() {
  return new Date().getFullYear();
}
/** 現在の JST を "YYYY-MM-DD HH:MM" で返す（CI が UTC でも Asia/Tokyo 基準）。snapshot の asOf 用。 */
function jstStamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const g = (t) => parts.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`;
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
  663457: 'ヌートバー',
};

/**
 * 日系だが birthCountry が日本でない選手（jp 名簿の自動抽出に載らない）を、ハブ/スナップショット/
 * 一覧に必ず含めるための明示ID。今は L.ヌートバー（母が日本人・米国出身）。
 */
const EXTRA_IDS = [663457];

/**
 * サイ・ヤング賞争いのライバル等（非日本人）。選手ハブ /player と一覧の「サイヤング争い」比較ブロック用に
 * スナップショットへ含める。さらに 2026-06-23（村山決定）からは games レーダー／jp 成績にも含める＝
 * 「一覧（/player）に出ている選手全員の出場試合を漏れなく記事化する」ため（旧来は snapshot だけが拾った）。
 * 日本語表記（RIVAL_NAMES）は src/lib/players.ts の rival エントリの nameJa と一致させる
 * ＝記事タグ→選手ハブの threadsOf 紐付けキーなので、ズレるとハブに記事が載らない。
 */
const RIVAL_NAMES = {
  694973: 'ポール・スキーンズ', // Skenes
  650911: 'クリストファー・サンチェス', // C.Sánchez
  694819: 'ミシオロウスキー', // Misiorowski
  519242: 'クリス・セール', // Sale
  695243: 'メイソン・ミラー', // M.Miller
  // 強打者ライバル（野手）。大谷の打撃比較用。NL=MVP争い／AL=別リーグの注目スラッガー。
  691718: 'ピート・クロウアームストロング', // Crow-Armstrong (NL)
  682998: 'コービン・キャロル', // Carroll (NL)
  695578: 'ジェームズ・ウッド', // Wood (NL)
  621566: 'マット・オルソン', // Olson (NL)
  682928: 'CJ・エイブラムス', // Abrams (NL)
  656941: 'カイル・シュワーバー', // Schwarber (NL)
  665742: 'フアン・ソト', // Soto (NL)
  677951: 'ボビー・ウィットJr.', // Witt Jr. (AL)
  701762: 'ニック・カーツ', // Kurtz (AL)
  592450: 'アーロン・ジャッジ', // Judge (AL)
};
const RIVAL_IDS = Object.keys(RIVAL_NAMES).map(Number);

// 表示名の唯一の引き当て表（日本人＋ライバル）。API は英語名しか返さないので id→日本語をここで解決。
const DISPLAY_NAMES = { ...JP_NAMES, ...RIVAL_NAMES };

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

/** 30球団の英語名 → 記事 id 用の英語スラッグ（既存記事の id と揃える。例: 2026-06-22-dodgers-vs-orioles）。 */
const TEAM_SLUG = {
  'Arizona Diamondbacks': 'dbacks', 'Atlanta Braves': 'braves', 'Baltimore Orioles': 'orioles',
  'Boston Red Sox': 'redsox', 'Chicago Cubs': 'cubs', 'Chicago White Sox': 'whitesox',
  'Cincinnati Reds': 'reds', 'Cleveland Guardians': 'guardians', 'Colorado Rockies': 'rockies',
  'Detroit Tigers': 'tigers', 'Houston Astros': 'astros', 'Kansas City Royals': 'royals',
  'Los Angeles Angels': 'angels', 'Los Angeles Dodgers': 'dodgers', 'Miami Marlins': 'marlins',
  'Milwaukee Brewers': 'brewers', 'Minnesota Twins': 'twins', 'New York Mets': 'mets',
  'New York Yankees': 'yankees', 'Oakland Athletics': 'athletics', Athletics: 'athletics',
  'Philadelphia Phillies': 'phillies', 'Pittsburgh Pirates': 'pirates', 'San Diego Padres': 'padres',
  'San Francisco Giants': 'giants', 'Seattle Mariners': 'mariners', 'St. Louis Cardinals': 'cardinals',
  'Tampa Bay Rays': 'rays', 'Texas Rangers': 'rangers', 'Toronto Blue Jays': 'bluejays',
  'Washington Nationals': 'nationals',
};

/** 看板 watch-along シリーズを持つチーム（英語名 → series.id）。src/lib/series.ts の SERIES と揃える。 */
const TEAM_SERIES = {
  'Los Angeles Dodgers': 'dodgers', 'Chicago Cubs': 'cubs', 'St. Louis Cardinals': 'cardinals',
  'Chicago White Sox': 'whitesox', 'Toronto Blue Jays': 'bluejays',
};

/** 30球団の英語名 → リーグ（AL=アメリカン / NL=ナショナル）。選手ハブの「リーグ○位」表示用。 */
const LEAGUE_BY_TEAM = {
  'Baltimore Orioles': 'AL', 'Boston Red Sox': 'AL', 'New York Yankees': 'AL',
  'Tampa Bay Rays': 'AL', 'Toronto Blue Jays': 'AL', 'Chicago White Sox': 'AL',
  'Cleveland Guardians': 'AL', 'Detroit Tigers': 'AL', 'Kansas City Royals': 'AL',
  'Minnesota Twins': 'AL', 'Houston Astros': 'AL', 'Los Angeles Angels': 'AL',
  'Oakland Athletics': 'AL', Athletics: 'AL', 'Seattle Mariners': 'AL', 'Texas Rangers': 'AL',
  'Atlanta Braves': 'NL', 'Miami Marlins': 'NL', 'New York Mets': 'NL',
  'Philadelphia Phillies': 'NL', 'Washington Nationals': 'NL', 'Chicago Cubs': 'NL',
  'Cincinnati Reds': 'NL', 'Milwaukee Brewers': 'NL', 'Pittsburgh Pirates': 'NL',
  'St. Louis Cardinals': 'NL', 'Arizona Diamondbacks': 'NL', 'Colorado Rockies': 'NL',
  'Los Angeles Dodgers': 'NL', 'San Diego Padres': 'NL', 'San Francisco Giants': 'NL',
};

const RANK_MAX = 30; // この順位以内のときだけ「MLB○位」を出す（下位の順位はノイズなので出さない）

/**
 * キーを再帰的にソートして安定した JSON 文字列にする（配列順は保持）。
 * MLB API は順位オブジェクト等のキー順を呼び出しごとに変えるため、そのまま書くと
 * 値が同じでも差分が出て、毎時 cron が無駄なコミット/デプロイを量産する。決定的に直す。
 */
function stableStringify(value, indent = 2) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, norm(v[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(norm(value), null, indent);
}

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
 * sabermetrics を personId → {hit, pit, woba, wrcplus} で返す（hit/pit は WAR）。
 * ⚠️ MLB API の sabermetrics は startDate/endDate を無視し「今季累計」しか返さない。
 *    ＝ WAR の「試合ごとの増減（前回比）」は取得できない。表示するのは今季の値のみ。
 */
async function fetchWar(ids, season) {
  const hydrate = `stats(group=%5Bhitting,pitching%5D,type=sabermetrics,season=${season})`;
  const data = await getJson(`${BASE}/people?personIds=${ids.join(',')}&hydrate=${hydrate}`);
  const map = new Map();
  for (const p of data.people ?? []) {
    const h = pickSplit(p, 'hitting');
    map.set(p.id, { hit: h?.war, pit: pickSplit(p, 'pitching')?.war, woba: h?.woba, wrcplus: h?.wRcPlus });
  }
  return map;
}

// ポジション略号 → 日本語（守備指標の見出し用）。
const POS_JA = { P: '投手', C: '捕手', '1B': '一塁', '2B': '二塁', '3B': '三塁', SS: '遊撃', LF: '左翼', CF: '中堅', RF: '右翼', OF: '外野' };

/**
 * 守備成績を personId → 主ポジションの守備スタッツで返す（選手ハブの詳細“守備”用）。
 * 1選手が複数ポジションを守るので、守備イニング最多＝主ポジションを採用。DH(守備なし)は除外。
 * 公知の事実（刺殺・補殺・失策・守備率・併殺など）だけを残す。
 */
async function fetchFielding(ids, season) {
  const hydrate = `stats(group=fielding,type=season,season=${season})`;
  const data = await getJson(`${BASE}/people?personIds=${ids.join(',')}&hydrate=${hydrate}`);
  const map = new Map();
  for (const p of data.people ?? []) {
    const block = (p.stats ?? []).find((s) => s.group?.displayName === 'fielding');
    const splits = (block?.splits ?? [])
      .map((s) => s.stat)
      .filter((st) => st && st.position?.abbreviation !== 'DH' && (parseFloat(st.innings) > 0 || st.gamesPlayed > 0));
    if (!splits.length) continue;
    splits.sort((a, b) => (parseFloat(b.innings) || b.gamesPlayed || 0) - (parseFloat(a.innings) || a.gamesPlayed || 0));
    map.set(p.id, splits[0]);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statcast（Baseball Savant）守備＋走力。statsapi の伝統的守備に、OAA/守備run/送球/走力を足す。
// savant も MLB 公式（Statcast）・キー不要。法務の posture は statsapi と同じ＝公知の数値だけ、
// バルク常用しない・サイト本体は叩かない（CI/編集時の取得のみ）。CSV リーダーボードを読む。
// ⚠️ fielder_name 等にカンマ入りの値があるので、素朴な split ではなく引用符対応の簡易 CSV パーサで読む。
// ─────────────────────────────────────────────────────────────────────────────
const SAVANT = 'https://baseballsavant.mlb.com/leaderboard';

/** 1行を引用符（""エスケープ）対応で分割。 */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
/** CSV テキスト → 連想配列の配列（先頭行をキー・BOM 除去）。 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.replace(/^﻿/, '').trim());
  return lines.slice(1).map((l) => {
    const cells = parseCsvLine(l);
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });
}
async function getCsv(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'matome-mlb-kaigai/editor' } });
  if (!res.ok) throw new Error(`Savant ${res.status}: ${url}`);
  return parseCsv(await res.text());
}
const toNum = (v) => {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Statcast の守備・走力を personId 別に返す。
 *  - oaa:   { oaa（守備範囲・符号付き）, runsPrevented（ラン換算＝FRV相当） } … 守備位置に就く野手のみ（内野・外野とも）
 *  - arm:   送球 最速 mph（内野 type=if ＋外野 type=of を統合） … 該当ポジションのみ
 *  - sprint: 走力 ft/s … 守備位置を問わず出る＝DH の大谷にも付く唯一の身体能力指標
 * 失敗してもコア（statsapi）スナップショットは壊さない＝その指標だけ欠落させて続行（CI の毎時実行を堅牢に）。
 */
async function fetchSavant(season) {
  const oaa = new Map();
  const arm = new Map();
  const sprint = new Map();
  try {
    const rows = await getCsv(
      `${SAVANT}/outs_above_average?type=Fielder&startYear=${season}&endYear=${season}&split=no&team=&range=year&min=1&pos=&roleKey=&csv=true`,
    );
    for (const r of rows) {
      const id = Number(r.player_id);
      const o = toNum(r.outs_above_average);
      const rp = toNum(r.fielding_runs_prevented);
      if (id && (o != null || rp != null)) oaa.set(id, { oaa: o, runsPrevented: rp });
    }
  } catch (e) {
    console.warn(`OAA取得スキップ（コアは継続）: ${e.message}`);
  }
  // 送球は内野(if)・外野(of)で別リーダーボード。両方読んで統合（選手は主ポジ1つなのでどちらかに載る）。
  for (const type of ['if', 'of']) {
    try {
      const rows = await getCsv(`${SAVANT}/arm-strength?type=${type}&year=${season}&csv=true`);
      for (const r of rows) {
        const id = Number(r.player_id);
        const v = toNum(r.max_arm_strength);
        if (id && v != null && !arm.has(id)) arm.set(id, v);
      }
    } catch (e) {
      console.warn(`送球(${type})取得スキップ（コアは継続）: ${e.message}`);
    }
  }
  try {
    const rows = await getCsv(`${SAVANT}/sprint_speed?attempts=5&year=${season}&csv=true`);
    for (const r of rows) {
      const id = Number(r.player_id);
      const v = toNum(r.sprint_speed);
      if (id && v != null) sprint.set(id, v);
    }
  } catch (e) {
    console.warn(`走力取得スキップ（コアは継続）: ${e.message}`);
  }
  return { oaa, arm, sprint };
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

// 選手ハブの詳細順位（指標ごとに MLB全体順位＋リーグ順位）。API が返す leaderCategory 名 → 表示キー。
const HIT_RANK_CATS =
  'battingAverage,homeRuns,runsBattedIn,runs,hits,doubles,triples,stolenBases,walks,onBasePercentage,sluggingPercentage,onBasePlusSlugging';
const PIT_RANK_CATS =
  'earnedRunAverage,walksAndHitsPerInningPitched,wins,strikeouts,inningsPitched,saves,winningPercentage';
const HIT_CAT_KEY = {
  battingAverage: 'avg', homeRuns: 'homeRuns', runsBattedIn: 'rbi', runs: 'runs', hits: 'hits',
  doubles: 'doubles', triples: 'triples', stolenBases: 'stolenBases', walks: 'baseOnBalls',
  onBasePercentage: 'obp', sluggingPercentage: 'slg', onBasePlusSlugging: 'ops',
};
const PIT_CAT_KEY = {
  earnedRunAverage: 'era', walksAndHitsPerInningPitched: 'whip', wins: 'wins', strikeouts: 'strikeOuts',
  inningsPitched: 'inningsPitched', saves: 'saves', winPercentage: 'winPercentage',
};

/**
 * 指標ごとの順位を personId → {hitting:{key:{mlb,lg}}, pitching:{...}} で返す（選手ハブ用）。
 * MLB全体（sportId=1）と各リーグ（leagueId=103 AL / 104 NL）を別々に取り、選手が載っている方の
 * リーグ順位を採用。leagueId はカンマ区切り不可なので AL/NL を個別に叩く（計6リクエスト）。
 */
async function fetchRanksFull(season) {
  const call = async (cats, statGroup, lg) => {
    const scope = lg ? `&leagueId=${lg}` : '';
    const url = `${BASE}/stats/leaders?leaderCategories=${cats}&statGroup=${statGroup}&sportId=1${scope}&season=${season}&limit=300`;
    return (await getJson(url)).leagueLeaders ?? [];
  };
  const [hMlb, hAl, hNl, pMlb, pAl, pNl] = await Promise.all([
    call(HIT_RANK_CATS, 'hitting', null), call(HIT_RANK_CATS, 'hitting', 103), call(HIT_RANK_CATS, 'hitting', 104),
    call(PIT_RANK_CATS, 'pitching', null), call(PIT_RANK_CATS, 'pitching', 103), call(PIT_RANK_CATS, 'pitching', 104),
  ]);
  const out = new Map();
  const ensure = (id) => {
    if (!out.has(id)) out.set(id, { hitting: {}, pitching: {} });
    return out.get(id);
  };
  const ingest = (groups, catKey, group, field) => {
    for (const L of groups) {
      const key = catKey[L.leaderCategory];
      if (!key) continue;
      for (const x of L.leaders) {
        const slot = ensure(x.person.id)[group];
        (slot[key] ??= {})[field] = Number(x.rank);
      }
    }
  };
  ingest(hMlb, HIT_CAT_KEY, 'hitting', 'mlb');
  ingest(hAl, HIT_CAT_KEY, 'hitting', 'lg');
  ingest(hNl, HIT_CAT_KEY, 'hitting', 'lg');
  ingest(pMlb, PIT_CAT_KEY, 'pitching', 'mlb');
  ingest(pAl, PIT_CAT_KEY, 'pitching', 'lg');
  ingest(pNl, PIT_CAT_KEY, 'pitching', 'lg');
  return out;
}

const jpName = (p) => DISPLAY_NAMES[p.id] ?? p.fullName;
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
  // 一覧に出ている選手全員（日本人＋ライバル）を対象＝rival のみの試合でも成績ボックスを作れる。
  const ids = [...new Set([...(await fetchJapanesePlayers(season)), ...EXTRA_IDS, ...RIVAL_IDS])];
  if (!ids.length) return console.error(`${season} の対象選手が見つからない`);
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
    const jpHit = Object.entries(DISPLAY_NAMES).find(([, ja]) => ja.includes(query));
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

// ─────────────────────────────────────────────────────────────────────────────
// games … 指定日(ET)に「日本人選手が出場した試合」を漏れなく列挙する（jp-games スキルの土台）。
// 日本人選手の成績ページ（/player）を充実させるため、出場試合のハイライト動画を漏らさず記事化する
// のが目的。ここは MLB公式スケジュールAPI（試合・スコア）＋出場判定（その日の打席/登板記録）＋
// 既存記事の突き合わせ（重複検知）まで。YouTube 検索は scripts/fetch-youtube.mjs search が担当（鍵の
// 関心を分ける）。法務 posture は他コマンドと同じ＝公知の数値だけ・サイト本体は叩かない（編集時取得）。
// ─────────────────────────────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-06-21" を n 日ずらす。Date は正午UTC固定で TZ 事故を避ける。 */
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 今日(ET)。既定日（直近に終わった slate = ET 昨日）の算出に使う。 */
function etToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}
/** start..end の日付配列（両端含む・上限40日で暴走防止）。 */
function enumerateDates(start, end) {
  const out = [];
  let cur = start;
  for (let i = 0; i < 40 && cur <= end; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
/** "2026-06-21" → "6/21/26"（MLB公式ハイライトのタイトル中の日付＝YouTube動画の同定に使う）。 */
function titleDateUS(etDate) {
  const [y, m, d] = etDate.split('-');
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

/** 指定日(ET)の全試合（チーム・スコア・状態）。officialDate が ET の試合日。 */
async function fetchSchedule(date) {
  const data = await getJson(`${BASE}/schedule?sportId=1&date=${date}`);
  const games = (data.dates ?? []).flatMap((d) => d.games ?? []);
  return games.map((g) => ({
    etDate: g.officialDate,
    status: g.status?.detailedState ?? g.status?.abstractGameState ?? '',
    doubleHeader: g.doubleHeader === 'Y',
    gameNumber: g.gameNumber,
    away: g.teams?.away?.team?.name,
    home: g.teams?.home?.team?.name,
    awayScore: g.teams?.away?.score ?? null,
    homeScore: g.teams?.home?.score ?? null,
  }));
}

const TEAM_JA_SET = new Set(Object.values(TEAM_JA));
/**
 * 既存の MLB 記事を {id, date, teamTags} で読む（重複検知用）。
 * date は series.date（JST）優先・無ければ id 先頭の YYYY-MM-DD。teamTags は tags のうちチーム名だけ。
 */
function loadExistingArticles() {
  const dir = path.join(process.cwd(), 'data', 'threads', 'mlb');
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    try {
      const t = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
      out.push({
        id: t.id ?? f.replace(/\.json$/, ''),
        date: t.series?.date ?? (t.id ?? '').slice(0, 10),
        teamTags: (t.tags ?? []).filter((x) => TEAM_JA_SET.has(x)),
      });
    } catch {
      /* 壊れた JSON はスキップ */
    }
  }
  return out;
}

/** 指定日(ET)に出場した日本人選手の試合を列挙（1試合=1行・両チームの日本人を集約）。 */
async function gamesForDate(season, date, ids, existing, { team } = {}) {
  const [games, appeared] = await Promise.all([
    fetchSchedule(date),
    fetchStats(ids, season, { date }),
  ]);
  // 出場した日本人選手を所属チーム（英語名）別にまとめる。打席 or 登板記録があれば「出場」。
  const byTeam = new Map();
  for (const p of appeared) {
    const h = pickSplit(p, 'hitting');
    const pi = pickSplit(p, 'pitching');
    if (!((h && h.gamesPlayed) || (pi && pi.gamesPlayed))) continue;
    const teamEn = p.currentTeam?.name;
    if (!teamEn) continue;
    if (!byTeam.has(teamEn)) byTeam.set(teamEn, []);
    byTeam.get(teamEn).push({ player: jpName(p), team: teamJa(p), today: dayLine(p) });
  }
  const rows = [];
  for (const g of games) {
    const jpPlayers = [...(byTeam.get(g.away) ?? []), ...(byTeam.get(g.home) ?? [])];
    if (!jpPlayers.length) continue; // 日本人が出ていない試合は対象外
    if (team && !jpPlayers.some((x) => x.team.includes(team))) continue;
    const awayJa = TEAM_JA[g.away] ?? g.away;
    const homeJa = TEAM_JA[g.home] ?? g.home;
    const gameDateJst = addDays(g.etDate, 1); // ET の試合は必ず翌日のJST（記事 id / series.date は JST）
    // 記事の左側（自軍）は watch-along シリーズを持つチームを優先、無ければ日本人が出た側。
    const jpTeamsEn = [g.away, g.home].filter((tn) => byTeam.get(tn)?.length);
    const leftEn = jpTeamsEn.find((tn) => TEAM_SERIES[tn]) ?? jpTeamsEn[0];
    const rightEn = leftEn === g.away ? g.home : g.away;
    const match = existing.find(
      (e) => e.date === gameDateJst && e.teamTags.includes(awayJa) && e.teamTags.includes(homeJa),
    );
    rows.push({
      etDate: g.etDate,
      gameDateJst,
      status: g.status,
      ...(g.doubleHeader ? { doubleHeader: true, gameNumber: g.gameNumber } : {}),
      matchup: `${awayJa}${g.awayScore != null ? ` ${g.awayScore}` : ''} - ${g.homeScore != null ? `${g.homeScore} ` : ''}${homeJa}`,
      away: { en: g.away, ja: awayJa, score: g.awayScore },
      home: { en: g.home, ja: homeJa, score: g.homeScore },
      jpPlayers,
      seriesId: TEAM_SERIES[leftEn] ?? null,
      selfTeamJa: TEAM_JA[leftEn] ?? leftEn,
      opponentJa: TEAM_JA[rightEn] ?? rightEn,
      suggestedId: `${gameDateJst}-${TEAM_SLUG[leftEn] ?? 'team'}-vs-${TEAM_SLUG[rightEn] ?? 'team'}`,
      searchQuery: `${g.away} vs. ${g.home} Game Highlights`,
      titleDateUS: titleDateUS(g.etDate),
      existingArticle: match ? match.id : null,
    });
  }
  return rows;
}

async function runGames(dates, { asJson, team } = {}) {
  const existing = loadExistingArticles();
  const all = [];
  for (const date of dates) {
    const season = Number(date.slice(0, 4));
    // 一覧に出ている選手全員（日本人＋ライバル）の出場試合を漏れなく拾う＝レーダーの対象を /player と一致させる。
    const ids = [...new Set([...(await fetchJapanesePlayers(season)), ...EXTRA_IDS, ...RIVAL_IDS])];
    all.push(...(await gamesForDate(season, date, ids, existing, { team })));
  }
  if (asJson) return console.log(JSON.stringify(all, null, 2));
  const span = dates.length === 1 ? `${dates[0]}(ET)` : `${dates[0]}〜${dates[dates.length - 1]}(ET)`;
  const todo = all.filter((g) => !g.existingArticle);
  console.log(`【対象選手の出場試合】${span}：${all.length}試合（未記事化 ${todo.length}）${team ? `／${team}` : ''}`);
  console.log(HEADER_NOTE + '\n');
  if (!all.length) return console.log('（この期間に日本人選手の出場試合は確認できず）');
  for (const g of all) {
    const mark = g.existingArticle ? `✓ ${g.existingArticle}` : '▶ 未記事化';
    console.log(`${mark}  [${g.titleDateUS}] ${g.matchup}${g.doubleHeader ? `（DH第${g.gameNumber}試合）` : ''}`);
    console.log(`    出場: ${g.jpPlayers.map((p) => `${p.player}（${p.today || '出場'}）`).join(' / ')}`);
    if (!g.existingArticle) {
      console.log(`    候補id: ${g.suggestedId}${g.seriesId ? ` / series:${g.seriesId}` : ''}`);
      console.log(`    検索: node scripts/fetch-youtube.mjs search "${g.searchQuery}" 5 --channel ${MLB_YT_CHANNEL}`);
    }
  }
}

// MLB公式 YouTube チャンネル（"Full Game Highlights (M/D/YY)" を投稿する正規の出どころ）。
const MLB_YT_CHANNEL = 'UCoLrcjPV5PbUrUyXq5mjc_A';

// 選手ハブ /player の詳細テーブル＆比較表が読む“今季成績スナップショット”に残す項目（公知の事実のみ）。
const HIT_FIELDS = ['gamesPlayed', 'plateAppearances', 'atBats', 'runs', 'hits', 'doubles', 'triples', 'homeRuns', 'rbi', 'stolenBases', 'baseOnBalls', 'strikeOuts', 'avg', 'obp', 'slg', 'ops', 'babip'];
const PIT_FIELDS = ['gamesPlayed', 'gamesStarted', 'wins', 'losses', 'saves', 'holds', 'inningsPitched', 'hits', 'runs', 'earnedRuns', 'homeRuns', 'baseOnBalls', 'strikeOuts', 'era', 'whip', 'avg', 'strikeoutsPer9Inn', 'walksPer9Inn', 'strikeoutWalkRatio', 'homeRunsPer9', 'winPercentage'];
const FIELD_FIELDS = ['gamesPlayed', 'gamesStarted', 'innings', 'putOuts', 'assists', 'errors', 'fielding', 'doublePlays'];
const pick = (obj, fields) => Object.fromEntries(fields.filter((f) => obj[f] != null).map((f) => [f, obj[f]]));

/**
 * 全日本人選手の今季成績を data/jp-players-stats.json に書き出す（選手ハブの詳細/比較表のデータ源）。
 * これは編集時取得のスナップショット。サイト本体はこの静的JSONを読むだけで API を叩かない。
 * 残すのは成績の数値（公知の事実）のみ。`asOf`（JSTの取得日）も保存し、ハブに「○月○日時点」と出す。
 */
async function runSnapshot(season, asOf) {
  const jpIds = await fetchJapanesePlayers(season);
  // 取得数が異常に少なければ API の不調とみなし、書き込まず非ゼロ終了（毎時 cron が
  // 既存の良いスナップショットを 1 名などに上書きする事故を防ぐ）。通常は十数名いる。
  if (jpIds.length < 8) {
    console.error(`日本人選手の取得数が異常 (${jpIds.length})。API不調とみなし中断＝既存JSONは保持。`);
    process.exit(1);
  }
  const ids = [...new Set([...jpIds, ...EXTRA_IDS, ...RIVAL_IDS])];
  const [seasonPeople, saberMap, ranksMap, fieldingMap, savant] = await Promise.all([
    fetchStats(ids, season),
    fetchWar(ids, season),
    fetchRanksFull(season),
    fetchFielding(ids, season),
    fetchSavant(season),
  ]);
  const players = {};
  for (const p of seasonPeople) {
    const h = pickSplit(p, 'hitting');
    const pi = pickSplit(p, 'pitching');
    const r = ranksMap.get(p.id);
    const ranks = {};
    if (h && h.gamesPlayed && r && Object.keys(r.hitting).length) ranks.hitting = r.hitting;
    if (pi && pi.gamesPlayed && r && Object.keys(r.pitching).length) ranks.pitching = r.pitching;
    const f = fieldingMap.get(p.id);
    // Statcast 守備（OAA/守備run/送球）は「守備位置に就く野手」のみ。投手の fielding 枠（大谷=投手）には
    // OAA 等が付かない＝savant 側に居ないので自然に省かれる（捏造しない）。
    const oaaRec = savant.oaa.get(p.id);
    const armV = savant.arm.get(p.id);
    const fielding = f
      ? {
          position: POS_JA[f.position?.abbreviation] ?? f.position?.abbreviation ?? '',
          ...pick(f, FIELD_FIELDS),
          ...(oaaRec?.oaa != null ? { oaa: oaaRec.oaa } : {}),
          ...(oaaRec?.runsPrevented != null ? { runsPrevented: oaaRec.runsPrevented } : {}),
          ...(armV != null ? { arm: armV } : {}),
        }
      : null;
    // 走力は守備に就かない選手（DH の大谷）にも出るので player 直下に持つ。
    const sprintSpeed = savant.sprint.get(p.id);
    players[p.id] = {
      team: teamJa(p),
      league: LEAGUE_BY_TEAM[p.currentTeam?.name] ?? null,
      hitting: h && h.gamesPlayed ? pick(h, HIT_FIELDS) : null,
      pitching: pi && pi.gamesPlayed ? pick(pi, PIT_FIELDS) : null,
      saber: saberMap.get(p.id) ?? null,
      ...(fielding ? { fielding } : {}),
      ...(sprintSpeed != null ? { sprintSpeed } : {}),
      ...(Object.keys(ranks).length ? { ranks } : {}),
    };
  }
  const file = path.join(process.cwd(), 'data', 'jp-players-stats.json');
  // 時刻つき asOf でも「中身が変わった時だけ」更新する：既存と players が一致するなら前回の asOf を据え置き、
  // ファイルをバイト一致のままにして毎時 cron の無駄コミット/デプロイを防ぐ（時刻が毎時動いても中身が同じなら no-op）。
  let stampedAsOf = asOf;
  try {
    const prev = JSON.parse(readFileSync(file, 'utf8'));
    if (stableStringify(prev.players ?? {}) === stableStringify(players)) stampedAsOf = prev.asOf || asOf;
  } catch {
    /* 既存スナップショットが無ければ新規作成 */
  }
  const out = { asOf: stampedAsOf, season, players };
  // 安定ソートで書く＝値が同じなら毎回バイト一致（毎時 cron の無駄コミットを防ぐ）
  writeFileSync(file, stableStringify(out) + '\n');
  console.log(`snapshot 書き出し: ${Object.keys(players).length}名 / asOf ${stampedAsOf} → ${file}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// gamelog … 1選手の「試合ごとの成績ログ」を data/gamelogs/{id}.json に書き出す。
// 用途: 選手ハブ /player の徹底分析セクション（日付別の全成績テーブル・直近N試合/月のソート・162換算）。
// サイト本体はこの静的JSONを読むだけ＝API は叩かない（snapshot と同じ posture）。残すのは公知の数値のみ。
//
// WAR の推移について: MLB API の sabermetrics は日付範囲を無視し「今季累計WAR」しか返さない
// （＝試合別WARは取得不能）。そこで毎回の取得で「最新試合日づけの累計WAR」を warHistory に upsert し、
// 自前の時系列を積み上げる（これから先の推移＝日次解像度の近似が出せる。追跡開始日からの片側のみ）。
// ─────────────────────────────────────────────────────────────────────────────

// 試合ごとに残すフィールド（公知の数値のみ・短いキーで委細をコミットしても差分を小さく保つ）。
// 率（avg/ops/era/whip）はその試合だけの率でノイズなので持たない＝期間集計はカウント数から再計算する。
const GL_HIT = {
  pa: 'plateAppearances', ab: 'atBats', r: 'runs', h: 'hits', dbl: 'doubles', tpl: 'triples',
  hr: 'homeRuns', rbi: 'rbi', sb: 'stolenBases', cs: 'caughtStealing', bb: 'baseOnBalls',
  ibb: 'intentionalWalks', hbp: 'hitByPitch', so: 'strikeOuts', sf: 'sacFlies', tb: 'totalBases',
};
const GL_PIT = {
  gs: 'gamesStarted', outs: 'outs', h: 'hits', r: 'runs', er: 'earnedRuns', hr: 'homeRuns',
  bb: 'baseOnBalls', ibb: 'intentionalWalks', hbp: 'hitBatsmen', so: 'strikeOuts', bf: 'battersFaced',
  w: 'wins', l: 'losses',
};
const num = (v) => (v == null || v === '' ? 0 : Number(v));
/** gameLog の1試合 split → コンパクトな行（map のキーで stat を引いて数値化）。 */
function glRow(split, map, extra = {}) {
  const st = split.stat ?? {};
  const row = { d: split.date, opp: split.opponent?.name ?? '', oppJa: TEAM_JA[split.opponent?.name] ?? split.opponent?.name ?? '', home: Boolean(split.isHome), ...extra };
  for (const [k, field] of Object.entries(map)) row[k] = num(st[field]);
  return row;
}

/** 指定 ID の gameLog（打撃＋投球）を取得。currentTeam も hydrate（チーム試合数の算出に使う）。 */
async function fetchGamelog(id, season) {
  const hydrate = `currentTeam,stats(group=%5Bhitting,pitching%5D,type=gameLog,season=${season})`;
  const data = await getJson(`${BASE}/people/${id}?hydrate=${hydrate}`);
  return data.people?.[0] ?? null;
}
/** チームの今季消化試合数（レギュラーシーズンの Final 数）。162換算の分母に使う。 */
async function fetchTeamGamesPlayed(teamId, season) {
  if (!teamId) return null;
  const data = await getJson(`${BASE}/schedule?sportId=1&season=${season}&teamId=${teamId}&gameType=R`);
  const games = (data.dates ?? []).flatMap((d) => d.games ?? []);
  return games.filter((g) => g.status?.codedGameState === 'F' || g.status?.abstractGameState === 'Final').length;
}

async function runGamelog(query, season, asOf) {
  // 選手解決（runPlayer と同じ：数字=ID / 日本語名 / 英語検索）。既定は大谷。
  let id;
  if (!query) id = 660271;
  else if (/^\d+$/.test(query)) id = Number(query);
  else {
    const jpHit = Object.entries(DISPLAY_NAMES).find(([, ja]) => ja.includes(query));
    if (jpHit) id = Number(jpHit[0]);
    else {
      const d = await getJson(`${BASE}/people/search?names=${encodeURIComponent(query)}`);
      id = d.people?.[0]?.id;
      if (!id) return console.error(`選手が見つからない: ${query}`);
    }
  }
  const [person, saberMap] = await Promise.all([fetchGamelog(id, season), fetchWar([id], season)]);
  if (!person) return console.error(`gameLog 取得失敗: ${id}`);
  const teamGames = await fetchTeamGamesPlayed(person.currentTeam?.id, season);

  const blockOf = (g) => (person.stats ?? []).find((s) => s.group?.displayName === g)?.splits ?? [];
  const hitting = blockOf('hitting').filter((s) => s.gameType === 'R').map((s) => glRow(s, GL_HIT, { win: s.isWin ?? null }));
  const pitching = blockOf('pitching').filter((s) => s.gameType === 'R').map((s) => glRow(s, GL_PIT));

  // WAR 時系列を upsert：キー＝スナップ日（asOf の JST 日付）。累計WARは「今この瞬間の今季値」＝
  // 取得時点で持つ量なので、試合日でなくスナップ日で打つ（git 履歴からの backfill も asOf 日付キー＝一貫）。
  // 同日複数回の取得は上書き（その日の最終値が残る）。日が変われば新しい点が増える＝1日1点の近似系列。
  const lastDate = (asOf ?? '').slice(0, 10) || ([...hitting, ...pitching].map((r) => r.d).sort().pop() ?? '');
  const saber = saberMap.get(id) ?? {};
  const r1 = (v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null);
  const warPoint =
    lastDate && (typeof saber.hit === 'number' || typeof saber.pit === 'number')
      ? {
          d: lastDate,
          ...(typeof saber.hit === 'number' ? { warHit: r1(saber.hit) } : {}),
          ...(typeof saber.pit === 'number' ? { warPit: r1(saber.pit) } : {}),
          ...(saber.woba != null ? { woba: saber.woba } : {}),
          ...(saber.wrcplus != null ? { wrcplus: saber.wrcplus } : {}),
        }
      : null;

  const dir = path.join(process.cwd(), 'data', 'gamelogs');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  let warHistory = [];
  let prevContent = null;
  let prevAsOf = asOf;
  try {
    const prev = JSON.parse(readFileSync(file, 'utf8'));
    warHistory = Array.isArray(prev.warHistory) ? prev.warHistory : [];
    prevAsOf = prev.asOf || asOf;
    const { asOf: _a, ...rest } = prev;
    prevContent = stableStringify(rest);
  } catch {
    /* 初回作成 */
  }
  if (warPoint) {
    warHistory = warHistory.filter((p) => p.d !== warPoint.d);
    warHistory.push(warPoint);
    warHistory.sort((a, b) => a.d.localeCompare(b.d));
  }

  const content = {
    season,
    player: { id, nameJa: jpName(person), nameEn: person.fullName },
    team: teamJa(person),
    teamGames,
    hitting,
    pitching,
    warHistory,
  };
  // asOf 以外が前回と一致なら asOf を据え置き＝バイト一致で no-op（毎時 cron の無駄コミット防止）。
  let stampedAsOf = asOf;
  if (prevContent != null && stableStringify(content) === prevContent) stampedAsOf = prevAsOf;
  writeFileSync(file, stableStringify({ asOf: stampedAsOf, ...content }) + '\n');
  console.log(`gamelog 書き出し: ${content.player.nameJa} 打${hitting.length}試合 / 投${pitching.length}試合 / WAR点${warHistory.length} → ${file}`);
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
  } else if (cmd === 'games') {
    // games [YYYY-MM-DD] [YYYY-MM-DD]：日本人選手の出場試合を列挙（既定=直近に終わった ET の slate）
    let dates;
    if (arg && DATE_RE.test(arg) && arg2 && DATE_RE.test(arg2)) {
      dates = enumerateDates(arg, arg2);
    } else if (arg && DATE_RE.test(arg)) {
      dates = [arg];
    } else {
      dates = [addDays(etToday(), -1)];
    }
    await runGames(dates, { asJson, team });
  } else if (cmd === 'snapshot') {
    // snapshot ["YYYY-MM-DD HH:MM"(=asOf)] [season]。asOf 省略時は現在のJST（分まで）。
    const asOf = arg && /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(arg) ? arg : jstStamp();
    const season = arg2 && /^\d{4}$/.test(arg2) ? Number(arg2) : defaultSeason();
    await runSnapshot(season, asOf);
  } else if (cmd === 'gamelog') {
    // gamelog [選手 or ID] [season]。既定=大谷(660271)。選手ハブの徹底分析セクション用の試合別ログ。
    const seasonArg = [arg, arg2].find((x) => x && /^\d{4}$/.test(x));
    const playerArg = [arg, arg2].find((x) => x && !/^\d{4}$/.test(x));
    await runGamelog(playerArg, seasonArg ? Number(seasonArg) : defaultSeason(), jstStamp());
  } else {
    console.error(
      [
        '使い方:',
        '  node scripts/fetch-mlb-stats.mjs jp [season]        # 日本人選手の今季成績一覧',
        '  node scripts/fetch-mlb-stats.mjs jp YYYY-MM-DD      # 指定日(ET)の各選手の成績',
        '  node scripts/fetch-mlb-stats.mjs player <名前|ID> [season]',
        '  node scripts/fetch-mlb-stats.mjs games [YYYY-MM-DD] [YYYY-MM-DD] # 日本人選手の出場試合を列挙（既定=ET昨日／重複検知つき）',
        '  node scripts/fetch-mlb-stats.mjs snapshot [YYYY-MM-DD] # 選手ハブ用に全選手の今季成績を data/jp-players-stats.json へ',
        '  node scripts/fetch-mlb-stats.mjs gamelog [選手|ID] [season] # 1選手の試合別ログ＋WAR推移を data/gamelogs/{id}.json へ（既定=大谷）',
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
