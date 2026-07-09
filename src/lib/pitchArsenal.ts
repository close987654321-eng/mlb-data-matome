import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 選手ハブ /player の「球種別 徹底分析」セクションが読む、1投手の球種データ。
 * data/pitch-arsenals.json は scripts/fetch-mlb-stats.mjs arsenal が編集時/CI で書き出す
 * 公知の数値のみのファイル（Baseball Savant / Statcast 由来）。サイト本体はこの静的JSONを
 * 読むだけで API を叩かない（[[mlb-stats-enrichment-decision]] と同じ posture）。
 */

/** 球種1つの中身。率は Savant の実測値をそのまま持つ（サイト側で再計算しない集計済みの値）。 */
export type ArsenalPitch = {
  type: string; // Statcast 球種コード（FF/SL/FS…）＝被弾結合や整列のキー
  nameJa: string; // 日本語表記（フォーシーム / スプリット…）
  usage: number | null; // 投球割合 %
  velo: number | null; // 平均球速 mph（球種の物理）
  whiff: number | null; // 空振り率 %（振ったうち空振り）
  putAway: number | null; // 2ストライク後の決着率 %
  ba: number | null; // 被打率
  woba: number | null; // 被wOBA
  xwoba: number | null; // 期待被wOBA（打球の質から＝運を除いた実力値）
  hardHit: number | null; // ハードヒット率 %（95mph以上の被弾性打球）
  rv100: number | null; // 100球あたり run value（＋＝投手が抑えている／−＝打たれている）
  hr: number; // この球種で打たれた本塁打数
};

/** 被弾した本塁打1本ずつ（新しい順）。 */
export type HrShot = {
  d: string; // 試合日（ET）
  type: string; // 球種コード
  name: string; // 球種（英語名・原データ）
  nameJa: string; // 球種（日本語）
  velo: number | null; // 投球の球速 mph
  ev: number | null; // 打球速度 mph
  angle: number | null; // 打球角度 °
  dist: number | null; // 飛距離 ft
};

export type HrAllowed = {
  total: number;
  byPitch: Record<string, number>; // 日本語球種名 → 被弾数
  list: HrShot[];
};

/** 1投手の球種プロファイル。純投手/二刀流の投手側にだけ出す。 */
export type PitcherArsenal = {
  nameJa: string;
  team: string;
  league: 'AL' | 'NL' | null;
  totalPitches: number;
  era?: number; // 実防御率
  xera?: number; // 期待防御率（打球の質から＝ERA との差で“運の剥離”を語る）
  pitches: ArsenalPitch[]; // 投球割合の多い順
  hrAllowed?: HrAllowed;
};

export type ArsenalFile = {
  asOf: string;
  season: number;
  pitchers: Record<string, PitcherArsenal>;
};

const FILE = path.join(process.cwd(), 'data', 'pitch-arsenals.json');

let cache: ArsenalFile | null = null;

async function load(): Promise<ArsenalFile> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as ArsenalFile;
  } catch {
    // 未生成でもビルドは通す（該当セクションを出さないだけ）。
    cache = { asOf: '', season: 0, pitchers: {} };
  }
  return cache;
}

/** 指定投手の球種プロファイル。未生成/野手なら null（＝球種セクションを出さない）。 */
export async function getPitchArsenal(mlbId: number): Promise<PitcherArsenal | null> {
  const file = await load();
  return file.pitchers[String(mlbId)] ?? null;
}

export async function getArsenalFile(): Promise<ArsenalFile> {
  return load();
}

// ─── 表示補助（fs 非依存＝サーバー/クライアント両方から呼べる） ───────────────

/** 空振り率の高い「決め球」を1つ返す（武器＝記事フックの素）。稀にしか投げない球のノイズは除く。 */
export function bestWhiffPitch(pitches: ArsenalPitch[]): ArsenalPitch | null {
  const usable = pitches.filter((p) => p.whiff != null && (p.usage ?? 0) >= 5);
  if (!usable.length) return null;
  return usable.reduce((a, b) => ((b.whiff ?? 0) > (a.whiff ?? 0) ? b : a));
}

/** 被wOBA が最悪＝一番打たれている球種（“穴”）。投球割合10%以上に絞ってノイズを除く。 */
export function leakiestPitch(pitches: ArsenalPitch[]): ArsenalPitch | null {
  const usable = pitches.filter((p) => p.woba != null && (p.usage ?? 0) >= 10);
  if (!usable.length) return null;
  return usable.reduce((a, b) => ((b.woba ?? 0) > (a.woba ?? 0) ? b : a));
}
