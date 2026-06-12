import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { buildFeed, type FeedItem } from '@/lib/feed';

/** タグ1件＝表示名と件数。タグ一覧やタグページの静的生成に使う。 */
export type TagCount = { tag: string; count: number };

/** 全記事（反応まとめ＋コラム）からタグを集計し、件数の多い順に返す。 */
export async function getAllTags(): Promise<TagCount[]> {
  const [threads, columns] = await Promise.all([getAllThreads(), getAllColumns()]);
  const counts = new Map<string, number>();
  const add = (tags?: string[]) => {
    for (const tag of tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  };
  threads.forEach((t) => add(t.tags));
  columns.forEach((c) => add(c.tags));
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ja'));
}

/** 指定タグを含む記事を、反応まとめ＋コラム横断の新着フィードとして返す。 */
export async function getFeedByTag(tag: string): Promise<FeedItem[]> {
  const [threads, columns] = await Promise.all([getAllThreads(), getAllColumns()]);
  const ts = threads.filter((t) => (t.tags ?? []).includes(tag));
  const cs = columns.filter((c) => (c.tags ?? []).includes(tag));
  return buildFeed(ts, cs);
}
