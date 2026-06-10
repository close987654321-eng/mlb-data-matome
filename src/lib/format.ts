/** ISO8601 → "2026/6/10 12:00" (ja) / "6/10/26, 12:00 PM" (en) のような簡潔表記 */
export function formatUpdatedAt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
