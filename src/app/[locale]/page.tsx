import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { buildFeed, paginate, type FeedItem } from '@/lib/feed';
import { getFrontPagePicks, issueDate } from '@/lib/frontpage';
import { getAllTags } from '@/lib/tags';
import { PLAYERS } from '@/lib/players';
import { getPlayersSnapshot, type PlayerSeason } from '@/lib/playerStats';
import { pickHero } from '@/lib/playerHero';
import { SPORTS, SPORT_INFO, type Sport } from '@/lib/sports';
import FeedCard from '@/components/FeedCard';
import FeedGrid from '@/components/FeedGrid';
import Pagination from '@/components/Pagination';
import PopularTags from '@/components/PopularTags';
import SearchConsole from '@/components/home/SearchConsole';
import TwoPillars from '@/components/home/TwoPillars';
import PlayerRail, { type PlayerRailItem } from '@/components/home/PlayerRail';
import SportZones, { type SportZone } from '@/components/home/SportZones';
import { localeAlternates, absoluteUrl, SITE_URL } from '@/lib/site';
import type { Locale } from '@/lib/i18n';
import type { Metadata } from 'next';

// トップは canonical/hreflang のみ補う（title/description は layout の既定を継ぐ）。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates(locale, '') };
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const [threads, columns, snap, allTags] = await Promise.all([
    getAllThreads(),
    getAllColumns(),
    getPlayersSnapshot(),
    getAllTags(),
  ]);

  // 新着フィード（反応まとめ＋コラムを日付順に混ぜる）。
  const feed = buildFeed(threads, columns);

  // 本日の一面＝手動 editorPick 優先＋自動フォールバック（直近×コメント数）。stale id を構造的に排除。
  const [heroThread] = getFrontPagePicks(threads, 1);
  const heroKey = heroThread ? `${heroThread.sport}/${heroThread.id}` : null;
  const heroItem: FeedItem | null = heroThread
    ? { kind: 'thread', date: heroThread.fetchedAt, thread: heroThread }
    : null;

  // 「新着のつづき」＝1ページ目から一面の重複だけ除く。
  const paged = paginate(feed, 1);
  const restItems = paged.items.filter(
    (it) => !(it.kind === 'thread' && `${it.thread.sport}/${it.thread.id}` === heroKey),
  );

  // 二枚看板の watch 本数（動画つき・hideFromWatch でない）。
  const watchCount = threads.filter((th) => th.media?.kind === 'video' && !th.hideFromWatch).length;

  // 注目選手レーン＝MLB 今季成績がある日本人（必ずヒーロー数字が出る＝honest）。SoT=players.ts 順。
  const railItems: PlayerRailItem[] = PLAYERS.filter((p) => !p.rival)
    .map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined }))
    .filter((x) => x.s != null && x.s.league != null)
    .slice(0, 10)
    .map(({ p, s }) => {
      const hero = pickHero(s as PlayerSeason);
      const statLabel = hero.statLabel ?? (hero.kind === 'warTotal' ? t('threads.statWar') : null);
      return { slug: p.slug, name: locale === 'en' ? p.nameEn : p.nameJa, statValue: hero.value, statLabel };
    });

  // 競技別ゾーン。主役 MLB は枠を 2 倍（8件）＋見出し大、ボクシング/MMA は各4件で専用ゾーンを確保。
  // 「MLB を強調しつつ少数競技も埋もれさせない」両立。SoT=sports.ts（MLB が先頭）。
  const PER_ZONE: Partial<Record<Sport, number>> = { mlb: 8 };
  const zones: SportZone[] = SPORTS.map((sport) => {
    const info = SPORT_INFO[sport];
    const list = threads.filter((th) => th.sport === sport);
    return {
      sport,
      label: locale === 'en' ? info.labelEn : info.labelJa,
      emoji: info.emoji,
      count: list.length,
      threads: list.slice(0, PER_ZONE[sport] ?? 4),
      lead: sport === 'mlb',
    };
  }).filter((z) => z.threads.length > 0);

  const consoleTags = allTags.slice(0, 8);
  const issue = issueDate(feed[0]?.date);

  // サイト全体の構造化データ（JSON-LD）。Organization=ブランド実体（ロゴ・公式X）、
  // WebSite=サイト内検索ボックス（SearchAction）。検索のサイトリンク／ブランド表示に効く。
  const siteLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: absoluteUrl(locale, ''),
        name: '海外の反応',
        alternateName: '海外の反応 — MLB / ボクシング / MMA',
        inLanguage: locale,
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${absoluteUrl(locale, '/search')}?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: '海外の反応',
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 1358, height: 428 },
        sameAs: ['https://x.com/gogogo123ka'],
      },
    ],
  };

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }}
      />

      {/* ネームプレート（紙面の題字）＋本日の日付＋説明 h1。旧ロゴ画像のメインビジュアルは撤去。
          ヘッダーの小ロゴ・OG/構造化データの Organization.logo は logo.png のまま温存している。 */}
      <section className="border-b-2 border-ink pb-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1.5 rounded-full bg-accent sm:h-10" />
            <span className="text-3xl font-bold tracking-tight text-ink sm:text-5xl">
              {t('site.title')}
            </span>
          </div>
          {issue && (
            <span className="whitespace-nowrap pb-1 text-[11px] uppercase tracking-[0.18em] text-ink-soft sm:text-xs">
              {issue} {t('home.updated')}
            </span>
          )}
        </div>
        <h1 className="mt-5 text-lg font-bold leading-snug text-ink sm:text-xl">
          {t('home.heroTitle')}
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">{t('home.heroBody')}</p>
      </section>

      <SearchConsole tags={consoleTags} />

      {heroItem && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-4 w-1 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
              {t('home.todays')}
            </h2>
          </div>
          <FeedCard item={heroItem} locale={locale} featured priority />
        </section>
      )}

      <TwoPillars watchCount={watchCount} asOf={snap.asOf || undefined} />

      <PlayerRail items={railItems} />

      <SportZones zones={zones} locale={locale} />

      <PopularTags />

      {restItems.length > 0 && (
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="h-4 w-1 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
              {t('home.more')}
            </h2>
          </div>
          <FeedGrid items={restItems} locale={locale} />
          <Pagination basePath="" page={1} totalPages={paged.totalPages} />
        </section>
      )}
    </div>
  );
}
