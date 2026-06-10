import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import type { Locale, Player, Team } from '@/types/mlb';
import { METRICS_BY_KEY, type MetricInfo } from '@/lib/metrics';
import { formatStat } from '@/lib/format';

type Row = Player | Team;

type Props = {
  rows: Row[];
  primaryMetric: MetricInfo;
  extraMetrics?: MetricInfo[];
  locale: Locale;
};

function isPlayer(row: Row): row is Player {
  return 'position' in row;
}

function rankRows(rows: Row[], metric: MetricInfo): Row[] {
  return [...rows].sort((a, b) => {
    const av = a.stats[metric.key];
    const bv = b.stats[metric.key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return metric.higherIsBetter ? bv - av : av - bv;
  });
}

export default function RankingTable({ rows, primaryMetric, extraMetrics = [], locale }: Props) {
  const t = useTranslations('ranking');
  const ranked = rankRows(rows, primaryMetric);

  if (ranked.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        {t('noData')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-mlbnavy text-white">
          <tr>
            <th className="px-3 py-2 text-left">{t('rank')}</th>
            <th className="px-3 py-2 text-left">{t('player')}</th>
            <th className="px-3 py-2 text-left">{t('team')}</th>
            <th className="px-3 py-2 text-right">{primaryMetric.label[locale]}</th>
            {extraMetrics.map((m) => (
              <th key={m.key} className="px-3 py-2 text-right">{m.label[locale]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2 font-semibold text-gray-700">{idx + 1}</td>
              <td className="px-3 py-2">
                <span className="font-medium text-gray-900">{row.name[locale]}</span>
                {isPlayer(row) && (
                  <span className="ml-2 text-xs text-gray-500">{row.position}</span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-700">{isPlayer(row) ? row.team : (row as Team).abbr}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatStat(row.stats[primaryMetric.key], primaryMetric)}
              </td>
              {extraMetrics.map((m) => {
                const v = row.stats[m.key];
                return (
                  <td
                    key={m.key}
                    className={`px-3 py-2 text-right font-mono tabular-nums ${
                      v == null ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    {formatStat(v, m)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
        <Link href={`/stats/${primaryMetric.slug}`} className="hover:underline">
          {primaryMetric.label[locale]} → {primaryMetric.short[locale]}
        </Link>
      </div>
    </div>
  );
}

export function metricFromKey(key: string): MetricInfo | undefined {
  return METRICS_BY_KEY[key];
}
