import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getCyYoungBoard } from '@/lib/cyYoungBoard';
import { getAllThreads } from '@/lib/data';
import { BOARD_COLUMN_TAGS, columnsForBoard } from '@/lib/boardColumns';
import { buildFeed } from '@/lib/feed';
import CyYoungBoard from '@/components/CyYoungBoard';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import BoardColumns from '@/components/BoardColumns';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import {
  asOfShort,
  boardItemList,
  boardLeaders,
  jpRankPhrase,
  leadersPhrase,
  type BoardLeaders,
} from '@/lib/boardSeo';
import { type Locale } from '@/lib/i18n';

// サイヤング賞レースの海外の反応記事を拾うタグ（表記ゆれ両対応）。
const CY_TAGS = ['サイ・ヤング賞', 'サイヤング賞'];

/**
 * ページ内の文言（インライン bilingual＝PitchArsenal と同じ流儀。messages は nav.cyYoung のみ）。
 *
 * 題字・タイトルの主語は「候補」＝検索で実際に打たれる語（GSC実測の根拠は boardSeo.ts）。
 * 「予測」はスコアの性質を説明する語として残し、断定でないことは methodTitle 側で担保する。
 * 説明文には現在のトップと日本人最上位を実データから差し込む（毎日CIで動く＝鮮度も兼ねる）。
 */
function copy(en: boolean, year: number | string, leaders: BoardLeaders, asOf?: string) {
  const day = asOfShort(asOf, en);
  return en
    ? {
        crumb: 'Cy Young Board',
        eyebrow: `${year} Season`,
        title: `${year} Cy Young Candidates & Prediction Board`,
        lead: 'Qualified starters ranked by a blended, within-league score (ERA + xERA, K-BB%, innings, WHIP, HR/9). A data-driven read on the AL & NL Cy Young races — with Shohei Ohtani, Yoshinobu Yamamoto and Japan’s rotation highlighted, plus overseas fan reactions. Tap any row for the full breakdown.',
        metaTitle: `${year} Cy Young Candidates | AL/NL Pitcher Rankings`,
        metaDesc: `${year} Cy Young candidates, ranked${day ? ` (as of ${day})` : ''}. ${leadersPhrase(leaders, true)} ${jpRankPhrase(leaders, true)} Qualified starters scored by ERA, xERA, K-BB% and innings across AL & NL.`,
      }
    : {
        crumb: 'サイヤング予測',
        eyebrow: `${year} シーズン`,
        title: `サイ・ヤング賞候補 ${year} 予測ランキング`,
        lead: '規定投球回に到達した先発投手を、ERA・xERA・K-BB%・投球回・WHIP・HR/9をもとにリーグ内でスコア化した予測ランキング。ア・リーグとナ・リーグのサイ・ヤング賞争いを、大谷翔平・山本由伸ら日本人投手の順位や海外ファンの反応とあわせて追えます。気になる投手の行をタップすると詳細ページへ。',
        // layout が「｜海外の反応」を足すので、ここは25字以内に抑えて SERP で切られないようにする。
        // ア・リーグ/ナ・リーグ のリーグ別クエリはページ内 h2（表の見出し）が受ける。
        metaTitle: `サイ・ヤング賞候補 ${year} 予測ランキング`,
        // 先頭に検索語（候補・予測ランキング）、その直後に「いま誰が有力か」を置く＝スニペットの
        // 見える範囲でクエリに答えきる。指標の列挙は切られてもいい後半に回す。
        metaDesc: `${year}年サイ・ヤング賞候補の予測ランキング${day ? `（${day}時点）` : ''}。${leadersPhrase(leaders, false)}${jpRankPhrase(leaders, false)}防御率・xERA・K-BB%・投球回でリーグ内スコア化した順位と、海外ファンの反応。`,
      };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const board = await getCyYoungBoard();
  const en = locale === 'en';
  const c = copy(
    en,
    board?.season ?? new Date().getFullYear(),
    board ? boardLeaders(board, en) : { nl: null, al: null, jp: null },
    board?.asOf,
  );
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    openGraph: { title: c.metaTitle, description: c.metaDesc, type: 'website', url: absoluteUrl(locale, '/cy-young') },
    twitter: { card: 'summary_large_image', title: c.metaTitle, description: c.metaDesc },
    alternates: localeAlternates(locale, '/cy-young'),
  };
}

export default async function CyYoungPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const board = await getCyYoungBoard();
  // データ未生成なら 404（cyyoung コマンド前）。通常はビルド時に data/cy-young-board.json が存在する。
  if (!board) notFound();
  const en = locale === 'en';
  const leaders = boardLeaders(board, en);
  const c = copy(en, board.season, leaders, board.asOf);

  // サイヤング賞レースの海外の反応（サイ・ヤング賞タグの記事）＝「サイヤング 海外の反応」の中身。
  const [all, raceColumns] = await Promise.all([
    getAllThreads(),
    columnsForBoard(BOARD_COLUMN_TAGS.cyYoung),
  ]);
  const reactionItems = buildFeed(
    all.filter((th) => (th.tags ?? []).some((x) => CY_TAGS.includes(x))),
    [],
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: c.title,
        description: c.metaDesc,
        url: absoluteUrl(locale, '/cy-young'),
        ...(board.asOf ? { dateModified: board.asOf.slice(0, 10) } : {}),
      },
      // 「サイヤング賞 ランキング／順位」型のクエリに対して、このページが実際に順位表であることを
      // 機械可読で示す。列挙するのは実在の行だけ（各リーグ上位10）。
      boardItemList(board, en, (row) => absoluteUrl(locale, `/cy-young/${row.id}`), c.title),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: c.title, item: absoluteUrl(locale, '/cy-young') },
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
        {board.asOf && <p className="mt-1 text-xs text-ink-soft">{t('player.asOf', { date: board.asOf })}</p>}
      </section>

      <CyYoungBoard board={board} locale={locale} />

      <BoardColumns
        columns={raceColumns}
        locale={locale}
        heading={en ? 'Reading the race' : 'このレースの読み解き'}
        lead={
          en
            ? 'Why the order moved — our data columns on the award races, written from the same boards.'
            : '順位が動いた理由を、同じボードの数字から読み解いたコラム。表では分からない差分だけを書いています。'
        }
      />

      {/* サイヤング賞レースの海外の反応＝検索意図「サイヤング 海外の反応」の受け皿。記事が付くほど厚くなる。 */}
      <section>
        <SectionHeading
          label={en ? 'Overseas reactions to the Cy Young race' : 'サイヤング賞レースの海外の反応'}
          count={reactionItems.length || undefined}
          lead
        />
        <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">
          {en
            ? 'What overseas fans are saying about the Cy Young contenders — Ohtani, Yamamoto and the rest of the field.'
            : '大谷翔平・山本由伸らサイ・ヤング賞候補への海外ファンの反応まとめ。レースが動くたびに記事が増えます。'}
        </p>
        {reactionItems.length > 0 ? (
          <FeedGrid items={reactionItems} locale={locale} />
        ) : (
          <p className="text-sm text-ink-soft">
            {en ? 'Reaction articles will appear here as the race heats up.' : 'これから記事がここに並びます。'}
          </p>
        )}
      </section>
    </div>
  );
}
