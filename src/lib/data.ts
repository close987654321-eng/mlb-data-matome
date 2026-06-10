import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Meta, Player, Team } from '@/types/mlb';
import type { Thread } from '@/types/thread';

const DATA_ROOT = path.join(process.cwd(), 'data');

export const CURRENT_SEASON = 2026;

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

function seasonDir(season: number = CURRENT_SEASON): string {
  return path.join(DATA_ROOT, `season-${season}`);
}

export type RankingPayload<T> = {
  season: number;
  updatedAt: string | null;
  items: T[];
  meta: Meta | null;
};

async function loadList<T>(
  fileName: string,
  collection: 'players' | 'teams',
  season: number,
): Promise<RankingPayload<T>> {
  const dir = seasonDir(season);
  const file = await readJsonSafe<{ season: number; updatedAt: string; [k: string]: unknown }>(
    path.join(dir, fileName),
  );
  const meta = await readJsonSafe<Meta>(path.join(dir, 'meta.json'));
  const items = (file?.[collection] as T[] | undefined) ?? [];
  return {
    season,
    updatedAt: file?.updatedAt ?? null,
    items,
    meta,
  };
}

export function getBatters(season: number = CURRENT_SEASON): Promise<RankingPayload<Player>> {
  return loadList<Player>('batters.json', 'players', season);
}

export function getPitchers(season: number = CURRENT_SEASON): Promise<RankingPayload<Player>> {
  return loadList<Player>('pitchers.json', 'players', season);
}

export function getTeams(season: number = CURRENT_SEASON): Promise<RankingPayload<Team>> {
  return loadList<Team>('teams.json', 'teams', season);
}

export async function getJapanesePlayers(
  season: number = CURRENT_SEASON,
): Promise<RankingPayload<Player>> {
  const file = await readJsonSafe<{ season: number; updatedAt: string; players?: Player[] }>(
    path.join(DATA_ROOT, 'japanese-players', `${season}.json`),
  );
  return {
    season,
    updatedAt: file?.updatedAt ?? null,
    items: file?.players ?? [],
    meta: null,
  };
}

function threadsDir(season: number = CURRENT_SEASON): string {
  return path.join(DATA_ROOT, 'threads', String(season));
}

/** 1 スレ 1 ファイル（data/threads/{season}/{id}.json）を全件読み、fetchedAt 降順で返す */
export async function getThreads(season: number = CURRENT_SEASON): Promise<Thread[]> {
  const dir = threadsDir(season);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const files = names.filter((n) => n.endsWith('.json'));
  const threads = await Promise.all(
    files.map((n) => readJsonSafe<Thread>(path.join(dir, n))),
  );
  return threads
    .filter((t): t is Thread => t != null)
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
}

export async function getThread(
  id: string,
  season: number = CURRENT_SEASON,
): Promise<Thread | null> {
  return readJsonSafe<Thread>(path.join(threadsDir(season), `${id}.json`));
}
