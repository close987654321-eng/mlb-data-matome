import { getSeries } from '@/lib/series';
import type { ThreadSeries } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/** 「海外ニキと見る」シリーズ記事に出す看板バッジ。未知の series.id なら何も出さない。 */
export default function SeriesBadge({
  series,
  locale,
  className = '',
}: {
  series: ThreadSeries;
  locale: Locale;
  className?: string;
}) {
  const info = getSeries(series.id);
  if (!info) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-paper ${className}`}
    >
      <span aria-hidden>▶</span>
      {info.badge[locale]}
    </span>
  );
}
