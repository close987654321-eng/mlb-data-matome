import { Link } from '@/lib/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { METRICS, type MetricCategory } from '@/lib/metrics';
import type { Locale } from '@/lib/i18n';

const CATEGORY_LABEL: Record<MetricCategory, { ja: string; en: string }> = {
  war: { ja: 'WAR系', en: 'WAR family' },
  batting: { ja: '打撃指標', en: 'Hitting metrics' },
  pitching: { ja: '投球指標', en: 'Pitching metrics' },
  defense: { ja: '守備・走塁指標', en: 'Defense / Baserunning' },
  clutch: { ja: '勝負強さ指標', en: 'Clutch metrics' },
};

export default async function StatsIndexPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const categories: MetricCategory[] = ['war', 'batting', 'pitching', 'defense', 'clutch'];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-mlbnavy">{t('nav.stats')}</h1>
      {categories.map((category) => {
        const items = METRICS.filter((m) => m.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category}>
            <h2 className="mb-3 text-lg font-semibold text-mlbnavy">
              {CATEGORY_LABEL[category][locale]}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((metric) => (
                <li key={metric.key}>
                  <Link
                    href={`/stats/${metric.slug}`}
                    className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-mlbnavy"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-bold text-mlbnavy">{metric.label[locale]}</span>
                      <span className="text-xs text-gray-500">
                        {metric.higherIsBetter ? '↑' : '↓'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{metric.short[locale]}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
