import { defaultLocale, type Locale } from '@/lib/i18n';

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
 * ブランド既定の OG 画像（1200x630）。
 *
 * ⚠️ Next の Metadata は openGraph / twitter を「マージではなく置換」する。ページ側で
 * `openGraph: { title, description }` と書いた時点で layout の images が消え、og:image が
 * 1枚も無いページになる（2026-07-30 の実測で 121 ページ＝タグLP107本＋競技LP等が該当）。
 * og:image 不在は Discover の大画像枠（max-image-preview:large を宣言済み）に載れず、
 * X も summary_large_image を宣言しながらカード画像が出ない＝主力チャネルを両方潰す。
 * → 独自の openGraph を持つページは必ず images を渡す。専用の OG 画像を持たない面（一覧LP・
 *   タグLP等）はこの既定を使う。opengraph-image.tsx があるルート（player/ranking/mvp/cy-young）は
 *   Next が自動注入するので何も渡さなくてよい。
 */
export const OG_IMAGE = { url: '/og.png', width: 1200, height: 630 } as const;

/** openGraph.images にそのまま渡す既定値。 */
export const OG_IMAGES = [OG_IMAGE];
/** twitter.images にそのまま渡す既定値（URL の配列）。 */
export const OG_IMAGES_TW = [OG_IMAGE.url];

/**
 * ページネーション 2 ページ目以降（/p/2・/{sport}/p/2・/watch/singles/p/2 …）の robots。
 *
 * 中身はカードのグリッドだけで固有の本文が無く、meta description も継承（＝トップと同文）に
 * なるため、実測 2026-07-30 時点で 102 ページが「薄い自動生成面」として検索面に並んでいた。
 * 薄記事（threadIndex）・薄タグLP（tagIndex）・/tags・/search・/en と同じ posture に揃える＝
 * noindex で検索面から下げ、follow は残してクロール経路として活かす。
 * 記事の発見性は落ちない: index 対象の記事は全件 sitemap に載っている（sitemap.ts）。
 */
export const PAGINATED_ROBOTS = { index: false, follow: true } as const;

/**
 * Metadata.alternates 用の canonical を作る。各ページの generateMetadata で使う。
 * - canonical: そのロケール自身の URL（ja版は ja を、en版は en を正規とする）
 * - hreflang（languages）は出さない: en は全ページ noindex（GSC実測 2026-07-11 で日本語クエリを
 *   ja 版と食い合った）ため、noindex の URL を hreflang で宣伝する矛盾シグナルを避ける。
 *   en に実コンテンツを載せて index に戻すときは、ここに ja/en 相互 + x-default を復活させる。
 * path は locale 接頭辞を含まないルート相対パス（例: "/mlb/2026-06-17-foo"、トップは ""）。
 */
export function localeAlternates(locale: Locale, path: string) {
  return {
    canonical: absoluteUrl(locale, path),
    // RSS 自動検出。Next の metadata は alternates を top-level で上書きするため、
    // ページ側で alternates を設定すると layout の RSS link が消える。ここで持たせ直す。
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: '海外の反応' }] },
  };
}
