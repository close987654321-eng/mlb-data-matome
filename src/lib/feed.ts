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
