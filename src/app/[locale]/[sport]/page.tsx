import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getThreadsBySport } from '@/lib/data';
import { getColumnsBySport } from '@/lib/columns';
import { buildFeed, paginate, type FeedItem } from '@/lib/feed';
import { SPORTS, SPORT_INFO, isSport, type Sport } from '@/lib/sports';
import { sportHubOf, sportHubIntroJa } from '@/lib/sportHub';
import { getTagsBySport } from '@/lib/tags';
import FeedGrid from '@/components/FeedGrid';
import Pagination from '@/components/Pagination';
import PopularTags from '@/components/PopularTags';
import TeamHubLinks from '@/components/TeamHubLinks';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';
import type { Metadata } from 'next';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => SPORTS.map((sport) => ({ locale, sport })));
}

/** LP化した競技（sportHub）は KW を正面に置いた見出し、それ以外は競技ラベル。 */
function headingOf(locale: Locale, sport: Sport): string {
  const hub = sportHubOf(sport);
  const info = SPORT_INFO[sport];
  if (locale === 'en') return hub?.headingEn ?? info.labelEn;
  return hub?.headingJa ?? info.labelJa;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; sport: string }>;
}): Promise<Metadata> {
  const { locale, sport } = await params;
  if (!isSport(sport)) return {};
  const info = SPORT_INFO[sport];
  const label = locale === 'ja' ? info.labelJa : info.labelEn;
  const hub = sportHubOf(sport);
  if (!hub || locale === 'en') {
    return {
      // title.template が「｜海外の反応」を付けるので、ここでは競技名だけ（二重ブランド回避）。
      title: label,
      alternates: localeAlternates(locale, `/${sport}`),
    };
  }
  // 競技LP: 「{競技} 海外の反応」クエリに正面から当てる title（absolute でテンプレート接尾辞を
  // 外し「海外の反応」の重複を避ける）＋実データ入りの description（記事が増えるたび変わる＝鮮度）。
  const [threads, columns, tags] = await Promise.all([
    getThreadsBySport(sport),
    getColumnsBySport(sport),
    getTagsBySport(sport),
  ]);
  const feed = buildFeed(threads, columns);
  const updated = feed[0]?.date.slice(0, 10);
  const description = `${sportHubIntroJa(hub, tags, feed.length)}${updated ? `最終更新: ${updated}。` : ''}`;
  const url = absoluteUrl(locale, `/${sport}`);
  return {
    title: { absolute: hub.titleJa },
    description,
    alternates: localeAlternates(locale, `/${sport}`),
    openGraph: { title: hub.titleJa, description, url },
    twitter: { card: 'summary_large_image', title: hub.titleJa, description },
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

export default async function SportPage({
  params,
}: {
  params: Promise<{ locale: Locale; sport: string }>;
}) {
  const { locale, sport } = await params;
  setRequestLocale(locale);
  if (!isSport(sport)) notFound();
  const t = await getTranslations();
  const info = SPORT_INFO[sport];
  const hub = sportHubOf(sport);
  // 反応まとめとコラム／インタビューを競技ごとに統合し、新着順で1グリッドに出す。
  const [threads, columns] = await Promise.all([
    getThreadsBySport(sport),
    getColumnsBySport(sport),
  ]);
  // 1ページ目。2ページ目以降は /{sport}/p/N（実 URL）でクロール可能にする。
  const feed = buildFeed(threads, columns);
  const paged = paginate(feed, 1);

  const heading = headingOf(locale, sport);
  // 競技LPの導入文（ja のみ。英語ページに和文の生成文を混ぜない）。
  const intro =
    hub && locale !== 'en' ? sportHubIntroJa(hub, await getTagsBySport(sport), feed.length) : undefined;
  const updatedIso = feed[0]?.date; // フィードは日付降順＝先頭が最新（最終更新のシグナル）

  const pageUrl = absoluteUrl(locale, `/${sport}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: heading,
        url: pageUrl,
        ...(updatedIso ? { dateModified: updatedIso } : {}),
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
          { '@type': 'ListItem', position: 2, name: heading, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative overflow-hidden rounded-2xl">
        <Image
          src={info.heroImages[0]}
          alt=""
          width={1600}
          height={600}
          priority
          className="h-56 w-full object-cover sm:h-72"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="absolute bottom-0 left-0 p-6 text-white sm:p-8">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/80">
            {t('nav.reactions')}
          </span>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">{heading}</h1>
          <p className="mt-1 text-sm text-white/80">{info.subreddits.join(' · ')}</p>
        </div>
      </section>

      {intro && (
        <section className="border-b border-line pb-6">
          <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{intro}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {t('tag.count', { count: feed.length })}
            {updatedIso && <span> ・ {t('tag.updated', { date: updatedIso.slice(0, 10) })}</span>}
          </p>
        </section>
      )}

      <PopularTags sport={sport} />

      {/* 球団別チームLPへの導線（チームタグの無い競技では自動的に非表示）。 */}
      <TeamHubLinks sport={sport} />

      {feed.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          {t('threads.empty')}
        </p>
      ) : (
        <>
          <FeedGrid items={paged.items} locale={locale} showSport={false} />
          <Pagination basePath={`/${sport}`} page={1} totalPages={paged.totalPages} />
        </>
      )}
    </div>
  );
}
