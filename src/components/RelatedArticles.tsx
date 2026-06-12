import { getTranslations } from 'next-intl/server';
import { buildFeed, feedKey, type FeedItem } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import type { Thread } from '@/types/thread';
import type { Column } from '@/types/column';
import type { Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';

type Props = {
  threads: Thread[];
  columns: Column[];
  /** 表示中の記事（feedKey）。回遊先から自分自身を除くために使う。 */
  currentKey: string;
  /** 表示中の記事の競技。タグが並んだ後の同点は同競技を優先する。 */
  sport: Sport;
  /** 表示中の記事のタグ。共有タグ数で関連度を測る。 */
  currentTags?: string[];
  locale: Locale;
  limit?: number;
};

const sportOf = (item: FeedItem): Sport =>
  item.kind === 'thread' ? item.thread.sport : item.column.sport;

const tagsOf = (item: FeedItem): string[] =>
  (item.kind === 'thread' ? item.thread.tags : item.column.tags) ?? [];

/**
 * 記事ページ末尾の回遊導線。反応まとめ＋コラムを横断した新着フィードから、
 * 関連度の高い順に数件出す。記事ページは元スレへ送るだけの行き止まりに
 * なりがちなので、ここで内部回遊を作る。
 *
 * 関連度は ①共有タグ数（多いほど上） → ②同競技かどうか → ③新着順 の優先順。
 * タグが一致する記事が無ければ同競技の新着で、それも尽きれば他競技の新着で埋める。
 */
export default async function RelatedArticles({
  threads,
  columns,
  currentKey,
  sport,
  currentTags = [],
  locale,
  limit = 4,
}: Props) {
  const t = await getTranslations();
  // 自分自身は除外。buildFeed が日付降順に整列済み（同点時の③新着順はこの順序で担保）。
  const feed = buildFeed(threads, columns).filter((item) => feedKey(item) !== currentKey);
  if (feed.length === 0) return null;

  const currentTagSet = new Set(currentTags);
  const sharedTagCount = (item: FeedItem): number =>
    tagsOf(item).reduce((n, tag) => (currentTagSet.has(tag) ? n + 1 : n), 0);

  // 安定ソート（Array.prototype.sort）＋ feed が新着順なので、スコア同点は新着順を保つ。
  const picked = feed
    .map((item) => ({
      item,
      shared: sharedTagCount(item),
      sameSport: sportOf(item) === sport ? 1 : 0,
    }))
    .sort((a, b) => b.shared - a.shared || b.sameSport - a.sameSport)
    .slice(0, limit)
    .map((x) => x.item);

  return (
    <section className="mt-14 border-t border-line pt-10">
      <div className="mb-7 flex items-center gap-3">
        <span className="h-4 w-1 rounded-full bg-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
          {t('related.title')}
        </h2>
      </div>
      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
        {picked.map((item) => (
          <li key={feedKey(item)}>
            <FeedCard item={item} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}
