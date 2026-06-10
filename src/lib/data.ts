import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Thread } from '@/types/thread';
import { SPORTS, type Sport } from '@/lib/sports';

const DATA_ROOT = path.join(process.cwd(), 'data');

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

function sportDir(sport: Sport): string {
  return path.join(DATA_ROOT, 'threads', sport);
}

/** 1 スレ 1 ファイル（data/threads/{sport}/{id}.json）。フォルダ名を sport の正とする。 */
async function loadSport(sport: Sport): Promise<Thread[]> {
  const dir = sportDir(sport);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const files = names.filter((n) => n.endsWith('.json'));
  const threads = await Promise.all(files.map((n) => readJsonSafe<Thread>(path.join(dir, n))));
  return threads
    .filter((t): t is Thread => t != null)
    .map((t) => ({ ...t, sport })); // フォルダ由来の sport を必ず付与
}

function byNewest(a: Thread, b: Thread): number {
  return b.fetchedAt.localeCompare(a.fetchedAt);
}

/** 全競技のまとめを新着順で返す（ホーム用） */
export async function getAllThreads(): Promise<Thread[]> {
  const lists = await Promise.all(SPORTS.map(loadSport));
  return lists.flat().sort(byNewest);
}

/** 指定競技のまとめを新着順で返す */
export async function getThreadsBySport(sport: Sport): Promise<Thread[]> {
  return (await loadSport(sport)).sort(byNewest);
}

export async function getThread(sport: Sport, id: string): Promise<Thread | null> {
  const t = await readJsonSafe<Thread>(path.join(sportDir(sport), `${id}.json`));
  return t ? { ...t, sport } : null;
}
