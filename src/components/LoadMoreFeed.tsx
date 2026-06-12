'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import FeedCard from '@/components/FeedCard';
import { feedKey, type FeedItem } from '@/lib/feed';
import type { Locale } from '@/lib/i18n';

type Props = {
  items: FeedItem[];
  locale: Locale;
  showSport?: boolean;
  /** 初回に出す件数 */
  initial?: number;
  /** 「もっと見る」1回で増える件数 */
  step?: number;
};

/**
 * 新着フィードを段階表示する。記事が増えても初期描画を軽く保ち、
 * 「もっと見る」で追加読み込みする（クライアントで枚数を増やすだけ＝再フェッチ無し）。
 */
export default function LoadMoreFeed({
  items,
  locale,
  showSport = true,
  initial = 9,
  step = 9,
}: Props) {
  const t = useTranslations();
  const [count, setCount] = useState(initial);
  const visible = items.slice(0, count);
  const remaining = items.length - count;

  return (
    <div className="space-y-10">
      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <li key={feedKey(item)}>
            <FeedCard item={item} locale={locale} showSport={showSport} />
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setCount((c) => c + step)}
            className="rounded-full border border-line px-6 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
          >
            {t('feed.loadMore', { count: remaining })}
          </button>
        </div>
      )}
    </div>
  );
}
