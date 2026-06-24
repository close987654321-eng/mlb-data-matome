import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getWatchAlongThreads, getWatchSingles } from '@/lib/data';
import { SERIES } from '@/lib/series';
import { SPORTS, SPORT_INFO, type Sport } from '@/lib/sports';
import { PLAYERS } from '@/lib/players';
import ThreadCard from '@/components/ThreadCard';
import { Link } from '@/lib/navigation';
import { localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';
import type { Metadata } from 'next';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('watch.title'),
    description: t('watch.lead'),
    alternates: localeAlternates(locale, '/watch'),
  };
}

/**
 * 「海外ファンと見る」ハブ。watch-along（動画つき）記事の総合ページ。
 * - 今夜のヒーロー（最新の watch-along 1本）。
 * - 固定シリーズは「最新試合日（series.date）降順」で並べ替え＝動いてるチームが上。各棚は最新4件＋すべて見る。
 *   （旧: src/lib/series.ts のカタログ宣言順固定）
 * - 単発（注目の試合）は競技別に解体。MLB を主役に多め、全件は /watch/singles（実 URL・ページ送り）へ。
 * - 最下部に選手成績ブリッジ＝watch（感情）→ player（数値）の往復を作る。
 */
export default async function WatchPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const [threads, singles] = await Promise.all([getWatchAlongThreads(), getWatchSingles()]);

  // 固定シリーズを束ね、各シリーズ内は試合日降順。シリーズ自体は「最新試合日」降順で並べる。
  const seriesGroups = Object.values(SERIES)
    .map((info) => {
      const items = threads
        .filter((th) => th.series?.id === info.id)
        .sort((a, b) => (b.series?.date ?? '').localeCompare(a.series?.date ?? ''));
      return { info, items, latest: items[0]?.series?.date ?? '' };
    })
    .filter((g) => g.items.length > 0)
    .sort((a, b) => b.latest.localeCompare(a.latest));

  // 単発を競技別に。MLB を主役＝多め（8件）、ボクシング/MMA は各4件で専用枠を確保。
  const SINGLES_PER: Partial<Record<Sport, number>> = { mlb: 8 };
  const singleZones = SPORTS.map((sport) => {
    const info = SPORT_INFO[sport];
    const list = singles.filter((th) => th.sport === sport);
    return {
      sport,
      label: locale === 'en' ? info.labelEn : info.labelJa,
      emoji: info.emoji,
      count: list.length,
      shown: list.slice(0, SINGLES_PER[sport] ?? 4),
      lead: sport === 'mlb',
    };
  }).filter((z) => z.shown.length > 0);

  const hero = threads[0];
  const bridgePlayers = PLAYERS.filter((p) => !p.rival).slice(0, 6);

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
        <p className="mt-3 text-xs text-ink-soft">{t('watch.totalCount', { count: threads.length })}</p>
      </section>

      {threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          {t('watch.empty')}
        </p>
      ) : (
        <>
          {hero && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-4 w-1 rounded-full bg-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
                  {t('watch.tonight')}
                </h2>
              </div>
              <ThreadCard thread={hero} locale={locale} featured priority />
            </section>
          )}

          {/* 固定シリーズ棚（最新試合日順・各棚は最新4件＋すべて見る） */}
          {seriesGroups.map(({ info, items }) => (
            <section key={info.id} className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="h-4 w-1 rounded-full bg-accent" />
                <h2 className="text-base font-bold text-ink sm:text-lg">{info.badge[locale]}</h2>
                <span className="text-xs text-ink-soft">{items.length}</span>
                <Link
                  href={`/watch/series/${info.id}`}
                  className="ml-auto text-xs font-medium text-accent transition-colors hover:text-accent-ink"
                >
                  {t('home.seeAll')} →
                </Link>
              </div>
              <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                {items.slice(0, 4).map((th) => (
                  <li key={`${th.sport}/${th.id}`}>
                    <ThreadCard thread={th} locale={locale} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* 注目の試合（単発）を競技別に解体。全件は /watch/singles へ。 */}
          {singleZones.length > 0 && (
            <div className="space-y-10">
              <div className="flex items-center gap-3">
                <span className="h-4 w-1 rounded-full bg-ink-soft" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
                  {t('watch.singlesTitle')}
                </h2>
                <span className="text-xs text-ink-soft">{singles.length}</span>
                <Link
                  href="/watch/singles"
                  className="ml-auto text-xs font-medium text-accent transition-colors hover:text-accent-ink"
                >
                  {t('home.seeAll')} →
                </Link>
              </div>
              {singleZones.map((z) => (
                <section key={z.sport} className="space-y-4">
                  <h3
                    className={`flex items-center gap-2 uppercase tracking-wider text-ink ${
                      z.lead ? 'text-base font-bold' : 'text-sm font-semibold'
                    }`}
                  >
                    <span aria-hidden>{z.emoji}</span>
                    {z.label}
                    <span className="text-xs font-normal text-ink-soft">{z.count}</span>
                  </h3>
                  <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                    {z.shown.map((th) => (
                      <li key={`${th.sport}/${th.id}`}>
                        <ThreadCard thread={th} locale={locale} showSport={false} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {/* 選手成績ブリッジ＝watch（感情）→ player（数値）の往復 */}
          <section className="rounded-2xl border border-line bg-surface p-6">
            <div className="flex items-center gap-2">
              <span aria-hidden>📊</span>
              <h2 className="text-lg font-bold text-ink">{t('nav.players')}</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('home.pillarPlayerLead')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {bridgePlayers.map((p) => (
                <Link
                  key={p.slug}
                  href={`/player/${p.slug}`}
                  className="rounded-full border border-line px-3 py-1 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  {locale === 'en' ? p.nameEn : p.nameJa}
                </Link>
              ))}
              <Link
                href="/player"
                className="rounded-full px-2 py-1 text-sm font-medium text-accent transition-colors hover:text-accent-ink"
              >
                {t('home.playersAll')} →
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
