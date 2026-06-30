import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { NPB_PROSPECTS } from '@/lib/npbPlayers';
import Breadcrumbs from '@/components/Breadcrumbs';
import SectionHeading from '@/components/SectionHeading';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

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
  const title = t('prospects.indexTitle');
  const description = t('prospects.indexLead');
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/prospects'),
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/prospects') },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ProspectsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const en = locale === 'en';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t('prospects.indexTitle'),
        description: t('prospects.indexLead'),
        url: absoluteUrl(locale, '/prospects'),
      },
      {
        '@type': 'ItemList',
        itemListElement: NPB_PROSPECTS.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: en ? p.nameEn : p.nameJa,
          url: absoluteUrl(locale, `/prospects/${p.slug}`),
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t('prospects.indexTitle'), item: absoluteUrl(locale, '/prospects') },
        ],
      },
    ],
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: t('prospects.indexTitle') }]} />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
          {t('prospects.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{t('prospects.indexTitle')}</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{t('prospects.indexLead')}</p>
      </section>

      <section>
        <div className="mb-5">
          <SectionHeading label={t('prospects.rosterTitle')} count={NPB_PROSPECTS.length} lead />
        </div>
        <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {NPB_PROSPECTS.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/prospects/${p.slug}`}
                className="group block border-b border-line pb-5 transition-colors hover:border-ink"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-ink transition-colors group-hover:text-ink-soft">
                    {en ? p.nameEn : p.nameJa}
                    <span className="ml-2 text-xs font-normal text-ink-soft">
                      {en ? p.nameJa : p.nameEn}
                    </span>
                  </h2>
                  <span aria-hidden className="shrink-0 text-ink-mute transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {en ? p.team.en : p.team.ja} · {en ? p.pos.en : p.pos.ja}
                </p>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                  {en ? p.mlbWatch.en : p.mlbWatch.ja}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ファネル: MLBで活躍する日本人選手（現役）へ。next（NPB）↔ 現役MLB の往復で回遊を作る。 */}
      <p className="text-sm">
        <Link href="/player" className="text-ink-soft transition-colors hover:text-ink hover:underline">
          {t('prospects.toMlbHub')} <span aria-hidden>→</span>
        </Link>
      </p>
    </div>
  );
}
