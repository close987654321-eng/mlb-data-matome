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
/** 主ポジションの守備成績（公知の事実）。position は日本語表記、他は刺殺・補殺・失策・守備率など。 */
export type FieldingRecord = { position: string } & Record<string, string | number>;
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
  fielding?: FieldingRecord | null;
  /** 走力（Statcast スプリント速度・ft/s）。守備位置を問わず付く＝DH の選手にも出る。 */
  sprintSpeed?: number | null;
  ranks?: Ranks;
};
export type PlayersSnapshot = {
  asOf: string;
  season: number;
  players: Record<string, PlayerSeason>;
};

/**
 * 表示するシーズン年の単一ソース。スナップショットの season を正とし、未生成（season=0）の時だけ
 * このフォールバック定数を使う。タイトル・地の文・構造化データで年をベタ書きしないための一箇所。
 * 年が変わったらスナップショットが自動で追従するので、フォールバックの更新は基本不要。
 */
export const FALLBACK_SEASON = 2026;
export function seasonYear(snap?: { season?: number } | null): number {
  return snap?.season && snap.season > 0 ? snap.season : FALLBACK_SEASON;
}

/** asOf（"YYYY-MM-DD HH:MM" JST）を schema.org 用の妥当な ISO8601 に直す。日付のみ・空にも耐える。 */
export function asOfIso(asOf?: string): string | undefined {
  if (!asOf) return undefined;
  const m = asOf.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (!m) return undefined;
  return m[2] ? `${m[1]}T${m[2]}:00+09:00` : m[1];
}

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
