import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import { getAllTags } from '@/lib/tags';
import { linkableFighterOf } from '@/lib/fighterHub';
import { RIZIN5, type Rizin5Fighter } from '@/lib/rizin5';
import { VOD_OFFERS } from '@/lib/vod';
import EventCountdown from '@/components/EventCountdown';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, SITE_URL } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

// 専用 OG（scripts/rizin5-og.mjs で生成）。縦カード流用ではなく 1200×630 を必ず渡す（site.ts の注意書き参照）。
const OG = { url: `${SITE_URL}/media/rizin5-og.jpg`, width: 1200, height: 630 } as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const title = t('rizin5.metaTitle');
  const description = t('rizin5.metaDesc');
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/rizin5'), images: [OG] },
    twitter: { card: 'summary_large_image', title, description, images: [OG.url] },
    alternates: localeAlternates(locale, '/rizin5'),
  };
}

/** カード内の選手1人ぶんの欄（写真・肩書き・戦績・直近の試合）。 */
function FighterColumn({
  fighter,
  recentLabel,
  lpTags,
}: {
  fighter: Rizin5Fighter;
  recentLabel: string;
  /** ファイターLPが生成済みのタグ集合（記事1件以上）。名前をLPへリンクする判定に使う */
  lpTags: Set<string>;
}) {
  // LP を持つ出場選手（平本蓮・朝倉未来など）は名前をLPへ。hub→LP の相互リンクで、
  // 大会ページで因縁を読んだ読者をその選手のキャリア観測日誌へ送る。
  const lp = linkableFighterOf(fighter.name, lpTags);
  return (
    <div className="flex-1 space-y-2">
      {fighter.photo && (
        <Image
          src={fighter.photo.src}
          alt={fighter.name}
          width={480}
          height={480}
          className="aspect-square w-full max-w-[220px] rounded-[3px] object-cover"
        />
      )}
      {lp ? (
        <p className="text-base font-bold text-ink">
          <Link
            href={`/tag/${encodeURIComponent(lp.nameJa)}`}
            className="group inline-flex items-center gap-1 underline decoration-line underline-offset-4 transition-colors hover:text-ink-soft hover:decoration-ink"
          >
            {fighter.name}
            <span aria-hidden className="text-sm transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </p>
      ) : (
        <p className="text-base font-bold text-ink">{fighter.name}</p>
      )}
      {fighter.noteJa && <p className="text-xs leading-relaxed text-ink-soft">{fighter.noteJa}</p>}
      {fighter.record && (
        <p className="text-xs text-ink">
          {fighter.record}
          <span className="text-ink-mute">（{fighter.recordAsOf}時点）</span>
        </p>
      )}
      {fighter.recentFights && fighter.recentFights.length > 0 && (
        <div className="border-t border-line pt-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-ink-mute">{recentLabel}</p>
          <ul className="mt-1 space-y-1">
            {fighter.recentFights.map((f) => (
              <li key={f.date + f.vsJa} className="flex gap-2 text-xs text-ink-soft">
                <span className="shrink-0 tabular-nums text-ink-mute">{f.date}</span>
                <span>
                  vs {f.vsJa}｜<span className="text-ink">{f.resultJa}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function Rizin5Page({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // 会期後は enabled=false で撤去（allstar と同じ期間限定ハブの作法）。
  if (!RIZIN5.enabled) notFound();
  const t = await getTranslations();
  const all = await getAllThreads();

  // この大会の反応まとめ（matchTags 付き記事が増えるたび自動で並ぶ＝hub-and-spoke の受け皿）。
  const reactionItems = buildFeed(
    all.filter((th) => (th.tags ?? []).some((tag) => RIZIN5.matchTags.includes(tag))),
    [],
  );

  // 視聴CTA: vod.ts の ABEMA 案件を参照＝アフィリエイト提携後の href 差し替えがここにも自動反映される。
  const abema = VOD_OFFERS.mma.find((o) => o.service === 'ABEMA' && o.href);

  // カード内の選手名をファイターLPへ張るための集合。LPは記事1件以上のタグにしか生成されない。
  const lpTags = new Set((await getAllTags()).map(({ tag }) => tag));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SportsEvent',
        name: RIZIN5.nameJa,
        startDate: `${RIZIN5.eventDate}T17:00:00+09:00`,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: RIZIN5.venueJa,
          address: { '@type': 'PostalAddress', addressLocality: '大阪市', addressRegion: '大阪府', addressCountry: 'JP' },
        },
        organizer: { '@type': 'Organization', name: 'RIZIN FIGHTING FEDERATION' },
        competitor: RIZIN5.cards.flatMap((c) => [
          { '@type': 'Person', name: c.left.name },
          { '@type': 'Person', name: c.right.name },
        ]),
        description: t('rizin5.metaDesc'),
        url: absoluteUrl(locale, '/rizin5'),
        image: OG.url,
      },
      {
        '@type': 'CollectionPage',
        name: t('rizin5.title'),
        description: t('rizin5.metaDesc'),
        url: absoluteUrl(locale, '/rizin5'),
        dateModified: RIZIN5.updatedAt,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: RIZIN5.nameJa, item: absoluteUrl(locale, '/rizin5') },
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: RIZIN5.nameJa }]} />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">{t('rizin5.eyebrow')}</span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{t('rizin5.title')}</h1>
        <p className="mt-3 text-sm text-ink">
          {RIZIN5.dateLabelJa} ／ {RIZIN5.venueJa} ／ {RIZIN5.doorLabelJa}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <EventCountdown
            dateIso={RIZIN5.eventDate}
            // {days} はクライアント側で置換するので raw のまま渡す（t() だと値不足でエラーになる）。
            daysLeftLabel={t.raw('rizin5.daysLeft') as string}
            todayLabel={t('rizin5.today')}
            doneLabel={t('rizin5.done')}
          />
          <span className="text-xs text-ink-soft">{t('rizin5.updatedLabel', { date: RIZIN5.updatedAt })}</span>
        </div>
      </section>

      {/* 導入の地の文（俺ボイス）＝このハブの編集の背骨。 */}
      <section className="max-w-prose space-y-4">
        {RIZIN5.introJa.map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-ink">
            {p}
          </p>
        ))}
      </section>

      {/* 対戦カードと因縁（全8試合）。 */}
      <section>
        <SectionHeading label={t('rizin5.cardsTitle')} count={RIZIN5.cards.length} lead />
        <div className="mt-4 space-y-6">
          {RIZIN5.cards.map((card) => (
            <article key={card.order} className="border border-line p-5 sm:p-6">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink-mute">
                {String(card.order).padStart(2, '0')} ／ {card.weightJa}
                {card.titleJa ? ` ／ ${card.titleJa}` : ''}
              </p>
              <h3 className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                {card.left.name} <span className="px-1 text-ink-mute">vs</span> {card.right.name}
              </h3>

              {/* 選手2欄（写真・戦績・直近の試合）。データの無い欄は自動で薄くなる。 */}
              <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:gap-8">
                <FighterColumn fighter={card.left} recentLabel={t('rizin5.recentLabel')} lpTags={lpTags} />
                <FighterColumn fighter={card.right} recentLabel={t('rizin5.recentLabel')} lpTags={lpTags} />
              </div>

              {card.feudJa && (
                <p className="mt-4 border border-ink/25 bg-ink/[0.03] px-3 py-2 text-xs leading-relaxed text-ink">
                  <span className="font-bold">{t('rizin5.feudLabel')}</span>｜{card.feudJa}
                </p>
              )}
              {card.story.length > 0 && (
                <div className="mt-4 max-w-prose space-y-3">
                  {card.story.map((p, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-ink">
                      {p}
                    </p>
                  ))}
                </div>
              )}
              {card.quotes && card.quotes.length > 0 && (
                <div className="mt-4 space-y-3">
                  {card.quotes.map((q, i) => (
                    <blockquote key={i} className="border-l-2 border-ink pl-4">
                      <p className="text-sm leading-relaxed text-ink">{q.text}</p>
                      <cite className="mt-1 block text-xs not-italic text-ink-soft">
                        {q.speaker}｜{q.source}
                      </cite>
                    </blockquote>
                  ))}
                </div>
              )}

              {/* 写真クレジット（CC ライセンスの帰属表示＝必須）。 */}
              {(() => {
                const credited = [card.left, card.right].flatMap((f) =>
                  f.photo ? [{ name: f.name, photo: f.photo }] : [],
                );
                if (credited.length === 0) return null;
                return (
                  <p className="mt-4 text-[11px] leading-relaxed text-ink-mute">
                    {t('rizin5.photoLabel')}:{' '}
                    {credited.map((c, i) => (
                      <span key={c.name}>
                        {i > 0 && ' ／ '}
                        {c.name}=
                        <a
                          href={c.photo.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:text-ink"
                        >
                          {c.photo.creditJa}
                        </a>
                      </span>
                    ))}
                  </p>
                );
              })()}
            </article>
          ))}
        </div>
      </section>

      {/* 視聴方法（未発表の間は正直にそう書く。提携確定後は vod.ts の href 差し替えが自動反映）。 */}
      <section id="watch">
        <SectionHeading label={t('rizin5.viewingTitle')} lead />
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{RIZIN5.viewing.noteJa}</p>
        {abema?.href && (
          <a
            href={abema.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
          >
            {t('rizin5.viewingCta', { service: abema.service })} <span aria-hidden>↗</span>
          </a>
        )}
      </section>

      {/* ロード・トゥ・9.10（新しい順・出来事の日付基準）。 */}
      <section id="road">
        <SectionHeading label={t('rizin5.roadTitle')} count={RIZIN5.road.length} lead />
        <ol className="mt-4 space-y-7 border-l border-line pl-5">
          {RIZIN5.road.map((entry) => (
            <li key={entry.date + entry.titleJa}>
              <time className="text-xs font-medium tracking-wide text-ink-mute">{entry.date}</time>
              <h3 className="mt-1 text-base font-bold text-ink">{entry.titleJa}</h3>
              <div className="mt-2 max-w-prose space-y-2">
                {entry.body.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink-soft">
                    {p}
                  </p>
                ))}
              </div>
              {entry.link &&
                (entry.link.internal ? (
                  <p className="mt-2 text-sm">
                    <Link
                      href={entry.link.href}
                      className="text-ink underline underline-offset-2 transition-colors hover:text-ink-soft"
                    >
                      {entry.link.labelJa} <span aria-hidden>→</span>
                    </Link>
                  </p>
                ) : (
                  <p className="mt-2 text-sm">
                    <a
                      href={entry.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink underline underline-offset-2 transition-colors hover:text-ink-soft"
                    >
                      {entry.link.labelJa} <span aria-hidden>↗</span>
                    </a>
                  </p>
                ))}
            </li>
          ))}
        </ol>
      </section>

      {/* この大会の反応まとめ（matchTags 付き記事の自動棚＝spoke 記事が増えるほど厚くなる）。 */}
      <section>
        <SectionHeading label={t('rizin5.reactionsTitle')} count={reactionItems.length || undefined} lead />
        {reactionItems.length > 0 ? (
          <div className="mt-3">
            <FeedGrid items={reactionItems} locale={locale} />
          </div>
        ) : (
          <p className="mt-1.5 max-w-prose text-sm text-ink-soft">{t('rizin5.reactionsEmpty')}</p>
        )}
      </section>

      <div className="space-y-1 border-t border-line pt-4">
        <p className="text-xs text-ink-soft">{t('rizin5.factNote')}</p>
      </div>
    </div>
  );
}
