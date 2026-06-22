import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getPlayer, PLAYERS, threadsOf, hubEligible } from '@/lib/players';
import { getPlayerSeason, getPlayersSnapshot } from '@/lib/playerStats';
import { pickHero } from '@/lib/playerHero';
import { buildFeed, feedKey } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import PlayerHero from '@/components/player/PlayerHero';
import PlayerMarquee from '@/components/player/PlayerMarquee';
import PlayerDetail from '@/components/player/PlayerDetail';
import PlayerStickyBar from '@/components/player/PlayerStickyBar';
import type { RankLabels } from '@/components/RankBadges';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export async function generateStaticParams() {
  const [all, snap] = await Promise.all([getAllThreads(), getPlayersSnapshot()]);
  // 記事がある or MLBの今季成績がある選手のハブを作る（成績つきなら薄くない＝松井・千賀のように
  // 記事がまだ無い現役選手にも成績ハブを用意する）。AAA等(league=null)は対象外。
  const withHub = PLAYERS.filter((p) => hubEligible(p, all, snap.players[String(p.mlbId)]));
  return locales.flatMap((locale) => withHub.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const player = getPlayer(slug);
  if (!player) return {};
  const snap = await getPlayersSnapshot();
  return {
    title: `${player.nameJa}（${player.nameEn}）今季成績・現地の評判`,
    description: `${player.nameJa}の今季成績（打率・本塁打・防御率・WHIP・WAR ほか）と、海外の反応まとめ記事を一覧。${snap.asOf ? `${snap.asOf}時点。` : ''}`,
    alternates: localeAlternates(locale, `/player/${slug}`),
  };
}

export default async function PlayerHubPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  unstable_setRequestLocale(locale);
  const player = getPlayer(slug);
  if (!player) notFound();
  const t = await getTranslations();

  const all = await getAllThreads();
  const [season, snap] = await Promise.all([getPlayerSeason(player.mlbId), getPlayersSnapshot()]);
  const threads = threadsOf(player, all);
  // 記事も成績も無ければハブを作らない（dynamicParams=false なので通常ここには来ないが保険）
  if (!hubEligible(player, all, season)) notFound();
  const feed = buildFeed(threads, []);

  const rankLabels: RankLabels = {
    mlb: t('player.rankMlb'),
    al: t('player.lgAL'),
    nl: t('player.lgNL'),
    unit: t('player.rankUnit'),
  };
  const hasStats = Boolean(season && (season.hitting || season.pitching));

  const hubUrl = absoluteUrl(locale, `/player/${slug}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        mainEntity: {
          '@type': 'Person',
          name: player.nameJa,
          alternateName: player.nameEn,
          jobTitle: '野球選手',
          ...(player.sameAs.length ? { sameAs: player.sameAs } : {}),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t('player.indexTitle'), item: absoluteUrl(locale, '/player') },
          { '@type': 'ListItem', position: 3, name: player.nameJa, item: hubUrl },
        ],
      },
    ],
  };

  const hero = hasStats && season ? pickHero(season) : null;
  // スティッキー・ミニヘッダ用の短いラベル（クライアント島には解決済み文字列を渡す）。
  const stickyLabel = hero
    ? hero.kind === 'warTotal'
      ? 'WAR'
      : hero.kind === 'wrc'
        ? t('player.heroTotalHitting')
        : hero.statLabel ?? ''
    : '';

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {hasStats && season && hero ? (
        <>
          <PlayerHero player={player} season={season} hero={hero} labels={rankLabels} asOf={snap.asOf} />
          <PlayerStickyBar
            name={player.nameJa}
            heroLabel={stickyLabel}
            heroValue={hero.value}
            dotAccent={hero.role === 'two-way'}
          />
          <PlayerMarquee season={season} hero={hero} labels={rankLabels} />
          <PlayerDetail season={season} hero={hero} labels={rankLabels} />

          {/* 経歴・外部権威URL（E-E-A-T テキストは DOM に残しつつ低優先で畳む）。 */}
          <details className="group border-t border-line pt-2">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {t('player.about')}
              <span aria-hidden="true" className="text-ink-soft transition-transform group-open:rotate-180">▾</span>
            </summary>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">{player.bio}</p>
            {player.sameAs.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-soft">
                {player.sameAs.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-[44px] items-center underline hover:text-ink">
                    {url.includes('wikipedia') ? 'Wikipedia' : url.includes('mlb.com') ? 'MLB.com' : '公式'}
                  </a>
                ))}
              </p>
            )}
          </details>
        </>
      ) : (
        // 成績がまだ無い選手（記事だけ）。名前＋経歴の最小ヘッダ。
        <section className="border-b border-line pb-6">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{t('player.eyebrow')}</span>
          <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
            {player.nameJa}
            <span className="ml-2 text-base font-normal text-ink-soft">{player.nameEn}</span>
          </h1>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{player.bio}</p>
          {player.sameAs.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-soft">
              {player.sameAs.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-[44px] items-center underline hover:text-ink">
                  {url.includes('wikipedia') ? 'Wikipedia' : url.includes('mlb.com') ? 'MLB.com' : '公式'}
                </a>
              ))}
            </p>
          )}
        </section>
      )}

      {threads.length > 0 && (
        <section>
          <h2 className="mb-5 text-lg font-bold text-ink">
            {t('player.articles', { name: player.nameJa, count: threads.length })}
          </h2>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {feed.map((item, i) => (
              <li key={feedKey(item)}>
                <FeedCard item={item} locale={locale} priority={i === 0} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm">
        <Link href="/player" className="text-accent hover:underline">
          ← {t('player.indexTitle')}
        </Link>
      </p>
    </div>
  );
}
