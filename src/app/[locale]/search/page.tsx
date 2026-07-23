import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { buildFeed, feedKey, type FeedItem } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import { localeAlternates } from '@/lib/site';
import { defaultLocale, type Locale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('search.heading'),
    alternates: localeAlternates(locale, '/search'),
    // 検索結果は薄いページの量産になるのでインデックスさせない（クロールバジェット節約）。
    robots: { index: false },
  };
}

// 検索語にマッチするか。タイトル原文/訳・要約/リード・タグを対象に部分一致（小文字化）。
function matches(item: FeedItem, q: string): boolean {
  const parts =
    item.kind === 'thread'
      ? [item.thread.title.ja, item.thread.title.en, item.thread.summaryJa, ...(item.thread.tags ?? [])]
      : [item.column.title.ja, item.column.title.en, item.column.lead, ...(item.column.tags ?? [])];
  return parts.join(' ').toLowerCase().includes(q);
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const t = await getTranslations();
  const query = (q ?? '').trim();

  const results: FeedItem[] = query
    ? buildFeed(await getAllThreads(), await getAllColumns()).filter((it) =>
        matches(it, query.toLowerCase()),
      )
    : [];

  // フォーム送信先は自ロケールの /search（ja=接頭辞なし・en=/en）。
  const action = `${locale === defaultLocale ? '' : `/${locale}`}/search`;

  return (
    <div className="space-y-8">
      <section className="border-b border-line pb-6">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">{t('search.heading')}</h1>
        <form action={action} method="get" className="mt-4 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t('search.placeholder')}
            aria-label={t('search.heading')}
            className="w-full rounded-lg border border-line bg-white px-4 py-2 text-sm text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white"
          >
            {t('search.button')}
          </button>
        </form>
      </section>

      {!query ? (
        <p className="text-sm text-ink-soft">{t('search.prompt')}</p>
      ) : results.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          {t('search.empty')}
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            {t('search.results', { q: query })} · {t('search.count', { count: results.length })}
          </p>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => (
              <li key={feedKey(item)}>
                <FeedCard item={item} locale={locale} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
