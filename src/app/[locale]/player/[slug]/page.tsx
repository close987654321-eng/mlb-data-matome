import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getPlayer, PLAYERS, threadsOf, hubEligible, hasMlbStats } from '@/lib/players';
import { getPlayerSeason, getPlayersSnapshot, seasonYear, asOfIso } from '@/lib/playerStats';
import { pickHero, playerShareText } from '@/lib/playerHero';
import { playerLede } from '@/lib/playerLede';
import { buildFeed, feedKey } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import ShareButtons from '@/components/ShareButtons';
import PlayerHero from '@/components/player/PlayerHero';
import PlayerMarquee from '@/components/player/PlayerMarquee';
import PlayerDetail from '@/components/player/PlayerDetail';
import PlayerStickyBar from '@/components/player/PlayerStickyBar';
import Breadcrumbs from '@/components/Breadcrumbs';
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
  const [snap, season] = await Promise.all([getPlayersSnapshot(), getPlayerSeason(player.mlbId)]);
  const year = seasonYear(snap);
  const en = locale === 'en';
  // シェア文の今季主要数値（JP整形）は ja の description にだけ使う（英語ページに和文を混ぜない）。
  const statLine = !en && season ? playerShareText(player.nameJa, season, pickHero(season)).split('｜')[1] : '';
  // 年号＋最重要KW「成績」を前方に（成績検索の定番『{選手} 成績 2026』に当てる）。英名は description 側へ。
  const title = en
    ? `${player.nameEn} — ${year} Stats & Fan Reactions`
    : `${player.nameJa} ${year}年 成績・現地の評判`;
  const teamCtx = season?.team ? `${season.team}・` : '';
  const description = en
    ? `${player.nameEn}'s ${year} MLB season stats${season?.team ? ` (${season.team})` : ''} and what overseas fans are saying — Japanese digests of reactions from abroad.`
    : `${player.nameJa}（${player.nameEn}）の${year}年MLB成績${statLine ? `（${statLine}）` : `（${teamCtx}打率・本塁打・防御率・WAR ほか）`}と、海外の反応まとめ記事を一覧。${snap.asOf ? `${snap.asOf}時点。` : ''}`;
  return {
    title,
    description,
    alternates: localeAlternates(locale, `/player/${slug}`),
    // 選手別の OG/Twitter カード。画像は同階層の opengraph-image が自動で差し込む。
    openGraph: { title, description, type: 'profile', url: absoluteUrl(locale, `/player/${slug}`) },
    twitter: { card: 'summary_large_image', title, description },
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
  // MLBロースター級の今季成績がある時だけ成績UIを出す（league=null=AAA等は除外＝hubEligible と整合）。
  const hasStats = hasMlbStats(season);
  const year = seasonYear(snap);
  // H1 直下の「今季の地の文」（成績がある選手のみ・実在値だけで生成＝薄ページ回避）。
  const lede = hasStats && season ? playerLede(player, season, year, locale) : undefined;

  const hubUrl = absoluteUrl(locale, `/player/${slug}`);
  const dateModified = asOfIso(snap.asOf);
  // Person を Athlete に格上げ（sport/所属/自URL/画像）。数値・所属は snapshot の実在値のみ（捏造しない）。
  const person = {
    '@type': ['Person', 'Athlete'],
    '@id': `${hubUrl}#person`,
    name: player.nameJa,
    alternateName: player.nameEn,
    jobTitle: '野球選手',
    sport: 'Baseball',
    url: hubUrl,
    image: absoluteUrl(locale, `/player/${slug}/opengraph-image`),
    ...(player.bio ? { description: player.bio } : {}),
    ...(hasStats && season?.team ? { memberOf: { '@type': 'SportsTeam', name: season.team } } : {}),
    ...(player.sameAs.length ? { sameAs: player.sameAs } : {}),
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        // 成績スナップショットの更新時刻＝毎時CI更新の鮮度シグナル（記事側 about:Person と双方向化）。
        ...(dateModified ? { dateModified } : {}),
        mainEntity: person,
        ...(threads.length
          ? { relatedLink: threads.slice(0, 25).map((th) => absoluteUrl(locale, `/${th.sport}/${th.id}`)) }
          : {}),
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
  // 直近の「試合」まとめ＝動画つき or シリーズ(watch-along)記事の最新（id 先頭の日付で新しい順）。
  // 試合性のある記事だけを対象にする（ただの議論スレを「試合」と誤ラベルしない＝誠実）。
  const latestGame = [...threads]
    .filter((th) => th.media?.kind === 'video' || th.series)
    .sort((a, b) => b.id.localeCompare(a.id))[0];
  // スティッキー・ミニヘッダ用の短いラベル（クライアント島には解決済み文字列を渡す）。
  const stickyLabel = hero
    ? hero.kind === 'warTotal'
      ? 'WAR'
      : hero.kind === 'wrc'
        ? t('player.heroTotalHitting')
        : hero.statLabel ?? ''
    : '';

  // 関連選手（同チーム優先 → ライバル/サイヤング文脈 → その他）。他ハブへ横リンクし回遊とトピッククラスタを強める。
  const myTeam = hasStats ? season?.team : undefined;
  const related = PLAYERS.filter((p) => p.slug !== slug && hubEligible(p, all, snap.players[String(p.mlbId)]))
    .map((p) => {
      const ps = snap.players[String(p.mlbId)];
      const sameTeam = myTeam && ps?.team === myTeam;
      const rivalLink = Boolean(p.rival || player.rival); // サイヤング/ライバル文脈の数珠つなぎ
      return { p, score: sameTeam ? 0 : rivalLink ? 1 : 2 };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map((x) => x.p);

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs
        items={[
          { name: t('nav.home'), href: '/' },
          { name: t('player.indexTitle'), href: '/player' },
          { name: player.nameJa },
        ]}
      />

      {hasStats && season && hero ? (
        <>
          <PlayerHero player={player} season={season} hero={hero} labels={rankLabels} asOf={snap.asOf} year={year} lede={lede} />
          <PlayerStickyBar
            name={player.nameJa}
            heroLabel={stickyLabel}
            heroValue={hero.value}
            dotAccent={hero.role === 'two-way'}
          />
          <PlayerMarquee season={season} hero={hero} labels={rankLabels} name={locale === 'en' ? player.nameEn : player.nameJa} />

          {/* 成績の二次拡散導線。シェア文に今季の主要数値を載せて“いい感じ”に拡散させる。 */}
          <ShareButtons url={hubUrl} title={playerShareText(player.nameJa, season, hero)} />

          <PlayerDetail season={season} hero={hero} labels={rankLabels} />

          {/* 成績詳細 → 直近の試合まとめへの導線（相互リンク／回遊）。 */}
          {latestGame && (
            <Link
              href={`/${latestGame.sport}/${latestGame.id}`}
              className="group flex items-center justify-between border-y border-line py-3.5 text-sm font-semibold text-accent transition-colors hover:text-accent-ink"
            >
              <span>
                <span aria-hidden="true">▶</span> {t('player.latestGame')}
              </span>
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          )}

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

      {related.length > 0 && (
        <section className="border-t border-line pt-6">
          <h2 className="mb-3 text-sm font-bold text-ink">{t('player.relatedTitle')}</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((rp) => (
              <Link
                key={rp.slug}
                href={`/player/${rp.slug}`}
                className="inline-flex items-center gap-1 rounded-full border border-line px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
              >
                <span aria-hidden="true">📊</span>
                {locale === 'en' ? rp.nameEn : rp.nameJa}
              </Link>
            ))}
          </div>
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
