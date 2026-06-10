import { useTranslations } from 'next-intl';
import type { Locale } from '@/types/mlb';
import type { MetricInfo } from '@/lib/metrics';

export default function MetricExplainer({
  metric,
  locale,
}: {
  metric: MetricInfo;
  locale: Locale;
}) {
  const t = useTranslations('metric');
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-mlbnavy">{metric.label[locale]}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            metric.higherIsBetter
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {metric.higherIsBetter ? t('higherIsBetter') : t('lowerIsBetter')}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{metric.short[locale]}</p>
      <p className="mt-3 text-sm leading-relaxed text-gray-800">{metric.description[locale]}</p>
      <p className="mt-3 text-xs text-gray-500">
        {t('source')}:{' '}
        <a href={metric.sourceUrl} target="_blank" rel="noreferrer" className="underline">
          {metric.sourceUrl}
        </a>
      </p>
    </section>
  );
}
