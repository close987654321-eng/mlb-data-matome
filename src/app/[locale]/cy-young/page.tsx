import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getCyYoungBoard } from '@/lib/cyYoungBoard';
import { getAllThreads } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import CyYoungBoard from '@/components/CyYoungBoard';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

// サイヤング賞レースの海外の反応記事を拾うタグ（表記ゆれ両対応）。
const CY_TAGS = ['サイ・ヤング賞', 'サイヤング賞'];

/** ページ内の文言（インライン bilingual＝PitchArsenal と同じ流儀。messages は nav.cyYoung のみ）。 */
function copy(en: boolean, year: number | string) {
  return en
    ? {
        crumb: 'Cy Young Board',
        eyebrow: `${year} Season`,
        title: 'Cy Young Prediction Board & Reactions',
        lead: 'Qualified starters ranked by a blended, within-league score (ERA + xERA, K-BB%, innings, WHIP, HR/9). A data-driven read on the AL & NL Cy Young races — with Shohei Ohtani, Yoshinobu Yamamoto and Japan’s rotation highlighted, plus overseas fan reactions. Tap any name for the pitch-by-pitch breakdown.',
        metaTitle: `Cy Young ${year} Prediction & Overseas Reactions | AL/NL Pitchers`,
        metaDesc: `Who wins the ${year} Cy Young? Qualified starters scored by ERA, xERA, K-BB% and innings across AL & NL — plus overseas fan reactions to Ohtani, Yamamoto and Japan’s starters.`,
      }
    : {
        crumb: 'サイヤング予測',
        eyebrow: `${year} シーズン`,
        title: 'サイ・ヤング賞 予測ボード＆海外の反応',
        lead: '規定到達の先発を、防御率＋xERA・K-BB%・投球回・WHIP・被弾率でリーグ内スコア化した“予測ボード”。ア・リーグ／ナ・リーグのサイヤング賞争いをデータで読み、大谷翔平・山本由伸ら日本人投手の現在地と、海外ファンの反応まで一枚に。名前をタップすると球種の設計図と海外の反応へ。',
        metaTitle: `サイ・ヤング賞 予測 ${year}｜AL/NL投手スコアランキング`,
        metaDesc: `${year}サイ・ヤング賞は誰が獲る？規定投手を防御率・xERA・K-BB%・投球回で総合スコア化したAL/NL予測ランキングと、大谷翔平・山本由伸ら日本人投手への海外の反応をまとめて。`,
      };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const board = await getCyYoungBoard();
  const c = copy(locale === 'en', board?.season ?? new Date().getFullYear());
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
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const board = await getCyYoungBoard();
  // データ未生成なら 404（cyyoung コマンド前）。通常はビルド時に data/cy-young-board.json が存在する。
  if (!board) notFound();
  const en = locale === 'en';
  const c = copy(en, board.season);

  // サイヤング賞レースの海外の反応（サイ・ヤング賞タグの記事）＝「サイヤング 海外の反応」の中身。
  const all = await getAllThreads();
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
      },
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
