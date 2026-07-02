import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { getSeries, formatGameDate } from '@/lib/series';
import type { Thread } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/**
 * 「海外ファンと見る」シリーズ記事の前試合／次試合ナビ（毎試合追う最高リテンション層の直列導線）。
 * 同じ series.id の記事を試合日（series.date）昇順に並べ、現在記事の前後へ links を出す。
 * シリーズ記事が1本しか無い間は何も出さない（ドジャース等の毎試合運用で効いてくる）。
 * 相手はシリーズ内で連戦して重複するので、ラベルは日付＋相手で1試合を一意に見せる。
 */
export default async function SeriesNav({
  thread,
  threads,
  locale,
}: {
  thread: Thread;
  threads: Thread[];
  locale: Locale;
}) {
  if (!thread.series || !getSeries(thread.series.id)) return null;
  const sid = thread.series.id;
  const siblings = threads
    .filter((th) => th.series?.id === sid)
    .sort((a, b) => (a.series?.date ?? '').localeCompare(b.series?.date ?? ''));
  if (siblings.length < 2) return null;

  const idx = siblings.findIndex((th) => th.id === thread.id && th.sport === thread.sport);
  if (idx === -1) return null;
  const prev = siblings[idx - 1]; // 試合日が前＝前試合
  const next = siblings[idx + 1]; // 試合日が後＝次試合
  if (!prev && !next) return null;

  const t = await getTranslations();
  const gameLabel = (th: Thread) =>
    th.series ? `${formatGameDate(th.series.date)} vs ${th.series.opponent[locale]}` : '';

  return (
    <nav className="mt-8 grid grid-cols-2 gap-3">
      {prev ? (
        <Link
          href={`/${prev.sport}/${prev.id}`}
          className="group rounded-[3px] border border-line bg-surface p-4 transition-colors hover:border-ink"
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            ← {t('seriesNav.prev')}
          </span>
          <span className="mt-1 block text-sm font-semibold text-ink group-hover:underline">
            {gameLabel(prev)}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/${next.sport}/${next.id}`}
          className="group rounded-[3px] border border-line bg-surface p-4 text-right transition-colors hover:border-ink"
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            {t('seriesNav.next')} →
          </span>
          <span className="mt-1 block text-sm font-semibold text-ink group-hover:underline">
            {gameLabel(next)}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
