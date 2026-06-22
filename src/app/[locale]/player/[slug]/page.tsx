import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getPlayer, PLAYERS, type Player } from '@/lib/players';
import { getPlayerSeason, getPlayersSnapshot } from '@/lib/playerStats';
import { buildFeed, feedKey } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import PlayerStatTable from '@/components/PlayerStatTable';
import PlayerStatHighlights from '@/components/PlayerStatHighlights';
import type { RankLabels } from '@/components/RankBadges';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';
import type { Thread } from '@/types/thread';

export const dynamicParams = false;

/** その選手の記事（タグ or 成績ボックスに名前がある記事）を新着順で。 */
function threadsOf(player: Player, all: Thread[]): Thread[] {
  return all.filter(
    (t) =>
      (t.tags ?? []).includes(player.nameJa) ||
      (t.stats ?? []).some((s) => s.player === player.nameJa),
  );
}

export async function generateStaticParams() {
  const all = await getAllThreads();
  // 記事が1本以上ある選手だけハブを作る（空ハブ＝薄いページを作らない）
  const withArticles = PLAYERS.filter((p) => threadsOf(p, all).length > 0);
  return locales.flatMap((locale) => withArticles.map((p) => ({ locale, slug: p.slug })));
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
  const threads = threadsOf(player, all);
  if (threads.length === 0) notFound();
  const [season, snap] = await Promise.all([getPlayerSeason(player.mlbId), getPlayersSnapshot()]);
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

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {t('player.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
          {player.nameJa}
          <span className="ml-2 text-base font-normal text-ink-soft">{player.nameEn}</span>
        </h1>
        {(season?.team || season?.league) && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5">
            {season?.team && (
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink ring-1 ring-line">
                {season.team}
              </span>
            )}
            {season?.league && (
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-soft ring-1 ring-line">
                {season.league === 'AL' ? t('player.lgAL') : t('player.lgNL')}
              </span>
            )}
          </p>
        )}
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{player.bio}</p>
        {player.sameAs.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-ink-soft">
            {player.sameAs.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-ink">
                {url.includes('wikipedia') ? 'Wikipedia' : url.includes('mlb.com') ? 'MLB.com' : '公式'}
              </a>
            ))}
          </p>
        )}
      </section>

      {/* マーキー成績（パッと見て分かる代表指標＋順位）。データが無ければ記事クラスタだけ出す。 */}
      {hasStats && season ? (
        <>
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-ink">{t('player.highlights')}</h2>
              {snap.asOf && (
                <span className="text-xs text-ink-soft">{t('player.asOf', { date: snap.asOf })}</span>
              )}
            </div>
            <PlayerStatHighlights
              hitting={season.hitting}
              pitching={season.pitching}
              saber={season.saber}
              ranks={season.ranks}
              league={season.league}
              labels={rankLabels}
              roleBat={t('player.roleBat')}
              rolePit={t('player.rolePit')}
            />
          </section>

          {/* 詳細成績（極限まで）。順位はセル下に小さく添える。 */}
          <section>
            <h2 className="text-lg font-bold text-ink">{t('player.statsTitle')}</h2>
            <PlayerStatTable
              hitting={season.hitting}
              pitching={season.pitching}
              saber={season.saber}
              ranks={season.ranks}
              league={season.league}
              labels={rankLabels}
            />
            <p className="mt-3 text-[11px] text-ink-soft">{t('player.statsNote')}</p>
          </section>
        </>
      ) : null}

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

      <p className="text-sm">
        <Link href="/player" className="text-accent hover:underline">
          ← {t('player.indexTitle')}
        </Link>
      </p>
    </div>
  );
}
