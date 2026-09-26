import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import {
  buildPostseasonFaq,
  currentRound,
  getPostseason,
  getPostseasonArchive,
  japaneseByTeam,
  postseasonReactions,
  roundName,
  teamLabel,
  type PostseasonData,
  type ReactionGroup,
} from '@/lib/postseason';
import { getAllThreads } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import { getAllTags } from '@/lib/tags';
import { teamHubOf, TEAM_HUB_MIN_ARTICLES } from '@/lib/teamHub';
import { getPlayersSnapshot } from '@/lib/playerStats';
import PostseasonNow from '@/components/PostseasonNow';
import PostseasonRace from '@/components/PostseasonRace';
import PostseasonBracket from '@/components/PostseasonBracket';
import FaqList from '@/components/FaqList';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { asOfShort } from '@/lib/boardSeo';
import { type Locale } from '@/lib/i18n';

/**
 * MLBポストシーズンの恒久ハブ（2026-09-26 新設）。
 *
 * 狙う検索: 「MLB ポストシーズン 組み合わせ/トーナメント表/日程/結果」「ワイルドカード 仕組み」
 * 「ポストシーズン 海外の反応」「{ラウンド} 海外の反応」。「ワイルドカード 順位」のような表を見に来る
 * クエリはポータルと順位表サイトの縄張りで、このサイトで取れるのは「海外の反応」を含む側（GSC実測で
 * クリックの72%）＝表は入口、主役は各ラウンドの海外の反応に置く。
 *
 * URL に年号を入れない（/mvp と同じ型）＝毎年同じURLが育つ。閉幕後は結果のアーカイブとして
 * 翌年9月まで残る（切り替えは scripts/fetch-mlb-stats.mjs postseason が9月1日に行う）。
 */
function copy(en: boolean, data: PostseasonData) {
  const y = data.season;
  const day = asOfShort(data.asOf, en);
  const cur = currentRound(data);
  const champ = data.champion ? teamLabel(data.champion.id, en) : null;
  if (en) {
    const state = champ
      ? `${champ} won the World Series.`
      : cur
        ? `${roundName(cur, true)} under way.`
        : 'The Wild Card race is down to the final games.';
    return {
      crumb: 'Postseason',
      eyebrow: `${y} MLB Postseason`,
      title: `${y} MLB Postseason Bracket & Overseas Reactions`,
      lead: 'The full 12-team bracket from the Wild Card Series to the World Series, with seeds, schedule and every game score, plus what overseas fans are saying about each round.',
      metaTitle: `${y} MLB Postseason Bracket & Results`,
      metaDesc: `${y} MLB postseason bracket${day ? ` (as of ${day})` : ''}. ${state} Seeds, schedule, results and overseas fan reactions for every round, plus how the Wild Card works.`,
    };
  }
  const state = champ
    ? `ワールドシリーズ優勝は${champ}。`
    : cur
      ? `いまは${roundName(cur, false)}の最中。`
      : 'ワイルドカード争いの最新順位と進出決定チーム、';
  return {
    crumb: 'ポストシーズン',
    eyebrow: `${y}年 MLBポストシーズン`,
    title: `MLBポストシーズン${y} トーナメント表と海外の反応`,
    lead: 'ワイルドカードシリーズからワールドシリーズまで、12球団の組み合わせ・シード・日程・試合ごとのスコアを1枚のトーナメント表にまとめました。各ラウンドの海外ファンの反応もこのページに集まります。',
    // layout が「｜海外の反応」を足すので25字以内。「組み合わせ」「結果」はこの時期に実際に打たれる語。
    metaTitle: `MLBポストシーズン${y} 組み合わせ・結果`,
    metaDesc: `${y}年MLBポストシーズンのトーナメント表${day ? `（${day}時点）` : ''}。${state}ワイルドカードシリーズからワールドシリーズまでの組み合わせ・日程・結果と、各ラウンドの海外ファンの反応。ワイルドカードの仕組みも。`,
  };
}

const REACTION_HEADING: Record<ReactionGroup['key'], { ja: string; en: string }> = {
  W: { ja: 'ワールドシリーズの海外の反応', en: 'World Series reactions' },
  L: { ja: 'リーグ優勝決定シリーズの海外の反応', en: 'Championship Series reactions' },
  D: { ja: '地区シリーズの海外の反応', en: 'Division Series reactions' },
  F: { ja: 'ワイルドカードシリーズの海外の反応', en: 'Wild Card Series reactions' },
  other: { ja: 'ポストシーズンの海外の反応', en: 'More postseason reactions' },
  race: { ja: 'ワイルドカード争いの海外の反応', en: 'Reactions from the Wild Card race' },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const data = await getPostseason();
  if (!data) return {};
  const c = copy(locale === 'en', data);
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    // openGraph/twitter はページ側で書くと layout の画像が消える（site.ts の注意書き）＝既定画像を渡す。
    openGraph: { title: c.metaTitle, description: c.metaDesc, type: 'website', url: absoluteUrl(locale, '/postseason'), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title: c.metaTitle, description: c.metaDesc, images: OG_IMAGES_TW },
    alternates: localeAlternates(locale, '/postseason'),
  };
}

export default async function PostseasonPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const data = await getPostseason();
  if (!data) notFound();
  const en = locale === 'en';
  const c = copy(en, data);

  const [all, tags, snap, archive] = await Promise.all([
    getAllThreads(),
    getAllTags(),
    getPlayersSnapshot(),
    getPostseasonArchive(data.season),
  ]);
  // チームLPに昇格済み（記事3件以上）のチームだけリンク化＝TeamStandings と同じ規律（薄いタグへ送らない）。
  const linkable = new Set(
    tags.filter(({ tag, count }) => count >= TEAM_HUB_MIN_ARTICLES && teamHubOf(tag)).map(({ tag }) => tag),
  );
  const jp = japaneseByTeam(snap);
  const faq = buildPostseasonFaq(data, jp);
  const groups = postseasonReactions(all, data.season);
  const reactionCount = groups.reduce((n, g) => n + g.threads.length, 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: c.title,
        description: c.metaDesc,
        url: absoluteUrl(locale, '/postseason'),
        ...(data.asOf ? { dateModified: data.asOf.slice(0, 10) } : {}),
      },
      // FAQPage は画面の「よくある質問」と同じ配列から組む＝表示と構造化データが食い違わない。
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: en ? item.q.en : item.q.ja,
          acceptedAnswer: { '@type': 'Answer', text: en ? item.a.en : item.a.ja },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: c.title, item: absoluteUrl(locale, '/postseason') },
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: c.crumb }]} />

      <PlayerHubNav />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">{c.eyebrow}</span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{c.title}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{c.lead}</p>
        {data.asOf && <p className="mt-1 text-xs text-ink-soft">{t('player.asOf', { date: data.asOf })}</p>}
      </section>

      <PostseasonNow data={data} locale={locale} />

      {/* レギュラーシーズン終盤だけ出る＝「ワイルドカード争い」で来た人に表の前で答える。 */}
      <PostseasonRace data={data} locale={locale} linkable={linkable} />

      <PostseasonBracket data={data} locale={locale} linkable={linkable} jp={jp} />

      {/* 主役＝各ラウンドの海外の反応。記事のタグ（src/lib/postseason.ts の POSTSEASON_TAGS）で自動的に集まる。 */}
      <section className="space-y-8">
        <div>
          <SectionHeading label={en ? 'Overseas reactions' : 'ポストシーズンの海外の反応'} count={reactionCount || undefined} lead />
          <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
            {en
              ? 'What overseas fans said, round by round. New rounds appear on top as the postseason moves on.'
              : '海外ファンがどう見たかを、ラウンドごとにまとめています。勝ち上がりが進むほど、新しいラウンドが上に積み上がります。'}
          </p>
        </div>
        {groups.length > 0 ? (
          groups.map((g) => (
            <div key={g.key}>
              <h3 className="mb-3 text-sm font-semibold text-ink">{en ? REACTION_HEADING[g.key].en : REACTION_HEADING[g.key].ja}</h3>
              <FeedGrid items={buildFeed(g.threads, [])} locale={locale} />
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-soft">{en ? 'Reaction articles will appear here as the games are played.' : '試合が進むごとに、ここに記事が並びます。'}</p>
        )}
      </section>

      <FaqList faq={faq} en={en} heading={en ? 'Postseason FAQ' : 'ポストシーズンのよくある質問'} />

      {archive.length > 0 && (
        <section>
          <SectionHeading label={en ? 'Past postseasons' : '過去のポストシーズン'} />
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            {archive.map((a) => {
              const ws = a.series.find((s) => s.round === 'W');
              const champ = ws && a.champion && (ws.top.id === a.champion.id ? ws.top : ws.bottom);
              const opp = ws && champ && (champ === ws.top ? ws.bottom : ws.top);
              return (
                <li key={a.season} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
                  <span className="w-14 shrink-0 font-semibold tabular-nums text-ink">{en ? a.season : `${a.season}年`}</span>
                  <span className="text-ink">
                    {a.champion ? (en ? `${teamLabel(a.champion.id, true)} won` : `${teamLabel(a.champion.id, false)}が優勝`) : ''}
                  </span>
                  {champ && opp?.id && (
                    <span className="text-ink-soft">
                      {en
                        ? `World Series ${champ.wins}-${opp.wins} vs ${teamLabel(opp.id, true)}`
                        : `ワールドシリーズ ${champ.wins}勝${opp.wins}敗 vs ${teamLabel(opp.id, false)}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
