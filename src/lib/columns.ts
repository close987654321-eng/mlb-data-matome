import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Column } from '@/types/column';

// コラム／インタビューは競技横断の1ディレクトリにフラットに置く（sport は各ファイルの属性）。
const COLUMNS_DIR = path.join(process.cwd(), 'data', 'columns');

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

function byNewest(a: Column, b: Column): number {
  return b.publishedAt.localeCompare(a.publishedAt);
}

/** 全コラム／インタビューを新着順で返す */
export async function getAllColumns(): Promise<Column[]> {
  let names: string[];
  try {
    names = await fs.readdir(COLUMNS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const files = names.filter((n) => n.endsWith('.json'));
  const columns = await Promise.all(
    files.map((n) => readJsonSafe<Column>(path.join(COLUMNS_DIR, n))),
  );
  return columns.filter((c): c is Column => c != null).sort(byNewest);
}

export async function getColumn(id: string): Promise<Column | null> {
  return readJsonSafe<Column>(path.join(COLUMNS_DIR, `${id}.json`));
}
