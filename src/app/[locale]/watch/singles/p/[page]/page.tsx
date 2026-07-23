import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getWatchSingles } from '@/lib/data';
import { paginate, FEED_PER_PAGE, type FeedItem } from '@/lib/feed';
import FeedGrid from '@/components/FeedGrid';
import Pagination from '@/components/Pagination';
import Breadcrumbs from '@/components/Breadcrumbs';
import { localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

// 単発一覧の 2 ページ目以降（/watch/singles/p/2 …）。1 ページ目は /watch/singles。
export async function generateStaticParams() {
  const singles = await getWatchSingles();
  const totalPages = Math.max(1, Math.ceil(singles.length / FEED_PER_PAGE));
  const params: { locale: string; page: string }[] = [];
  for (const locale of locales) {
    for (let p = 2; p <= totalPages; p++) params.push({ locale, page: String(p) });
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; page: string }>;
}): Promise<Metadata> {
  const { locale, page } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('watch.singlesTitle')}（${page}）`,
    alternates: localeAlternates(locale, `/watch/singles/p/${page}`),
  };
}

export default async function WatchSinglesFeedPage({
  params,
}: {
  params: Promise<{ locale: Locale; page: string }>;
}) {
  const { locale, page } = await params;
  setRequestLocale(locale);
  const pageNum = Number(page);
  if (!Number.isInteger(pageNum) || pageNum < 2) notFound();
  const t = await getTranslations();
  const singles = await getWatchSingles();
  const feed: FeedItem[] = singles.map((th) => ({ kind: 'thread', date: th.fetchedAt, thread: th }));
  const paged = paginate(feed, pageNum);
  if (pageNum > paged.totalPages) notFound();

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { name: t('nav.home'), href: '/' },
          { name: t('watch.title'), href: '/watch' },
          { name: t('watch.singlesTitle'), href: '/watch/singles' },
        ]}
      />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
          {t('watch.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          {t('watch.singlesTitle')}
        </h1>
      </section>

      <FeedGrid items={paged.items} locale={locale} />
      <Pagination basePath="/watch/singles" page={paged.page} totalPages={paged.totalPages} />
    </div>
  );
}
