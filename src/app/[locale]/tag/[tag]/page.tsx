import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllTags, getFeedByTag } from '@/lib/tags';
import { isTagIndexable } from '@/lib/tagIndex';
import { feedKey, type FeedItem } from '@/lib/feed';
import { tagHubOf, tagHubIntroJa, tagHubVoices, playerTagHubs, type TagVoice } from '@/lib/tagHub';
import {
  fighterHubOf,
  fighterHubIntroJa,
  fighterHubTitleJa,
  fighterHubHeadingJa,
  fighterTagHubs,
  fightFeedItems,
  fightDateJa,
} from '@/lib/fighterHub';
import type { Fighter } from '@/lib/fighters';
import { SPORT_INFO } from '@/lib/sports';
import { getEditorNote, type EditorNote } from '@/lib/editorNotes';
import {
  getPlayerJournal,
  getFighterJournal,
  journalLatestHighlight,
  type PlayerJournal as PlayerJournalData,
} from '@/lib/playerJournal';
import { getGamelog, type Gamelog } from '@/lib/gamelog';
import { jpWarRank, type JpRank } from '@/lib/jpRank';
import {
  teamHubOf,
  teamHubIntroJa,
  teamHubDescriptionJa,
  teamHubTopics,
  teamJpPlayers,
  teamDisplayJa,
  TEAM_HUB_MIN_ARTICLES,
  type TeamHub,
} from '@/lib/teamHub';
import { getTeam, headshotUrl, teamLogoUrl, teamOfficialUrl, type TeamInfo } from '@/lib/teams';
import { standingOfTeam, standingPhraseJa } from '@/lib/standings';
import type { Player } from '@/lib/players';
import { getPlayerSeason, getPlayersSnapshot, seasonYear, type PlayerSeason } from '@/lib/playerStats';
import FeedCard from '@/components/FeedCard';
import TagVoices from '@/components/TagVoices';
import PlayerNow from '@/components/PlayerNow';
import FighterNow from '@/components/FighterNow';
import UpcomingFights from '@/components/UpcomingFights';
import SeasonJournal from '@/components/SeasonJournal';
import TeamStandings from '@/components/TeamStandings';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export async function generateStaticParams() {
  const tags = await getAllTags();
  // タグは生（デコード済み）で渡す。Next がパスを URL エンコードする。
  return locales.flatMap((locale) => tags.map(({ tag }) => ({ locale, tag })));
}

/**
 * このタグをチームLPとして扱うか。teams.ts に載る30球団タグでも、記事が閾値未満のうちは
 * 通常タグのまま（薄いLPを量産しない）。件数はビルドごとに再評価＝増えたら自動昇格。
 */
function teamLpOf(tag: string, feedCount: number): TeamHub | null {
  return feedCount >= TEAM_HUB_MIN_ARTICLES ? teamHubOf(tag) : null;
}

/** フィード1件のタグ（チームLPの話題集計用）。 */
function tagsOfItem(item: FeedItem): string[] {
  return (item.kind === 'thread' ? item.thread.tags : item.column.tags) ?? [];
}

/** 選手LPのアーカイブ（カード枠から溢れた分）を月ごとにまとめる。フィードは日付降順＝月も新しい順。 */
function archiveMonthsOf(items: FeedItem[]): { month: string; items: FeedItem[] }[] {
  const groups: { month: string; items: FeedItem[] }[] = [];
  for (const item of items) {
    const month = item.date.slice(0, 7);
    const last = groups.at(-1);
    if (last && last.month === month) last.items.push(item);
    else groups.push({ month, items: [item] });
  }
  return groups;
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
function monthLabel(month: string, locale: Locale): string {
  const [y, m] = month.split('-');
  return locale === 'en' ? `${MONTHS_EN[Number(m) - 1]} ${y}` : `${y}年${Number(m)}月`;
}

/** ファイターの競技ラベル（パンくず・競技一覧リンク用）。 */
function sportLabel(fighter: Fighter, locale: Locale): string {
  const info = SPORT_INFO[fighter.sport];
  return locale === 'en' ? info.labelEn : info.labelJa;
}

/**
 * 所属日本人選手リンクに添える成績1行（snapshot の公知の数値のみ）。野手は打撃3値・投手は勝敗と
 * 防御率。二刀流（大谷）は打撃を優先＝1行に収める。数値が無ければ出さない（捏造しない）。
 */
function statLineOf(season: PlayerSeason | null | undefined, locale: Locale): string | null {
  const h = season?.hitting;
  if (h?.avg != null) {
    return locale === 'en'
      ? `AVG ${h.avg} · ${h.homeRuns ?? 0} HR · OPS ${h.ops ?? '-'}`
      : `打率${h.avg}・${h.homeRuns ?? 0}本塁打・OPS ${h.ops ?? '-'}`;
  }
  const p = season?.pitching;
  if (p?.era != null) {
    return locale === 'en'
      ? `${p.wins ?? 0}-${p.losses ?? 0} · ERA ${p.era}`
      : `${p.wins ?? 0}勝${p.losses ?? 0}敗・防御率${p.era}`;
  }
  return null;
}

/**
 * タグLPの H1 ＝ meta title（選手・チームタグは「{名前}の海外の反応まとめ」で KW を正面に）。
 * チームLPは検索の主流表記（teams.ts の aliasJa・例「Dバックス」）を併記してクエリと文字列一致させる。
 */
async function headingOf(locale: Locale, tag: string, teamLp: TeamHub | null): Promise<string> {
  const hub = tagHubOf(tag);
  const fighter = fighterHubOf(tag);
  const t = await getTranslations({ locale });
  if (locale === 'en') {
    if (hub) return `${hub.nameEn} — Overseas Fan Reactions`;
    // domestic ファイターは英語面でも「海外の反応」を名乗らせない（実態は国内の声）。
    if (fighter) {
      return fighter.voiceScope === 'global'
        ? `${fighter.nameEn} — Overseas Fan Reactions`
        : `${fighter.nameEn} — Career Record & Fan Voices`;
    }
    if (teamLp) return `${teamLp.info.nameEn} — Overseas Fan Reactions`;
  }
  // domestic ファイターの H1 は「戦績×次戦」框（title と同じ関係＝【】接尾辞なし）。
  if (fighter && fighter.voiceScope === 'domestic') return fighterHubHeadingJa(fighter);
  return t('tag.heading', { tag: teamLp ? teamDisplayJa(teamLp) : tag });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; tag: string }>;
}): Promise<Metadata> {
  const { locale, tag } = await params;
  const decoded = decodeURIComponent(tag);
  const t = await getTranslations({ locale });
  const hub = tagHubOf(decoded);
  const fighter = hub ? null : fighterHubOf(decoded);
  const feed = await getFeedByTag(decoded);
  const teamLp = hub || fighter ? null : teamLpOf(decoded, feed.length);
  const heading = await headingOf(locale, decoded, teamLp);
  // 選手・チームタグLPは absolute でテンプレート接尾辞（｜海外の反応）を外す＝「海外の反応」の重複を
  // 避け、「{選手名/チーム名} 海外の反応」クエリに正面から当てる title に固定する。
  const isJaHub = Boolean(hub || fighter || teamLp) && locale !== 'en';
  // チームLPは alias 併記（例「ダイヤモンドバックス（Dバックス）」）＝実際に打たれるクエリに一致させる。
  const nameJa = teamLp ? teamDisplayJa(teamLp) : decoded;
  // 格闘技は「MLB現地ファン」だと誤りになるので接尾辞を競技非依存にする。
  // domestic ファイターは框ごと差し替え＝「戦績×次戦×ファンの声」（fighterHubTitleJa）。
  const fullTitle =
    fighter && locale !== 'en'
      ? fighterHubTitleJa(fighter)
      : isJaHub
        ? `${nameJa}の海外の反応まとめ【MLB現地ファンの声を日本語訳】`
        : heading;
  const title = isJaHub ? { absolute: fullTitle } : fullTitle;
  let description = t('tag.lead', { tag: decoded });
  const updated = feed[0]?.date.slice(0, 10);
  if (hub && locale !== 'en') {
    // 選手タグLP: 実在の成績値入りの導入文をそのまま description に（毎日変わる＝鮮度）。
    const [snap, season] = await Promise.all([getPlayersSnapshot(), getPlayerSeason(hub.mlbId)]);
    description = `${tagHubIntroJa(hub, season, seasonYear(snap), feed.length)}${updated ? `最終更新: ${updated}。` : ''}`;
  } else if (fighter && locale !== 'en') {
    // ファイタータグLP: 戦績・直近試合入りの導入文（fighters.ts の裏取り済みの値のみ）。
    description = `${fighterHubIntroJa(fighter, feed.length)}${updated ? `最終更新: ${updated}。` : ''}`;
  } else if (teamLp && locale !== 'en') {
    // チームタグLP: 所属日本人選手・地区順位・件数・最終更新入りの短縮文（毎日動く実データ＝鮮度）。
    const [snap, standing] = await Promise.all([getPlayersSnapshot(), standingOfTeam(teamLp.info.id)]);
    const jp = teamJpPlayers(snap, decoded);
    description = teamHubDescriptionJa(
      teamLp,
      seasonYear(snap),
      jp,
      feed.length,
      updated,
      standing ? standingPhraseJa(standing.row, standing.division) : undefined,
    );
  }
  const url = absoluteUrl(locale, `/tag/${encodeURIComponent(decoded)}`);
  // 薄い長尾タグ・汎用総称タグは noindex（ページは残すが検索対象から外す。sitemap 掲載条件と一致）。
  const indexable = isTagIndexable(decoded, feed.length);
  return {
    title,
    description,
    ...(indexable ? {} : { robots: { index: false } }),
    alternates: localeAlternates(locale, `/tag/${encodeURIComponent(decoded)}`),
    openGraph: { title: fullTitle, description, url, images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: OG_IMAGES_TW },
  };
}

/** JSON-LD の ItemList 用に、フィード1件の URL とタイトルを引く。 */
function itemOf(item: FeedItem, locale: Locale): { url: string; name: string } {
  return item.kind === 'thread'
    ? {
        url: absoluteUrl(locale, `/${item.thread.sport}/${item.thread.id}`),
        name: (locale === 'en' ? item.thread.title.en : item.thread.title.ja) || item.thread.title.ja,
      }
    : {
        url: absoluteUrl(locale, `/columns/${item.column.id}`),
        name: (locale === 'en' ? item.column.title.en : item.column.title.ja) || item.column.title.ja,
      };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ locale: Locale; tag: string }>;
}) {
  const { locale, tag } = await params;
  setRequestLocale(locale);
  const decoded = decodeURIComponent(tag);
  const t = await getTranslations();
  const feed = await getFeedByTag(decoded);
  if (feed.length === 0) notFound();

  const hub = tagHubOf(decoded);
  const fighter = hub ? null : fighterHubOf(decoded);
  const teamLp = hub || fighter ? null : teamLpOf(decoded, feed.length);
  const heading = await headingOf(locale, decoded, teamLp);
  // 選手・ファイタータグLP: 反応そのものを LP に直接載せるピックアップ＋LP同士の相互リンク網。
  // ピックアップは「その人に言及している声」だけを質の高い順に（tagHubVoices）。
  // 観測日誌（時系列の逐語引用）がある選手は声ピックアップを出さない＝同じ声が2度並ぶ重複を避け、
  // 日誌を LP の主役にする（2026-08-01 村山判断）。
  // 格闘技はキャリア観測日誌（fighter-journal）＝シーズン版と同じ型・同じ表示で1冊をキャリア通算で積む。
  const journal: PlayerJournalData | null = hub
    ? await getPlayerJournal(hub.slug)
    : fighter
      ? await getFighterJournal(fighter.slug)
      : null;
  let voices: TagVoice[] = [];
  let otherHubs: { player: Player; count: number }[] = [];
  let otherFighters: { fighter: Fighter; count: number }[] = [];
  if (hub) {
    // 日誌はja専用なので、enでは日誌選手でも声ピックアップを出す（enから声も日誌も消える穴を塞ぐ）。
    if (!journal || locale === 'en') voices = tagHubVoices(feed, hub);
    otherHubs = playerTagHubs(await getAllTags()).filter(({ player }) => player.slug !== hub.slug);
  } else if (fighter) {
    // 日誌があるファイターも選手LPと同じ扱い＝声ピックアップは出さない（同じ声が2度並ぶのを避ける）。
    if (!journal || locale === 'en') voices = tagHubVoices(feed, fighter);
    otherFighters = fighterTagHubs(await getAllTags()).filter(
      ({ fighter: f }) => f.slug !== fighter.slug,
    );
  }
  // 選手・チームタグLPの導入文（ja のみ。英語ページに和文の生成文を混ぜない）。
  let intro: string | undefined;
  let editorNote: EditorNote | null = null; // 編集部ノート（ja のみ。手書きの和文要約）
  let teamPlayers: Player[] = [];
  let hubTeam: TeamInfo | undefined; // 顔写真に添える所属チーム（ロゴ・カラー）。snapshot 由来＝移籍に自動追従。
  const statLines = new Map<string, string>(); // slug → 成績1行（所属日本人選手リンクに添える）
  // 「いま」ブロック（PlayerNow）用: 今季成績・試合別ログ・日本人WAR順位（すべて静的JSONの再表示）。
  let hubSeason: PlayerSeason | null = null;
  let hubGamelog: Gamelog | null = null;
  let hubJpRank: JpRank | null = null;
  let hubAsOf: string | undefined;
  if (hub) {
    // 所属は ja/en どちらのLPでも顔写真の横に出すので、導入文（ja のみ）と切り離して取る。
    const [snap, season, gamelog] = await Promise.all([
      getPlayersSnapshot(),
      getPlayerSeason(hub.mlbId),
      getGamelog(hub.mlbId),
    ]);
    hubTeam = getTeam(season?.team);
    hubSeason = season;
    hubGamelog = gamelog;
    hubJpRank = jpWarRank(snap, hub);
    hubAsOf = snap.asOf || undefined;
    if (locale !== 'en') {
      intro = tagHubIntroJa(hub, season, seasonYear(snap), feed.length);
      editorNote = await getEditorNote(hub.slug);
    }
  } else if (fighter && locale !== 'en') {
    intro = fighterHubIntroJa(fighter, feed.length);
    editorNote = await getEditorNote(fighter.slug);
  } else if (teamLp) {
    const [snap, standing] = await Promise.all([getPlayersSnapshot(), standingOfTeam(teamLp.info.id)]);
    teamPlayers = teamJpPlayers(snap, decoded);
    for (const p of teamPlayers) {
      const line = statLineOf(snap.players[String(p.mlbId)], locale);
      if (line) statLines.set(p.slug, line);
    }
    if (locale !== 'en') {
      intro = teamHubIntroJa(
        teamLp,
        seasonYear(snap),
        teamPlayers,
        teamHubTopics(feed.map(tagsOfItem), decoded, teamPlayers),
        feed.length,
        standing ? standingPhraseJa(standing.row, standing.division) : undefined,
      );
    }
  }

  const pageUrl = absoluteUrl(locale, `/tag/${encodeURIComponent(decoded)}`);
  const updatedIso = feed[0]?.date; // フィードは日付降順＝先頭が最新（最終更新のシグナル）
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: heading,
        url: pageUrl,
        ...(updatedIso ? { dateModified: updatedIso } : {}),
        // 選手タグはエンティティを明示（選手ハブの Person と同一人物として束ねる）。
        ...(hub
          ? {
              about: {
                '@type': ['Person', 'Athlete'],
                '@id': `${absoluteUrl(locale, `/player/${hub.slug}`)}#person`,
                name: hub.nameJa,
                alternateName: hub.nameEn,
                // ページに実際に出している公式顔写真（同じURL）＝エンティティの画像として明示する。
                image: headshotUrl(hub.mlbId, 'spot'),
                url: absoluteUrl(locale, `/player/${hub.slug}`),
                ...(hub.sameAs.length ? { sameAs: hub.sameAs } : {}),
              },
            }
          : {}),
        // ファイタータグも Person/Athlete で束ねる（Wikipedia 照合＝Knowledge Graph）。
        ...(fighter
          ? {
              about: {
                '@type': ['Person', 'Athlete'],
                '@id': `${pageUrl}#person`,
                name: fighter.nameJa,
                alternateName: fighter.nameEn,
                ...(fighter.sameAs.length ? { sameAs: fighter.sameAs } : {}),
              },
            }
          : {}),
        // チームタグは SportsTeam エンティティを明示（MLB 公式サイトと照合＝Knowledge Graph 束ね）。
        ...(teamLp
          ? {
              about: {
                '@type': 'SportsTeam',
                name: teamLp.info.nameFull,
                alternateName: [
                  teamLp.nameJa,
                  ...(teamLp.info.aliasJa ? [teamLp.info.aliasJa] : []),
                  teamLp.info.nameEn,
                ],
                sport: 'Baseball',
                logo: teamLogoUrl(teamLp.info.id),
                sameAs: [teamOfficialUrl(teamLp.info.slug)],
              },
            }
          : {}),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: feed.length,
          itemListElement: feed.slice(0, 25).map((item, i) => {
            const { url, name } = itemOf(item, locale);
            return { '@type': 'ListItem', position: i + 1, url, name };
          }),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          // ファイターLPは競技階層を挟む（Home > ボクシング > 井上尚弥）＝回遊と文脈の両方に効く。
          ...(fighter
            ? [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: sportLabel(fighter, locale),
                  item: absoluteUrl(locale, `/${fighter.sport}`),
                },
                { '@type': 'ListItem', position: 3, name: heading, item: pageUrl },
              ]
            : [{ '@type': 'ListItem', position: 2, name: heading, item: pageUrl }]),
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs
        items={[
          { name: t('nav.home'), href: '/' },
          ...(fighter ? [{ name: sportLabel(fighter, locale), href: `/${fighter.sport}` }] : []),
          { name: `#${decoded}` },
        ]}
      />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
          {t('tag.eyebrow')}
        </span>
        <div className="mt-2 flex items-center gap-4">
          {/* 選手タグLP: 顔写真＋所属チームのロゴ／カラー。「{選手名} 海外の反応」で来た人に
              “その人のページに来た”と一目で伝える（画像は MLB 公式CDNから直リンク＝再ホストしない）。
              チーム情報は snapshot 由来なので移籍しても自動で追従する。 */}
          {hub && (
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない） */}
              <img
                src={headshotUrl(hub.mlbId, 'spot')}
                alt={hubTeam ? `${heading}（${hubTeam.nameEn}）` : heading}
                width={64}
                height={64}
                className="h-14 w-14 rounded-full bg-paper object-cover sm:h-16 sm:w-16"
                style={hubTeam ? { boxShadow: `0 0 0 2px ${hubTeam.color}` } : undefined}
              />
              {hubTeam && (
                // eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク
                <img
                  src={teamLogoUrl(hubTeam.id)}
                  alt={hubTeam.nameEn}
                  width={24}
                  height={24}
                  loading="lazy"
                  className="absolute -bottom-1 -right-1 h-6 w-6 rounded-[2px] bg-surface object-contain p-0.5 ring-1 ring-line"
                />
              )}
            </div>
          )}
          {teamLp && (
            // eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク（再ホストしない）
            <img
              src={teamLogoUrl(teamLp.info.id)}
              alt={`${teamLp.info.nameEn} logo`}
              width={56}
              height={56}
              className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
            />
          )}
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">{heading}</h1>
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
          {intro ?? t('tag.lead', { tag: decoded })}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {t('tag.count', { count: feed.length })}
          {updatedIso && <span> ・ {t('tag.updated', { date: updatedIso.slice(0, 10) })}</span>}
        </p>

        {/* 成績ハブへの導線は「いま」ブロック（PlayerNow）のフッターに統合＝ヘッダーの1行リンクは廃止。 */}

        {/* ファイターLP: 競技一覧への1行リンクは廃止＝ファーストビューの逃げ導線になっていた
            （2026-08-03 村山判断）。競技への回遊はパンくず・記事カード経由で足りる。 */}

        {/* チームLP: 所属日本人選手の成績ハブへ（snapshot 由来＝ハブが必ず生成済みの選手のみ）。 */}
        {teamPlayers.length > 0 && (
          <div className="mt-5 divide-y divide-line border-y border-line">
            {teamPlayers.map((p) => (
              <Link
                key={p.slug}
                href={`/player/${p.slug}`}
                className="group flex items-center justify-between py-3.5 text-sm font-semibold text-ink transition-colors hover:text-ink-soft"
              >
                <span className="flex flex-col gap-0.5">
                  <span>{t('tag.statsHub', { name: locale === 'en' ? p.nameEn : p.nameJa })}</span>
                  {/* 今季成績1行（snapshot の公知の数値）＝リンク先（成績ハブ）の中身を予告する */}
                  {statLines.has(p.slug) && (
                    <span className="text-xs font-normal text-ink-mute">{statLines.get(p.slug)}</span>
                  )}
                </span>
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* チームLP: 地区順位表（CI が毎時更新する静的JSON。ライバルのLPへの回遊網も兼ねる）。 */}
      {teamLp && <TeamStandings teamId={teamLp.info.id} locale={locale} />}

      {/* 選手タグLP: 「いま」ブロック＝最新の山場の声＋総評＋スタットパネル。検索着地の
          第一意図「直近どう見られてる？」にファーストビューで答え、数字は成績ハブへの太い橋になる。
          日誌がない選手・en面ではスタットパネルだけに退化する（全選手LP共通）。 */}
      {hub && (
        <PlayerNow
          locale={locale}
          player={hub}
          season={hubSeason}
          gamelog={hubGamelog}
          jpRank={hubJpRank}
          asOf={hubAsOf}
          highlight={journal && locale !== 'en' ? journalLatestHighlight(journal) : null}
          editorNote={journal && locale !== 'en' ? editorNote : null}
          showJournalJump={Boolean(journal) && locale !== 'en'}
        />
      )}

      {/* ファイタータグLP: 「いま」ブロック＝最新の山場の声＋総評＋ビッグ数字（戦績・KO率・世界戦・P4P）。
          数値は fighters.ts の裏取り済みカタログの再表示（PlayerNow のファイター版・ja のみ）。 */}
      {fighter && locale !== 'en' && (
        <FighterNow
          fighter={fighter}
          highlight={journal ? journalLatestHighlight(journal) : null}
          editorNote={editorNote}
          showJournalJump={Boolean(journal)}
        />
      )}

      {/* 選手・ファイタータグLP: 反応そのものを LP に直接引用する（クエリ意図との一致＋記事追加ごとに入れ替わる鮮度）。 */}
      {(hub || fighter) && (
        <TagVoices
          voices={voices}
          locale={locale}
          label={t('tag.voices', {
            name: locale === 'en' ? (hub ?? fighter)!.nameEn : (hub ?? fighter)!.nameJa,
          })}
        />
      )}

      {/* 編集部ノート＝「海外でどう見られているか」の要約（ja のみ・手書き）。
          選手は「いま」（PlayerNow）、ファイターは FighterNow に吸収済みなので、
          ここに出すのは日誌なしの選手だけ。 */}
      {hub && !journal && editorNote && (
        <section className="space-y-5">
          <SectionHeading label={t('tag.editorNote', { name: (hub ?? fighter)!.nameJa })} />
          <div className="rounded-[3px] border border-line bg-surface p-5 sm:p-6">
            <p className="max-w-prose text-sm leading-relaxed text-ink">{editorNote.noteJa}</p>
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-mute">
              {t('tag.editorNoteBy')} ・ {t('tag.updated', { date: editorNote.updatedAt })}
            </p>
          </div>
        </section>
      )}

      {/* 選手タグLP: シーズン観測日誌＝海外の評価の推移を章立てで追う追記型セクション。
          記事が増えるたびに伸びる＝再着地した検索読者に「物語が進んでいる」継続性を見せる。
          日誌がある選手は声ピックアップの代わりにこれが LP の主役（ja のみ）。
          ファイターはキャリア観測日誌＝試合が年数回なのでシーズンでなくキャリア1冊で積む。 */}
      {(hub || fighter) && journal && locale !== 'en' && (
        <SeasonJournal
          journal={journal}
          variant={fighter ? 'career' : 'season'}
          label={t(
            fighter
              ? fighter.voiceScope === 'domestic'
                ? 'tag.careerJournalDomestic'
                : 'tag.careerJournal'
              : 'tag.journal',
            { name: (hub ?? fighter)!.nameJa },
          )}
        />
      )}

      {/* ファイターLP: 主要試合タイムライン＝「この試合の反応が読みたい」ナビ。公式スコアの
          事実行＋その試合の記事への直リンクで、「{選手名} {対戦相手} 海外の反応」の複合クエリも受ける。 */}
      {fighter && locale !== 'en' && fighter.fights.length > 0 && (
        <section className="space-y-5">
          <SectionHeading
            label={t(fighter.voiceScope === 'domestic' ? 'tag.fightsDomestic' : 'tag.fights', {
              name: fighter.nameJa,
            })}
          />
          <div className="divide-y divide-line border-y border-line">
            {fighter.fights.map((fight) => {
              const related = fightFeedItems(fight, feed);
              return (
                <div key={fight.date + fight.opponentEn} className="py-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-sm font-semibold text-ink">
                      vs {fight.opponentJa}
                      <span className="ml-2 text-xs font-normal text-ink-mute">{fight.venueJa}</span>
                    </p>
                    <span className="shrink-0 text-xs tabular-nums text-ink-mute">
                      {fightDateJa(fight.date)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-ink-soft">
                    {fight.resultJa}
                    {fight.noteJa && <span className="text-ink-mute"> — {fight.noteJa}</span>}
                  </p>
                  {related.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {related.map((item) => {
                        const { name } = itemOf(item, locale);
                        const href =
                          item.kind === 'thread'
                            ? `/${item.thread.sport}/${item.thread.id}`
                            : `/columns/${item.column.id}`;
                        return (
                          <li key={feedKey(item)}>
                            <Link
                              href={href}
                              className="group flex items-center gap-2 text-xs text-ink-soft transition-colors hover:text-ink"
                            >
                              <span aria-hidden className="shrink-0 text-ink-mute">
                                →
                              </span>
                              <span className="line-clamp-1">{name}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 記事一覧: 選手LPは日誌・いまブロックが主役になったので、カードは最新6件だけ。
          残りは軽い月別テキストのアーカイブに降格（大谷LPの78枚カード壁＝ページ重量問題も同時に解消）。 */}
      <section className="space-y-5">
        {hub && <SectionHeading label={t('tag.latestArticles')} count={feed.length} />}
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {(hub ? feed.slice(0, 6) : feed).map((item, i) => (
            <li key={feedKey(item)}>
              {/* 先頭カードだけ画像を LCP として先取り。 */}
              <FeedCard item={item} locale={locale} priority={i === 0} />
            </li>
          ))}
        </ul>
      </section>

      {hub && feed.length > 6 && (
        <section className="space-y-6">
          <SectionHeading label={t('tag.archive')} count={feed.length - 6} />
          {archiveMonthsOf(feed.slice(6)).map(({ month, items }) => (
            <div key={month}>
              <p className="border-b border-line pb-2 text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
                {monthLabel(month, locale)}
              </p>
              <ul className="divide-y divide-line">
                {items.map((item) => {
                  const { name } = itemOf(item, locale);
                  const href =
                    item.kind === 'thread'
                      ? `/${item.thread.sport}/${item.thread.id}`
                      : `/columns/${item.column.id}`;
                  return (
                    <li key={feedKey(item)}>
                      <Link
                        href={href}
                        className="group flex items-baseline gap-3 py-2.5 text-sm text-ink-soft transition-colors hover:text-ink"
                      >
                        <span className="shrink-0 text-xs tabular-nums text-ink-mute">
                          {Number(item.date.slice(5, 7))}/{Number(item.date.slice(8, 10))}
                        </span>
                        <span className="line-clamp-1">{name}</span>
                        <span
                          aria-hidden
                          className="ml-auto shrink-0 text-ink-mute transition-transform group-hover:translate-x-0.5"
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* 他ファイターの次戦＝LPを読み終えた読者の次の行き先（自分の次戦はヒーローに出ているので除く）。 */}
      {fighter && locale !== 'en' && <UpcomingFights excludeSlug={fighter.slug} />}

      {/* ファイターLP同士の相互リンク網（選手LPクラスタと同じ思想。まずは井上⇔中谷から）。 */}
      {fighter && otherFighters.length > 0 && (
        <section className="space-y-5">
          <SectionHeading label={t('tag.otherPlayers')} />
          <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4">
            {otherFighters.map(({ fighter: f, count }) => (
              <li key={f.slug}>
                <Link
                  href={`/tag/${encodeURIComponent(f.nameJa)}`}
                  className="group flex items-center justify-between gap-2 border-b border-line py-3 text-sm font-medium text-ink transition-colors hover:text-ink-soft"
                >
                  <span className="line-clamp-1">{locale === 'en' ? f.nameEn : f.nameJa}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-mute">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 選手タグLP同士の相互リンク網: 「{選手名} 海外の反応」は同型クエリ＝LP クラスタの内部リンクを密にする。 */}
      {hub && otherHubs.length > 0 && (
        <section className="space-y-5">
          <SectionHeading label={t('tag.otherPlayers')} />
          <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4">
            {otherHubs.map(({ player, count }) => (
              <li key={player.slug}>
                <Link
                  href={`/tag/${encodeURIComponent(player.nameJa)}`}
                  className="group flex items-center justify-between gap-2 border-b border-line py-3 text-sm font-medium text-ink transition-colors hover:text-ink-soft"
                >
                  <span className="line-clamp-1">
                    {locale === 'en' ? player.nameEn : player.nameJa}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-mute">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
