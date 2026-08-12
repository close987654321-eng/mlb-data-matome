import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getThreadsBySport } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import { eventBySlug, ORG_LABEL, type FightEvent } from '@/lib/events';
import { SPORT_INFO } from '@/lib/sports';
import { vodOffers } from '@/lib/vod';
import EventCountdown from '@/components/EventCountdown';
import EventTimeline from '@/components/EventTimeline';
import UpcomingFights from '@/components/UpcomingFights';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

/**
 * 軽量イベントページ（tier: 'standard'）の共通実装。/rizin5（手組みの祭り級特設ハブ）で
 * 実証した「開催前から1URLを育てる」型の量産版＝中身は events.ts のレジストリだけで立つ。
 *
 * 各大会のルートは3行スタブ:
 *   const route = createEventRoute('rizin-landmark16');
 *   export const generateMetadata = route.generateMetadata;
 *   export default route.Page;
 *
 * 狙うクエリは「{大会名} 対戦カード／チケット／視聴方法／いつ・どこ」。
 * 「{大会名} 結果」は結果まとめ記事（柱B の roundup タイトル規則）に譲る＝共食い防止。
 */
export function createEventRoute(slug: string) {
  const event = eventBySlug(slug);

  async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: Locale }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    if (!event) return {};
    // 「対戦カード・チケット・視聴方法」はこの型が正面から答えるクエリ形（layout の
    // template が「｜海外の反応」を後置する）。カタカナ等の検索表記は queryAliasJa で併記。
    const alias = event.queryAliasJa ? `（${event.queryAliasJa}）` : '';
    const title = `${event.nameJa}${alias} 対戦カード・チケット・視聴方法`;
    const description = `${event.dateLabelJa}${event.venueJa ? `・${event.venueJa}` : ''}${
      event.cityJa ? `（${event.cityJa}）` : ''
    }開催「${event.nameJa}」${
      event.queryAliasJa ? `（${event.queryAliasJa}）` : ''
    }の観戦ガイド。発表済みの対戦カード・チケット・視聴方法をこの1ページで追い、新情報が出るたび更新する。`;
    const url = absoluteUrl(locale, `/${event.slug}`);
    return {
      title,
      description,
      // OG 画像は必ず明示（Next の Metadata は openGraph を置換する＝渡し忘れると og:image ゼロ）。
      openGraph: { title, description, type: 'website', url, images: OG_IMAGES },
      twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
      alternates: localeAlternates(locale, `/${event.slug}`),
    };
  }

  async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    if (!event) notFound();
    const t = await getTranslations();
    const mmaLabel = locale === 'en' ? SPORT_INFO.mma.labelEn : SPORT_INFO.mma.labelJa;

    // この大会の反応記事（matchTags と記事 tags の一致で自動紐付け）。
    const tags = new Set(event.matchTags ?? []);
    const threads =
      tags.size === 0
        ? []
        : (await getThreadsBySport('mma')).filter((th) => th.tags?.some((tag) => tags.has(tag)));
    const feed = buildFeed(threads, []);

    // RIZIN の視聴CTAは vod.ts の現行販路フラグ（rizinPpv）を再利用＝販路の増減は vod.ts だけで完結。
    // BreakingDown は自社プラットフォーム（アフィ提携なし）なので公式サイトへの一次情報リンクのみ。
    const ppvServices = event.org === 'rizin' ? vodOffers('mma').filter((o) => o.rizinPpv) : [];

    const pageUrl = absoluteUrl(locale, `/${event.slug}`);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SportsEvent',
          name: event.nameJa,
          startDate: event.date,
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          ...(event.venueJa && {
            location: {
              '@type': 'Place',
              name: event.venueJa,
              ...(event.cityJa && {
                address: { '@type': 'PostalAddress', addressLocality: event.cityJa, addressCountry: 'JP' },
              }),
            },
          }),
          organizer: {
            '@type': 'Organization',
            name: event.org === 'rizin' ? 'RIZIN FIGHTING FEDERATION' : 'BreakingDown',
          },
          ...(event.cards &&
            event.cards.length > 0 && {
              competitor: event.cards.flatMap((c) =>
                c.matchJa.split(' vs ').map((name) => ({ '@type': 'Person', name: name.trim() })),
              ),
            }),
          ...(event.ticketOffer && {
            offers: {
              '@type': 'AggregateOffer',
              url: event.ticketOffer.url,
              priceCurrency: 'JPY',
              lowPrice: event.ticketOffer.lowPrice,
              highPrice: event.ticketOffer.highPrice,
              availability: 'https://schema.org/InStock',
              ...(event.ticketOffer.validFrom && { validFrom: event.ticketOffer.validFrom }),
            },
          }),
          url: pageUrl,
        },
        {
          '@type': 'CollectionPage',
          name: event.nameJa,
          url: pageUrl,
          dateModified: event.updatedAt,
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
            { '@type': 'ListItem', position: 2, name: mmaLabel, item: absoluteUrl(locale, '/mma') },
            { '@type': 'ListItem', position: 3, name: event.nameJa, item: pageUrl },
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
            { name: mmaLabel, href: '/mma' },
            { name: event.shortJa },
          ]}
        />

        {/* ヘッダー: 大会名・開催日・会場・カウントダウン */}
        <header className="space-y-3 border-b border-line pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
              {ORG_LABEL[event.org]}
            </span>
            <EventCountdown
              dateIso={event.date}
              daysLeftLabel={t.raw('events.daysLeft') as string}
              todayLabel={t('events.today')}
              doneLabel={t('events.done')}
            />
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">{event.nameJa}</h1>
          <p className="text-sm text-ink-soft">
            {event.dateLabelJa}
            {event.venueJa && <span> ・ {event.venueJa}</span>}
            {event.cityJa && <span>（{event.cityJa}）</span>}
          </p>
          {event.leadJa && <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{event.leadJa}</p>}
          <p className="text-xs text-ink-mute">{t('events.updatedLabel', { date: event.updatedAt })}</p>
        </header>

        {/* 対戦カード（発表済みのみ。未発表は未発表と正直に書く＝捏造しない） */}
        <section className="space-y-5">
          <SectionHeading label={t('events.cardsTitle')} count={event.cards?.length} />
          {event.cards && event.cards.length > 0 ? (
            <div className="divide-y divide-line border-y border-line">
              {event.cards.map((c) => (
                <div key={c.order} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3.5">
                  <span className="shrink-0 text-xs tabular-nums text-ink-mute">
                    {t('events.cardNo', { no: c.order })}
                  </span>
                  <span className="text-sm font-semibold text-ink">{c.matchJa}</span>
                  {c.noteJa && <span className="text-xs text-ink-mute">{c.noteJa}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{t('events.cardsTbd')}</p>
          )}
        </section>

        {/* チケット（裏取り済みのみ） */}
        {event.ticketsJa && (
          <section className="space-y-5">
            <SectionHeading label={t('events.ticketsTitle')} />
            <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{event.ticketsJa}</p>
          </section>
        )}

        {/* 視聴方法＝このページの成果地点。未発表期は「未発表」と書き、確定し次第更新する。 */}
        {(event.watchJa || ppvServices.length > 0 || event.officialUrl) && (
          <section id="watch" className="space-y-5">
            <SectionHeading label={t('events.watchTitle')} />
            {event.watchJa && (
              <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{event.watchJa}</p>
            )}
            {ppvServices.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {ppvServices.map((o) => (
                  <a
                    key={o.service}
                    href={o.href}
                    target="_blank"
                    rel="noopener nofollow sponsored"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="inline-flex items-center gap-1.5 rounded-[3px] bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
                  >
                    {o.impressionPixel && (
                      // eslint-disable-next-line @next/next/no-img-element -- 計測ピクセルは最適化しない（VodCta と同じ規律）
                      <img src={o.impressionPixel} alt="" width={1} height={1} loading="lazy" aria-hidden />
                    )}
                    {t('events.watchCta', { service: o.service })}
                    <span aria-hidden>→</span>
                  </a>
                ))}
              </div>
            )}
            {event.officialUrl && (
              <p className="text-sm">
                <a
                  href={event.officialUrl}
                  target="_blank"
                  rel="noopener"
                  className="text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
                >
                  {t('events.official')} →
                </a>
              </p>
            )}
          </section>
        )}

        {/* この大会の反応記事（matchTags で自動紐付け。無い間はセクションごと出さない） */}
        {feed.length > 0 && (
          <section className="space-y-5">
            <SectionHeading label={t('events.articles')} count={feed.length} />
            <FeedGrid items={feed} locale={locale} showSport={false} />
          </section>
        )}

        {/* サイト内の関連ページ（観測ページ・特集）。 */}
        {event.relatedJa && event.relatedJa.length > 0 && (
          <section className="space-y-2">
            <SectionHeading label={t('events.related')} />
            <ul className="space-y-1.5">
              {event.relatedJa.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:text-ink-soft hover:decoration-ink"
                  >
                    {r.labelJa} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 内部リンクの網: 次の試合（ファイターLP）と大会年表（他のイベントページ） */}
        {locale !== 'en' && <UpcomingFights sport="mma" />}
        <EventTimeline excludeSlug={event.slug} />
      </div>
    );
  }

  return { generateMetadata, Page };
}
