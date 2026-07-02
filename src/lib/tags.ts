import { getAllThreads, getThreadsBySport } from '@/lib/data';
import { getAllColumns, getColumnsBySport } from '@/lib/columns';
import { buildFeed, type FeedItem } from '@/lib/feed';
import type { Sport } from '@/lib/sports';
import type { Thread } from '@/types/thread';
import type { Column } from '@/types/column';

/**
 * 汎用すぎて回遊価値の無いタグの集合（唯一の正）。
 *
 * 記事タグは大きく3種に分かれる:
 *  1) 選手名タグ（players.ts で解決）… 滞在の長い選手ハブ /player へ送れる最良の回遊先
 *  2) 通常タグ … チーム名・話題など、/tag 一覧で複数記事が集まる意味のある切り口
 *  3) 汎用タグ（STOPLIST）… ほぼ全記事に付く定型・カテゴリ総称。踏んでも薄く、
 *     関連度スコアの識別力も無い（「海外の反応」は全記事の約4割に付く）。
 *
 * STOPLIST は「リンクにしない（行き止まり回避）」＋「関連度スコアで無視する（IDF 事故防止）」の
 * 両方で使う単一の集合。ここに無い通常タグでも、全記事で1件しか付かない singleton は踏むと
 * 自分1件のページに落ちるので、描画側は tagCountMap で別途 non-link にする。
 */
export const TAG_STOPLIST = new Set<string>([
  // 全記事に付く定型（旧 ThreadCard の CARD_TAG_DENY を昇格）
  '海外の反応',
  // 競技カテゴリの総称（sports.ts のラベル。作品/選手を横断するので識別力ゼロ）
  'MLB', 'NPB', 'ボクシング', 'MMA', 'UFC', 'RIZIN',
  'Boxing', 'boxing', 'baseball', 'MLB公式',
  // 様式・話題の総称（記事を横断するので回遊の識別力が低い）
  'ハイライト', '試合結果', 'まとめ', '海外ファンと見る',
]);

/** 汎用すぎて回遊価値の無いタグ（リンクにしない／関連度で無視する）か。 */
export function isStopTag(tag: string): boolean {
  return TAG_STOPLIST.has(tag);
}

/**
 * 全記事横断のタグ出現数 map（tag -> 件数）。singleton（=1）判定＝行き止まりタグの非リンク化と、
 * 関連度の IDF 重みに使う。記事詳細ページは allThreads を既にロード済みなので追加 I/O は無い。
 */
export function tagCountMap(threads: Thread[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of threads) for (const tag of t.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return counts;
}

/** タグ1件＝表示名と件数。タグ一覧やタグページの静的生成に使う。 */
export type TagCount = { tag: string; count: number };

function countTagsOf(threads: Thread[], columns: Column[]): TagCount[] {
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

/** 全記事（反応まとめ＋コラム）からタグを集計し、件数の多い順に返す。 */
export async function getAllTags(): Promise<TagCount[]> {
  const [threads, columns] = await Promise.all([getAllThreads(), getAllColumns()]);
  return countTagsOf(threads, columns);
}

/** 指定競技の記事だけでタグを集計。競技LPの人気タグと導入文の話題差し込みに使う。 */
export async function getTagsBySport(sport: Sport): Promise<TagCount[]> {
  const [threads, columns] = await Promise.all([getThreadsBySport(sport), getColumnsBySport(sport)]);
  return countTagsOf(threads, columns);
}

/** 指定タグを含む記事を、反応まとめ＋コラム横断の新着フィードとして返す。 */
export async function getFeedByTag(tag: string): Promise<FeedItem[]> {
  const [threads, columns] = await Promise.all([getAllThreads(), getAllColumns()]);
  const ts = threads.filter((t) => (t.tags ?? []).includes(tag));
  const cs = columns.filter((c) => (c.tags ?? []).includes(tag));
  return buildFeed(ts, cs);
}
