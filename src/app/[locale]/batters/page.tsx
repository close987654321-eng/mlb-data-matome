import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getBatters } from '@/lib/data';
import { METRICS_BY_KEY } from '@/lib/metrics';
import { formatUpdatedAt } from '@/lib/format';
import RankingTable from '@/components/RankingTable';
import type { Locale } from '@/lib/i18n';

export default async function BattersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const { items, updatedAt } = await getBatters();
  const fWAR = METRICS_BY_KEY['fWAR'];
  const extras = ['wRC+', 'xwOBA', 'Barrel%', 'HardHit%'].map((k) => METRICS_BY_KEY[k]).filter(Boolean);

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-mlbnavy">{t('nav.batters')}</h1>
        {updatedAt && (
          <span className="text-xs text-gray-500">
            {t('home.lastUpdated')}: {formatUpdatedAt(updatedAt, locale)}
          </span>
        )}
      </header>
      <RankingTable rows={items} primaryMetric={fWAR} extraMetrics={extras} locale={locale} />
    </div>
  );
}
