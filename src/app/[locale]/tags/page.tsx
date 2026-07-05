import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllTags } from '@/lib/tags';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from '@/lib/navigation';
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
    title: t('tags.allTitle'),
    description: t('tags.allLead'),
    // タグクラウドの全件一覧＝ナビ用のユーティリティ面。固有の本文が無く薄いので noindex
    // （実質のあるタグは sitemap で拾える＝発見性は落とさない。follow は残しクロール経路にする）。
    robots: { index: false },
    alternates: localeAlternates(locale, '/tags'),
  };
}

/**
 * 全タグ一覧。PopularTags（上位12）の取りこぼし＝ロングテールへの到達経路を閉じる。
 * 件数の多い順（getAllTags の既定）に全件をチップで列挙し、クロール経路にもなる。
 */
export default async function TagsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const tags = await getAllTags();

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: t('tags.allTitle') }]} />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
          {t('tag.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{t('tags.allTitle')}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{t('tags.allLead')}</p>
      </section>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => (
            <Link
              key={tag}
              href={`/tag/${encodeURIComponent(tag)}`}
              className="inline-flex items-center gap-1 rounded-[2px] border border-line px-3 py-1 text-sm text-ink transition-colors hover:border-ink hover:text-ink"
            >
              #{tag}
              <span className="text-xs text-ink-soft">{count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
