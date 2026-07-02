import { Link } from '@/lib/navigation';
import { getSeries } from '@/lib/series';
import type { ThreadSeries } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/**
 * 「海外ファンと見る」シリーズ記事に出す看板バッジ。未知の series.id なら何も出さない。
 * asLink=true のとき、そのシリーズの棚（/watch/series/{id}）へ送るリンクにする＝記事詳細の回遊導線。
 * ThreadCard の中では stretched-link カードと入れ子アンカーが衝突するので、既定は非リンク（span）。
 */
export default function SeriesBadge({
  series,
  locale,
  className = '',
  asLink = false,
}: {
  series: ThreadSeries;
  locale: Locale;
  className?: string;
  asLink?: boolean;
}) {
  const info = getSeries(series.id);
  if (!info) return null;
  const base = `inline-flex items-center gap-1.5 rounded-[2px] bg-accent px-2.5 py-1 text-xs font-semibold text-paper ${className}`;
  const inner = (
    <>
      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-current" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
      {info.badge[locale]}
    </>
  );
  if (asLink) {
    return (
      <Link href={`/watch/series/${info.id}`} className={`${base} transition-opacity hover:opacity-90`}>
        {inner}
      </Link>
    );
  }
  return <span className={base}>{inner}</span>;
}
