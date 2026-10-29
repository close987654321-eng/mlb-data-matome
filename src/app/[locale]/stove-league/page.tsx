import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getPlayer } from '@/lib/players';
import { playerLabel } from '@/lib/playerNames';
import { prospectsOnTheMove, NPB_PROSPECTS } from '@/lib/npbPlayers';
import { getNpbStats, headlineStats } from '@/lib/npbStats';
import {
  getStoveLeague,
  getStoveStats,
  worldSeriesEnd,
  resolveDates,
  stoveThreads,
  voiceFor,
  rowStatus,
  teamPath,
  statLine,
  buildStoveFaq,
  ROUTE_LABEL,
} from '@/lib/stoveLeague';
import { buildFeed } from '@/lib/feed';
import StoveJapanese, { type StoveJpCard, type StoveNpbRow } from '@/components/StoveJapanese';
import StoveBoard, { type StoveBoardRow } from '@/components/StoveBoard';
import StoveDates from '@/components/StoveDates';
import FeedGrid from '@/components/FeedGrid';
import FaqList from '@/components/FaqList';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import SectionHeading from '@/components/SectionHeading';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** 「2026-27」＝米国の呼び方。日本の検索は「ストーブリーグ 2026」が主流なので title は前年側の年も前に出す。 */
const offseasonLabel = (season: number) => `${season}-${String((season + 1) % 100).padStart(2, '0')}`;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const cat = await getStoveLeague();
  if (!cat) return {};
  const en = locale === 'en';
  const off = offseasonLabel(cat.season);
  const names = cat.japanese.filter((j) => !j.outcome).map((j) => getPlayer(j.slug)).filter(Boolean);
  // title の語順は検索語の順に合わせる（「MLB ストーブリーグ 2026」「MLB FA 2026」「MLB 移籍」）。
  // layout の template が「｜海外の反応」を足すので、ここで同じ語を重ねない。
  const title = en
    ? `MLB Hot Stove ${off}: Free Agent Tracker & Japanese Players`
    : `MLBストーブリーグ${off} FA・移籍の最新情報と日本人の去就`;
  const description = en
    ? `Where ${names.map((p) => p!.nameEn).join(', ')} and the top MLB free agents stand this winter: status, 2026 stats, the offseason calendar up to the December 1 CBA deadline, and overseas fan reactions.`
    : `${names.map((p) => p!.nameJa).join('・')}ら日本人選手の去就と、スクーバルなどFA注目選手${cat.board.length}人の今季成績・現在地。FA解禁から12月1日の労使協定の期限までの日程、海外ファンの反応もまとめて追う（${cat.asOf.slice(5).replace('-', '/')}更新）。`;
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/stove-league'),
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/stove-league'), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
  };
}

export default async function StoveLeaguePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const cat = await getStoveLeague();
  if (!cat) notFound();
  const t = await getTranslations();
  const en = locale === 'en';
  const [stats, npb, all, wsEnd] = await Promise.all([
    getStoveStats(),
    getNpbStats(),
    getAllThreads(),
    worldSeriesEnd(cat.season),
  ]);
  const off = offseasonLabel(cat.season);
  const threads = stoveThreads(all, cat.season);
  const npbLine = (slug: string) => {
    const ns = npb.players[slug];
    if (!ns) return '';
    return headlineStats(ns, locale)
      .map((x) => (en ? `${x.label} ${x.value}` : `${x.label}${x.value}`))
      .join(en ? ', ' : '・');
  };
  const boardByJp = new Map(cat.board.filter((b) => b.jpSlug).map((b) => [b.jpSlug!, b]));
  const boardByProspect = new Map(cat.board.filter((b) => b.prospectSlug).map((b) => [b.prospectSlug!, b]));

  // ── 日本人（MLB組）
  const mlb: StoveJpCard[] = cat.japanese.flatMap((j) => {
    const p = getPlayer(j.slug);
    if (!p) return [];
    const s = stats.players[String(p.mlbId)];
    const voice = voiceFor(threads, p.nameJa);
    return [
      {
        href: `/player/${p.slug}`,
        name: { ja: p.nameJa, en: p.nameEn },
        team: teamPath({}, s),
        status: rowStatus(j.route, j.outcome, s),
        rank: boardByJp.get(j.slug)?.rank,
        headline: j.headline,
        statLine: statLine(s, en),
        latest: j.timeline[0],
        voice: voice
          ? {
              ja: voice.comment.bodyJa,
              author: voice.comment.author,
              href: `/${voice.thread.sport}/${voice.thread.id}`,
            }
          : undefined,
      },
    ];
  });

  // ── 日本人（NPB組）＝ NEXT MLB のカタログをそのまま使う（ポスティング報道の正は npbPlayers.ts）
  const npbRows: StoveNpbRow[] = prospectsOnTheMove().map((p) => {
    const w = p.postingWatch!;
    return {
      href: `/prospects/${p.slug}`,
      name: { ja: p.nameJa, en: p.nameEn },
      team: p.team,
      route: w.route === 'intl-fa' ? { ja: '海外FA', en: 'International FA' } : ROUTE_LABEL.posting,
      rank: boardByProspect.get(p.slug)?.rank,
      headline: w.headline,
      statLine: npbLine(p.slug) || undefined,
    };
  });

  // ── FA注目選手（MLB.com の順位順）
  const rows: StoveBoardRow[] = await Promise.all(
    cat.board.map(async (b) => {
      const s = b.mlbId ? stats.players[String(b.mlbId)] : undefined;
      const prospect = b.prospectSlug ? NPB_PROSPECTS.find((p) => p.slug === b.prospectSlug) : undefined;
      const jp = b.jpSlug ? getPlayer(b.jpSlug) : undefined;
      const label = jp || prospect ? null : await playerLabel(b.nameEn, { locale, mlbId: b.mlbId });
      const name = jp
        ? en ? jp.nameEn : jp.nameJa
        : prospect
          ? en ? prospect.nameEn : prospect.nameJa
          : label!.label;
      return {
        rank: b.rank,
        name,
        nameSub: en ? undefined : b.nameEn,
        href: jp ? `/player/${jp.slug}` : prospect ? `/prospects/${prospect.slug}` : undefined,
        japanese: Boolean(jp || prospect),
        pos: b.pos,
        team: teamPath(b, s),
        status: rowStatus(b.route, b.outcome, s),
        statLine: s ? statLine(s, en) : prospect ? npbLine(prospect.slug) : '',
        note: b.note,
      };
    }),
  );

  const dates = resolveDates(cat, wsEnd);
  const next = dates.find((d) => !d.past);
  const faq = buildStoveFaq(
    cat,
    Object.fromEntries(
      cat.japanese.map((j) => {
        const p = getPlayer(j.slug);
        return [j.slug, { ja: p?.nameJa ?? j.slug, en: p?.nameEn ?? j.slug }];
      }),
    ),
    wsEnd,
    prospectsOnTheMove().map((p) => ({ ja: p.nameJa, en: p.nameEn })),
  );

  const title = en ? `MLB Hot Stove ${off}` : `MLBストーブリーグ ${off}`;
  const url = absoluteUrl(locale, '/stove-league');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: title,
        url,
        dateModified: `${cat.asOf}T00:00:00+09:00`,
        ...(threads.length
          ? { relatedLink: threads.slice(0, 20).map((th) => absoluteUrl(locale, `/${th.sport}/${th.id}`)) }
          : {}),
      },
      {
        '@type': 'ItemList',
        name: en ? 'Top MLB free agents' : 'MLBのFA注目選手',
        itemListElement: rows.map((r) => ({
          '@type': 'ListItem',
          position: r.rank,
          name: r.name,
          ...(r.href ? { url: absoluteUrl(locale, r.href) } : {}),
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: en ? item.q.en : item.q.ja,
          acceptedAnswer: { '@type': 'Answer', text: en ? item.a.en : item.a.ja },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: title, item: url },
        ],
      },
    ],
  };

  const md = (iso: string) =>
    en
      ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      : `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日`;

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: title }]} />

      <PlayerHubNav />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">Hot Stove</span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          {en
            ? 'Where the Japanese players land this winter, how the top free agents stand, and what overseas fans are saying, on one page. The current CBA expires on December 1, so this offseason may move faster than usual.'
            : '今オフ、日本人選手はどこへ行くのか。FA注目選手の現在地と今季成績、海外ファンの反応を1ページで追います。現行の労使協定は12月1日に期限を迎えるため、今オフは例年より早く大型契約が決まる可能性があります。'}
        </p>
        <p className="mt-2 text-xs text-ink-mute">
          {en
            ? `Updated ${cat.asOf} · contract moves sync from MLB's official transactions every 3 hours (last change ${stats.asOf} JST)`
            : `${md(cat.asOf)}更新・契約の動きはMLB公式の取引記録から3時間ごとに反映（最終反映 ${stats.asOf}）`}
        </p>

        {/* いまの局面＝次の節目。「FA いつから」で来た人に、表を読む前に答える。 */}
        {next && (
          <div className="mt-5 border border-line bg-surface p-4">
            <p className="text-xs text-ink-mute">{en ? 'Next on the calendar' : '次の節目'}</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {next.on
                ? md(next.on)
                : next.afterWs === 1
                  ? en ? 'Day after the World Series' : 'ワールドシリーズ終了の翌日'
                  : en ? `${next.afterWs} days after the World Series` : `ワールドシリーズ終了の${next.afterWs}日後`}
              <span className="ml-2 font-normal text-ink-soft">{en ? next.en : next.ja}</span>
            </p>
          </div>
        )}

        <nav aria-label={en ? 'On this page' : 'このページの内容'} className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {[
            { href: '#japanese', ja: '日本人選手の去就', en: 'Japanese players' },
            { href: '#ranking', ja: 'FA注目選手ランキング', en: 'Top free agents' },
            { href: '#dates', ja: '日程・ロックアウト', en: 'Calendar & lockout' },
            { href: '#reactions', ja: '海外の反応', en: 'Reactions' },
            { href: '#faq', ja: 'よくある質問', en: 'FAQ' },
          ].map((l) => (
            <a key={l.href} href={l.href} className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              {en ? l.en : l.ja}
            </a>
          ))}
        </nav>
      </section>

      <StoveJapanese mlb={mlb} npb={npbRows} en={en} rankSource={en ? 'MLB.com' : 'MLB公式'} />

      <StoveBoard
        rows={rows}
        en={en}
        source={{ name: en ? cat.ranking.nameEn : cat.ranking.name, url: cat.ranking.url, date: cat.ranking.date }}
        statsAsOf={stats.asOf.slice(0, 10)}
      />

      <StoveDates dates={dates} en={en} />

      <section id="reactions" className="space-y-4">
        <div>
          <SectionHeading label={en ? 'Overseas reactions' : 'ストーブリーグの海外の反応'} count={threads.length || undefined} lead />
          <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
            {en
              ? 'What overseas fans are saying about free agency, opt-outs and postings, newest first.'
              : 'FA・オプトアウト・ポスティングの話題に、海外ファンがどう反応したか。新しい順に並びます。'}
          </p>
        </div>
        {threads.length > 0 ? (
          <FeedGrid items={buildFeed(threads, [])} locale={locale} />
        ) : (
          <p className="text-sm text-ink-soft">{en ? 'Articles will appear here as the winter moves.' : '動きがあるたびに、ここに記事が並びます。'}</p>
        )}
      </section>

      <div id="faq">
        <FaqList faq={faq} en={en} heading={en ? 'Hot stove FAQ' : 'ストーブリーグのよくある質問'} />
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <Link href="/prospects" className="text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'NPB posting candidates (NEXT MLB)' : 'NEXT MLB：ポスティング候補のNPB選手'} <span aria-hidden>→</span>
        </Link>
        <Link href="/player" className="text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Japanese MLB players: stats hub' : '日本人メジャーリーガーの成績一覧'} <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
