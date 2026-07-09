import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * サイ・ヤング賞「予測ボード」＝規定到達投手を AL/NL 別に合成スコアで順位予測したデータ。
 * data/cy-young-board.json は scripts/fetch-mlb-stats.mjs cyyoung が編集時/CI で書き出す
 * 公知の数値のみのファイル（statsapi の規定投手スタッツ＋ Savant xERA）。サイト本体は静的JSONを
 * 読むだけで API を叩かない。スコアは「各指標のリーグ内パーセンタイル×重み」の透明な合成
 * （＝断定でなく“データからの予測”。ページ側で式と出典を明示する）。
 */

/** ランク表の1行（規定到達投手）。 */
export type CyRow = {
  rank: number;
  id: number;
  nameJa: string;
  nameEn: string;
  teamJa: string;
  teamEn: string;
  league: 'AL' | 'NL';
  isJp: boolean; // 日本人＝行を強調
  era: string;
  xera: number | null;
  ipDisp: string; // 投球回（野球表記 "104.2"）
  w: number;
  l: number;
  so: number;
  whip: string;
  hr9: number | null;
  kbbPct: number | null; // K-BB%（既に % 値）
  score: number; // 合成スコア（0-100）
  why: string; // データ由来の一言（日本語）
  whyEn: string;
};

/** 圏外の注目日本人（規定投球回“未達”だが到達しうる先発＝大谷ら）。 */
export type CyWatch = {
  id: number;
  nameJa: string;
  teamJa: string;
  teamEn: string | null;
  league: 'AL' | 'NL' | null;
  gs: number;
  ipDisp: string;
  era: string;
  xera: number | null;
  whip: string;
  hr9: number | null;
  so: number;
  kbbPct: number | null;
  ipGap: number; // 規定投球回まで あと約N回
};

export type CyWeights = { prevention: number; kbb: number; ip: number; whip: number; hr9: number };

export type CyYoungBoard = {
  asOf: string;
  season: number;
  qualifyIp: number; // 規定投球回の目安（表示用）
  weights: CyWeights;
  leagues: { AL: CyRow[]; NL: CyRow[] };
  watch: CyWatch[];
};

const FILE = path.join(process.cwd(), 'data', 'cy-young-board.json');

let cache: CyYoungBoard | null = null;

/** ボードのデータ。未生成なら null（ページはビルド時に notFound / 空表示にする）。 */
export async function getCyYoungBoard(): Promise<CyYoungBoard | null> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as CyYoungBoard;
  } catch {
    return null;
  }
  return cache;
}
