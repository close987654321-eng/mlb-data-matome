import { defaultLocale, locales, type Locale } from '@/lib/i18n';

/** 本番の絶対 URL（末尾スラッシュなし）。OGP やシェアの絶対 URL 生成に使う。 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://matome-mlb-kaigai.jp'
).replace(/\/$/, '');

/**
 * ロケール込みの絶対 URL を作る。localePrefix は as-needed なので、
 * デフォルト（ja）は接頭辞なし・en は /en を付ける（navigation の設定に合わせる）。
 */
export function absoluteUrl(locale: Locale, path: string): string {
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return `${SITE_URL}${prefix}${path}`;
}

/**
 * Metadata.alternates 用の canonical + hreflang を作る。各ページの generateMetadata で使う。
 * - canonical: そのロケール自身の URL（ja版は ja を、en版は en を正規とする）
 * - languages: ja/en の相互 hreflang ＋ x-default（既定 = ja）
 * path は locale 接頭辞を含まないルート相対パス（例: "/mlb/2026-06-17-foo"、トップは ""）。
 */
export function localeAlternates(locale: Locale, path: string) {
  const languages: Record<string, string> = Object.fromEntries(
    locales.map((l) => [l, absoluteUrl(l, path)]),
  );
  languages['x-default'] = absoluteUrl(defaultLocale, path);
  return {
    canonical: absoluteUrl(locale, path),
    languages,
    // RSS 自動検出。Next の metadata は alternates を top-level で上書きするため、
    // ページ側で alternates を設定すると layout の RSS link が消える。ここで持たせ直す。
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: '海外の反応' }] },
  };
}
