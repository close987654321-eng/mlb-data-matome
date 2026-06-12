import type { LocalizedName } from '@/types/common';
import type { Thread, ThreadSeries } from '@/types/thread';
import type { Locale } from './i18n';

/**
 * 「海外ニキと見る」シリーズ（watch-along 看板企画）のカタログ。
 * これが唯一の正。新しいシリーズ（ヤンキースニキと見る等）を増やすときはここに足す。
 * 記事側（data/threads/.../*.json）は series.id でここを参照するだけ。
 */
export type SeriesInfo = {
  id: string;
  team: LocalizedName; // 自軍名（タイトルの "vs" の左）。例: ドジャース
  titlePrefix: LocalizedName; // タイトル接頭辞。例: 「海外ドジャースニキと見る」
  badge: LocalizedName; // カード/記事に出すシリーズバッジ表示
};

export const SERIES: Record<string, SeriesInfo> = {
  dodgers: {
    id: 'dodgers',
    team: { ja: 'ドジャース', en: 'Dodgers' },
    titlePrefix: { ja: '海外ドジャースニキと見る', en: 'Watch w/ overseas Dodgers fans' },
    badge: { ja: '海外ドジャースニキと見る', en: 'Dodgers Watch-Along' },
  },
  cubs: {
    id: 'cubs',
    team: { ja: 'カブス', en: 'Cubs' },
    titlePrefix: { ja: '海外カブスニキと見る', en: 'Watch w/ overseas Cubs fans' },
    badge: { ja: '海外カブスニキと見る', en: 'Cubs Watch-Along' },
  },
};

export function getSeries(id: string): SeriesInfo | null {
  return SERIES[id] ?? null;
}

/** "2026-06-10" → "2026.6.10"（前ゼロを落とす）。Date を介さず文字列で処理しTZ事故を避ける。 */
export function formatGameDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${y}.${Number(m)}.${Number(d)}`;
}

/** シリーズ記事の定型タイトル: 「{接頭辞} {YYYY.M.D} {自軍} vs {相手}」 */
export function seriesTitle(series: ThreadSeries, locale: Locale): string {
  const info = getSeries(series.id);
  if (!info) return '';
  return `${info.titlePrefix[locale]} ${formatGameDate(series.date)} ${info.team[locale]} vs ${series.opponent[locale]}`;
}

/** 記事の表示タイトル。シリーズ記事は定型を自動生成し、それ以外は title をそのまま使う。 */
export function threadTitle(thread: Thread, locale: Locale): string {
  if (thread.series && getSeries(thread.series.id)) return seriesTitle(thread.series, locale);
  return locale === 'ja' ? thread.title.ja : thread.title.en;
}
