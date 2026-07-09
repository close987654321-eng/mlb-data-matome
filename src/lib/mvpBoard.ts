import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * MVP「予測ボード」＝規定到達打者を AL/NL 別に合成スコアで順位予測したデータ（cyYoungBoard の野手版）。
 * data/mvp-board.json は scripts/fetch-mlb-stats.mjs mvp が編集時/CI で書き出す公知の数値のみのファイル
 * （statsapi の規定打者スタッツ＋sabermetrics WAR ＋ Savant xwOBA/打球の質/バットスピード）。
 * サイト本体は静的JSONを読むだけで API を叩かない。スコアは「各指標のリーグ内パーセンタイル×重み」の
 * 透明な合成（＝断定でなく“データからの予測”。ページ側で式と出典を明示する）。
 * 二刀流（大谷）は投手WARを合算した warTotal で評価＝MVP投票の実態（総合価値）に合わせる。
 */

/** 各指標のリーグ内パーセンタイル（0-100・大きいほどそのリーグで優秀）。 */
export type MvpPct = { wrc: number; xwoba: number; hr: number; run: number; def: number; war: number };

/** 打球の質・スイング・走守（詳細ページの「野手の厚いデータ」）。計測対象外/未計測は null。 */
export type MvpStatcast = {
  ev: number | null; // 平均打球速度 mph
  maxEv: number | null; // 最大打球速度 mph
  barrel: number | null; // バレル率 %
  hardHit: number | null; // ハードヒット率 %（95mph以上）
  sweetSpot: number | null; // スイートスポット率 %（打球角度8-32°）
  batSpeed: number | null; // 平均バットスピード mph
  hardSwing: number | null; // 強スイング率 %（75mph以上のスイング）
  squaredUp: number | null; // squared-up率 %（芯で捉えたスイングの割合）
  sprint: number | null; // 走力 ft/s
  oaa: number | null; // 守備範囲 OAA（守備位置に就く野手のみ）
};

/** ランク表の1行（規定到達打者）。 */
export type MvpRow = {
  rank: number;
  id: number;
  nameJa: string;
  nameEn: string;
  teamJa: string;
  teamEn: string;
  teamId: number | null; // 公式ロゴ引き当て用（teams.ts）
  league: 'AL' | 'NL';
  pos: string | null; // 守備位置（TWP=二刀流）
  isJp: boolean; // 日本人＝行を強調
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  hr: number;
  rbi: number;
  sbs: number; // 盗塁
  pa: number;
  wrcPlus: number | null;
  woba: number | null;
  xwoba: number | null;
  xslg: number | null;
  war: number | null; // 打者WAR
  warPitch: number | null; // 二刀流の投手WAR（大谷のみ想定）
  warTotal: number | null; // 打者WAR＋投手WAR＝スコアに使う総合値
  runBat: number | null; // 打撃run
  runBsr: number | null; // 走塁run
  runDef: number | null; // 守備＋位置補正run（DHのマイナス込み）
  score: number; // 合成スコア（0-100）
  pct: MvpPct; // 各指標のリーグ内パーセンタイル（詳細ページのスコア内訳バー）
  sc: MvpStatcast;
  why: string; // データ由来の一言（日本語）
  whyEn: string;
};

/** 圏外の注目日本人（規定打席“未達”の野手＝村上ら）。 */
export type MvpWatch = {
  id: number;
  nameJa: string;
  teamJa: string;
  teamEn: string | null;
  teamId: number | null;
  league: 'AL' | 'NL' | null;
  pa: number;
  avg: string;
  ops: string;
  hr: number;
  rbi: number;
  xwoba: number | null;
  paGap: number; // 規定打席まで あと約N打席
};

export type MvpWeights = { batting: number; hr: number; run: number; def: number; war: number };

export type MvpBoard = {
  asOf: string;
  season: number;
  qualifyPa: number; // 規定打席の目安（表示用）
  weights: MvpWeights;
  leagues: { AL: MvpRow[]; NL: MvpRow[] };
  watch: MvpWatch[];
};

const FILE = path.join(process.cwd(), 'data', 'mvp-board.json');

let cache: MvpBoard | null = null;

/** ボードのデータ。未生成なら null（ページはビルド時に notFound / 空表示にする）。 */
export async function getMvpBoard(): Promise<MvpBoard | null> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as MvpBoard;
  } catch {
    return null;
  }
  return cache;
}

/** 詳細ページを作る打者＝各リーグ上位 N（既定5）。generateStaticParams と相互に使う。 */
export const MVP_DETAIL_TOP = 5;

export async function getMvpDetailRows(): Promise<MvpRow[]> {
  const board = await getMvpBoard();
  if (!board) return [];
  return [...board.leagues.NL.slice(0, MVP_DETAIL_TOP), ...board.leagues.AL.slice(0, MVP_DETAIL_TOP)];
}

/** 指定 mlbId の打者が「詳細ページ対象（上位N）」ならその行を返す。対象外/未生成は null。 */
export async function getMvpHitter(mlbId: number): Promise<{ row: MvpRow; board: MvpBoard } | null> {
  const board = await getMvpBoard();
  if (!board) return null;
  const row = (await getMvpDetailRows()).find((r) => r.id === mlbId);
  return row ? { row, board } : null;
}
