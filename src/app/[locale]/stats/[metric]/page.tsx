import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { METRICS, METRICS_BY_SLUG } from '@/lib/metrics';
import { getBatters, getPitchers, getTeams } from '@/lib/data';
import RankingTable from '@/components/RankingTable';
import MetricExplainer from '@/components/MetricExplainer';
import type { Locale } from '@/lib/i18n';

export function generateStaticParams() {
  return METRICS.map((m) => ({ metric: m.slug }));
}

export default async function MetricPage({
  params,
}: {
  params: Promise<{ locale: Locale; metric: string }>;
}) {
  const { locale, metric: slug } = await params;
  unstable_setRequestLocale(locale);
  const metric = METRICS_BY_SLUG[slug];
  if (!metric) notFound();
  const t = await getTranslations();

  let rows: Awaited<ReturnType<typeof getBatters>>['items'] = [];
  if (metric.category === 'batting' || metric.category === 'defense' || metric.category === 'clutch') {
    rows = (await getBatters()).items;
  } else if (metric.category === 'pitching') {
    rows = (await getPitchers()).items;
  } else {
    const [b, p] = await Promise.all([getBatters(), getPitchers()]);
    rows = [...b.items, ...p.items];
  }
  rows = rows.filter((r) => r.stats[metric.key] != null);

  const teamData = metric.category === 'war' ? (await getTeams()).items : [];

  return (
    <div className="space-y-6">
      <MetricExplainer metric={metric} locale={locale} />
      <section>
        <h2 className="mb-3 text-lg font-semibold text-mlbnavy">
          {t('metric.rankingByThis')}
        </h2>
        <RankingTable rows={rows} primaryMetric={metric} locale={locale} />
      </section>
      {teamData.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-mlbnavy">
            {t('nav.teams')} — {metric.label[locale]}
          </h2>
          <RankingTable rows={teamData} primaryMetric={metric} locale={locale} />
        </section>
      )}
    </div>
  );
}
