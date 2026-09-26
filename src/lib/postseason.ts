import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getTeamById, teamAbbr } from '@/lib/teams';
import { PLAYERS } from '@/lib/players';
import type { PlayersSnapshot } from '@/lib/playerStats';
import type { Thread } from '@/types/thread';
import type { FaqItem } from '@/components/FaqList';

/**
 * /postseason ハブ（トーナメント表＋海外の反応）が読むデータ。
 *
 * data/postseason.json は scripts/fetch-mlb-stats.mjs postseason が CI（毎時）で書き出す公知の事実のみ
 * （順位・確定マーク・シード・勝敗・日程・スコア）。サイト本体はこの静的JSONを読むだけで
 * MLB API を叩かない（standings.json と同じ posture）。
 *
 * URL に年号を入れない恒久ハブ（/mvp と同じ型）: 毎年9月1日に翌シーズンへ切り替わり、それまでは
 * 前年の結果を出したまま待つ。閉幕した年は data/postseason-archive/{season}.json に固定されて残る。
 */

export type Round = 'F' | 'D' | 'L' | 'W';
export type League = 'AL' | 'NL';
export type Phase = 'race' | 'postseason' | 'final';

export type RaceRow = {
  id: number;
  nameJa: string;
  division: 'East' | 'Central' | 'West';
  w: number;
  l: number;
  pct: string;
  divisionRank: number;
  divisionLeader: boolean;
  /** 地区のゲーム差（首位は "-"） */
  gb: string;
  wcRank: number | null;
  /** ワイルドカード3位とのゲーム差（圏内は "+2.0"・3位は "-"） */
  wcGb: string | null;
  /** 地区優勝の自力消滅までの数（"E"＝消滅） */
  divElim: string | null;
  /** ワイルドカードの自力消滅までの数（"E"＝消滅） */
  wcElim: string | null;
  /** MLB公式の凡例: x=進出確定 y=地区優勝 z=リーグ最高勝率 w=ワイルドカード確定 */
  clinch: 'x' | 'y' | 'z' | 'w' | null;
  remaining: number;
};

export type SeriesSide = {
  id: number | null;
  nameJa?: string;
  /** 未確定の枠の API 表記（"CWS/CLE" "NL Wild Card #3" "AL 3/6 Winner" など） */
  placeholder?: string | null;
  seed?: number | null;
  wins: number;
};

export type SeriesGame = {
  n: number | null;
  gamePk: number;
  etDate: string;
  /** 開始時刻（UTC ISO）。tbd のときは仮の値なので時刻を出さない。 */
  start: string;
  tbd: boolean;
  state: string;
  detailed: string;
  ifNecessary: boolean;
  away: { id: number | null; score: number | null };
  home: { id: number | null; score: number | null };
};

export type Series = {
  id: string;
  round: Round;
  league: League | null;
  label: 'A' | 'B' | null;
  bestOf: number;
  /** 第1戦のビジター（下位シード） */
  top: SeriesSide;
  /** 第1戦の本拠地（上位シード） */
  bottom: SeriesSide;
  winnerId: number | null;
  games: SeriesGame[];
};

export type PostseasonData = {
  asOf: string;
  season: number;
  dates: { regularEnd: string | null; postStart: string | null };
  phase: Phase;
  race: Record<League, RaceRow[]>;
  series: Series[];
  champion: { id: number; nameJa: string } | null;
};

const DATA_DIR = path.join(process.cwd(), 'data');

let cache: PostseasonData | null | undefined;

export async function getPostseason(): Promise<PostseasonData | null> {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'postseason.json'), 'utf8')) as PostseasonData;
  } catch {
    // 未生成でもビルドは通す（/postseason は 404、チームLPの一行とタブは出ない）
    cache = null;
  }
  return cache;
}

/** 閉幕した年の結果（新しい年が先）。今表示している年は除く。 */
export async function getPostseasonArchive(exceptSeason?: number): Promise<PostseasonData[]> {
  const dir = path.join(DATA_DIR, 'postseason-archive');
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => /^\d{4}\.json$/.test(f));
  } catch {
    return [];
  }
  const rows = await Promise.all(
    files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')) as PostseasonData),
  );
  return rows.filter((r) => r.season !== exceptSeason && r.champion).sort((a, b) => b.season - a.season);
}

// ───────────────────────────────────────────── 表記

export const ROUND_ORDER: Round[] = ['F', 'D', 'L', 'W'];

const ROUND_NAME: Record<Round, { ja: string; en: string; shortJa: string; shortEn: string }> = {
  F: { ja: 'ワイルドカードシリーズ', en: 'Wild Card Series', shortJa: 'WCシリーズ', shortEn: 'Wild Card' },
  D: { ja: '地区シリーズ', en: 'Division Series', shortJa: '地区シリーズ', shortEn: 'Division Series' },
  L: { ja: 'リーグ優勝決定シリーズ', en: 'Championship Series', shortJa: '優勝決定S', shortEn: 'LCS' },
  W: { ja: 'ワールドシリーズ', en: 'World Series', shortJa: 'ワールドシリーズ', shortEn: 'World Series' },
};

export function roundName(round: Round, en: boolean, short = false): string {
  const r = ROUND_NAME[round];
  return en ? (short ? r.shortEn : r.en) : short ? r.shortJa : r.ja;
}

export function leagueName(league: League, en: boolean): string {
  return en ? (league === 'AL' ? 'American League' : 'National League') : league === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';
}

export function bestOfLabel(bestOf: number, en: boolean): string {
  const need = Math.ceil(bestOf / 2);
  return en ? `Best of ${bestOf}` : `${bestOf}戦${need}勝制`;
}

function teamJa(id: number): string {
  return getTeamById(id)?.nameJa ?? String(id);
}

export function teamLabel(id: number, en: boolean): string {
  const t = getTeamById(id);
  return t ? (en ? t.info.nameEn : t.nameJa) : String(id);
}

/** 略号（"CWS"）→ 日本語名。未確定枠の "CWS/CLE" を読むのに使う。 */
function nameFromAbbr(abbr: string, en: boolean): string {
  for (let id = 100; id < 200; id++) {
    if (teamAbbr(id) === abbr) return teamLabel(id, en);
  }
  return abbr;
}

/**
 * 未確定の枠の表記。API は決まるまで "CWS/CLE"（どちらか）・"NL Wild Card #3"・"AL 3/6 Winner"・
 * "AL Higher Seed" のような仮の名前を返す。読者に意味の通る言い方へ直す（決め打ちで埋めない）。
 */
export function placeholderLabel(ph: string | null | undefined, en: boolean): string {
  if (!ph) return en ? 'TBD' : '未定';
  const pair = ph.match(/^([A-Z]{2,3})\/([A-Z]{2,3})$/);
  if (pair) {
    const [a, b] = [nameFromAbbr(pair[1], en), nameFromAbbr(pair[2], en)];
    return en ? `${a} or ${b}` : `${a}か${b}`;
  }
  const wc = ph.match(/^(AL|NL) Wild Card #(\d)$/);
  if (wc) return en ? `${wc[1]} Wild Card #${wc[2]}` : `${leagueName(wc[1] as League, false)}WC${wc[2]}位`;
  const winner = ph.match(/^(AL|NL) (\d)\/(\d) Winner$/);
  if (winner) return en ? `Winner of #${winner[2]} vs #${winner[3]}` : `第${winner[2]}シード対第${winner[3]}シードの勝者`;
  return en ? 'TBD' : '未定';
}

export function sideLabel(side: SeriesSide, en: boolean): string {
  return side.id ? teamLabel(side.id, en) : placeholderLabel(side.placeholder, en);
}

/** 試合の日時。時刻が決まっていれば日本時間、未定なら現地の日付だけ（JST に直すと日付がずれうる）。 */
export function gameWhen(g: SeriesGame, en: boolean): string {
  if (g.tbd) {
    const [, m, d] = g.etDate.split('-').map(Number);
    return en ? `${m}/${d} (ET, time TBD)` : `現地${m}/${d}（時刻未定）`;
  }
  const dt = new Date(g.start);
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(dt);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return en
    ? `${v('month')}/${v('day')} ${v('hour')}:${v('minute')} JST`
    : `${v('month')}/${v('day')}（${v('weekday')}）${v('hour')}:${v('minute')}`;
}

/** シリーズの状況を一文で（「ヤンキースが2勝1敗で突破」「1勝1敗のタイ」「第1戦 9/30（火）7:08」）。 */
export function seriesStatus(s: Series, en: boolean): string {
  const { top, bottom } = s;
  if (s.winnerId) {
    const w = s.winnerId === top.id ? top : bottom;
    const l = w === top ? bottom : top;
    const name = teamLabel(s.winnerId, en);
    if (s.round === 'W') return en ? `${name} win the World Series ${w.wins}-${l.wins}` : `${name}が${w.wins}勝${l.wins}敗で世界一`;
    return en ? `${name} advance ${w.wins}-${l.wins}` : `${name}が${w.wins}勝${l.wins}敗で突破`;
  }
  const played = top.wins + bottom.wins;
  const next = s.games.find((g) => g.state !== 'Final');
  const live = s.games.find((g) => g.state === 'Live');
  if (live) return en ? `Game ${live.n} in progress` : `第${live.n}戦 試合中`;
  if (played > 0 && top.id && bottom.id) {
    if (top.wins === bottom.wins) return en ? `Tied ${top.wins}-${bottom.wins}` : `${top.wins}勝${bottom.wins}敗のタイ`;
    const lead = top.wins > bottom.wins ? top : bottom;
    const trail = lead === top ? bottom : top;
    return en
      ? `${teamLabel(lead.id!, en)} lead ${lead.wins}-${trail.wins}`
      : `${teamLabel(lead.id!, en)}が${lead.wins}勝${trail.wins}敗でリード`;
  }
  if (next) return en ? `Game ${next.n}: ${gameWhen(next, en)}` : `第${next.n}戦 ${gameWhen(next, en)}`;
  return en ? 'TBD' : '未定';
}

/** 1試合の結果行（「ヤンキース 3-2 レッドソックス」）。未実施は null。 */
export function gameScoreLine(g: SeriesGame, en: boolean): string | null {
  if (g.state !== 'Final' || g.away.id == null || g.home.id == null) return null;
  return `${teamLabel(g.away.id, en)} ${g.away.score ?? '-'}-${g.home.score ?? '-'} ${teamLabel(g.home.id, en)}`;
}

/** 各ラウンドの開幕日（現地）。FAQ と「いまの局面」の日程に使う。リーグ別に日が違うラウンドは早い方。 */
export function roundStartDates(data: PostseasonData): Partial<Record<Round, { AL?: string; NL?: string; any: string }>> {
  const out: Partial<Record<Round, { AL?: string; NL?: string; any: string }>> = {};
  for (const s of data.series) {
    const first = s.games.find((g) => g.n === 1) ?? s.games[0];
    if (!first) continue;
    const cur = out[s.round] ?? { any: first.etDate };
    if (first.etDate < cur.any) cur.any = first.etDate;
    if (s.league) cur[s.league] = first.etDate;
    out[s.round] = cur;
  }
  return out;
}

export function mdLabel(etDate: string, en: boolean): string {
  const [, m, d] = etDate.split('-').map(Number);
  return en ? `${m}/${d}` : `${m}月${d}日`;
}

/** いま進んでいるラウンド（決着していない最初のラウンド）。ポストシーズン中だけ値を持つ。 */
export function currentRound(data: PostseasonData): Round | null {
  // 進出争いの間（race）と閉幕後（final）は「いまのラウンド」が無い。
  if (data.phase !== 'postseason') return null;
  for (const r of ROUND_ORDER) {
    if (data.series.some((s) => s.round === r && !s.winnerId)) return r;
  }
  return null;
}

// ───────────────────────────────────────────── チームLP の一行

/**
 * チームLP（順位表の下）に出すポストシーズンの状況。対象外（争いにも枠にも居ない）は null。
 * 値は data/postseason.json の事実の言い換えだけ（予想・確率は書かない）。
 */
export function postseasonStatusOf(data: PostseasonData, teamId: number): { ja: string; en: string } | null {
  if (data.phase === 'race') {
    const lg = (['AL', 'NL'] as League[]).find((l) => data.race[l].some((r) => r.id === teamId));
    const row = lg ? data.race[lg].find((r) => r.id === teamId) : undefined;
    if (!row) return null;
    if (row.clinch === 'y' || row.clinch === 'z') return { ja: '地区優勝決定・ポストシーズン進出', en: 'Clinched division' };
    if (row.clinch === 'x' || row.clinch === 'w') return { ja: 'ポストシーズン進出決定', en: 'Clinched a postseason berth' };
    const rest = row.remaining;
    if (row.divisionLeader) return { ja: `地区首位で争い中（残り${rest}試合）`, en: `Leading the division (${rest} games left)` };
    // 地区首位と同率（gb が "-"）でも API は片方だけを divisionLeader にする＝もう片方も首位争いの当事者。
    if (row.gb === '-') return { ja: `地区首位と同率で争い中（残り${rest}試合）`, en: `Tied for the division lead (${rest} games left)` };
    if (row.wcRank && row.wcRank <= 3) return { ja: `ワイルドカード${row.wcRank}位で争い中（残り${rest}試合）`, en: `Wild Card #${row.wcRank} (${rest} games left)` };
    // ワイルドカードの目が消えて地区優勝だけが残っているチームに「WC圏まで◯差」と書くと経路を取り違える。
    if (row.wcElim === 'E') {
      return { ja: `地区首位と${row.gb}ゲーム差（残り${rest}試合）`, en: `${row.gb} games back in the division (${rest} games left)` };
    }
    return {
      ja: `ワイルドカード圏まで${row.wcGb}ゲーム差（残り${rest}試合）`,
      en: `${row.wcGb} games out of a Wild Card spot (${rest} games left)`,
    };
  }
  const mine = data.series.filter((s) => s.top.id === teamId || s.bottom.id === teamId);
  if (!mine.length) return null;
  const last = [...mine].sort((a, b) => ROUND_ORDER.indexOf(b.round) - ROUND_ORDER.indexOf(a.round))[0];
  const rj = roundName(last.round, false);
  const re = roundName(last.round, true);
  if (last.winnerId === teamId && last.round === 'W') return { ja: `${data.season}年 ワールドシリーズ優勝`, en: `${data.season} World Series champions` };
  if (last.winnerId && last.winnerId !== teamId) return { ja: `${rj}で敗退`, en: `Eliminated in the ${re}` };
  const me = last.top.id === teamId ? last.top : last.bottom;
  const opp = me === last.top ? last.bottom : last.top;
  if (me.wins + opp.wins === 0) {
    const seed = me.seed ? `第${me.seed}シード・` : '';
    return { ja: `${seed}${rj}に出場`, en: `${me.seed ? `No. ${me.seed} seed, ` : ''}playing in the ${re}` };
  }
  return { ja: `${rj} ${me.wins}勝${opp.wins}敗`, en: `${re}: ${me.wins}-${opp.wins}` };
}

// ───────────────────────────────────────────── 日本人選手（トーナメント表の各行に小さく添える）

/** teamId → そのチームの日本人選手名（カタログの非ライバル × スナップショットの所属）。 */
export function japaneseByTeam(snap: PlayersSnapshot): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const p of PLAYERS) {
    if (p.rival) continue;
    const team = snap.players[String(p.mlbId)]?.team;
    const id = team ? getTeamIdByJa(team) : undefined;
    if (!id) continue;
    map.set(id, [...(map.get(id) ?? []), p.nameJa]);
  }
  return map;
}

function getTeamIdByJa(nameJa: string): number | undefined {
  for (let id = 100; id < 200; id++) {
    if (getTeamById(id)?.nameJa === nameJa) return id;
  }
  return undefined;
}

// ───────────────────────────────────────────── 海外の反応（記事をタグでラウンドに振り分ける）

/**
 * ラウンドごとの記事タグ。記事側（matome・jp-daily）が付けるタグ名の正はここ。
 * 「ポストシーズン」は全ラウンド共通の傘タグ（ラウンドのタグと両方付ける）。
 * 「ワールドシリーズ」タグは過去の名場面記事（松井のMVPなど）にも付いているので、その年の
 * 9月以降に書かれた記事だけを拾う。
 */
export const POSTSEASON_TAGS = {
  race: ['ワイルドカード', '地区優勝', 'ポストシーズン進出'],
  F: ['ワイルドカードシリーズ'],
  D: ['地区シリーズ'],
  L: ['リーグ優勝決定シリーズ'],
  W: ['ワールドシリーズ'],
  umbrella: ['ポストシーズン'],
} as const;

export type ReactionGroup = { key: Round | 'race' | 'other'; threads: Thread[] };

export function postseasonReactions(threads: Thread[], season: number): ReactionGroup[] {
  const inSeason = threads.filter((t) => t.fetchedAt >= `${season}-09-01` && t.fetchedAt < `${season + 1}-01-01`);
  const has = (t: Thread, tags: readonly string[]) => (t.tags ?? []).some((x) => tags.includes(x));
  const used = new Set<string>();
  const groups: ReactionGroup[] = [];
  // 新しいラウンドが先＝いま読まれている話題を上に置く。
  for (const r of [...ROUND_ORDER].reverse()) {
    const list = inSeason.filter((t) => has(t, POSTSEASON_TAGS[r]) && !used.has(t.id));
    list.forEach((t) => used.add(t.id));
    if (list.length) groups.push({ key: r, threads: list });
  }
  const race = inSeason.filter((t) => has(t, POSTSEASON_TAGS.race) && !used.has(t.id));
  race.forEach((t) => used.add(t.id));
  const other = inSeason.filter((t) => has(t, POSTSEASON_TAGS.umbrella) && !used.has(t.id));
  if (other.length) groups.push({ key: 'other', threads: other });
  if (race.length) groups.push({ key: 'race', threads: race });
  return groups;
}

// ───────────────────────────────────────────── FAQ（画面と FAQPage JSON-LD が同じ配列を使う）

/**
 * 答えは制度（2022年からの12球団制）の定型の事実と、data/postseason.json の値の言い換えだけ。
 * 日程・シード・優勝チームはデータから毎回組み直す＝古い答えを掲げ続けない。
 */
export function buildPostseasonFaq(data: PostseasonData, jp: Map<number, string[]>): FaqItem[] {
  const y = data.season;
  const starts = roundStartDates(data);
  const faq: FaqItem[] = [
    {
      q: { ja: 'MLBのワイルドカードとは？', en: 'What is the MLB Wild Card?' },
      a: {
        ja: '各リーグで地区優勝を逃したチームのうち、勝率の高い3チームに与えられるポストシーズンの出場枠です。地区優勝の3チームと合わせて各リーグ6チーム、両リーグで計12チームがポストシーズンに進みます。',
        en: 'The three teams in each league with the best records among non-division winners. With the three division winners, six teams per league and twelve in total reach the postseason.',
      },
    },
    {
      q: { ja: 'ワイルドカードシリーズの仕組みは？', en: 'How does the Wild Card Series work?' },
      a: {
        ja: '3戦2勝制で、全試合を上位シードの本拠地で行います。各リーグ第3シード（勝率3位の地区優勝チーム）対第6シード、第4シード対第5シードの2カード。第1・第2シードは初戦免除で、地区シリーズから登場します。',
        en: 'A best-of-three with every game at the higher seed. In each league, No. 3 (the third-best division winner) plays No. 6 and No. 4 plays No. 5. The top two seeds get a bye to the Division Series.',
      },
    },
    {
      q: { ja: '地区シリーズ・リーグ優勝決定シリーズ・ワールドシリーズは何戦制？', en: 'How long are the later rounds?' },
      a: {
        ja: '地区シリーズは5戦3勝制、リーグ優勝決定シリーズとワールドシリーズは7戦4勝制です。勝ち上がるたびに組み直す再シーディングはなく、トーナメント表の組み合わせのまま進みます。',
        en: 'The Division Series is best-of-five; the League Championship Series and World Series are best-of-seven. There is no reseeding: winners advance along the bracket.',
      },
    },
  ];

  if (starts.F || starts.D || starts.W) {
    const partsJa: string[] = [];
    const partsEn: string[] = [];
    if (starts.F) {
      partsJa.push(`ワイルドカードシリーズは${mdLabel(starts.F.any, false)}`);
      partsEn.push(`Wild Card Series ${mdLabel(starts.F.any, true)}`);
    }
    if (starts.D) {
      partsJa.push(`地区シリーズは${mdLabel(starts.D.any, false)}`);
      partsEn.push(`Division Series ${mdLabel(starts.D.any, true)}`);
    }
    if (starts.L) {
      const { AL, NL } = starts.L;
      if (AL && NL && AL !== NL) {
        partsJa.push(`リーグ優勝決定シリーズはナ・リーグ${mdLabel(NL, false)}・ア・リーグ${mdLabel(AL, false)}`);
        partsEn.push(`NLCS ${mdLabel(NL, true)}, ALCS ${mdLabel(AL, true)}`);
      } else {
        partsJa.push(`リーグ優勝決定シリーズは${mdLabel(starts.L.any, false)}`);
        partsEn.push(`LCS ${mdLabel(starts.L.any, true)}`);
      }
    }
    if (starts.W) {
      partsJa.push(`ワールドシリーズは${mdLabel(starts.W.any, false)}`);
      partsEn.push(`World Series ${mdLabel(starts.W.any, true)}`);
    }
    faq.push({
      q: { ja: `${y}年のポストシーズンの日程は？`, en: `When is the ${y} postseason?` },
      a: {
        ja: `${partsJa.join('、')}にそれぞれ開幕します（いずれも現地の日付。日本時間ではおおむね翌日の朝）。`,
        en: `${partsEn.join('; ')} (local US dates; usually the next morning in Japan).`,
      },
    });
  }

  // 初戦免除のチーム（地区シリーズの本拠地側＝第1・第2シード）。決まっている分だけ答える。
  const byes = data.series.filter((s) => s.round === 'D' && s.bottom.id && s.bottom.seed);
  if (byes.length) {
    const fmt = (enL: boolean) =>
      (['AL', 'NL'] as League[])
        .map((lg) => {
          const list = byes
            .filter((s) => s.league === lg)
            .sort((a, b) => (a.bottom.seed ?? 9) - (b.bottom.seed ?? 9))
            .map((s) => (enL ? `${teamLabel(s.bottom.id!, true)} (No. ${s.bottom.seed})` : `${teamJa(s.bottom.id!)}（第${s.bottom.seed}シード）`));
          return list.length ? (enL ? `${lg}: ${list.join(', ')}` : `${leagueName(lg, false)}は${list.join('と')}`) : null;
        })
        .filter(Boolean)
        .join(enL ? '; ' : '、');
    const complete = byes.length === 4;
    faq.push({
      q: { ja: `${y}年に初戦免除（シード）になったチームは？`, en: `Which teams have a first-round bye in ${y}?` },
      a: {
        ja: `${fmt(false)}です。${complete ? '' : '残りの枠はまだ決まっていません。'}初戦免除のチームは地区シリーズから登場します。`,
        en: `${fmt(true)}.${complete ? '' : ' The remaining spots are not settled yet.'} They start in the Division Series.`,
      },
    });
  }

  // 日本人選手のいる出場チーム。トーナメント表の位置が未確定でも、確定マーク（x/y/z/w）が付いた
  // チームは「進出決定」として数える（位置が決まった枠だけで答えるとカブス・パドレスが漏れる）。
  const clinched = new Set<number>();
  for (const s of data.series) for (const side of [s.top, s.bottom]) if (side.id) clinched.add(side.id);
  const contenders: number[] = [];
  if (data.phase === 'race') {
    for (const r of [...data.race.AL, ...data.race.NL]) {
      if (r.clinch) clinched.add(r.id);
      else contenders.push(r.id);
    }
  }
  const withJp = (ids: Iterable<number>) => [...ids].filter((id) => jp.get(id)?.length);
  const jpIn = withJp(clinched);
  const jpRace = withJp(contenders);
  if (jpIn.length || jpRace.length) {
    const listJa = (ids: number[]) => ids.map((id) => `${teamJa(id)}の${jp.get(id)!.join('・')}`).join('、');
    const listEn = (ids: number[]) => ids.map((id) => `${teamLabel(id, true)} (${jp.get(id)!.join(', ')})`).join('; ');
    const ja = [
      jpIn.length ? `進出を決めたチームには、${listJa(jpIn)}が所属しています。` : '',
      jpRace.length ? `${jpRace.map((id) => `${teamJa(id)}（${jp.get(id)!.join('・')}）`).join('と')}はまだ進出を争っています。` : '',
    ].join('');
    const enA = [
      jpIn.length ? `Clinched teams with Japanese players: ${listEn(jpIn)}.` : '',
      jpRace.length ? ` Still in the race: ${listEn(jpRace)}.` : '',
    ].join('');
    faq.push({
      q: { ja: `${y}年のポストシーズンに出る日本人選手は？`, en: `Which Japanese players are in the ${y} postseason?` },
      a: {
        ja: `${ja}出場登録（ロースター）は各シリーズの前に発表されます。`,
        en: `${enA} Rosters are announced before each series.`,
      },
    });
  }

  if (data.champion) {
    const ws = data.series.find((s) => s.round === 'W');
    const champ = ws && (ws.top.id === data.champion.id ? ws.top : ws.bottom);
    const opp = ws && (champ === ws.top ? ws.bottom : ws.top);
    if (ws && champ && opp?.id) {
      faq.push({
        q: { ja: `${y}年のワールドシリーズ優勝チームは？`, en: `Who won the ${y} World Series?` },
        a: {
          ja: `${teamJa(data.champion.id)}です。ワールドシリーズで${teamJa(opp.id)}を${champ.wins}勝${opp.wins}敗で破りました。`,
          en: `The ${teamLabel(data.champion.id, true)}, beating the ${teamLabel(opp.id, true)} ${champ.wins}-${opp.wins}.`,
        },
      });
    }
  }
  return faq;
}
