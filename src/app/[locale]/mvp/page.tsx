import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getMvpBoard } from '@/lib/mvpBoard';
import { getAllThreads } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import MvpBoard from '@/components/MvpBoard';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

// MVPレースの海外の反応記事を拾うタグ。
const MVP_TAGS = ['MVP'];

/** ページ内の文言（インライン bilingual＝CyYoungPage と同じ流儀。messages は nav.mvp のみ）。 */
function copy(en: boolean, year: number | string) {
  return en
    ? {
        crumb: 'MVP Board',
        eyebrow: `${year} Season`,
        title: 'MVP Prediction Board & Reactions',
        lead: 'Qualified hitters ranked by a blended, within-league score (wRC+ + xwOBA, home runs, baserunning, defense, WAR — two-way pitching WAR included). A data-driven read on the AL & NL MVP races — with Shohei Ohtani and Japan’s bats highlighted, plus overseas fan reactions. Tap any row for the full breakdown.',
        metaTitle: `MVP ${year} Prediction & Overseas Reactions | AL/NL Hitters`,
        metaDesc: `Who wins the ${year} MVP? Qualified hitters scored by wRC+, xwOBA, homers, baserunning, defense and WAR across AL & NL — plus overseas fan reactions to Ohtani and Japan’s hitters.`,
      }
    : {
        crumb: 'MVP予測',
        eyebrow: `${year} シーズン`,
        title: 'MVP 予測ボード＆海外の反応',
        lead: '規定打席に到達した打者を、wRC+・xwOBA・本塁打・走塁・守備・WARをもとにリーグ内でスコア化した予測ランキング（二刀流の大谷翔平は投手WARも合算）。ア・リーグとナ・リーグのMVP争いを、日本人打者の順位や海外ファンの反応とあわせて追えます。気になる打者の行をタップすると、打球の質・バットスピードまで分かる詳細ページへ。',
        metaTitle: `MVP 予測 ${year}｜AL/NL打者スコアランキング`,
        metaDesc: `${year}MVPは誰が獲る？規定打者をwRC+・xwOBA・本塁打・走塁・守備・WARで総合スコア化したAL/NL予測ランキングと、大谷翔平ら日本人打者への海外の反応をまとめて。`,
      };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const board = await getMvpBoard();
  const c = copy(locale === 'en', board?.season ?? new Date().getFullYear());
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    openGraph: { title: c.metaTitle, description: c.metaDesc, type: 'website', url: absoluteUrl(locale, '/mvp') },
    twitter: { card: 'summary_large_image', title: c.metaTitle, description: c.metaDesc },
    alternates: localeAlternates(locale, '/mvp'),
  };
}

export default async function MvpPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const board = await getMvpBoard();
  // データ未生成なら 404（mvp コマンド前）。通常はビルド時に data/mvp-board.json が存在する。
  if (!board) notFound();
  const en = locale === 'en';
  const c = copy(en, board.season);

  // MVPレースの海外の反応（MVPタグの記事）＝「MVP 海外の反応」の中身。
  const all = await getAllThreads();
  const reactionItems = buildFeed(
    all.filter((th) => (th.tags ?? []).some((x) => MVP_TAGS.includes(x))),
    [],
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: c.title,
        description: c.metaDesc,
        url: absoluteUrl(locale, '/mvp'),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: c.title, item: absoluteUrl(locale, '/mvp') },
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

      <MvpBoard board={board} locale={locale} />

      {/* MVPレースの海外の反応＝検索意図「MVP 海外の反応」の受け皿。記事が付くほど厚くなる。 */}
      <section>
        <SectionHeading
          label={en ? 'Overseas reactions to the MVP race' : 'MVPレースの海外の反応'}
          count={reactionItems.length || undefined}
          lead
        />
        <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">
          {en
            ? 'What overseas fans are saying about the MVP contenders — Ohtani and the rest of the field.'
            : '大谷翔平らMVP候補への海外ファンの反応まとめ。レースが動くたびに記事が増えます。'}
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
