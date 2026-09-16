import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { NPB_PROSPECTS, prospectsOnTheMove } from '@/lib/npbPlayers';
import { getNpbStats } from '@/lib/npbStats';
import { POSTING_FACTS, POSTING_SOURCE, postingFactText } from '@/lib/postingSystem';
import ProspectBoard from '@/components/ProspectBoard';
import FaqList from '@/components/FaqList';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import SectionHeading from '@/components/SectionHeading';
import VodCta from '@/components/VodCta';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const en = locale === 'en';
  // ハブの SERP 文言はブランド名（NEXT MLB）でなく検索語で書く。オフに跳ねるのは
  // 「ポスティング {年}」「NPB MLB挑戦」系で、"NEXT MLB" では一致しない。h1・ナビの表記は
  // NEXT MLB のまま＝ブランドは維持し、meta だけ検索意図に寄せる（boardSeo.ts と同じ考え方）。
  // 年は postingWatch.asOf（手で更新する編集値）から取る＝ハードコードした年が古びるのを防ぐ。
  const posted = prospectsOnTheMove().filter((p) => p.postingWatch?.level === 'expected');
  const year = posted
    .map((p) => p.postingWatch!.asOf.slice(0, 4))
    .sort()
    .at(-1);
  const names = posted.map((p) => (en ? p.nameEn : p.nameJa));
  const title = en
    ? `NPB Posting Watch${year ? ` ${year}` : ''} — Players on the MLB Radar`
    : `ポスティング候補${year ?? ''} — MLB挑戦が注目されるNPB選手`;
  const description = en
    ? `${names.length ? `${names.join(', ')} and other ` : ''}NPB players MLB scouts are watching: posting reports with sources, ${year ?? ''} stats, and overseas reactions, player by player.`
    : `${names.length ? `${names.join('・')}ら、` : ''}ポスティングでのMLB挑戦が注目されるNPB選手のまとめ。ポスティング報道の時系列（出典つき）、${year ?? ''}年の成績、海外の反応を選手ごとに追う。`;
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/prospects'),
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/prospects'), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
  };
}

export default async function ProspectsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const en = locale === 'en';
  const npb = await getNpbStats();
  const movers = prospectsOnTheMove();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t('prospects.indexTitle'),
        description: t('prospects.indexLead'),
        url: absoluteUrl(locale, '/prospects'),
      },
      {
        '@type': 'ItemList',
        itemListElement: NPB_PROSPECTS.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: en ? p.nameEn : p.nameJa,
          url: absoluteUrl(locale, `/prospects/${p.slug}`),
        })),
      },
      // 制度の解説を FAQPage で出す。「ポスティングとは」「譲渡金 いくら」は選手名を伴わない
      // 一般クエリで、受け皿はこのハブしかない（選手LPに重ねると重複になる）。
      {
        '@type': 'FAQPage',
        mainEntity: POSTING_FACTS.map((f) => {
          const { q, a } = postingFactText(f, locale);
          return { '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } };
        }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t('prospects.indexTitle'), item: absoluteUrl(locale, '/prospects') },
        ],
      },
    ],
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: t('prospects.indexTitle') }]} />

      <PlayerHubNav />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
          {t('prospects.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{t('prospects.indexTitle')}</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{t('prospects.indexLead')}</p>
      </section>

      {/* 今オフ動く選手の比較表。名簿より先に置く＝オフの第一意図は「今年誰が出るのか」で、
          そこに答えてから個々の選手へ送る。 */}
      <ProspectBoard
        players={movers}
        stats={npb}
        locale={locale}
        heading={t('prospects.boardTitle')}
        cols={{
          player: t('prospects.boardPlayer'),
          team: t('prospects.boardTeam'),
          route: t('prospects.boardRoute'),
          timing: t('prospects.boardTiming'),
          stats: t('prospects.boardStats'),
        }}
        routeLabels={{ posting: t('prospects.route.posting'), intlFa: t('prospects.route.intlFa') }}
        asOfLabel={t('prospects.statsAsOf', { date: npb.asOf })}
      />

      {/* 制度の解説。選手LPに重ねず、ハブに1か所だけ置いて各LPから送る。
          見た目は /roy と同じ FaqList＝サイト内で「よくある質問」の形を1つに揃える。 */}
      <section className="space-y-2">
        <FaqList
          faq={POSTING_FACTS}
          en={en}
          heading={t('prospects.systemTitle')}
        />
        <p className="text-xs text-ink-soft">
          {t('prospects.systemSource')}{' '}
          <a
            href={POSTING_SOURCE.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline hover:text-ink"
          >
            {POSTING_SOURCE.name} <span aria-hidden>↗</span>
          </a>
        </p>
      </section>

      <section>
        <div className="mb-5">
          <SectionHeading label={t('prospects.rosterTitle')} count={NPB_PROSPECTS.length} lead />
        </div>
        <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {NPB_PROSPECTS.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/prospects/${p.slug}`}
                className="group block border-b border-line pb-5 transition-colors hover:border-ink"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-ink transition-colors group-hover:text-ink-soft">
                    {en ? p.nameEn : p.nameJa}
                    <span className="ml-2 text-xs font-normal text-ink-soft">
                      {en ? p.nameJa : p.nameEn}
                    </span>
                  </h2>
                  <span aria-hidden className="shrink-0 text-ink-mute transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {en ? p.team.en : p.team.ja} · {en ? p.pos.en : p.pos.ja}
                  {/* 今オフ動く選手だけ一覧で立てる＝「誰が今年出るのか」をハブの時点で答える
                      （オフの検索意図はまず名簿ではなく“今年の顔ぶれ”）。ポスティングと海外FAは
                      道筋が違うので同じ看板にせず、海外FA権の保持者はその語で立てる。 */}
                  {p.postingWatch?.level === 'expected' ? (
                    <span className="ml-2 inline-flex items-center border border-line px-1.5 py-0.5 text-[11px] text-ink">
                      {t('prospects.watchLevel.expected')}
                    </span>
                  ) : p.postingWatch?.route === 'intl-fa' ? (
                    <span className="ml-2 inline-flex items-center border border-line px-1.5 py-0.5 text-[11px] text-ink">
                      {t('prospects.route.intlFa')}
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">
                  {en ? p.mlbWatch.en : p.mlbWatch.ja}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 視聴ガイド。名鑑で「この選手を見たい」が立った直後に置く＝NPBの試合を実際に観る手段への唯一の導線。 */}
      <VodCta
        sport="npb"
        locale={locale}
        heading={t('vod.heading', { sport: 'NPB' })}
        prLabel={t('vod.pr')}
        watchLabel={t('vod.watch')}
        placement="hub"
      />

      {/* 回遊導線: 海外の反応・評価の記事一覧（/npb カテゴリ）＋ 現役MLB日本人ハブ（往復ファネル）。 */}
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/npb" className="text-ink-soft transition-colors hover:text-ink hover:underline">
          {t('prospects.toArticles')} <span aria-hidden>→</span>
        </Link>
        <Link href="/player" className="text-ink-soft transition-colors hover:text-ink hover:underline">
          {t('prospects.toMlbHub')} <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
