import { Link } from '@/lib/navigation';
import { unstable_setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { getBatters, getPitchers } from '@/lib/data';
import { METRICS_BY_KEY } from '@/lib/metrics';
import { formatUpdatedAt } from '@/lib/format';
import RankingTable from '@/components/RankingTable';
import type { Locale } from '@/lib/i18n';

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const [batters, pitchers] = await Promise.all([getBatters(), getPitchers()]);
  const fWAR = METRICS_BY_KEY['fWAR'];
  const wRC = METRICS_BY_KEY['wRC+'];
  const FIP = METRICS_BY_KEY['FIP'];

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-br from-mlbnavy to-blue-900 p-6 text-white">
        <h1 className="text-2xl font-bold sm:text-3xl">{t('home.heroTitle')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">
          {t('home.heroBody')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {['fWAR', 'wRC+', 'xwOBA', 'Barrel%', 'FIP', 'Stuff+', 'OAA', 'BsR', 'Clutch', 'WPA'].map((key) => (
            <Link
              key={key}
              href={`/stats/${METRICS_BY_KEY[key]?.slug ?? ''}`}
              className="rounded-full border border-white/30 px-3 py-1 hover:bg-white/10"
            >
              {key}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-mlbnavy">
            {t('home.topBattersBy', { metric: 'fWAR' })}
          </h2>
          {batters.updatedAt && (
            <span className="text-xs text-gray-500">
              {t('home.lastUpdated')}: {formatUpdatedAt(batters.updatedAt, locale)}
            </span>
          )}
        </div>
        <RankingTable
          rows={batters.items.slice(0, 10)}
          primaryMetric={fWAR}
          extraMetrics={[wRC]}
          locale={locale}
        />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-mlbnavy">
            {t('home.topPitchersBy', { metric: 'fWAR' })}
          </h2>
          {pitchers.updatedAt && (
            <span className="text-xs text-gray-500">
              {t('home.lastUpdated')}: {formatUpdatedAt(pitchers.updatedAt, locale)}
            </span>
          )}
        </div>
        <RankingTable
          rows={pitchers.items.slice(0, 10)}
          primaryMetric={fWAR}
          extraMetrics={[FIP]}
          locale={locale}
        />
      </section>
    </div>
  );
}
