import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getWatchAlongThreads } from '@/lib/data';
import { SERIES, getSeries } from '@/lib/series';
import ThreadCard from '@/components/ThreadCard';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

// 全ロケール × 登録シリーズの実 URL を静的生成（series.ts が SoT）。
export function generateStaticParams() {
  return locales.flatMap((locale) => Object.keys(SERIES).map((id) => ({ locale, id })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const info = getSeries(id);
  if (!info) return {};
  // 固有の description（無いと layout のトップ用コピーをそのまま継ぐ＝6シリーズ棚が同文になる）。
  // 掲載本数を入れて棚の実体を示し、記事が増えるたび文面が動く＝鮮度シグナルも兼ねる。
  const count = (await getWatchAlongThreads()).filter((th) => th.series?.id === id).length;
  const description =
    locale === 'ja'
      ? `${info.titlePrefix.ja}シリーズの記事一覧。${info.team.ja}の試合を海外ファンのコメント（日本語訳）と一緒に振り返る watch-along 企画を全${count}件、新着順で掲載。`
      : `Every ${info.badge.en} article — watch ${info.team.en} games alongside translated overseas fan comments. ${count} posts, newest first.`;
  return {
    title: info.badge[locale],
    description,
    alternates: localeAlternates(locale, `/watch/series/${id}`),
    openGraph: { title: info.badge[locale], description, type: 'website', url: absoluteUrl(locale, `/watch/series/${id}`), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title: info.badge[locale], description, images: OG_IMAGES_TW },
  };
}

/** シリーズ個別ページ。そのシリーズの watch-along 記事を試合日降順で全件出す（/watch の棚「すべて見る」先）。 */
export default async function SeriesPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const info = getSeries(id);
  if (!info) notFound();
  const t = await getTranslations();
  const items = (await getWatchAlongThreads())
    .filter((th) => th.series?.id === id)
    .sort((a, b) => (b.series?.date ?? '').localeCompare(a.series?.date ?? ''));

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { name: t('nav.home'), href: '/' },
          { name: t('watch.title'), href: '/watch' },
          { name: info.badge[locale] },
        ]}
      />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
          {t('watch.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          {info.badge[locale]}
        </h1>
        <p className="mt-2 text-xs text-ink-soft">{t('watch.count', { count: items.length })}</p>
      </section>

      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((th) => (
          <li key={`${th.sport}/${th.id}`}>
            <ThreadCard thread={th} locale={locale} />
          </li>
        ))}
      </ul>

      <Link href="/watch" className="inline-block text-sm font-medium text-ink-soft transition-colors hover:text-ink">
        ← {t('watch.title')}
      </Link>
    </div>
  );
}
