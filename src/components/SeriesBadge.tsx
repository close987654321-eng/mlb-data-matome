import { getSeries } from '@/lib/series';
import type { ThreadSeries } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/** 「海外ファンと見る」シリーズ記事に出す看板バッジ。未知の series.id なら何も出さない。 */
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
      className={`inline-flex items-center gap-1.5 rounded-[2px] bg-accent px-2.5 py-1 text-xs font-semibold text-paper ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-current" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
      {info.badge[locale]}
    </span>
  );
}
