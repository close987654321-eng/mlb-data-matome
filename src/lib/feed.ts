import type { Thread } from '@/types/thread';
import type { Column } from '@/types/column';

/**
 * 反応まとめ（Thread）とコラム／インタビュー（Column）を1つの新着フィードに統合する。
 * 別ディレクトリ・別フォーマットだが、一覧では同じカードとして日付順に混ぜて見せる。
 * 日付は Thread=fetchedAt / Column=publishedAt（どちらも JST ISO8601）。
 */
export type FeedItem =
  | { kind: 'thread'; date: string; thread: Thread }
  | { kind: 'column'; date: string; column: Column };

export function buildFeed(threads: Thread[], columns: Column[]): FeedItem[] {
  const items: FeedItem[] = [
    ...threads.map((thread) => ({ kind: 'thread' as const, date: thread.fetchedAt, thread })),
    ...columns.map((column) => ({ kind: 'column' as const, date: column.publishedAt, column })),
  ];
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export function feedKey(item: FeedItem): string {
  return item.kind === 'thread'
    ? `thread/${item.thread.sport}/${item.thread.id}`
    : `column/${item.column.id}`;
}

/** 一覧1ページあたりの件数（実 URL ページ送りの単位＝3カラム×4行）。 */
export const FEED_PER_PAGE = 12;

export type PagedFeed = { items: FeedItem[]; page: number; totalPages: number };

/**
 * フィードを FEED_PER_PAGE 件ずつのページに切り出す（page は 1 始まり）。
 * page は 1〜totalPages にクランプし、totalPages は空フィードでも最低 1 を返す。
 * 呼び出し側は paged.totalPages で範囲外（404）を判定する。
 */
export function paginate(feed: FeedItem[], page: number): PagedFeed {
  const totalPages = Math.max(1, Math.ceil(feed.length / FEED_PER_PAGE));
  const current = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (current - 1) * FEED_PER_PAGE;
  return { items: feed.slice(start, start + FEED_PER_PAGE), page: current, totalPages };
}
