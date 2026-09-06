import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 新人王（ROY）「予測ボード」＝ルーキー資格のある選手を AL/NL 別に合成スコアで順位予測したデータ。
 * data/roy-board.json は scripts/fetch-mlb-stats.mjs roy が編集時/CI で書き出す公知の数値のみの
 * ファイル（statsapi の season ＋ sabermetrics）。サイト本体は静的JSONを読むだけで API を叩かない。
 *
 * 他の2ボード（/cy-young・/mvp）と違うのは、新人王だけが1つの賞を野手と投手が同じ土俵で争うこと。
 * そこで WAR を役割をまたぐ共通通貨に置き、役割ごとの中身と出場量はそれぞれの母集団の中で
 * percentile を取る（式はスクリプト側のコメントが正）。行は role で野手/投手を持ち分ける。
 */

/** 役割。野手（bat）と投手（pit）が同じ表に混ざる＝新人王が1つの賞だから。 */
export type RoyRole = 'bat' | 'pit';

type RoyRowBase = {
  rank: number;
  id: number;
  nameJa: string;
  nameEn: string;
  teamJa: string;
  teamEn: string;
  teamId: number | null; // 公式ロゴ引き当て用（teams.ts）
  league: 'AL' | 'NL';
  isJp: boolean; // 日本人＝行を強調
  pos: string | null;
  war: number | null;
  score: number; // 合成スコア（0-100）
  pct: RoyPct; // スコアの内訳（リーグ内/役割内パーセンタイル）
  why: string; // データ由来の一言（日本語）
  whyEn: string;
};

/** 野手の行。 */
export type RoyBatRow = RoyRowBase & {
  role: 'bat';
  pa: number;
  avg: string | null;
  obp: string | null;
  slg: string | null;
  ops: string | null;
  hr: number;
  rbi: number;
  sb: number;
  wrcPlus: number | null;
};

/** 投手の行。 */
export type RoyPitRow = RoyRowBase & {
  role: 'pit';
  ipDisp: string | null; // 投球回（野球表記 "104.2"）
  era: string | null;
  w: number;
  l: number;
  sv: number;
  gs: number;
  so: number;
  whip: string | null;
  fip: number | null;
};

export type RoyRow = RoyBatRow | RoyPitRow;

/** スコアの内訳（0-100）。war はリーグのルーキー全体、role/volume は役割ごとの母集団での位置。 */
export type RoyPct = { war: number; role: number; volume: number };

/** 出場量の下限に届いていない日本人ルーキー（現在地を正しく示す watch 枠）。 */
export type RoyWatch = {
  id: number;
  role: RoyRole;
  nameJa: string;
  teamJa: string;
  teamEn: string | null;
  teamId: number | null;
  league: 'AL' | 'NL' | null;
  // 野手
  pa?: number;
  avg?: string | null;
  ops?: string | null;
  hr?: number;
  paGap?: number;
  // 投手
  ipDisp?: string | null;
  era?: string | null;
  so?: number;
  ipGap?: number;
};

export type RoyWeights = { war: number; role: number; volume: number };

export type RoyBoard = {
  asOf: string;
  season: number;
  minPa: number; // 表に載せる野手の下限打席
  minIp: number; // 表に載せる投手の下限投球回
  weights: RoyWeights;
  leagues: { AL: RoyRow[]; NL: RoyRow[] };
  watch: RoyWatch[];
};

const FILE = path.join(process.cwd(), 'data', 'roy-board.json');

let cache: RoyBoard | null = null;

/** ボードのデータ。未生成なら null（ページはビルド時に notFound）。 */
export async function getRoyBoard(): Promise<RoyBoard | null> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as RoyBoard;
  } catch {
    return null;
  }
  return cache;
}
