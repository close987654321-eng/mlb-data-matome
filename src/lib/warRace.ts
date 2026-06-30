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
