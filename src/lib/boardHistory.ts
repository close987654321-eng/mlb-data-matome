import { promises as fs } from 'node:fs';
import path from 'node:path';
/** 履歴の読み手が必要とするボードの最小形（RoyBoard / CyYoungBoard のどちらも満たす）。 */
export type HistBoardLike = { asOf: string; leagues: { AL: { id: number; rank: number }[]; NL: { id: number; rank: number }[] } };

/** 履歴を持つボードの種別＝ data/{kind}-history.json。 */
export type BoardKind = 'roy' | 'cy-young';

/** 履歴1日ぶんの行（ボード行の最小形）。 */
export type RoyHistRow = { id: number; nameJa: string; nameEn: string; rank: number; score: number; isJp: boolean };

/** 履歴の1日。asOf はボードのスタンプ、date はその日付（1日1エントリのキー）。 */
export type RoyHistDay = { asOf: string; date: string; AL: RoyHistRow[]; NL: RoyHistRow[] };

export type RoyHistory = { season: number; topN: number; days: RoyHistDay[] };

/**
 * 賞レースボードの日次履歴（data/{roy,cy-young}-history.json）の読み手。
 * ボード本体は毎日上書きされるので、「首位が何日座っているか」「日本人が何位から何位へ動いたか」は
 * この履歴からしか出ない。書き手は scripts/fetch-mlb-stats.mjs の appendBoardHistory（roy / cyyoung コマンド）。
 * 各日は上位 topN ＋ 日本人の行だけを持つ＝表に出ている選手の推移が引ければ足りる。
 */
const cache = new Map<BoardKind, RoyHistory | null>();

export async function getBoardHistory(kind: BoardKind): Promise<RoyHistory | null> {
  if (cache.has(kind)) return cache.get(kind) ?? null;
  let h: RoyHistory | null = null;
  try {
    h = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', `${kind}-history.json`), 'utf8')) as RoyHistory;
  } catch {
    h = null;
  }
  cache.set(kind, h);
  return h;
}

/** 後方互換＝新人王ボードの履歴。 */
export function getRoyHistory(): Promise<RoyHistory | null> {
  return getBoardHistory('roy');
}

/** 現在のボード日付より前で、いちばん新しい日のエントリ（今日ぶんの再取得で自分自身と比べない）。 */
export function previousDay(h: RoyHistory | null, currentAsOf: string): RoyHistDay | null {
  if (!h) return null;
  const date = currentAsOf.slice(0, 10);
  const before = h.days.filter((d) => d.date < date);
  return before.length ? before[before.length - 1] : null;
}

/** N日前以前でいちばん新しい日のエントリ（「1週間前と比べて」用）。 */
export function dayAtLeastBefore(h: RoyHistory | null, currentAsOf: string, days: number): RoyHistDay | null {
  if (!h) return null;
  const cur = new Date(`${currentAsOf.slice(0, 10)}T00:00:00Z`).getTime();
  const cutoff = cur - days * 86400000;
  const before = h.days.filter((d) => new Date(`${d.date}T00:00:00Z`).getTime() <= cutoff);
  return before.length ? before[before.length - 1] : null;
}

/**
 * 前日比の順位差（正＝上昇）。前日のエントリに居ない選手は null（＝新しく表に入った／前日は圏外）。
 * 履歴自体が無い場合は空の Map を返し、呼び手は▲▼を出さない。
 */
export function rankDeltas(prev: RoyHistDay | null, board: HistBoardLike): Map<number, number | null> {
  const out = new Map<number, number | null>();
  if (!prev) return out;
  for (const lg of ['AL', 'NL'] as const) {
    const prevRank = new Map(prev[lg].map((r) => [r.id, r.rank]));
    for (const row of board.leagues[lg]) {
      const p = prevRank.get(row.id);
      out.set(row.id, p == null ? null : p - row.rank);
    }
  }
  return out;
}

export type LeaderStreak = {
  /** 現在の1位が連続で1位に座っている日数（履歴に載っている日だけ数える）。 */
  days: number;
  /** 履歴の期間内で1位の名前が替わった回数。 */
  changes: number;
  /** 期間内に1位に座った選手（登場順・重複なし）。 */
  leaders: RoyHistRow[];
  /** 履歴の初日と最終日。 */
  from: string | null;
  to: string | null;
};

export function leaderStreak(h: RoyHistory | null, league: 'AL' | 'NL', currentLeaderId: number | undefined): LeaderStreak {
  const empty: LeaderStreak = { days: 0, changes: 0, leaders: [], from: null, to: null };
  if (!h || !h.days.length || currentLeaderId == null) return empty;
  const firsts = h.days.map((d) => d[league].find((r) => r.rank === 1)).filter((r): r is RoyHistRow => !!r);
  let changes = 0;
  const leaders: RoyHistRow[] = [];
  for (let i = 0; i < firsts.length; i++) {
    if (i > 0 && firsts[i].id !== firsts[i - 1].id) changes++;
    if (!leaders.some((l) => l.id === firsts[i].id)) leaders.push(firsts[i]);
  }
  let days = 0;
  for (let i = firsts.length - 1; i >= 0 && firsts[i].id === currentLeaderId; i--) days++;
  return { days, changes, leaders, from: h.days[0].date, to: h.days[h.days.length - 1].date };
}

/** ある選手の日次推移（履歴に載っていない日は欠測＝rank null）。 */
export function seriesOf(h: RoyHistory | null, league: 'AL' | 'NL', id: number): { date: string; rank: number | null; score: number | null }[] {
  if (!h) return [];
  return h.days.map((d) => {
    const r = d[league].find((x) => x.id === id);
    return { date: d.date, rank: r?.rank ?? null, score: r?.score ?? null };
  });
}

/** "2026-09-16" → ja "9/16" / en "9/16"（表のヘッダ用・短く）。 */
export function shortDate(date: string): string {
  const m = date.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[1])}/${Number(m[2])}` : date;
}
