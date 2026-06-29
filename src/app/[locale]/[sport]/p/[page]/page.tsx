import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getThreadsBySport } from '@/lib/data';
import { getColumnsBySport } from '@/lib/columns';
import { buildFeed, paginate, FEED_PER_PAGE } from '@/lib/feed';
import { SPORTS, SPORT_INFO, isSport } from '@/lib/sports';
import FeedGrid from '@/components/FeedGrid';
import Pagination from '@/components/Pagination';
import PopularTags from '@/components/PopularTags';
import { localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

// カテゴリ一覧の 2 ページ目以降（/mlb/p/2 …）。1 ページ目は /mlb。
export async function generateStaticParams() {
  const params: { locale: string; sport: string; page: string }[] = [];
  for (const sport of SPORTS) {
    const [threads, columns] = await Promise.all([
      getThreadsBySport(sport),
      getColumnsBySport(sport),
    ]);
    const totalPages = Math.max(1, Math.ceil(buildFeed(threads, columns).length / FEED_PER_PAGE));
    for (const locale of locales) {
      for (let p = 2; p <= totalPages; p++) params.push({ locale, sport, page: String(p) });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; sport: string; page: string }>;
}): Promise<Metadata> {
  const { locale, sport, page } = await params;
  if (!isSport(sport)) return {};
  const info = SPORT_INFO[sport];
  const label = locale === 'ja' ? info.labelJa : info.labelEn;
  return {
    title: `${label}（${page}）`,
    alternates: localeAlternates(locale, `/${sport}/p/${page}`),
  };
}

export default async function SportFeedPage({
  params,
}: {
  params: Promise<{ locale: Locale; sport: string; page: string }>;
}) {
  const { locale, sport, page } = await params;
  unstable_setRequestLocale(locale);
  if (!isSport(sport)) notFound();
  const pageNum = Number(page);
  if (!Number.isInteger(pageNum) || pageNum < 2) notFound();
  const t = await getTranslations();
  const info = SPORT_INFO[sport];
  const [threads, columns] = await Promise.all([
    getThreadsBySport(sport),
    getColumnsBySport(sport),
  ]);
  const paged = paginate(buildFeed(threads, columns), pageNum);
  if (pageNum > paged.totalPages) notFound();

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl">
        <Image
          src={info.heroImages[0]}
          alt=""
          width={1600}
          height={600}
          priority
          className="h-56 w-full object-cover sm:h-72"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="absolute bottom-0 left-0 p-6 text-white sm:p-8">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/80">
            {t('nav.reactions')}
          </span>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            {locale === 'ja' ? info.labelJa : info.labelEn}
          </h1>
          <p className="mt-1 text-sm text-white/80">{info.subreddits.join(' · ')}</p>
        </div>
      </section>

      <PopularTags />
      <FeedGrid items={paged.items} locale={locale} showSport={false} />
      <Pagination basePath={`/${sport}`} page={paged.page} totalPages={paged.totalPages} />
    </div>
  );
}
