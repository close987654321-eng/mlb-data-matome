import ThreadCard from '@/components/ThreadCard';
import ColumnCard from '@/components/ColumnCard';
import type { FeedItem } from '@/lib/feed';
import type { Locale } from '@/lib/i18n';

type Props = {
  item: FeedItem;
  locale: Locale;
  /** 競技横断（ホーム）では競技ラベルを出す。競技ページ内では省略。 */
  showSport?: boolean;
  /** 先頭を大きく見せる */
  featured?: boolean;
};

/** 新着フィードの1件。中身に応じて反応まとめ／コラムのカードへ振り分ける。 */
export default function FeedCard({ item, locale, showSport = true, featured = false }: Props) {
  return item.kind === 'thread' ? (
    <ThreadCard thread={item.thread} locale={locale} showSport={showSport} featured={featured} />
  ) : (
    <ColumnCard column={item.column} locale={locale} featured={featured} />
  );
}
