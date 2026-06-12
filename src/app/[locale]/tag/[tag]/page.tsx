import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllTags, getFeedByTag } from '@/lib/tags';
import { feedKey } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export async function generateStaticParams() {
  const tags = await getAllTags();
  // タグは生（デコード済み）で渡す。Next がパスを URL エンコードする。
  return locales.flatMap((locale) => tags.map(({ tag }) => ({ locale, tag })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; tag: string }>;
}): Promise<Metadata> {
  const { locale, tag } = await params;
  const decoded = decodeURIComponent(tag);
  const t = await getTranslations({ locale });
  const title = t('tag.heading', { tag: decoded });
  return { title, description: t('tag.lead', { tag: decoded }) };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ locale: Locale; tag: string }>;
}) {
  const { locale, tag } = await params;
  unstable_setRequestLocale(locale);
  const decoded = decodeURIComponent(tag);
  const t = await getTranslations();
  const feed = await getFeedByTag(decoded);
  if (feed.length === 0) notFound();

  return (
    <div className="space-y-10">
      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {t('tag.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">#{decoded}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t('tag.count', { count: feed.length })}</p>
      </section>

      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {feed.map((item) => (
          <li key={feedKey(item)}>
            <FeedCard item={item} locale={locale} />
          </li>
        ))}
      </ul>
    </div>
  );
}
