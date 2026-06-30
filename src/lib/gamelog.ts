import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 選手ハブ /player の「徹底分析」セクションが読む、1選手の試合別ログ。
 * data/gamelogs/{mlbId}.json は scripts/fetch-mlb-stats.mjs gamelog が編集時/CI で書き出す
 * 公知の数値のみのファイル。サイト本体はこの静的JSONを読むだけで MLB API を叩かない
 * （[[mlb-stats-enrichment-decision]] の方針）。率（avg/era 等）は持たず、期間集計はカウント数から再計算する。
 */

/** 打撃 1 試合（短いキー＝コミット差分を小さく保つ）。 */
export type HitGame = {
  d: string; // 試合日（ET officialDate）
  opp: string; // 対戦相手（英語名）
  oppJa: string; // 対戦相手（日本語）
  home: boolean;
  win: boolean | null; // チームの勝敗
  pa: number; ab: number; r: number; h: number; dbl: number; tpl: number; hr: number;
  rbi: number; sb: number; cs: number; bb: number; ibb: number; hbp: number; so: number; sf: number; tb: number;
};
/** 投球 1 試合。outs（アウト数）を持つので投球回の集計が端数まで正確。 */
export type PitGame = {
  d: string; opp: string; oppJa: string; home: boolean;
  gs: number; outs: number; h: number; r: number; er: number; hr: number;
  bb: number; ibb: number; hbp: number; so: number; bf: number; w: number; l: number;
};
/** WAR の時系列点（その日づけ＝直近試合日の今季累計WAR）。自前で日次に積み上げた近似系列。 */
export type WarPoint = { d: string; warHit?: number; warPit?: number; woba?: number; wrcplus?: number };

export type Gamelog = {
  asOf: string;
  season: number;
  player: { id: number; nameJa: string; nameEn: string };
  team: string;
  teamGames: number | null; // チームの消化試合数（162換算の分母）
  hitting: HitGame[];
  pitching: PitGame[];
  warHistory: WarPoint[];
};

const DIR = path.join(process.cwd(), 'data', 'gamelogs');

/** 指定選手の試合別ログ。未生成なら null（その選手は分析セクションを出さない）。 */
export async function getGamelog(mlbId: number): Promise<Gamelog | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, `${mlbId}.json`), 'utf8')) as Gamelog;
  } catch {
    return null;
  }
}
