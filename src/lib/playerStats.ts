import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 選手ハブ（/player）が読む「今季成績スナップショット」。
 * data/jp-players-stats.json は scripts/fetch-mlb-stats.mjs snapshot が編集時に書き出す
 * 公知の事実（数値）のみのファイル。サイト本体はこの静的JSONを読むだけで MLB API を叩かない
 * （[[mlb-stats-enrichment-decision]] の方針）。`asOf` をハブに「○月○日時点」と表示する。
 */
export type Saber = { hit?: number; pit?: number; woba?: number; wrcplus?: number };
export type StatRecord = Record<string, string | number>;
/** 指標ごとの順位（MLB全体＝mlb / 所属リーグ＝lg）。スナップショットが持つ公知の事実。 */
export type Rank = { mlb?: number; lg?: number };
export type Ranks = { hitting?: Record<string, Rank>; pitching?: Record<string, Rank> };
export type League = 'AL' | 'NL';
export type PlayerSeason = {
  team?: string;
  league?: League | null;
  hitting: StatRecord | null;
  pitching: StatRecord | null;
  saber: Saber | null;
  ranks?: Ranks;
};
export type PlayersSnapshot = {
  asOf: string;
  season: number;
  players: Record<string, PlayerSeason>;
};

const FILE = path.join(process.cwd(), 'data', 'jp-players-stats.json');

let cache: PlayersSnapshot | null = null;

async function load(): Promise<PlayersSnapshot> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as PlayersSnapshot;
  } catch {
    // スナップショット未生成でもビルドは通す（ハブは成績なしで記事クラスタだけ出す）
    cache = { asOf: '', season: 0, players: {} };
  }
  return cache;
}

export async function getPlayersSnapshot(): Promise<PlayersSnapshot> {
  return load();
}

export async function getPlayerSeason(mlbId: number): Promise<PlayerSeason | null> {
  const snap = await load();
  return snap.players[String(mlbId)] ?? null;
}
