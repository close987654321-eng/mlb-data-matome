import type { MetadataRoute } from 'next';
import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { getAllTags } from '@/lib/tags';
import { SPORTS } from '@/lib/sports';
import { locales, defaultLocale } from '@/lib/i18n';

// 本番ドメイン。プレビュー等で差し替えたい場合は NEXT_PUBLIC_SITE_URL で上書きする。
const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mlb-data-matome.vercel.app').replace(
  /\/$/,
  '',
);

// localePrefix: 'as-needed' なので ja はプレフィックス無し、en は /en を付ける。
// path は先頭 '/' 始まり（ホームは ''）。
function localeUrl(locale: (typeof locales)[number], path: string): string {
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return `${BASE_URL}${prefix}${path}` || `${BASE_URL}/`;
}

// 1 ページにつき 1 エントリ（ja を正規 URL）。hreflang で ja/en を相互に示す。
function entry(path: string, lastModified?: string | Date): MetadataRoute.Sitemap[number] {
  return {
    url: localeUrl(defaultLocale, path) || `${BASE_URL}/`,
    lastModified,
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, localeUrl(l, path)])),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [threads, columns, tags] = await Promise.all([
    getAllThreads(),
    getAllColumns(),
    getAllTags(),
  ]);
  const latest = threads[0]?.fetchedAt; // 新着順なので先頭が最新

  // /watch は動画つき記事のハブ。最新の動画記事の日時を lastModified にする。
  const latestWatch = threads.find((t) => t.media?.kind === 'video')?.fetchedAt;

  return [
    entry('', latest), // ホーム（新着が更新されたら lastModified も動く）
    entry('/watch', latestWatch), // 「海外ニキと見る」ハブ
    ...SPORTS.map((sport) => {
      const newestInSport = threads.find((t) => t.sport === sport)?.fetchedAt;
      return entry(`/${sport}`, newestInSport);
    }),
    ...threads.map((t) => entry(`/${t.sport}/${t.id}`, t.fetchedAt)),
    // コラム一覧ページは廃止（競技ページに統合）。記事個別ページは残す。
    ...columns.map((c) => entry(`/columns/${c.id}`, c.publishedAt)),
    // タグ別ページ（SEO の入口）。日本語タグは URL エンコードする。
    ...tags.map(({ tag }) => entry(`/tag/${encodeURIComponent(tag)}`)),
  ];
}
