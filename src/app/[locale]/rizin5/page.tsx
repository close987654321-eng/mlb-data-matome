import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import { getAllTags } from '@/lib/tags';
import { linkableFighterOf } from '@/lib/fighterHub';
import { RIZIN5, currentPpvTier, type Rizin5Fighter } from '@/lib/rizin5';
import { SPORT_INFO } from '@/lib/sports';
import { vodOffers } from '@/lib/vod';
import { toEmbedUrl, youTubeId } from '@/lib/media';
import EventCountdown from '@/components/EventCountdown';
import LiteVideo from '@/components/LiteVideo';
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
      {/*
        写真のある選手と無い選手が同じ行に並ぶので、枠は必ず同じ正方形を出す。
        CC ライセンスの写真が存在しない選手（RIZIN勢は Commons に無いことが多い）は
        頭文字だけのタイルにする＝片方だけ絵が無くて左右が崩れるのを防ぐため。
      */}
      {fighter.photo ? (
        <Image
          src={fighter.photo.src}
          alt={fighter.name}
          width={512}
          height={512}
          sizes="220px"
          className="aspect-square w-full max-w-[220px] rounded-[3px] object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex aspect-square w-full max-w-[220px] items-center justify-center rounded-[3px] border border-line bg-ink/[0.04]"
        >
          <span className="text-5xl font-bold leading-none text-ink/20">{[...fighter.name][0]}</span>
        </div>
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
          {/* デビュー戦の選手は「◯◯時点」が意味を持たないので基準日を持たない（川端龍など）。 */}
          {fighter.recordAsOf && <span className="text-ink-mute">（{fighter.recordAsOf}時点）</span>}
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

  // 視聴CTA: vod.ts の mma 案件のうち RIZIN の PPV 販売実績がある販路だけ出す（判定は vod.ts の rizinPpv）。
  // 販路の増減も href のアフィリエイト差し替えも vod.ts 側だけで完結する。
  const ppvServices = vodOffers('mma').filter((o) => o.rizinPpv);
  // JSON-LD の offers は販売中の席種だけで組む（完売席を含めると価格レンジが実態とズレる）。
  const seatsOnSale = RIZIN5.tickets.seats.filter((s) => !s.soldOut);
  // いま買える PPV 券種（ビルド時点の JST）。CI の毎時デプロイで追従する＝販売期間の切り替わりは最大1時間ズレる。
  const ppvNow = currentPpvTier();
  const ppv = RIZIN5.viewing.ppv;

  // カード内の選手名をファイターLPへ張るための集合。LPは記事1件以上のタグにしか生成されない。
  const lpTags = new Set((await getAllTags()).map(({ tag }) => tag));

  const mmaLabel = locale === 'en' ? SPORT_INFO.mma.labelEn : SPORT_INFO.mma.labelJa;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SportsEvent',
        name: RIZIN5.nameJa,
        // 開始時刻は公式の「開場14:00／開始16:00予定」に追従（doorLabelJa とセットで直す）。
        startDate: `${RIZIN5.eventDate}T16:00:00+09:00`,
        eventStatus: 'https://schema.org/EventScheduled',
        // 現地観戦＋ABEMA PPV 生中継＝Mixed（PPV の offer を並べるため）。
        eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
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
        // offers＝現地チケット（公式の席種・価格の転記）＋ABEMA PPV（いま販売中の券種）。
        // 完売席を含めると価格レンジが実態とズレるので販売中だけで組む。
        offers: [
          ...(seatsOnSale.length > 0
            ? [
                {
                  '@type': 'AggregateOffer',
                  name: 'チケット（現地観戦）',
                  url: RIZIN5.tickets.links[0].href,
                  priceCurrency: 'JPY',
                  lowPrice: Math.min(...seatsOnSale.map((s) => s.price)),
                  highPrice: Math.max(...seatsOnSale.map((s) => s.price)),
                  offerCount: seatsOnSale.length,
                  availability: 'https://schema.org/LimitedAvailability',
                  validFrom: '2026-07-12T10:00:00+09:00',
                },
              ]
            : []),
          ...(ppvNow
            ? [
                {
                  '@type': 'Offer',
                  name: `ABEMA PPV ${ppvNow.nameJa}（ブラウザ購入）`,
                  url: ppv.buyUrl,
                  priceCurrency: 'JPY',
                  price: ppvNow.browser,
                  availability: 'https://schema.org/InStock',
                  validFrom: ppvNow.from,
                  validThrough: ppvNow.to,
                },
              ]
            : []),
        ],
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
        // 競技（MMA）を1階層挟む＝表示のパンくずと同じ形。/mma LP への内部リンクをこのハブからも張る。
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: mmaLabel, item: absoluteUrl(locale, '/mma') },
          { '@type': 'ListItem', position: 3, name: RIZIN5.nameJa, item: absoluteUrl(locale, '/rizin5') },
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
          { name: RIZIN5.nameJa },
        ]}
      />

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

      {/*
        公式映像（#official）。1本目＝トレーラーを大枠で主役に据える。
        ファサード（LiteVideo）なので、クリックするまでプレイヤー一式は読み込まれない＝
        大会ページの初期表示を重くせずに公式ビジュアルだけ見せられる。
        画像を転載しない代わりに公式の絵をここで出す、という設計の意図は rizin5.ts の Rizin5Video 参照。
      */}
      {RIZIN5.videos.length > 0 && (
        <section id="official">
          <SectionHeading label={t('rizin5.officialTitle')} lead />
          {(() => {
            const [hero, ...rest] = RIZIN5.videos;
            const heroEmbed = toEmbedUrl(hero.url);
            const heroId = youTubeId(hero.url);
            return (
              <>
                {heroEmbed && (
                  <figure className="mt-4">
                    <div className="relative aspect-video overflow-hidden rounded-[3px] bg-black">
                      <LiteVideo
                        embedUrl={heroEmbed}
                        thumbUrl={heroId ? `https://i.ytimg.com/vi/${heroId}/maxresdefault.jpg` : ''}
                        title={hero.titleJa}
                      />
                    </div>
                    <figcaption className="mt-2 text-xs leading-relaxed text-ink-soft">
                      {hero.titleJa}
                      {hero.noteJa && <span className="text-ink-mute">｜{hero.noteJa}</span>}
                    </figcaption>
                  </figure>
                )}
                {rest.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {rest.map((v) => (
                      <li key={v.url} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <time className="shrink-0 tabular-nums text-xs text-ink-mute">{v.date}</time>
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-ink underline underline-offset-2 transition-colors hover:text-ink-soft"
                        >
                          {v.titleJa} <span aria-hidden>↗</span>
                        </a>
                        {v.noteJa && <span className="text-xs text-ink-mute">{v.noteJa}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">{t('rizin5.officialNote')}</p>
              </>
            );
          })()}
        </section>
      )}

      {/*
        対戦カード一覧（#card-list）。下の詳細カードは1試合ずつが長いので、
        「全8試合を一目で見て、気になる試合へ飛ぶ」入口をここに置く＝
        「超RIZIN.5 対戦カード」クエリで来た読者が探している形そのもの。
      */}
      <section id="card-list">
        <SectionHeading label={t('rizin5.cardListTitle')} count={RIZIN5.cards.length} lead />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink/40 text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                <th className="py-2 pr-3 font-medium">{t('rizin5.cardListNo')}</th>
                <th className="py-2 pr-4 font-medium">{t('rizin5.cardListMatch')}</th>
                <th className="py-2 font-medium">{t('rizin5.cardListWeight')}</th>
              </tr>
            </thead>
            <tbody>
              {RIZIN5.cards.map((card) => (
                <tr key={card.order} className="border-b border-line align-top">
                  <td className="py-2.5 pr-3 tabular-nums text-ink-mute">
                    {String(card.order).padStart(2, '0')}
                  </td>
                  <td className="py-2.5 pr-4">
                    <a
                      href={`#fight-${card.order}`}
                      className="font-bold text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
                    >
                      {card.left.name} <span className="text-ink-mute">vs</span> {card.right.name}
                    </a>
                    {card.titleJa && (
                      <span className="mt-0.5 block text-xs text-ink-soft">{card.titleJa}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-xs text-ink-soft">{card.weightJa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 対戦カードと因縁（全8試合）。 */}
      <section>
        <SectionHeading label={t('rizin5.cardsTitle')} count={RIZIN5.cards.length} lead />
        <div className="mt-4 space-y-6">
          {RIZIN5.cards.map((card) => (
            <article
              key={card.order}
              id={`fight-${card.order}`}
              // 一覧表からのアンカー着地でヘッダーに潜らないよう余白を確保する。
              className="scroll-mt-20 border border-line p-5 sm:p-6"
            >
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

      {/* 視聴方法（未発表の間は正直にそう書き、直近大会のPPV実績で当たりを付けてもらう。提携確定後は vod.ts の href 差し替えが自動反映）。 */}
      <section id="watch">
        <SectionHeading label={t('rizin5.viewingTitle')} lead />
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{RIZIN5.viewing.noteJa}</p>

        {/* ABEMA PPV の確定情報（2026-08-17 発表）。券種×販売期間×価格の表＋いま買える券種の強調。値は公式リリースの転記のみ。 */}
        <div className="mt-5 border border-ink/40 p-4 sm:p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-ink-mute">{t('rizin5.ppvTitle')}</p>
          <p className="mt-1 text-base font-bold text-ink">{ppv.platformJa}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-mute">{t('rizin5.ppvOnSale')}</dt>
            <dd className="text-ink">{ppv.onSaleJa}</dd>
            <dt className="text-ink-mute">{t('rizin5.ppvStream')}</dt>
            <dd className="text-ink">{ppv.streamJa}</dd>
            <dt className="text-ink-mute">{t('rizin5.ppvArchive')}</dt>
            <dd className="text-ink">{ppv.archiveJa}</dd>
          </dl>
          {ppvNow && (
            <p className="mt-4 text-sm text-ink">
              <span className="mr-2 rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-paper">{t('rizin5.ppvNow')}</span>
              <span className="font-bold">{ppvNow.nameJa}</span>
              <span className="ml-2 tabular-nums">
                {t('rizin5.ppvBrowser')} {ppvNow.browser.toLocaleString('ja-JP')}円 ／ {t('rizin5.ppvApp')}{' '}
                {ppvNow.app.toLocaleString('ja-JP')}円
              </span>
              <span className="ml-2 text-xs text-ink-mute">（{ppvNow.periodJa}）</span>
            </p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink/40 text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                  <th className="py-2 pr-4 font-medium">{t('rizin5.ppvTier')}</th>
                  <th className="py-2 pr-4 font-medium">{t('rizin5.ppvPeriod')}</th>
                  <th className="py-2 pr-4 font-medium">{t('rizin5.ppvBrowser')}</th>
                  <th className="py-2 pr-4 font-medium">{t('rizin5.ppvApp')}</th>
                  <th className="py-2 font-medium">{t('rizin5.ppvSupport')}</th>
                </tr>
              </thead>
              <tbody>
                {ppv.tiers.map((tier) => {
                  const now = ppvNow?.nameJa === tier.nameJa;
                  return (
                    <tr key={tier.nameJa} className={`border-b border-line align-top ${now ? 'bg-ink/[0.04]' : ''}`}>
                      <td className="whitespace-nowrap py-2.5 pr-4 font-bold text-ink">{tier.nameJa}</td>
                      <td className="py-2.5 pr-4 text-ink-soft">{tier.periodJa}</td>
                      <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-ink">{tier.browser.toLocaleString('ja-JP')}円</td>
                      <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-ink">{tier.app.toLocaleString('ja-JP')}円</td>
                      <td className="whitespace-nowrap py-2.5 tabular-nums text-ink-soft">
                        {tier.supportBrowser.toLocaleString('ja-JP')}円 ／ {tier.supportApp.toLocaleString('ja-JP')}円
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-mute">
            {t('rizin5.ppvSupportNote', { fighters: ppv.supportFightersJa })}｜{ppv.supportNoteJa}
          </p>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink">
            <span className="font-bold">{t('rizin5.ppvCashback')}</span>｜{ppv.cashbackJa}
          </p>
          <ul className="mt-3 max-w-prose list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-soft">
            {ppv.extrasJa.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={ppv.buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
            >
              {t('rizin5.ppvBuy')} <span aria-hidden>↗</span>
            </a>
            <a href={ppv.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-mute underline-offset-2 hover:underline">
              {ppv.sourceLabelJa} ↗
            </a>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-ink-mute">
            {t('rizin5.viewingPastTitle')}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink/40 text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                  <th className="py-2 pr-4 font-medium">{t('rizin5.viewingPastEvent')}</th>
                  <th className="py-2 pr-4 font-medium">{t('rizin5.viewingPastPlatforms')}</th>
                  <th className="py-2 font-medium">{t('rizin5.viewingPastPrice')}</th>
                </tr>
              </thead>
              <tbody>
                {RIZIN5.viewing.pastPpv.map((row) => (
                  <tr key={row.eventJa} className="border-b border-line align-top">
                    <td className="whitespace-nowrap py-2.5 pr-4 font-bold text-ink">{row.eventJa}</td>
                    <td className="py-2.5 pr-4 text-ink">{row.platformsJa}</td>
                    <td className="py-2.5 text-ink-soft">{row.priceJa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-mute">{RIZIN5.viewing.pastPpvNoteJa}</p>
        </div>

        {/* 配信サービスへの導線。景表法ステマ規制対応＝PR明示＋rel=sponsored（VodCta と同じ規律・アフィ差し替え後もこのまま法令準拠）。 */}
        {ppvServices.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="w-full max-w-prose text-xs leading-relaxed text-ink-mute">{t('rizin5.viewingPremiumLead')}</p>
            <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
              {t('vod.pr')}
            </span>
            {ppvServices.map((o) => (
              <a
                key={o.service}
                href={o.href}
                target="_blank"
                rel="noopener nofollow sponsored"
                // もしも（スカパー!）のタグ仕様。既定の strict-origin だと参照元URLが落ちて成果計測を取りこぼす。
                referrerPolicy="no-referrer-when-downgrade"
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
              >
                {t('rizin5.viewingPremiumCta', { service: o.service })} <span aria-hidden>↗</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* チケット（現地観戦）。席種・価格は公式ページの転記＝残席が動くので「◯◯時点」を必ず出す。購入導線は公式＋プレイガイドの通常リンク（非アフィリエイト）。 */}
      <section id="tickets">
        <SectionHeading label={t('rizin5.ticketsTitle')} lead />
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink">{RIZIN5.tickets.statusJa}</p>
        <div className="mt-4 max-w-xl overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink/40 text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                <th className="py-2 pr-4 font-medium">{t('rizin5.ticketsSeat')}</th>
                <th className="py-2 pr-4 font-medium">{t('rizin5.ticketsPrice')}</th>
                <th className="py-2 font-medium">{t('rizin5.ticketsStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {RIZIN5.tickets.seats.map((seat) => (
                <tr key={seat.nameJa} className="border-b border-line">
                  <td className="py-2 pr-4 font-bold text-ink">{seat.nameJa}</td>
                  <td className="py-2 pr-4 tabular-nums text-ink">{seat.price.toLocaleString('ja-JP')}円</td>
                  <td className="py-2 text-xs">
                    {seat.soldOut ? (
                      <span className="text-ink-mute">{t('rizin5.ticketsSoldOut')}</span>
                    ) : (
                      <span className="font-medium text-ink">{t('rizin5.ticketsOnSale')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-mute">
          {t('rizin5.ticketsAsOf', { date: RIZIN5.tickets.asOfJa })}｜{RIZIN5.tickets.noteJa}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {RIZIN5.tickets.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-ink px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              {l.labelJa} <span aria-hidden>↗</span>
            </a>
          ))}
        </div>
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
