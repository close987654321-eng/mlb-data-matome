import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllTags, getFeedByTag } from '@/lib/tags';
import { feedKey, type FeedItem } from '@/lib/feed';
import { tagHubOf, tagHubIntroJa } from '@/lib/tagHub';
import { getPlayerSeason, getPlayersSnapshot, seasonYear } from '@/lib/playerStats';
import FeedCard from '@/components/FeedCard';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export async function generateStaticParams() {
  const tags = await getAllTags();
  // タグは生（デコード済み）で渡す。Next がパスを URL エンコードする。
  return locales.flatMap((locale) => tags.map(({ tag }) => ({ locale, tag })));
}

/** タグLPの H1 ＝ meta title（選手タグは「{名前}の海外の反応まとめ」で KW を正面に）。 */
async function headingOf(locale: Locale, tag: string): Promise<string> {
  const hub = tagHubOf(tag);
  const t = await getTranslations({ locale });
  if (hub && locale === 'en') return `${hub.nameEn} — Overseas Fan Reactions`;
  return t('tag.heading', { tag });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; tag: string }>;
}): Promise<Metadata> {
  const { locale, tag } = await params;
  const decoded = decodeURIComponent(tag);
  const t = await getTranslations({ locale });
  const heading = await headingOf(locale, decoded);
  const hub = tagHubOf(decoded);
  // 選手タグLPは absolute でテンプレート接尾辞（｜海外の反応）を外す＝「海外の反応」の重複を避け、
  // 「{選手名} 海外の反応」クエリに正面から当てる title に固定する。
  const isJaHub = Boolean(hub) && locale !== 'en';
  const fullTitle = isJaHub ? `${decoded}の海外の反応まとめ【MLB現地ファンの声を日本語訳】` : heading;
  const title = isJaHub ? { absolute: fullTitle } : fullTitle;
  let description = t('tag.lead', { tag: decoded });
  if (hub && locale !== 'en') {
    // 選手タグLP: 実在の成績値入りの導入文をそのまま description に（毎日変わる＝鮮度）。
    const [snap, season, feed] = await Promise.all([
      getPlayersSnapshot(),
      getPlayerSeason(hub.mlbId),
      getFeedByTag(decoded),
    ]);
    const updated = feed[0]?.date.slice(0, 10);
    description = `${tagHubIntroJa(hub, season, seasonYear(snap), feed.length)}${updated ? `最終更新: ${updated}。` : ''}`;
  }
  const url = absoluteUrl(locale, `/tag/${encodeURIComponent(decoded)}`);
  return {
    title,
    description,
    alternates: localeAlternates(locale, `/tag/${encodeURIComponent(decoded)}`),
    openGraph: { title: fullTitle, description, url },
    twitter: { card: 'summary_large_image', title: fullTitle, description },
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
  unstable_setRequestLocale(locale);
  const decoded = decodeURIComponent(tag);
  const t = await getTranslations();
  const feed = await getFeedByTag(decoded);
  if (feed.length === 0) notFound();

  const heading = await headingOf(locale, decoded);
  const hub = tagHubOf(decoded);
  // 選手タグLPの導入文（ja のみ。英語ページに和文の生成文を混ぜない）。
  let intro: string | undefined;
  if (hub && locale !== 'en') {
    const [snap, season] = await Promise.all([getPlayersSnapshot(), getPlayerSeason(hub.mlbId)]);
    intro = tagHubIntroJa(hub, season, seasonYear(snap), feed.length);
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
                url: absoluteUrl(locale, `/player/${hub.slug}`),
                ...(hub.sameAs.length ? { sameAs: hub.sameAs } : {}),
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
          { '@type': 'ListItem', position: 2, name: heading, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: `#${decoded}` }]} />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
          {t('tag.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{heading}</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
          {intro ?? t('tag.lead', { tag: decoded })}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {t('tag.count', { count: feed.length })}
          {updatedIso && <span> ・ {t('tag.updated', { date: updatedIso.slice(0, 10) })}</span>}
        </p>

        {/* 役割分担の相互リンク: 反応まとめ（ここ）⇔ 成績・徹底分析（選手ハブ）。 */}
        {hub && (
          <Link
            href={`/player/${hub.slug}`}
            className="group mt-5 flex items-center justify-between border-y border-line py-3.5 text-sm font-semibold text-ink transition-colors hover:text-ink-soft"
          >
            <span>{t('tag.statsHub', { name: locale === 'en' ? hub.nameEn : hub.nameJa })}</span>
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        )}
      </section>

      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {feed.map((item, i) => (
          <li key={feedKey(item)}>
            {/* 先頭カードだけ画像を LCP として先取り。 */}
            <FeedCard item={item} locale={locale} priority={i === 0} />
          </li>
        ))}
      </ul>
    </div>
  );
}
