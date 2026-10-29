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
  worldSeriesState,
  resolveDates,
  stoveThreads,
  voiceFor,
  articleFor,
  rowStatus,
  teamPath,
  statLine,
  fmtDate,
  buildStoveFaq,
  ROUTE_LABEL,
} from '@/lib/stoveLeague';
import { headshotUrl } from '@/lib/teams';
import StoveJapanese, { StoveSummary, type StoveJpCard } from '@/components/StoveJapanese';
import StoveBoard, { type StoveBoardRow } from '@/components/StoveBoard';
import StoveDates from '@/components/StoveDates';
import StoveReactions from '@/components/StoveReactions';
import ShareButtons from '@/components/ShareButtons';
import FaqList from '@/components/FaqList';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
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
  const [stats, npb, all, wsEnd, ws] = await Promise.all([
    getStoveStats(),
    getNpbStats(),
    getAllThreads(),
    worldSeriesEnd(cat.season),
    worldSeriesState(cat.season),
  ]);
  const off = offseasonLabel(cat.season);
  const threads = stoveThreads(all, cat.season);
  // ワールドシリーズが決着するまでは「FA予定」（まだFAではないものをFAと書かない）。
  const faOpen = Boolean(wsEnd);
  const npbLine = (slug: string) => {
    const ns = npb.players[slug];
    if (!ns) return '';
    return headlineStats(ns, locale)
      .map((x) => (en ? `${x.label} ${x.value}` : `${x.label}${x.value}`))
      .join(en ? ', ' : '・');
  };
  const boardByJp = new Map(cat.board.filter((b) => b.jpSlug).map((b) => [b.jpSlug!, b]));
  const boardByProspect = new Map(cat.board.filter((b) => b.prospectSlug).map((b) => [b.prospectSlug!, b]));
  const voiceOf = (nameJa: string) => {
    const v = voiceFor(threads, nameJa);
    return v ? { ja: v.comment.bodyJa, author: v.comment.author, href: `/${v.thread.sport}/${v.thread.id}` } : undefined;
  };

  // ── 日本人（MLB組）
  const mlbCards: StoveJpCard[] = cat.japanese.flatMap((j) => {
    const p = getPlayer(j.slug);
    if (!p) return [];
    const s = stats.players[String(p.mlbId)];
    const status = rowStatus(j.route, j.outcome, s, faOpen);
    // オプトアウト権の選手は、行使するまで「どこへ行くか」は問いにならない＝関心球団の欄は判断待ちと出す。
    const decided = j.route !== 'opt-out' || s?.moves.some((m) => m.type === 'Declared Free Agency');
    return [
      {
        anchor: `jp-${p.slug}`,
        href: `/player/${p.slug}`,
        name: { ja: p.nameJa, en: p.nameEn },
        photo: headshotUrl(p.mlbId, 'spot'),
        team: teamPath({}, s),
        status,
        rank: boardByJp.get(j.slug)?.rank,
        headline: j.headline,
        statLine: statLine(s, en),
        suitors: decided ? (j.suitors ?? []) : undefined,
        voice: voiceOf(p.nameJa),
        group: 'mlb' as const,
      },
    ];
  });

  // ── 日本人（NPB組）＝ NEXT MLB のカタログをそのまま使う（ポスティング報道の正は npbPlayers.ts）
  const npbCards: StoveJpCard[] = prospectsOnTheMove().map((p) => {
    const w = p.postingWatch!;
    return {
      anchor: `jp-${p.slug}`,
      href: `/prospects/${p.slug}`,
      name: { ja: p.nameJa, en: p.nameEn },
      team: p.team,
      status: { label: w.route === 'intl-fa' ? { ja: '海外FA', en: 'International FA' } : ROUTE_LABEL.posting, done: false },
      rank: boardByProspect.get(p.slug)?.rank,
      headline: w.headline,
      statLine: npbLine(p.slug),
      suitors: w.suitors ?? [],
      voice: voiceOf(p.nameJa),
      group: 'npb' as const,
    };
  });
  const jpCards = [...mlbCards, ...npbCards];

  // ── FA注目選手（MLB.com の順位順）
  const rows: StoveBoardRow[] = await Promise.all(
    cat.board.map(async (b) => {
      const s = b.mlbId ? stats.players[String(b.mlbId)] : undefined;
      const prospect = b.prospectSlug ? NPB_PROSPECTS.find((p) => p.slug === b.prospectSlug) : undefined;
      const jp = b.jpSlug ? getPlayer(b.jpSlug) : undefined;
      // 記事のタグは日本語＝en ページでも日本語表記で引く。
      const labelJa = jp || prospect ? null : (await playerLabel(b.nameEn, { locale: 'ja', mlbId: b.mlbId })).label;
      const label = jp || prospect ? null : await playerLabel(b.nameEn, { locale, mlbId: b.mlbId });
      const article = labelJa ? articleFor(threads, labelJa) : null;
      const name = jp
        ? en ? jp.nameEn : jp.nameJa
        : prospect
          ? en ? prospect.nameEn : prospect.nameJa
          : label!.label;
      return {
        rank: b.rank,
        name,
        nameSub: en ? undefined : b.nameEn,
        href: jp ? `/player/${jp.slug}` : prospect ? `/prospects/${prospect.slug}` : article ? `/${article.sport}/${article.id}` : undefined,
        hrefIsArticle: !jp && !prospect && Boolean(article),
        photo: b.mlbId ? headshotUrl(b.mlbId, 'spot') : undefined,
        japanese: Boolean(jp || prospect),
        pos: b.pos,
        team: teamPath(b, s),
        status: rowStatus(b.route, b.outcome, s, faOpen),
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
          ...(r.href && !r.hrefIsArticle ? { url: absoluteUrl(locale, r.href) } : {}),
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

  // 「次の節目」。ワールドシリーズ中は「あと何勝で決着か」が「FA いつから」への答えになる。
  const wsLine = (() => {
    if (!ws || ws.done || !ws.lead || !ws.trail) return null;
    const tied = ws.lead.wins === ws.trail.wins;
    const nextGame = ws.next
      ? en
        ? ` ${ws.next.n ? `Game ${ws.next.n}` : 'The next game'} is on ${fmtDate(ws.next.jst, true)} (JST).`
        : `次の${ws.next.n ? `第${ws.next.n}戦` : '試合'}は${fmtDate(ws.next.jst, false)}。`
      : '';
    if (tied) {
      return en
        ? `The World Series is tied ${ws.lead.wins}-${ws.trail.wins}.${nextGame} Free agency opens the day after it ends.`
        : `ワールドシリーズは${ws.lead.wins}勝${ws.trail.wins}敗のタイ。${nextGame}決着の翌日にFAが解禁される。`;
    }
    const clinch = ws.lead.wins === 3;
    return en
      ? `${ws.lead.en} lead the World Series ${ws.lead.wins}-${ws.trail.wins}.${nextGame}${clinch ? ` One more win ends it, and free agency opens the next day.` : ' Free agency opens the day after it ends.'}`
      : `ワールドシリーズは${ws.lead.ja}が${ws.lead.wins}勝${ws.trail.wins}敗でリード。${nextGame}${clinch ? `${ws.lead.ja}があと1勝すれば決着し、その翌日にFAが解禁される。` : '決着の翌日にFAが解禁される。'}`;
  })();
  const asOfJa = `${fmtDate(cat.asOf, en)}`;
  const statsAsOf = stats.asOf ? `${fmtDate(stats.asOf.slice(0, 10), en)} ${stats.asOf.slice(11, 16).replace(/^0/, '')}` : '';

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="space-y-4">
        <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: title }]} />
        <PlayerHubNav />
      </div>

      <section className="space-y-5">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">Hot Stove</span>
          {/* 「ストーブリーグ」の途中で折り返さない（スマホで「MLBストーブ／リーグ」になっていた）。 */}
          <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
            MLB<span className="inline-block">{en ? ' Hot Stove' : 'ストーブリーグ'}</span>{' '}
            <span className="inline-block">{off}</span>
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
            {en
              ? 'Where the Japanese players land this winter, the top free agents, and what overseas fans are saying.'
              : '日本人選手の去就、FA注目選手の現在地、海外ファンの反応を1ページで追います。'}
          </p>
          <p className="mt-1 text-xs text-ink-mute">
            {en
              ? `Updated ${asOfJa} · signings sync from MLB every 3 hours`
              : `${asOfJa}更新・契約の動きはMLB公式の記録から3時間ごとに自動で反映`}
          </p>
        </div>

      </section>

      {/* 第一の問い「日本人は誰が、どうなるのか」に、見出しのすぐ下で答える。 */}
      <StoveSummary cards={jpCards} en={en} rankSource={en ? 'MLB.com' : 'MLB公式'} />

      <div className="space-y-4">
        {/* 次の節目。ワールドシリーズ中はその状況、決着後は日程の次の行と、それが日本人の誰に関わるか。 */}
        {(wsLine || next) && (
          <div className="border border-line bg-surface p-4">
            <p className="text-xs text-ink-mute">{en ? 'Next up' : '次の節目'}</p>
            {wsLine ? (
              <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">{wsLine}</p>
            ) : next ? (
              <>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {next.on ? fmtDate(next.on, en) : ''}
                  {next.time && <span className="ml-1.5 font-normal text-ink-soft">{en ? next.time.en : next.time.ja}</span>}
                  <span className="ml-2 font-normal text-ink-soft">{en ? next.en : next.ja}</span>
                </p>
                {next.jp && <p className="mt-1 text-sm font-semibold text-ink">{en ? next.jp.en : next.jp.ja}</p>}
              </>
            ) : null}
          </div>
        )}

        <nav aria-label={en ? 'On this page' : 'このページの内容'} className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap border-y border-line px-4 text-sm sm:mx-0 sm:px-0">
          {[
            { href: '#japanese', ja: '日本人選手の去就', en: 'Japanese players' },
            { href: '#reactions', ja: '海外の反応', en: 'Reactions' },
            { href: '#ranking', ja: 'FA注目選手', en: 'Top free agents' },
            { href: '#dates', ja: '日程・ロックアウト', en: 'Calendar' },
            { href: '#faq', ja: 'よくある質問', en: 'FAQ' },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex min-h-[44px] items-center text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              {en ? l.en : l.ja}
            </a>
          ))}
        </nav>
      </div>

      <StoveReactions threads={threads} locale={locale} />

      <StoveJapanese cards={jpCards} en={en} rankSource={en ? 'MLB.com' : 'MLB公式'} />

      <StoveBoard
        rows={rows}
        en={en}
        source={{ name: en ? cat.ranking.nameEn : cat.ranking.name, url: cat.ranking.url }}
        sourceDate={fmtDate(cat.ranking.date, en)}
        statsAsOf={stats.asOf ? fmtDate(stats.asOf.slice(0, 10), en) : ''}
      />

      <StoveDates dates={dates} en={en} />

      <div id="faq">
        <FaqList faq={faq} en={en} heading={en ? 'Hot stove FAQ' : 'ストーブリーグのよくある質問'} />
      </div>

      <ShareButtons
        url={url}
        title={en ? `${title}: Japanese players and top free agents` : `${title}｜日本人選手の去就とFA注目選手`}
      />

      <div className="flex flex-col text-sm">
        <Link href="/prospects" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'NPB posting candidates (NEXT MLB)' : 'NEXT MLB：ポスティング候補のNPB選手'} <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link href="/player" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Japanese MLB players: stats hub' : '日本人メジャーリーガーの成績一覧'} <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>
    </div>
  );
}
