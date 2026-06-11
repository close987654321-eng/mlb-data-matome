import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getWatchAlongThreads } from '@/lib/data';
import { SERIES, getSeries } from '@/lib/series';
import ThreadCard from '@/components/ThreadCard';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * 「海外ニキと見る」ハブ。watch-along（動画つき）記事の総合ページ。
 * - 固定シリーズ（海外ドジャースニキと見る 等）はカタログ順にシリーズ単位で束ねて出す。
 * - それ以外の単発の動画まとめは「注目の試合」枠に新着順でまとめる。
 */
export default async function WatchPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const threads = await getWatchAlongThreads(); // 全競技横断・動画つき・新着順

  // 固定シリーズごとにまとめる。カタログの定義順で出し、記事0件のシリーズは出さない。
  const groups = Object.values(SERIES)
    .map((info) => ({
      info,
      items: threads.filter((th) => th.series?.id === info.id),
    }))
    .filter((g) => g.items.length > 0);

  // どの登録シリーズにも属さない動画まとめ＝単発。「注目の試合」枠に出す。
  const singles = threads.filter((th) => !th.series || !getSeries(th.series.id));

  return (
    <div className="space-y-12">
      <section className="border-b border-line pb-8">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {t('watch.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-5xl">
          {t('watch.title')}
        </h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-soft sm:text-base">
          {t('watch.lead')}
        </p>
      </section>

      {threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          {t('watch.empty')}
        </p>
      ) : (
        <>
          {groups.map(({ info, items }) => (
            <section key={info.id} className="space-y-8">
              <div className="flex items-center gap-3">
                <span className="h-4 w-1 rounded-full bg-accent" />
                <h2 className="text-base font-bold text-ink sm:text-lg">{info.badge[locale]}</h2>
                <span className="text-xs text-ink-soft">{t('watch.count', { count: items.length })}</span>
              </div>
              <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((th) => (
                  <li key={`${th.sport}/${th.id}`}>
                    <ThreadCard thread={th} locale={locale} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {singles.length > 0 && (
            <section className="space-y-8">
              <div className="flex items-center gap-3">
                <span className="h-4 w-1 rounded-full bg-ink-soft" />
                <h2 className="text-base font-bold text-ink sm:text-lg">{t('watch.singlesTitle')}</h2>
                <span className="text-xs text-ink-soft">{t('watch.count', { count: singles.length })}</span>
              </div>
              <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {singles.map((th) => (
                  <li key={`${th.sport}/${th.id}`}>
                    <ThreadCard thread={th} locale={locale} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
