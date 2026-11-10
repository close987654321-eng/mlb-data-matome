import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { NPB_PROSPECTS, prospectsOnTheMove } from '@/lib/npbPlayers';
import { getNpbStats } from '@/lib/npbStats';
import { POSTING_FACTS, POSTING_SOURCE, postingFactText } from '@/lib/postingSystem';
import { getStoveLeague, stoveActive } from '@/lib/stoveLeague';
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

/**
 * いまのオフの年（例: 2026＝2026年オフ）。ストーブリーグの期間だけ返す。
 * 「メジャー挑戦 2027」の年はここから組む（postingWatch.asOf の年だと、年が明けた1月に1年ずれる）。
 */
async function offseason(): Promise<number | null> {
  const stove = await getStoveLeague();
  return stove && stoveActive(stove) ? stove.season : null;
}

/** 手続きのいちばん進んだ段階（契約＞交渉開始＞申請＞容認＞権利行使の表明）。無ければ null。 */
function latestStep(p: (typeof NPB_PROSPECTS)[number]): 'signed' | 'talks' | 'filed' | 'approved' | 'declared' | null {
  const st = p.postingWatch?.steps;
  if (!st) return null;
  return (['signed', 'talks', 'filed', 'approved', 'declared'] as const).find((k) => st[k]) ?? null;
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
  // オフの間（ストーブリーグの期間）は「メジャー挑戦 日本人 {来季の年}」に寄せる。2026-11-10 に採った
  // 入力候補は「メジャー挑戦 日本人 2027」「メジャー挑戦 しそうな選手 2027」「メジャー挑戦 表明 一覧」＝
  // 来季の年で探されている。旧題「ポスティング候補2026」は年がずれ、海外FAの選手（髙橋光成）も外していた。
  const season = await offseason();
  const title = season
    ? en
      ? `Japanese Players Heading to MLB in ${season + 1}: Posting & International FA Tracker`
      : `メジャー挑戦する日本人選手${season + 1} 一覧｜ポスティング・海外FAの最新状況`
    : en
      ? `NPB Posting Watch${year ? ` ${year}` : ''} — Players on the MLB Radar`
      : `ポスティング候補${year ?? ''} — MLB挑戦が注目されるNPB選手`;
  const description = season
    ? en
      ? `${names.join(', ')} are moving to MLB after the ${season} season. Where each stands (approved, filed, talks open), reported suitors, projected contracts with sources, ${season} stats and overseas reactions — plus the names to watch for later winters.`
      : `${season}年オフに${names.join('・')}がポスティング・海外FAでメジャー挑戦へ動いている。容認・申請・交渉開始のどの段階か、関心球団、予想される契約（出典つき）、${season}年の成績、海外の反応を選手ごとに追う。来オフ以降の候補も一覧で。`
    : en
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
  const season = await offseason();
  // オフの間は h1 も検索の語に合わせる（ブランド名 NEXT MLB は上の小見出しとナビに残す）。
  const h1 = season ? t('prospects.h1', { year: season + 1 }) : t('prospects.indexTitle');
  const lead = season ? t('prospects.lead', { season }) : t('prospects.indexLead');
  const moverSlugs = new Set(movers.map((p) => p.slug));
  // 名簿は「今オフの挑戦者」と「来オフ以降の候補」に分ける（オフの間だけ。問いが違う＝
  // 前者は「いまどうなっているか」、後者は「次は誰か」）。
  const rosterGroups = season
    ? [
        { key: 'now', label: t('prospects.rosterTitle'), players: NPB_PROSPECTS.filter((p) => moverSlugs.has(p.slug)) },
        {
          key: 'next',
          label: t('prospects.rosterNext', { year: season + 2 }),
          players: NPB_PROSPECTS.filter((p) => !moverSlugs.has(p.slug)),
        },
      ].filter((g) => g.players.length)
    : [{ key: 'all', label: t('prospects.rosterTitle'), players: NPB_PROSPECTS }];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: h1,
        description: lead,
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
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">{h1}</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{lead}</p>
      </section>

      {/* 今オフ動く選手の比較表。名簿より先に置く＝オフの第一意図は「今年誰が出るのか」で、
          そこに答えてから個々の選手へ送る。 */}
      <ProspectBoard
        players={movers}
        stats={npb}
        locale={locale}
        heading={t('prospects.boardTitle', { season: season ?? movers[0]?.postingWatch?.asOf.slice(0, 4) ?? '' })}
        stepLabels={{
          declared: t('prospects.step.declared'),
          approved: t('prospects.step.approved'),
          filed: t('prospects.step.filed'),
          talks: t('prospects.step.talks'),
          signed: t('prospects.step.signed'),
        }}
        cols={{
          player: t('prospects.boardPlayer'),
          team: t('prospects.boardTeam'),
          route: t('prospects.boardRoute'),
          timing: t('prospects.boardTiming'),
          stats: t('prospects.boardStats'),
        }}
        routeLabels={{ posting: t('prospects.route.posting'), intlFa: t('prospects.route.intlFa') }}
        asOfLabel={npb.asOf ? t('prospects.statsAsOf', { date: npb.asOf }) : ''}
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

      {rosterGroups.map((g) => (
      <section key={g.key}>
        <div className="mb-5">
          <SectionHeading label={g.label} count={g.players.length} lead />
        </div>
        <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {g.players.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/prospects/${p.slug}`}
                className="group block border-b border-line pb-5 transition-colors hover:border-ink"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-lg font-bold text-ink transition-colors group-hover:text-ink-soft">
                    {en ? p.nameEn : p.nameJa}
                    <span className="ml-2 text-xs font-normal text-ink-soft">
                      {en ? p.nameJa : p.nameEn}
                    </span>
                  </h3>
                  <span aria-hidden className="shrink-0 text-ink-mute transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {en ? p.team.en : p.team.ja} · {en ? p.pos.en : p.pos.ja}
                  {/* 今オフ動く選手だけ一覧で立てる＝「誰が今年出るのか」をハブの時点で答える
                      （オフの検索意図はまず名簿ではなく“今年の顔ぶれ”）。ポスティングと海外FAは
                      道筋が違うので同じ看板にせず、海外FA権の保持者はその語で立てる。 */}
                  {latestStep(p) ? (
                    // 手続きが進んだ選手は、いまの段階を出す（申請済みの選手に「申請が有力」を残さない）。
                    <span className="ml-2 inline-flex items-center border border-ink px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                      {t(`prospects.step.${latestStep(p)!}`)}
                    </span>
                  ) : p.postingWatch?.level === 'expected' ? (
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
      ))}

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
        {season && (
          <>
            <Link href="/stove-league" className="text-ink-soft transition-colors hover:text-ink hover:underline">
              {en
                ? `MLB hot stove ${season}-${season + 1}: Japanese players, free agents and the calendar`
                : `MLBストーブリーグ${season}-${season + 1}：日本人選手の去就・日程・海外の反応`}{' '}
              <span aria-hidden>→</span>
            </Link>
            <Link href="/stove-league/fa" className="text-ink-soft transition-colors hover:text-ink hover:underline">
              {en ? 'MLB free agent rankings and status' : 'MLBのFAランキングと契約状況'} <span aria-hidden>→</span>
            </Link>
          </>
        )}
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
