import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import { PLAYERS } from '@/lib/players';
import { getPlayersSnapshot, seasonYear, type PlayerSeason } from '@/lib/playerStats';
import { ALLSTAR } from '@/lib/allstar';
import { getAllStarBallot } from '@/lib/allstarBallot';
import Leaderboard, { type LeaderRow } from '@/components/Leaderboard';
import BallotRace from '@/components/BallotRace';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const year = String(ALLSTAR.year);
  const title = t('allstar.metaTitle', { year });
  const description = t('allstar.metaDesc', { year });
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/allstar'), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
    alternates: localeAlternates(locale, '/allstar'),
  };
}

// 打者/投手 WAR の高い方（二刀流の大谷を1指標で並べるため）。無ければ -Infinity で末尾へ。
const bestWar = (s: PlayerSeason) => Math.max(s.saber?.hit ?? -Infinity, s.saber?.pit ?? -Infinity);

export default async function AllStarPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // 会期後は enabled=false で撤去（期間限定ハブ）。
  if (!ALLSTAR.enabled) notFound();
  const t = await getTranslations();
  const en = locale === 'en';
  const [snap, all, ballot] = await Promise.all([getPlayersSnapshot(), getAllThreads(), getAllStarBallot()]);
  const year = seasonYear(snap);

  // 今季 MLB 成績のある日本人選手（WAR算出可能）。
  const jp = PLAYERS.filter((p) => !p.rival)
    .map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined }))
    .filter((x): x is { p: (typeof PLAYERS)[number]; s: PlayerSeason } =>
      Boolean(x.s && x.s.league && Number.isFinite(bestWar(x.s))),
    );

  // 発表後は選出選手のみ／発表前は前半戦WAR上位＝「選出が期待される候補」（＝当サイトの見立て・事実断定しない）。
  const announced = ALLSTAR.rosterAnnounced && ALLSTAR.selectedMlbIds.length > 0;
  const selectedSet = new Set(ALLSTAR.selectedMlbIds.map(String));
  const pool = announced ? jp.filter((x) => selectedSet.has(String(x.p.mlbId))) : jp;
  const ranked = [...pool].sort((a, b) => bestWar(b.s) - bestWar(a.s)).slice(0, 12);
  const candidateRows: LeaderRow[] = ranked.map((x, i) => ({
    rank: i + 1,
    slug: x.p.slug,
    name: en ? x.p.nameEn : x.p.nameJa,
    team: x.s.team,
    mlbId: x.p.mlbId,
    value: bestWar(x.s).toFixed(1),
  }));

  // 海外の反応クラスタ（記事タグに ALLSTAR.tag が付いたもの）。無ければセクションは案内文だけ。
  const reactionItems = buildFeed(
    all.filter((th) => (th.tags ?? []).includes(ALLSTAR.tag)),
    [],
  );

  const pageTitle = t('allstar.titleYear', { year: String(year) });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: pageTitle,
        description: t('allstar.metaDesc', { year: String(year) }),
        url: absoluteUrl(locale, '/allstar'),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t('allstar.title'), item: absoluteUrl(locale, '/allstar') },
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: t('allstar.title') }]} />

      <PlayerHubNav />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">{t('allstar.eyebrow')}</span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{t('allstar.titleYear', { year: String(year) })}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{t('allstar.lead')}</p>
        {/* 日程/会場は公式確認後（allstar.ts）に埋める。空なら出さない＝未確認の事実を載せない。 */}
        {(ALLSTAR.dateLabel || ALLSTAR.venue) && (
          <p className="mt-2 text-sm text-ink">
            {[ALLSTAR.dateLabel, ALLSTAR.venue].filter(Boolean).join(' ／ ')}
          </p>
        )}
        {snap.asOf && <p className="mt-1 text-xs text-ink-soft">{t('player.asOf', { date: snap.asOf })}</p>}
      </section>

      {/* 投票レース: 各リーグ×守備位置の候補を成績(OPS)で見る。投票数は公式非公開なので出さず、公式ballotへ送客。 */}
      {ballot && (
        <section>
          <SectionHeading label={t('allstar.ballotTitle')} lead />
          <p className="mb-4 mt-1.5 max-w-prose text-sm text-ink-soft">{t('allstar.ballotLead')}</p>
          <BallotRace ballot={ballot} locale={locale} />
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={ballot.ballotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
            >
              {t('allstar.ballotCta')} <span aria-hidden>↗</span>
            </a>
            <span className="text-xs text-ink-soft">
              {t('allstar.ballotNote')}
              {ballot.asOf ? ` ／ ${t('player.asOf', { date: ballot.asOf })}` : ''}
            </span>
          </div>
        </section>
      )}

      {/* 選出／候補: 前半戦WAR上位の日本人選手。各行→選手ハブ（母艦へ送客）。 */}
      {candidateRows.length > 0 && (
        <section>
          <SectionHeading label={announced ? t('allstar.selectedTitle') : t('allstar.candidatesTitle')} count={candidateRows.length} lead />
          <p className="mb-1 mt-1.5 max-w-prose text-sm text-ink-soft">
            {announced ? t('allstar.selectedLead') : t('allstar.candidatesLead')}
          </p>
          <Leaderboard rows={candidateRows} />
          <p className="mt-4 text-sm">
            <Link href="/ranking" className="text-ink-soft transition-colors hover:text-ink hover:underline">
              {t('allstar.rankingCta')} <span aria-hidden>→</span>
            </Link>
          </p>
        </section>
      )}

      {/* オールスターの海外の反応（発表→ダービー→本戦の各局面で記事を足すと自動で並ぶ）。 */}
      <section>
        <SectionHeading label={t('allstar.reactionsTitle')} count={reactionItems.length || undefined} lead />
        {reactionItems.length > 0 ? (
          <div className="mt-3">
            <FeedGrid items={reactionItems} locale={locale} />
          </div>
        ) : (
          <p className="mt-1.5 max-w-prose text-sm text-ink-soft">{t('allstar.reactionsEmpty')}</p>
        )}
      </section>

      {/* 本戦 watch-along への導線。 */}
      <section className="border-t border-line pt-6">
        <p className="text-sm">
          <Link href="/watch" className="text-ink-soft transition-colors hover:text-ink hover:underline">
            {t('allstar.watchCta')} <span aria-hidden>→</span>
          </Link>
        </p>
      </section>

      <div className="space-y-1 border-t border-line pt-4">
        <p className="text-xs text-ink-soft">{t('allstar.factNote')}</p>
        <p className="text-xs text-ink-soft">{t('player.statsNote')}</p>
      </div>
    </div>
  );
}
