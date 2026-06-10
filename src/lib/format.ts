import type { MetricInfo } from '@/lib/metrics';

/** 指標値を MetricInfo.formatStyle に従って表示用文字列にする。null は "—" */
export function formatStat(value: number | null | undefined, metric: MetricInfo): string {
  if (value == null || Number.isNaN(value)) return '—';
  const precision = metric.precision;
  switch (metric.formatStyle ?? 'plain') {
    case 'avg': {
      const fixed = value.toFixed(precision);
      return fixed.replace(/^(-?)0\./, '$1.');
    }
    case 'percent':
      return `${value.toFixed(precision)}%`;
    case 'plusSign':
      return `${value > 0 ? '+' : ''}${value.toFixed(precision)}`;
    case 'plain':
    default:
      return value.toFixed(precision);
  }
}

/** ISO8601 → "2026/5/25 9:00" (ja) / "5/25/26, 9:00 AM" (en) のような簡潔表記 */
export function formatUpdatedAt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
