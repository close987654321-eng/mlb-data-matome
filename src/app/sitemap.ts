import type { MetadataRoute } from 'next';
import { getAllThreads, getWatchAlongThreads, getWatchSingles } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { getAllTags } from '@/lib/tags';
import { isTagIndexable } from '@/lib/tagIndex';
import { isThreadIndexable } from '@/lib/threadIndex';
import { PLAYERS, threadsOf, hubEligible, hasMlbStats } from '@/lib/players';
import { getPlayersSnapshot } from '@/lib/playerStats';
import { NPB_PROSPECTS } from '@/lib/npbPlayers';
import { ALLSTAR } from '@/lib/allstar';
import { RIZIN5 } from '@/lib/rizin5';
import { standardEventPages } from '@/lib/events';
import { bdAuditionsFetchedAt } from '@/lib/bdAuditions';
import { SPORTS } from '@/lib/sports';
import { SERIES } from '@/lib/series';
import { getCyDetailRows } from '@/lib/cyYoungBoard';
import { getMvpDetailRows } from '@/lib/mvpBoard';
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
  return `${BASE_URL}${prefix}${path}`;
}

// 1 ページにつき 1 エントリ（ja を正規 URL）。
// hreflang（alternates.languages）は載せない: en は全ページ noindex（GSC実測 2026-07-11 で
// 日本語クエリを ja 版と食い合った）ため、sitemap で /en を Google に宣伝しない。
// URL は canonical（metadataBase 由来＝ホームは末尾スラッシュなし）と必ず同じ文字列にする。
function entry(path: string, lastModified?: string | Date): MetadataRoute.Sitemap[number] {
  return {
    url: localeUrl(defaultLocale, path),
    lastModified,
  };
}

/** NPB注目株の lastmod。成績を手入力した選手はその集計時点を使う（無ければ undefined）。 */
function prospectAsOf(p: (typeof NPB_PROSPECTS)[number]): string | undefined {
  return p.season?.asOf;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [threads, columns, tags, snap, watchAlong, singles, cyRows, mvpRows] = await Promise.all([
    getAllThreads(),
    getAllColumns(),
    getAllTags(),
    getPlayersSnapshot(),
    getWatchAlongThreads(),
    getWatchSingles(),
    getCyDetailRows(),
    getMvpDetailRows(),
  ]);
  const latest = threads[0]?.fetchedAt; // 新着順なので先頭が最新

  // /watch は動画つき記事のハブ。最新の動画記事の日時を lastModified にする。
  const latestWatch = threads.find((t) => t.media?.kind === 'video')?.fetchedAt;

  // /daily は「きょうの日本人選手」の恒久ハブ。最新号の日時＝毎日16時に動く鮮度シグナル。
  const latestDaily = threads.find((t) => t.daily)?.fetchedAt;

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
    // 選手・チーム別LPディレクトリ（ヘッダー常設）。記事が増えるたび件数・並びが動く＝最新記事日時。
    entry('/browse', latest),
    entry('/daily', latestDaily), // 「きょうの日本人選手」恒久ハブ（毎日16時更新）
    // 運営者情報・規約系（AdSense 審査要件・更新頻度は低いので lastModified なし）
    entry('/about'),
    entry('/privacy'),
    entry('/contact'),
    ...SPORTS.map((sport) => {
      const newestInSport = threads.find((t) => t.sport === sport)?.fetchedAt;
      return entry(`/${sport}`, newestInSport);
    }),
    // 記事個別。noindex の薄記事は載せない（robots と sitemap の言い分を一致させる。
    // index 可否の唯一の正は isThreadIndexable）。
    ...threads
      .filter(isThreadIndexable)
      .map((t) => entry(`/${t.sport}/${t.id}`, t.fetchedAt)),
    // 選手ハブ（トピッククラスタのピラー）。lastmod は上で算出済み
    // （/player ピラー＝選手ハブ群の最新／個別＝最新記事 or 成績更新の新しい方）。
    entry('/player', playerHubLatest),
    // 日本人選手 成績ランキング（WAR/本塁打/防御率…の順位づけ面）。lastmod は成績スナップショットの日付。
    entry('/ranking', statDate),
    // サイ・ヤング賞 予測ボード（規定投手をAL/NL別にスコア化）。lastmod は成績スナップショットの日付。
    entry('/cy-young', statDate),
    // MVP 予測ボード（規定打者をAL/NL別にスコア化・二刀流は投手WAR合算）。lastmod は成績スナップショットの日付。
    entry('/mvp', statDate),
    // 期間限定 オールスター特設ハブ（会期後は allstar.ts の enabled=false で自動的に外れる）。
    ...(ALLSTAR.enabled ? [entry('/allstar', statDate)] : []),
    // 超RIZIN.5 特設ハブ（開催前から育てるイベント観測所。lastmod はコンテンツの最終更新日）。
    ...(RIZIN5.enabled ? [entry('/rizin5', RIZIN5.updatedAt)] : []),
    // 軽量イベントページ（events.ts レジストリ発行の /rizin-landmark16 等。festival の特設ハブは上の行）。
    ...standardEventPages().map((e) => entry(`/${e.slug}`, e.updatedAt)),
    // BreakingDown オーディション全史（データ観測ページ）。lastmod は統計スナップショットの取得日。
    entry('/breakingdown-audition', await bdAuditionsFetchedAt()),
    ...playerEntries,
    // next メジャーリーガー（NPB注目株ハブ）＝MLBハブと並走する選手クラスタ。
    // ピラーの lastmod は配下で最も新しい成績時点（手キュレーションなので他に動く日付が無い）。
    entry('/prospects', maxDate(NPB_PROSPECTS.map(prospectAsOf).filter(Boolean) as string[])),
    // 個別は手入力した成績の集計時点(season.asOf)を lastmod にする（無い選手は undefined）。
    ...NPB_PROSPECTS.map((p) => entry(`/prospects/${p.slug}`, prospectAsOf(p))),
    // コラム一覧ページは廃止（競技ページに統合）。記事個別ページは残す。
    ...columns.map((c) => entry(`/columns/${c.id}`, c.publishedAt)),
    // 「海外ファンと見る」シリーズ棚（/watch/series/{id}）と単発一覧。index 可能なのに
    // sitemap から漏れていた（2026-07-30 実測）。lastmod はその棚の最新記事。
    ...Object.keys(SERIES).map((id) => {
      const newest = watchAlong.find((t) => t.series?.id === id)?.fetchedAt;
      return entry(`/watch/series/${id}`, newest);
    }),
    entry('/watch/singles', singles[0]?.fetchedAt),
    // 予測ボードの選手別詳細（/cy-young/{id}・/mvp/{id}）。ボードから内部リンクはあるが sitemap には
    // 載っておらず、毎日成績が動くのに lastmod シグナルが無かった（再クロールが遅れる）。
    // lastmod は成績スナップショットの日付＝ボードの更新日。
    ...cyRows.map((r) => entry(`/cy-young/${r.id}`, statDate)),
    ...mvpRows.map((r) => entry(`/mvp/${r.id}`, statDate)),
    // タグ別ページ（SEO の入口）。日本語タグは URL エンコードする。
    // 実質のあるタグ（選手LP／記事3本以上の通常タグ）だけ載せる＝薄い長尾タグLPを sitemap から外す
    // （index 可否の唯一の正は isTagIndexable。タグページ側の robots noindex と一致させる）。
    // lastmod はそのタグに付く最新記事（LP の description は成績・件数で毎日動くので鮮度を渡す）。
    ...tags
      .filter(({ tag, count }) => isTagIndexable(tag, count))
      .map(({ tag }) =>
        entry(
          `/tag/${encodeURIComponent(tag)}`,
          threads.find((t) => (t.tags ?? []).includes(tag))?.fetchedAt,
        ),
      ),
  ];
}
