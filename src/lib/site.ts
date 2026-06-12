import { defaultLocale, type Locale } from '@/lib/i18n';

/** 本番の絶対 URL（末尾スラッシュなし）。OGP やシェアの絶対 URL 生成に使う。 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mlb-data-matome.vercel.app'
).replace(/\/$/, '');

/**
 * ロケール込みの絶対 URL を作る。localePrefix は as-needed なので、
 * デフォルト（ja）は接頭辞なし・en は /en を付ける（navigation の設定に合わせる）。
 */
export function absoluteUrl(locale: Locale, path: string): string {
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return `${SITE_URL}${prefix}${path}`;
}
