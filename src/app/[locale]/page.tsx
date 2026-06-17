import Image from 'next/image';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads, getThread } from '@/lib/data';
import { getAllColumns, getColumn } from '@/lib/columns';
import { buildFeed, paginate } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import FeedGrid from '@/components/FeedGrid';
import Pagination from '@/components/Pagination';
import PopularTags from '@/components/PopularTags';
import PickupSection from '@/components/PickupSection';
import { localeAlternates, absoluteUrl, SITE_URL } from '@/lib/site';
import type { Locale } from '@/lib/i18n';
import type { Metadata } from 'next';

// トップは canonical/hreflang のみ補う（title/description は layout の既定を継ぐ）。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates(locale, '') };
}

// TOP に大きく出す「ピックアップ」。手動キュレーション（id 指定）。
const PICKUP_THREADS: { sport: 'mlb'; id: string }[] = [
  { sport: 'mlb', id: '2021-07-02-ohtani-29-30-walsh-walkoff' },
  { sport: 'mlb', id: '2026-06-10-why-no-second-ohtani' },
];
const PICKUP_COLUMNS = ['2026-06-11-freddie-freeman-2500-hits'];

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const [threads, columns, pickThreads, pickColumns] = await Promise.all([
    getAllThreads(),
    getAllColumns(),
    Promise.all(PICKUP_THREADS.map((p) => getThread(p.sport, p.id))),
    Promise.all(PICKUP_COLUMNS.map((id) => getColumn(id))),
  ]);
  // 新着は反応まとめとコラムを横断で混ぜ、日付順で出す（コラム専用ページは廃止）。
  // 1ページ目だけ先頭を大カードにし、残りはグリッド。2ページ目以降は /p/N（実 URL）。
  const feed = buildFeed(threads, columns);
  const paged = paginate(feed, 1);
  const [featured, ...rest] = paged.items;
  // 取得できなかった id（リネーム等）は黙って除外する。
  const pickedThreads = pickThreads.filter((x): x is NonNullable<typeof x> => x != null);
  const pickedColumns = pickColumns.filter((x): x is NonNullable<typeof x> => x != null);
  const hasPickup = pickedThreads.length + pickedColumns.length > 0;

  // サイト全体の構造化データ（JSON-LD）。Organization=ブランド実体（ロゴ・公式X）、
  // WebSite=サイト内検索ボックス（SearchAction）。検索のサイトリンク／ブランド表示に効く。
  // SearchAction の遷移先は実在する /search（無いと無効マークアップになる）。
  const siteLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: absoluteUrl(locale, ''),
        name: '海外の反応',
        alternateName: '海外の反応 — MLB / ボクシング / MMA',
        inLanguage: locale,
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${absoluteUrl(locale, '/search')}?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: '海外の反応',
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 1358, height: 428 },
        sameAs: ['https://x.com/gogogo123ka'],
      },
    ],
  };

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }}
      />
      <section className="border-b border-line pb-8">
        {/* メインビジュアル（ブランドのキービジュアル） */}
        <Image
          src="/logo.png"
          alt={t('site.title')}
          width={1358}
          height={428}
          priority
          className="mb-7 h-auto w-full max-w-xl"
        />
        <h1 className="text-3xl font-bold leading-tight text-ink sm:text-5xl">
          {t('home.heroTitle')}
        </h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-soft sm:text-base">
          {t('home.heroBody')}
        </p>
      </section>

      {hasPickup && (
        <PickupSection threads={pickedThreads} columns={pickedColumns} locale={locale} />
      )}

      <PopularTags />

      {feed.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          {t('threads.empty')}
        </p>
      ) : (
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="h-4 w-1 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
              {t('home.latest')}
            </h2>
          </div>

          {featured && <FeedCard item={featured} locale={locale} featured />}

          {rest.length > 0 && (
            <div className="border-t border-line pt-10">
              <FeedGrid items={rest} locale={locale} />
            </div>
          )}

          <Pagination basePath="" page={1} totalPages={paged.totalPages} />
        </section>
      )}
    </div>
  );
}
