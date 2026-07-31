import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Thread } from '@/types/thread';
import { SPORTS, type Sport } from '@/lib/sports';
import { getSeries } from '@/lib/series';

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

// 同時オープンする fd 数の上限。tag/[tag] のような大量ページ（1000+）を
// staticGenerationMaxConcurrency 並列で SSG すると、ページごとに全スレ（500+件）を
// Promise.all で一気に開くため、コンテナの fd 上限（ulimit -n）を超えて EMFILE 相当の
// 断続的な prerender エラーになる（2026-07-31 に /ja/tag/[tag] で発生・原因調査済み）。
// バッチ処理で同時オープン数を抑える。
const READ_CONCURRENCY = 32;

async function readFilesLimited(dir: string, files: string[]): Promise<(Thread | null)[]> {
  const results: (Thread | null)[] = new Array(files.length);
  for (let i = 0; i < files.length; i += READ_CONCURRENCY) {
    const batch = files.slice(i, i + READ_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((n) => readJsonSafe<Thread>(path.join(dir, n))),
    );
    batchResults.forEach((r, j) => (results[i + j] = r));
  }
  return results;
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
  const threads = await readFilesLimited(dir, files);
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

/**
 * 「海外ファンと見る」ハブ（/watch）に載せる記事＝動画つき watch-along 記事を
 * 全競技横断で新着順に返す。固定シリーズ（series 付き）も単発の動画まとめも含む。
 * hideFromWatch を立てた記事（スタジオ解説等、watch-along に馴染まない動画）は除外する。
 */
export async function getWatchAlongThreads(): Promise<Thread[]> {
  return (await getAllThreads()).filter((t) => t.media?.kind === 'video' && !t.hideFromWatch);
}

/**
 * /watch の「注目の試合（単発）」＝動画つきだが登録シリーズに属さない watch-along 記事。新着順。
 * 固定シリーズ（series.ts に登録ありの series.id）はシリーズ棚に出すのでここから除く。
 */
export async function getWatchSingles(): Promise<Thread[]> {
  return (await getWatchAlongThreads()).filter((t) => !t.series || !getSeries(t.series.id));
}

export async function getThread(sport: Sport, id: string): Promise<Thread | null> {
  const t = await readJsonSafe<Thread>(path.join(sportDir(sport), `${id}.json`));
  return t ? { ...t, sport } : null;
}
