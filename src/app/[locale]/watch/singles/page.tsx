import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getWatchSingles } from '@/lib/data';
import { paginate, type FeedItem } from '@/lib/feed';
import FeedGrid from '@/components/FeedGrid';
import Pagination from '@/components/Pagination';
import Breadcrumbs from '@/components/Breadcrumbs';
import { localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

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
    title: t('watch.singlesTitle'),
    description: t('watch.singlesLead'),
    alternates: localeAlternates(locale, '/watch/singles'),
  };
}

/** 注目の試合（単発 watch-along）の全件一覧・1ページ目。2ページ目以降は /watch/singles/p/N（実 URL）。 */
export default async function WatchSinglesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const singles = await getWatchSingles();
  const feed: FeedItem[] = singles.map((th) => ({ kind: 'thread', date: th.fetchedAt, thread: th }));
  const paged = paginate(feed, 1);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { name: t('nav.home'), href: '/' },
          { name: t('watch.title'), href: '/watch' },
          { name: t('watch.singlesTitle') },
        ]}
      />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {t('watch.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          {t('watch.singlesTitle')}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{t('watch.singlesLead')}</p>
        <p className="mt-2 text-xs text-ink-soft">{t('watch.count', { count: feed.length })}</p>
      </section>

      <FeedGrid items={paged.items} locale={locale} />
      <Pagination basePath="/watch/singles" page={1} totalPages={paged.totalPages} />
    </div>
  );
}
