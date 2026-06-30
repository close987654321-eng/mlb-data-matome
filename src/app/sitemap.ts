import type { MetadataRoute } from 'next';
import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { getAllTags } from '@/lib/tags';
import { PLAYERS, threadsOf, hubEligible, hasMlbStats } from '@/lib/players';
import { getPlayersSnapshot } from '@/lib/playerStats';
import { NPB_PROSPECTS } from '@/lib/npbPlayers';
import { SPORTS } from '@/lib/sports';
import { locales, defaultLocale } from '@/lib/i18n';

// 本番ドメイン。プレビュー等で差し替えたい場合は NEXT_PUBLIC_SITE_URL で上書きする。
const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://matome-mlb-kaigai.jp').replace(
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
  const [threads, columns, tags, snap] = await Promise.all([
    getAllThreads(),
    getAllColumns(),
    getAllTags(),
    getPlayersSnapshot(),
  ]);
  const latest = threads[0]?.fetchedAt; // 新着順なので先頭が最新

  // /watch は動画つき記事のハブ。最新の動画記事の日時を lastModified にする。
  const latestWatch = threads.find((t) => t.media?.kind === 'video')?.fetchedAt;

  // 選手ハブの lastmod。個別＝最新記事 or 成績更新(asOf)の新しい方。/player ピラーはそれら個別の最新を採用し、
  // 無関係な競技（ボクシング/MMA）の更新で /player が動かないようにする（lastmod の信頼を保つ）。
  const statDate = snap.asOf ? snap.asOf.slice(0, 10) : undefined;
  // 文字列日付（ISO）の最大＝最新。空なら undefined（Array.prototype.at の lib 依存を避けて index 参照）。
  const maxDate = (arr: string[]): string | undefined =>
    arr.length ? [...arr].sort()[arr.length - 1] : undefined;
  const playerEntries = PLAYERS.map((p) => {
    const season = snap.players[String(p.mlbId)];
    if (!hubEligible(p, threads, season)) return null;
    const articleDate = threadsOf(p, threads)[0]?.fetchedAt;
    const dates = [articleDate, hasMlbStats(season) ? statDate : undefined].filter(Boolean) as string[];
    return entry(`/player/${p.slug}`, maxDate(dates));
  }).filter((e): e is NonNullable<typeof e> => e != null);
  const playerHubLatest = maxDate(
    playerEntries.map((e) => e.lastModified).filter(Boolean).map(String),
  );

  return [
    entry('', latest), // ホーム（新着が更新されたら lastModified も動く）
    entry('/watch', latestWatch), // 「海外ファンと見る」ハブ
    // 運営者情報・規約系（AdSense 審査要件・更新頻度は低いので lastModified なし）
    entry('/about'),
    entry('/privacy'),
    entry('/contact'),
    ...SPORTS.map((sport) => {
      const newestInSport = threads.find((t) => t.sport === sport)?.fetchedAt;
      return entry(`/${sport}`, newestInSport);
    }),
    ...threads.map((t) => entry(`/${t.sport}/${t.id}`, t.fetchedAt)),
    // 選手ハブ（トピッククラスタのピラー）。lastmod は上で算出済み
    // （/player ピラー＝選手ハブ群の最新／個別＝最新記事 or 成績更新の新しい方）。
    entry('/player', playerHubLatest),
    ...playerEntries,
    // next メジャーリーガー（NPB注目株ハブ）＝MLBハブと並走する選手クラスタ。手キュレーションなので lastmod なし。
    entry('/prospects'),
    ...NPB_PROSPECTS.map((p) => entry(`/prospects/${p.slug}`)),
    // コラム一覧ページは廃止（競技ページに統合）。記事個別ページは残す。
    ...columns.map((c) => entry(`/columns/${c.id}`, c.publishedAt)),
    // タグ別ページ（SEO の入口）。日本語タグは URL エンコードする。
    ...tags.map(({ tag }) => entry(`/tag/${encodeURIComponent(tag)}`)),
  ];
}
