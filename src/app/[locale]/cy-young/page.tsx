import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getCyYoungBoard } from '@/lib/cyYoungBoard';
import CyYoungBoard from '@/components/CyYoungBoard';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

/** ページ内の文言（インライン bilingual＝PitchArsenal と同じ流儀。messages は nav.cyYoung のみ）。 */
function copy(en: boolean, year: number | string) {
  return en
    ? {
        crumb: 'Cy Young Board',
        eyebrow: `${year} Season`,
        title: 'Cy Young Prediction Board',
        lead: 'Qualified starters ranked by a blended, within-league score (ERA + xERA, K-BB%, innings, WHIP, HR/9). A data-driven read on the AL & NL Cy Young races — with Shohei Ohtani, Yoshinobu Yamamoto and Japan’s rotation highlighted. Tap any name for the pitch-by-pitch breakdown.',
        metaTitle: `Cy Young Prediction Board | ${year}`,
        metaDesc: `A data-driven AL/NL Cy Young prediction — qualified starters scored by ERA, xERA, K-BB% and innings, with Ohtani, Yamamoto and Japan’s starters tracked.`,
      }
    : {
        crumb: 'サイヤング予測',
        eyebrow: `${year} シーズン`,
        title: 'サイ・ヤング賞 予測ボード',
        lead: '規定到達の先発を、防御率＋xERA・K-BB%・投球回・WHIP・被弾率でリーグ内スコア化した“予測ボード”。AL/NLのサイヤング争いをデータで読み、大谷翔平・山本由伸ら日本人投手の現在地も強調。名前をタップすると球種の設計図（徹底分析）へ。',
        metaTitle: `サイ・ヤング賞 予測ボード｜${year}`,
        metaDesc: `AL/NL別に規定投手を防御率・xERA・K-BB%・投球回で総合スコア化したサイヤング賞予測。大谷翔平・山本由伸ら日本人投手の現在地も追う。`,
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
    </div>
  );
}
