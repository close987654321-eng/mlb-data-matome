import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getRoyBoard } from '@/lib/royBoard';
import { getAllThreads } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import { BOARD_COLUMN_TAGS, columnsForBoard } from '@/lib/boardColumns';
import { PLAYERS } from '@/lib/players';
import RoyBoard from '@/components/RoyBoard';
import BoardColumns from '@/components/BoardColumns';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { asOfShort, boardItemList, boardLeaders, jpRankPhrase, leadersPhrase, type BoardLeaders } from '@/lib/boardSeo';
import { type Locale } from '@/lib/i18n';

// 新人王レースの海外の反応記事を拾うタグ。
const ROY_TAGS = ['新人王'];

/**
 * ページ内の文言（インライン bilingual＝/cy-young・/mvp と同じ流儀。messages は nav.roy のみ）。
 *
 * 題字・タイトルの主語は「候補」＝検索で実際に打たれる語（根拠は boardSeo.ts）。/cy-young で
 * 「予測」だけの語彙だったのを「候補」に寄せて順位が 9.1→7.9 に動いた実績をそのまま踏襲する。
 */
function copy(en: boolean, year: number | string, leaders: BoardLeaders, asOf?: string) {
  const day = asOfShort(asOf, en);
  return en
    ? {
        crumb: 'Rookie of the Year Board',
        eyebrow: `${year} Season`,
        title: `${year} Rookie of the Year Candidates & Prediction Board`,
        lead: 'Rookie-eligible hitters and pitchers ranked together by a blended score — WAR as the shared currency across roles, plus wRC+/FIP and playing time within each role. A data-driven read on the AL & NL Rookie of the Year races, with Munetaka Murakami, Kazuma Okamoto and Tatsuya Imai highlighted, plus overseas fan reactions.',
        metaTitle: `${year} Rookie of the Year Candidates | AL/NL Rankings`,
        metaDesc: `${year} Rookie of the Year candidates, ranked${day ? ` (as of ${day})` : ''}. ${leadersPhrase(leaders, true)} ${jpRankPhrase(leaders, true)} Rookie hitters and pitchers scored together by WAR, wRC+/FIP and playing time across AL & NL.`,
      }
    : {
        crumb: '新人王予測',
        eyebrow: `${year} シーズン`,
        title: `新人王候補 ${year} 予測ランキング`,
        lead: 'ルーキー資格のある野手と投手を1つの表でスコア化した予測ランキング。WARを役割をまたぐ共通の物差しに置き、野手はwRC+と打席数、投手はFIPと投球回でリーグ内の位置を出しています。ア・リーグとナ・リーグの新人王争いを、村上宗隆・岡本和真・今井達也の順位や海外ファンの反応とあわせて追えます。',
        // layout が「｜海外の反応」を足すので、ここは25字以内に抑えて SERP で切られないようにする。
        // ア・リーグ/ナ・リーグ のリーグ別クエリはページ内 h2（表の見出し）が受ける。
        metaTitle: `新人王候補 ${year} 予測ランキング`,
        // 先頭に検索語（候補・予測ランキング）、その直後に「いま誰が有力か」を置く＝スニペットの
        // 見える範囲でクエリに答えきる。指標の列挙は切られてもいい後半に回す。
        metaDesc: `${year}年MLB新人王候補の予測ランキング${day ? `（${day}時点）` : ''}。${leadersPhrase(leaders, false)}${jpRankPhrase(leaders, false)}村上宗隆・岡本和真ら日本人ルーキーの順位と、WAR・wRC+・FIPでスコア化した順位表。`,
      };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const board = await getRoyBoard();
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
    openGraph: { title: c.metaTitle, description: c.metaDesc, type: 'website', url: absoluteUrl(locale, '/roy') },
    twitter: { card: 'summary_large_image', title: c.metaTitle, description: c.metaDesc },
    alternates: localeAlternates(locale, '/roy'),
  };
}

export default async function RoyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const board = await getRoyBoard();
  // データ未生成なら 404（roy コマンド前）。通常はビルド時に data/roy-board.json が存在する。
  if (!board) notFound();
  const en = locale === 'en';
  const leaders = boardLeaders(board, en);
  const c = copy(en, board.season, leaders, board.asOf);

  const [all, raceColumns] = await Promise.all([getAllThreads(), columnsForBoard(BOARD_COLUMN_TAGS.roy)]);
  const reactionItems = buildFeed(
    all.filter((th) => (th.tags ?? []).some((x) => ROY_TAGS.includes(x))),
    [],
  );

  // 新人王ボードは詳細ページを持たない（/cy-young・/mvp の詳細ページは索引方針を検討中＝面を増やさない）。
  // ItemList の url は選手ハブがある選手はそこへ、無い選手はリーグ表のアンカーへ向ける。
  const slugByMlbId = new Map(PLAYERS.map((p) => [p.mlbId, p.slug]));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: c.title,
        description: c.metaDesc,
        url: absoluteUrl(locale, '/roy'),
        ...(board.asOf ? { dateModified: board.asOf.slice(0, 10) } : {}),
      },
      boardItemList(
        board,
        en,
        (row) => {
          const slug = slugByMlbId.get(row.id);
          return slug ? absoluteUrl(locale, `/player/${slug}`) : absoluteUrl(locale, `/roy#${row.league.toLowerCase()}`);
        },
        c.title,
      ),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: c.title, item: absoluteUrl(locale, '/roy') },
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

      <RoyBoard board={board} locale={locale} />

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

      {/* 新人王レースの海外の反応＝検索意図「新人王 海外の反応」の受け皿。記事が付くほど厚くなる。 */}
      <section>
        <SectionHeading
          label={en ? 'Overseas reactions to the Rookie of the Year race' : '新人王レースの海外の反応'}
          count={reactionItems.length || undefined}
          lead
        />
        <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">
          {en
            ? 'What overseas fans are saying about the rookie class — Murakami, Okamoto and the rest of the field.'
            : '村上宗隆・岡本和真ら新人王候補への海外ファンの反応まとめ。レースが動くたびに記事が増えます。'}
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
