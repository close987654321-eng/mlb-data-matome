import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 選手ハブ /player の徹底分析「WARレース」が読む、大谷＋主なライバルの累計WAR時系列。
 * data/war-race.json は scripts/fetch-mlb-stats.mjs warrace が snapshot を読んで1日1点 積む
 * 公知の数値(WAR)のみのファイル。サイト本体は静的JSONを読むだけで API を叩かない。
 * MVP/サイヤング争いを日次で可視化する（WAR は MLB公式 sabermetrics の値）。
 */
export type WarRacePoint = { d: string; war: number; warHit?: number; warPit?: number };
export type WarRacePlayer = { nameJa: string; league: 'AL' | 'NL' | null; warHistory: WarRacePoint[] };
export type WarRace = { asOf: string; season: number; players: Record<string, WarRacePlayer> };

const FILE = path.join(process.cwd(), 'data', 'war-race.json');

export async function getWarRace(): Promise<WarRace | null> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as WarRace;
  } catch {
    return null;
  }
}

export type WarRank = { rank: number; war: number; runnerUp: number | null; gap: number | null };

/**
 * WARレースにおける選手の全体順位（＋直近の比較相手との差）を返す唯一の算出口。
 * ヒーローの赤「MLB1位」エンブレムと WARレースのスコアボードが“同じ事実”を指すよう、page.tsx と
 * WarRace.tsx の両方がこの純関数を使う（順位の二重定義＝食い違い＝捏造を構造的に防ぐ）。
 * rank=1 のとき gap は2位への「リード（＋）」、それ以外は1位との「差（−）」。
 */
export function warRank(race: WarRace, mlbId: number): WarRank | null {
  const entries = Object.entries(race.players)
    .map(([id, p]) => ({ id, war: p.warHistory.at(-1)?.war ?? 0, n: p.warHistory.length }))
    .filter((e) => e.n > 0)
    .sort((a, b) => b.war - a.war);
  const i = entries.findIndex((e) => e.id === String(mlbId));
  if (i < 0) return null;
  const me = entries[i];
  const ref = i === 0 ? entries[1] : entries[0]; // 1位なら2位、そうでなければ1位を比較相手に
  return {
    rank: i + 1,
    war: me.war,
    runnerUp: ref ? ref.war : null,
    gap: ref ? Math.round((me.war - ref.war) * 10) / 10 : null,
  };
}
