import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { buildFeed, paginate, type FeedItem } from '@/lib/feed';
import { getFrontPagePicks, issueDate } from '@/lib/frontpage';
import { getAllTags } from '@/lib/tags';
import { PLAYERS } from '@/lib/players';
import { FIGHTERS } from '@/lib/fighters';
import { TEAM_HUB_MIN_ARTICLES } from '@/lib/teamHub';
import { getPlayersSnapshot, seasonYear, type PlayerSeason } from '@/lib/playerStats';
import { pickHero } from '@/lib/playerHero';
import { SPORTS, SPORT_INFO, type Sport } from '@/lib/sports';
import { getTeam } from '@/lib/teams';
import { getMvpBoard } from '@/lib/mvpBoard';
import { getCyYoungBoard } from '@/lib/cyYoungBoard';
import FeedCard from '@/components/FeedCard';
import FeedGrid from '@/components/FeedGrid';
import Pagination from '@/components/Pagination';
import PopularTags from '@/components/PopularTags';
import SectionHeading from '@/components/SectionHeading';
import MlbToday from '@/components/home/MlbToday';
import SearchConsole from '@/components/home/SearchConsole';
import TwoPillars from '@/components/home/TwoPillars';
import PlayerRail, { type PlayerRailItem } from '@/components/home/PlayerRail';
import RaceBoards, { type RaceBoardCard, type RaceRow } from '@/components/home/RaceBoards';
import SportZones, { type SportZone } from '@/components/home/SportZones';
import { localeAlternates, absoluteUrl, SITE_URL, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import type { Locale } from '@/lib/i18n';
import type { Metadata } from 'next';

/**
 * トップの検索スニペット（title / description）。
 *
 * なぜトップだけ layout の既定を上書きするか（2026-08-30・GSC 実測）:
 * 「MLB 海外の反応」クラスタはトップ 1 枚に一本化した（9e197dbd）結果、**順位は取れた**が
 * クリックに変換できていなかった。2026-08-21〜27 の実測（page = サイトルート）:
 *
 *   mlb 海外の反応        375表示 /  2クリック / CTR 0.5% / 順位 4.2
 *   mlb海外の反応         127表示 /  1クリック / CTR 0.8% / 順位 4.2
 *   メジャーリーグ 海外の反応  90表示 /  0クリック / CTR 0.0% / 順位 4.6
 *   メジャーリーグ海外の反応   50表示 /  0クリック / CTR 0.0% / 順位 4.9
 *   海外の反応 mlb          40表示 /  0クリック / CTR 0.0% / 順位 4.5
 *   （上位17クエリ計 758表示 / 5クリック＝CTR 0.66%。モバイルは 237表示で 0 クリック）
 *
 * 順位 4 台で CTR 0.66% は順位では説明できない＝スニペット側の問題。読みは2つ:
 *   1. 旧 title の後半「ボクシング・MMA も…」が MLB 検索者には無関係で、
 *      モバイルの表示幅（全角30字前後）で価値が切れていた。トップは実際には
 *      ボクシング/MMA のクエリを1件も取っていない＝後半は薄めるだけだった。
 *   2. 「メジャーリーグ」表記がどこにも無く、その系統（計168表示）が全滅していた。
 *
 * 当てる型は自前の実測で勝っているもの＝チーム/選手タグLP（同じ順位帯で CTR 19%）に合わせる:
 * title は「{主題}の海外の反応まとめ【…現地ファンの声を日本語訳】」、description は
 * 先頭90字に「海外の反応まとめ」「ファンの反応」を連続一致で収め、後半は**毎日動く実データ**
 * （今季の主役・記事総数・最終更新日）で鮮度を出す（teamHubDescriptionJa と同じ処方）。
 *
 * en は全ページ noindex（layout 参照）なので触らず既定を継ぐ。
 */
async function homeSeoJa(): Promise<{ title: string; description: string }> {
  const [threads, snap] = await Promise.all([getAllThreads(), getPlayersSnapshot()]);
  // 今季の主役3人＝PlayerRail と同じ選び方（players.ts のカタログ順 × 今季成績がある人）。
  // ベタ書きしない＝移籍・離脱でカタログが動けばスニペットも自動で追従する。
  const stars = PLAYERS.filter((p) => !p.rival && snap.players[String(p.mlbId)]?.league != null)
    .slice(0, 3)
    .map((p) => p.nameJa);
  const updated = threads[0]?.fetchedAt.slice(0, 10);
  const parts = [
    'MLB（メジャーリーグ）の海外の反応まとめ。現地ファンの反応・コメントを試合直後に日本語訳で毎日更新。',
    stars.length ? `${seasonYear(snap)}年は${stars.join('・')}ら日本人選手の全試合を網羅。` : '',
    // 鮮度（件数・最終更新日）は必ず末尾に置きつつ全体を120字前後に収める＝日本語の description は
    // それ以上が截り落とされる。MVP／サイ・ヤング賞やボクシング・MMA は**この面が取っていない**
    // クエリ（実測17クエリはすべて MLB 海外の反応 系）＝並べると鮮度を截り落とす側に押し出すだけ。
    // それぞれ /mvp・/cy-young・/boxing・/mma が自前の description で当てている。
    `全${threads.length}件を新着順で掲載${updated ? `・最終更新 ${updated}` : ''}。`,
  ];
  return {
    title: 'MLBの海外の反応まとめ【メジャーリーグ現地ファンの声を日本語訳】',
    description: parts.filter(Boolean).join(''),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const alternates = localeAlternates(locale, '');
  if (locale === 'en') return { alternates };
  const { title, description } = await homeSeoJa();
  return {
    // absolute＝layout の template（%s｜海外の反応）を効かせない。title 内に既に「海外の反応」があり
    // 接尾すると二重になる（選手・チームタグLPと同じ理由）。
    title: { absolute: title },
    description,
    // ⚠️ Next の Metadata は openGraph / twitter を**置換**する（マージしない）。ここで書く以上は
    // images を必ず渡す＝渡さないと layout の og.png が消えてトップの og:image が1枚も無くなる
    // （CLAUDE.md §4.2+・2026-07-30 に121ページで起きた事故と同じ穴）。
    openGraph: {
      title,
      description,
      siteName: '海外の反応',
      type: 'website',
      images: OG_IMAGES,
    },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
    alternates,
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [threads, columns, snap, allTags, mvpBoard, cyBoard] = await Promise.all([
    getAllThreads(),
    getAllColumns(),
    getPlayersSnapshot(),
    getAllTags(),
    getMvpBoard(),
    getCyYoungBoard(),
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

  // 二枚看板 左セル＝/browse（選手・チーム別LPディレクトリ）の件数。/browse 本体と同じ基準
  // （選手=タグ記事1件以上の非rival・チーム=LP昇格済み3件以上・格闘家=記事あり）で数える。
  const tagCounts = new Map(allTags.map(({ tag, count }) => [tag, count]));
  const browseCount =
    PLAYERS.filter((p) => !p.rival && (tagCounts.get(p.nameJa) ?? 0) > 0).length +
    allTags.filter(({ tag, count }) => getTeam(tag) != null && count >= TEAM_HUB_MIN_ARTICLES)
      .length +
    FIGHTERS.filter((f) => (tagCounts.get(f.nameJa) ?? 0) > 0).length;

  // 注目選手レーン＝MLB 今季成績がある日本人（必ずヒーロー数字が出る＝honest）。SoT=players.ts 順。
  // 行き先は選手LP（/tag/{名前}＝海外の反応の定点）に集める（2026-08-01・村山指示）。
  // 記事が1本も無い選手はタグページ自体が生成されないので、その選手だけ成績ハブへ倒す。
  const railItems: PlayerRailItem[] = PLAYERS.filter((p) => !p.rival)
    .map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined }))
    .filter((x) => x.s != null && x.s.league != null)
    .slice(0, 10)
    .map(({ p, s }) => {
      const hero = pickHero(s as PlayerSeason);
      const statLabel = hero.statLabel ?? (hero.kind === 'warTotal' ? t('threads.statWar') : null);
      return {
        slug: p.slug,
        href:
          (tagCounts.get(p.nameJa) ?? 0) > 0
            ? `/tag/${encodeURIComponent(p.nameJa)}`
            : `/player/${p.slug}`,
        name: locale === 'en' ? p.nameEn : p.nameJa,
        statValue: hero.value,
        statLabel,
        mlbId: p.mlbId,
        teamColor: getTeam((s as PlayerSeason).team)?.color,
      };
    });

  // アワードレース枠＝MVP／サイヤング予測ボードの各リーグ上位3人だけのダイジェスト（本体へ送客）。
  // スコアはリーグ内パーセンタイルの合成値なので AL/NL を混ぜて並べない（ボード本体と同じ規律）。
  const en = locale === 'en';
  const toRaceRows = (
    rows: { id: number; rank: number; nameJa: string; nameEn: string; score: number; isJp: boolean; teamId: number | null }[],
  ): RaceRow[] =>
    rows.slice(0, 3).map((r) => ({
      id: r.id,
      rank: r.rank,
      name: en ? r.nameEn : r.nameJa,
      score: r.score,
      isJp: r.isJp,
      teamId: r.teamId,
    }));
  const raceCards: RaceBoardCard[] = [];
  if (mvpBoard) {
    raceCards.push({
      title: t('home.raceMvp'),
      href: '/mvp',
      moreLabel: t('home.raceMoreMvp'),
      asOfText: mvpBoard.asOf ? t('player.asOf', { date: mvpBoard.asOf }) : null,
      leagues: [
        { label: 'NL', rows: toRaceRows(mvpBoard.leagues.NL) },
        { label: 'AL', rows: toRaceRows(mvpBoard.leagues.AL) },
      ],
    });
  }
  if (cyBoard) {
    raceCards.push({
      title: t('home.raceCy'),
      href: '/cy-young',
      moreLabel: t('home.raceMoreCy'),
      asOfText: cyBoard.asOf ? t('player.asOf', { date: cyBoard.asOf }) : null,
      leagues: [
        { label: 'NL', rows: toRaceRows(cyBoard.leagues.NL) },
        { label: 'AL', rows: toRaceRows(cyBoard.leagues.AL) },
      ],
    });
  }

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

  // きょうのMLBダイジェスト＝「mlb 海外の反応」検索の着地意図に最上段で即応する（MlbToday の docblock 参照）。
  const mlbThreads = threads.filter((th) => th.sport === 'mlb');
  const mlbLabel = locale === 'en' ? SPORT_INFO.mlb.labelEn : SPORT_INFO.mlb.labelJa;

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
      {/* 題字（マスト）。サイト唯一の赤は、ここの細い縦罫の一点にだけ宿す（色は極小）。
          丸ピルのバーをやめ、シャープな 3px 罫に。題字は字間を詰めて誌面の風格を出す。 */}
      <section className="border-b border-ink pb-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="h-8 w-[3px] bg-accent sm:h-11" />
            <span className="text-3xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">
              {t('site.title')}
            </span>
          </div>
          {issue && (
            <span className="whitespace-nowrap pb-1.5 text-[11px] tracking-[0.12em] text-ink-mute tabular-nums sm:text-xs">
              {issue} {t('home.updated')}
            </span>
          )}
        </div>
        <h1 className="mt-5 text-lg font-bold leading-snug tracking-[-0.01em] text-ink sm:text-xl">
          {t('home.heroTitle')}
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">{t('home.heroBody')}</p>
      </section>

      <MlbToday
        threads={mlbThreads.slice(0, 20)}
        count={mlbThreads.length}
        label={mlbLabel}
        locale={locale}
      />

      <SearchConsole tags={consoleTags} />

      {heroItem && (
        <section className="space-y-4">
          <SectionHeading label={t('home.todays')} />
          <FeedCard item={heroItem} locale={locale} featured priority />
        </section>
      )}

      <TwoPillars browseCount={browseCount} asOf={snap.asOf || undefined} />

      <PlayerRail items={railItems} />

      <RaceBoards
        heading={t('home.races')}
        boardLabel={t('home.raceBoard')}
        scoreLabel={t('home.raceScore')}
        cards={raceCards}
      />

      <SportZones zones={zones} locale={locale} />

      <PopularTags />

      {restItems.length > 0 && (
        <section className="space-y-8">
          <SectionHeading label={t('home.more')} />
          <FeedGrid items={restItems} locale={locale} />
          <Pagination basePath="" page={1} totalPages={paged.totalPages} />
        </section>
      )}
    </div>
  );
}
