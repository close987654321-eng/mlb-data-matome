/** ISO8601 → "2026/6/10 12:00" (ja) / "6/10/26, 12:00 PM" (en) のような簡潔表記 */
export function formatUpdatedAt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  // タイムゾーンを固定する。本番（Vercel）のサーバーは UTC で動くので、指定しないと
  // 14:50 JST の記事が「5:50」と9時間早く出る（手元の開発環境は JST なので気づけなかった）。
  // 記事の fetchedAt は JST で書く規約＝表示も JST に揃える（en ページも同じ時刻を出す）。
  return new Date(iso).toLocaleString(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  });
}

/**
 * 日付だけの表記「10月27日」。年が基準（refYear）と違うときだけ年を付ける（「2025年11月19日」）。
 * en は「Oct 27」。報道の時系列・日程など「いつ」を読ませる面で、ISO の「2026-10-27」を出さないために使う。
 */
export function fmtDate(iso: string, en: boolean, refYear?: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (en) {
    const s = new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    return refYear && y !== refYear ? `${s}, ${y}` : s;
  }
  return `${refYear && y !== refYear ? `${y}年` : ''}${m}月${d}日`;
}
