import FeedCard from '@/components/FeedCard';
import { feedKey, type FeedItem } from '@/lib/feed';
import type { Locale } from '@/lib/i18n';

/**
 * 新着フィードのカードグリッド。トップ・カテゴリ一覧・ページ送り・タグページで共通に使う。
 * SSR で全件を描画する（クローラが全記事リンクを辿れる＝旧 LoadMoreFeed の取りこぼし解消）。
 */
export default function FeedGrid({
  items,
  locale,
  showSport = true,
}: {
  items: FeedItem[];
  locale: Locale;
  showSport?: boolean;
}) {
  return (
    <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={feedKey(item)}>
          <FeedCard item={item} locale={locale} showSport={showSport} />
        </li>
      ))}
    </ul>
  );
}
