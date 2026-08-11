import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllTags } from '@/lib/tags';
import { PLAYERS, hasMlbStats, type Player } from '@/lib/players';
import { getPlayersSnapshot } from '@/lib/playerStats';
import { FIGHTERS } from '@/lib/fighters';
import { getTeam, teamLogoUrl, headshotUrl } from '@/lib/teams';
import { TEAM_HUB_MIN_ARTICLES, teamHubOf, teamDisplayJa, type TeamHub } from '@/lib/teamHub';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import UpcomingFights from '@/components/UpcomingFights';
import { Link } from '@/lib/navigation';
import { localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('browse.title'),
    description: t('browse.lead'),
    alternates: localeAlternates(locale, '/browse'),
  };
}

/**
 * 「選手・チーム別」ハブ。リッチ化済みのタグLP（選手LP・チームLP・格闘家LP）だけを束ねる
 * キュレーション・ディレクトリ。/tags（全タグクラウド・noindex）とは役割を分け、こちらは
 * ヘッダー常設＝全ページからLP群へ2ホップで届く内部リンクのハブにする（「{選手名} 海外の反応」で
 * 上がってきたLPに検索評価とリピーターを集める配線）。
 *
 * 並べるのは記事が実在するLPのみ（記事0件の選手は載せない＝/tag が空のページに送客しない）。
 * チームは teamHub と同じ下限（TEAM_HUB_MIN_ARTICLES）＝LP昇格済みのタグだけ。
 */
export default async function BrowsePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [tags, snap] = await Promise.all([getAllTags(), getPlayersSnapshot()]);
  const countOf = new Map(tags.map(({ tag, count }) => [tag, count]));

  // 日本人MLB選手のLP（tagHub と同じ opt-in＝非 rival の正式名タグ）。記事数降順。
  const players = PLAYERS.filter((p) => !p.rival)
    .map((p) => ({ p, count: countOf.get(p.nameJa) ?? 0 }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count || a.p.nameJa.localeCompare(b.p.nameJa, 'ja'));

  // 海外の注目スター（rival カタログ）。行き先はタグLPでなく /player/{slug}＝「{選手名} 成績」で
  // 2ページ目に張り付く成績ハブへ、ヘッダー常設ハブから2ホップの内部リンクを通す（GSC実測:
  // シュワーバー/クロウアームストロング成績系が計2,000表示超で全部11位前後・2026-08-11）。
  // hasMlbStats で絞る＝/player の生成条件（hubEligible）を満たすリンクだけ並べて404を作らない。
  const rivals = PLAYERS.filter((p) => p.rival && hasMlbStats(snap.players[String(p.mlbId)]));

  // チームLP（LP昇格済み＝記事3件以上のタグのみ）。記事数降順。
  const teams = tags
    .map(({ tag, count }) => ({ hub: teamHubOf(tag), count }))
    .filter((e): e is { hub: TeamHub; count: number } => e.hub != null && e.count >= TEAM_HUB_MIN_ARTICLES)
    .sort((a, b) => b.count - a.count || a.hub.nameJa.localeCompare(b.hub.nameJa, 'ja'));

  // 格闘家LP（fighters.ts の opt-in カタログ）。記事数降順。
  const fighters = FIGHTERS.map((f) => ({ f, count: countOf.get(f.nameJa) ?? 0 }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: t('browse.title') }]} />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
          {t('tag.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{t('browse.title')}</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">{t('browse.lead')}</p>
      </section>

      <section className="space-y-4">
        <SectionHeading
          label={t('browse.players')}
          count={players.length}
          seeAllHref="/player"
          seeAllLabel={t('browse.statsBridge')}
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map(({ p, count }) => (
            <PlayerCard
              key={p.slug}
              player={p}
              teamJa={snap.players[String(p.mlbId)]?.team}
              countLabel={t('browse.articleCount', { count })}
            />
          ))}
        </ul>
      </section>

      {rivals.length > 0 && (
        <section className="space-y-4">
          <SectionHeading label={t('browse.rivals')} count={rivals.length} />
          <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{t('browse.rivalsLead')}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rivals.map((p) => (
              <PlayerCard
                key={p.slug}
                player={p}
                href={`/player/${p.slug}`}
                teamJa={snap.players[String(p.mlbId)]?.team}
                countLabel={t('browse.rivalStats')}
              />
            ))}
          </ul>
        </section>
      )}

      {teams.length > 0 && (
        <section className="space-y-4">
          <SectionHeading label={t('browse.teams')} count={teams.length} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map(({ hub, count }) => (
              <li key={hub.nameJa}>
                <Link
                  href={`/tag/${encodeURIComponent(hub.nameJa)}`}
                  className="flex items-center gap-3 rounded-[2px] border border-line p-3 transition-colors hover:border-ink"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク */}
                  <img
                    src={teamLogoUrl(hub.info.id)}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {teamDisplayJa(hub)}
                    </span>
                    <span className="block truncate text-xs text-ink-mute">{hub.info.nameFull}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                    {t('browse.articleCount', { count })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 次の試合＝ディレクトリに「いま押す理由」を足す枠（格闘家LPとイベントハブへの近道）。 */}
      {locale !== 'en' && <UpcomingFights />}

      {fighters.length > 0 && (
        <section className="space-y-4">
          <SectionHeading label={t('browse.fighters')} count={fighters.length} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fighters.map(({ f, count }) => (
              <li key={f.slug}>
                <Link
                  href={`/tag/${encodeURIComponent(f.nameJa)}`}
                  className="block rounded-[2px] border border-line p-3 transition-colors hover:border-ink"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-ink">{f.nameJa}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                      {t('browse.articleCount', { count })}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink-mute">
                    {f.nameEn} ・ {f.record.wins}勝{f.record.losses}敗{f.record.draws > 0 ? `${f.record.draws}分` : ''}
                    （{f.record.kos}KO）
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="border-t border-line pt-6 text-sm text-ink-soft">
        <Link href="/tags" className="underline decoration-line underline-offset-4 transition-colors hover:text-ink">
          {t('browse.allTags')}
        </Link>
      </p>
    </div>
  );
}

function PlayerCard({
  player,
  teamJa,
  countLabel,
  href,
}: {
  player: Player;
  teamJa?: string;
  countLabel: string;
  /** 省略時はタグLP。rival は成績ハブ /player/{slug} を渡す（タグ記事0件でもリンク先が空にならない）。 */
  href?: string;
}) {
  const team = getTeam(teamJa);
  return (
    <li>
      <Link
        href={href ?? `/tag/${encodeURIComponent(player.nameJa)}`}
        className="flex items-center gap-3 rounded-[2px] border border-line p-3 transition-colors hover:border-ink"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式ヘッドショットを直リンク */}
        <img
          src={headshotUrl(player.mlbId)}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-[2px] bg-paper object-cover ring-1 ring-line"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{player.nameJa}</span>
          <span className="block truncate text-xs text-ink-mute">
            {player.nameEn}
            {team ? ` ・ ${teamJa}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-ink-soft">{countLabel}</span>
      </Link>
    </li>
  );
}
