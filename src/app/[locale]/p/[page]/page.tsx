import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { buildFeed, paginate, FEED_PER_PAGE } from '@/lib/feed';
import FeedGrid from '@/components/FeedGrid';
import Pagination from '@/components/Pagination';
import PopularTags from '@/components/PopularTags';
import { localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

// 新着フィードの 2 ページ目以降（/p/2 …）。1 ページ目はトップ（/）。
export async function generateStaticParams() {
  const [threads, columns] = await Promise.all([getAllThreads(), getAllColumns()]);
  const totalPages = Math.max(1, Math.ceil(buildFeed(threads, columns).length / FEED_PER_PAGE));
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
    title: `${t('home.latest')}（${page}）`,
    alternates: localeAlternates(locale, `/p/${page}`),
  };
}

export default async function FeedPage({
  params,
}: {
  params: Promise<{ locale: Locale; page: string }>;
}) {
  const { locale, page } = await params;
  unstable_setRequestLocale(locale);
  const pageNum = Number(page);
  if (!Number.isInteger(pageNum) || pageNum < 2) notFound();
  const t = await getTranslations();
  const [threads, columns] = await Promise.all([getAllThreads(), getAllColumns()]);
  const paged = paginate(buildFeed(threads, columns), pageNum);
  if (pageNum > paged.totalPages) notFound();

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <span className="h-4 w-1 rounded-full bg-accent" />
        <h1 className="text-sm font-semibold uppercase tracking-wider text-ink">
          {t('home.latest')}
        </h1>
      </div>
      <PopularTags />
      <FeedGrid items={paged.items} locale={locale} />
      <Pagination basePath="" page={paged.page} totalPages={paged.totalPages} />
    </div>
  );
}
