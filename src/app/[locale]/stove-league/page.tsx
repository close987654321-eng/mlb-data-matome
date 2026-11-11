import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getPlayer } from '@/lib/players';
import { prospectsOnTheMove } from '@/lib/npbPlayers';
import { getNpbStats, headlineStats } from '@/lib/npbStats';
import {
  getStoveLeague,
  getStoveStats,
  worldSeriesEnd,
  worldSeriesState,
  resolveDates,
  stoveThreads,
  voiceFor,
  rowStatus,
  teamPath,
  statLine,
  fmtDate,
  buildStoveFaq,
  latestNews,
  offseasonLabel,
  ROUTE_LABEL,
} from '@/lib/stoveLeague';
import { buildFaRows, faCounts } from '@/lib/stoveBoard';
import { getLockout } from '@/lib/lockout';
import { getStoveMoves, moveCounts } from '@/lib/stoveMoves';
import { headshotUrl } from '@/lib/teams';
import StoveJapanese, { StoveSummary, type StoveJpCard } from '@/components/StoveJapanese';
import StoveBoard from '@/components/StoveBoard';
import StoveDates from '@/components/StoveDates';
import StoveReactions from '@/components/StoveReactions';
import StoveNews from '@/components/StoveNews';
import StoveDoors from '@/components/StoveDoors';
import SectionHeading from '@/components/SectionHeading';
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

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const cat = await getStoveLeague();
  if (!cat) return {};
  const en = locale === 'en';
  // 年は「2026-2027」と省かずに書く＝検索は「ストーブリーグ 2026」でも「移籍 2027」（来季）でも来る
  // （2026-11-10 に入力候補を採取: メジャー挑戦 日本人 2027／mlb 移籍 2027／mlb fa 2027）。
  const off = offseasonLabel(cat.season);
  const names = cat.japanese.filter((j) => !j.outcome).map((j) => getPlayer(j.slug)).filter(Boolean);
  // layout の template が「｜海外の反応」を足すので、ここで同じ語を重ねない。
  // 「FAランキング」は専用ページ（/stove-league/fa）の題に譲る＝同じ語を2つの題で取り合わない。
  const title = en
    ? `MLB Hot Stove ${off}: Japanese Players, Free Agents & Trades`
    : `MLBストーブリーグ${off}｜日本人の去就・FA・移籍の最新まとめ`;
  const description = en
    ? `Where ${names.map((p) => p!.nameEn).join(', ')} and the top MLB free agents stand this winter: the latest moves, status, 2026 stats, the offseason calendar up to the December 1 CBA deadline, and overseas fan reactions.`
    : `${cat.season}年オフ（${cat.season + 1}年シーズンに向けた）MLBのストーブリーグ。${names.map((p) => p!.nameJa).join('・')}ら日本人選手の去就と最新の動き、FA注目選手の契約状況、FA解禁から12月の労使協定の期限までの日程、海外ファンの反応をまとめて追う（${cat.asOf.slice(5).replace('-', '/')}更新）。`;
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
  const [stats, npb, all, wsEnd, ws, lockout, movesFile] = await Promise.all([
    getStoveStats(),
    getNpbStats(),
    getAllThreads(),
    worldSeriesEnd(cat.season),
    worldSeriesState(cat.season),
    getLockout(),
    getStoveMoves(),
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
  const movers = prospectsOnTheMove();

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
  const npbCards: StoveJpCard[] = movers.map((p) => {
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

  // ── 最新の動き（各選手の報道の時系列をまたいで日付順に。MLB組→NPB組の順で同じ日を並べる）
  const news = latestNews(
    [
      ...cat.japanese.flatMap((j) => {
        const p = getPlayer(j.slug);
        return p ? [{ name: { ja: p.nameJa, en: p.nameEn }, href: `/player/${p.slug}`, timeline: j.timeline }] : [];
      }),
      ...movers.map((p) => ({
        name: { ja: p.nameJa, en: p.nameEn },
        href: `/prospects/${p.slug}`,
        timeline: p.postingWatch!.timeline,
      })),
      // 外国人の主役（stars[]）は日本人の後ろ＝同じ日・同じ出典なら日本人の行が残る。
      ...(cat.stars ?? []).flatMap((j) => {
        const p = getPlayer(j.slug);
        return p ? [{ name: { ja: p.nameJa, en: p.nameEn }, href: `/player/${p.slug}`, timeline: j.timeline }] : [];
      }),
    ],
    9,
  );

  // ── FA注目選手（MLB.com の順位順）。全員ぶんの表は /stove-league/fa＝ここは上位5人と日本人だけ。
  const faRows = await buildFaRows({ cat, stats, threads, npbLine, locale, faOpen });
  const fa = faCounts(faRows);
  const boardRows = faRows.filter((r) => r.rank <= 5 || r.japanese);

  const dates = resolveDates(cat, wsEnd);
  const next = dates.find((d) => !d.past);
  const dateOf = (key: string) => dates.find((d) => d.key === key);
  const faq = buildStoveFaq(
    cat,
    Object.fromEntries(
      cat.japanese.map((j) => {
        const p = getPlayer(j.slug);
        return [j.slug, { ja: p?.nameJa ?? j.slug, en: p?.nameEn ?? j.slug }];
      }),
    ),
    wsEnd,
    movers.map((p) => ({ ja: p.nameJa, en: p.nameEn })),
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
        // FA一覧（ItemList）は専用ページが持つ＝同じ一覧を2つのURLで宣言しない。
        hasPart: [{ '@type': 'CollectionPage', url: absoluteUrl(locale, '/stove-league/fa') }],
        ...(threads.length
          ? { relatedLink: threads.slice(0, 20).map((th) => absoluteUrl(locale, `/${th.sport}/${th.id}`)) }
          : {}),
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
  // 確認日は更新日より新しいときだけ出す（同じ日なら「更新」で足りる）。
  const checkedJa = cat.checkedAt && cat.checkedAt > cat.asOf ? fmtDate(cat.checkedAt, en) : '';

  // 見出しの下の「いまの状況」。数はFA一覧からの数え上げ、日本人は去就が決まっていない人数。
  const jpOpen = jpCards.filter((c) => !c.status.done).length;
  const nowLine = faOpen
    ? en
      ? `${fa.open} of the top ${fa.total} free agents are unsigned, and ${jpOpen} Japanese players are still undecided.`
      : `${fa.done ? `FA注目${fa.total}人のうち${fa.open}人が未契約。` : `FA注目${fa.total}人は、まだ誰も契約を決めていない。`}日本人選手は${jpCards.length}人のうち${jpOpen}人の行き先が決まっていない。`
    : '';

  // 「ストーブリーグとは・今オフはいつからいつまで」。日付はすべて日程表（出典つき）の値。
  const faOpenDay = dateOf('fa-open');
  const qoDay = dateOf('qo-accept');
  const cbaDay = dateOf('cba');
  const wmDay = dateOf('winter-meetings');
  const about = {
    ja: `ストーブリーグは、シーズンが終わってから翌年のキャンプが始まるまでの、FA契約とトレードが動く期間のこと。寒い季節にファンがストーブを囲んで補強の話をしたことから、こう呼ばれる。MLBではワールドシリーズ終了の翌日にFAが解禁され、翌年2月中旬のキャンプインまで続く。`,
    en: `The hot stove is the stretch between the end of the season and spring training, when free agents sign and trades happen. In MLB it starts when free agency opens the day after the World Series and runs until camps open in mid-February.`,
  };
  const thisYear = [
    faOpenDay?.on ? { ja: `${fmtDate(faOpenDay.on, false)}にFAが解禁された`, en: `free agency opened on ${fmtDate(faOpenDay.on, true)}` } : null,
    qoDay?.on ? { ja: `${fmtDate(qoDay.on, false)}がクオリファイング・オファーの回答期限`, en: `qualifying offer answers are due ${fmtDate(qoDay.on, true)}` } : null,
    cbaDay?.on ? { ja: `${fmtDate(cbaDay.on, false)}が労使協定の期限（まとまらなければロックアウト）`, en: `the CBA expires on ${fmtDate(cbaDay.on, true)} (a lockout follows without a deal)` } : null,
    wmDay?.on ? { ja: `${fmtDate(wmDay.on, false)}からウィンターミーティング`, en: `the Winter Meetings start on ${fmtDate(wmDay.on, true)}` } : null,
  ].filter((x): x is { ja: string; en: string } => Boolean(x));

  const doors = [
    {
      href: '/stove-league/fa',
      eyebrow: en ? 'Free agents' : 'FAランキング',
      title: en ? `Top ${fa.total} free agents: status and projections` : `FAランキングと契約状況（上位${fa.total}人）`,
      body: en
        ? `${fa.open} unsigned, ${fa.done} settled. Contract projections and qualifying offer decisions.`
        : `${fa.done ? `未契約${fa.open}人・決着${fa.done}人。` : `${fa.total}人ともまだ未契約。`}予想契約と、QOを提示された${fa.qoAll}人の回答。`,
    },
    {
      href: '/prospects',
      eyebrow: en ? 'From NPB' : 'メジャー挑戦',
      title: en ? `Japanese players heading to MLB in ${cat.season + 1}` : `メジャー挑戦する日本人選手${cat.season + 1}`,
      body: en
        ? `${movers.map((p) => p.nameEn).join(', ')}: posting and international free agency, step by step.`
        : `${movers.map((p) => p.nameJa).join('・')}のポスティング・海外FAの現在地。`,
    },
    ...(movesFile
      ? [
          {
            href: '/stove-league/moves',
            eyebrow: en ? 'Transactions' : '移籍情報',
            title: en ? 'Signings and trades by date' : '移籍情報：FA契約・トレードの一覧',
            body: en
              ? `${moveCounts(movesFile).signings} signings and ${moveCounts(movesFile).trades} trades so far, synced from MLB's transaction log every 3 hours.`
              : `FA契約${moveCounts(movesFile).signings}件・トレード${moveCounts(movesFile).trades}件を日付順に。MLB公式の取引記録から3時間ごとに更新。`,
          },
        ]
      : []),
    {
      href: '/stove-league/guide',
      eyebrow: en ? 'Glossary' : '用語',
      title: en ? 'Offseason terms explained' : 'オフの用語：QO・オプトアウト・ノンテンダーとは',
      body: en
        ? 'Qualifying offers, opt-outs, non-tenders, arbitration, the Rule 5 Draft and the luxury tax, with this winter’s examples.'
        : 'クオリファイングオファー・オプトアウト・ノンテンダー・年俸調停・ルール5ドラフト・ぜいたく税を、今オフの実例つきで。',
    },
    ...(lockout
      ? [
          {
            href: '/stove-league/lockout',
            eyebrow: en ? 'Lockout' : 'ロックアウト',
            title: en ? 'MLB lockout: when, why and what it means' : 'MLBロックアウト：いつから・なぜ・日本人への影響',
            body: en
              ? 'The CBA deadline, the salary cap dispute, and what freezes for free agents and posted players.'
              : `労使協定の期限${cbaDay?.on ? `（${fmtDate(cbaDay.on, false)}）` : ''}、争点のサラリーキャップ、FAとポスティングの交渉がどうなるか。`,
          },
        ]
      : []),
  ];

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
              : '日本人選手の去就、FA・移籍の動き、海外ファンの反応を1ページで追います。'}
          </p>
          {nowLine && <p className="mt-2 max-w-prose text-[15px] font-semibold leading-relaxed text-ink">{nowLine}</p>}
          <p className="mt-1 text-xs text-ink-mute">
            {en
              ? `Updated ${asOfJa}${checkedJa ? ` · checked ${checkedJa}` : ''} · news checked every morning at 6 a.m. JST, signings sync every 3 hours`
              : `${asOfJa}更新${checkedJa ? `・${checkedJa}確認` : ''}・報道は毎朝6時に確認、契約の動きは3時間ごとに自動で反映`}
          </p>
        </div>
      </section>

      {/* 「きょうまでに何が起きたか」を日付順で。選手別の並びより先に置く＝最新を探して来た人への答え。 */}
      <StoveNews items={news} en={en} />

      {/* 第一の問い「日本人は誰が、どうなるのか」に答える一覧。 */}
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

        {/* 語ごとに分けたページへの入口（FAランキング／メジャー挑戦）。 */}
        <StoveDoors doors={doors} label={en ? 'More on the hot stove' : 'ストーブリーグの各ページ'} />

        <nav aria-label={en ? 'On this page' : 'このページの内容'} className="-mx-4 flex gap-x-5 overflow-x-auto whitespace-nowrap border-y border-line px-4 text-sm sm:mx-0 sm:px-0">
          {[
            { href: '#news', ja: '最新の動き', en: 'Latest' },
            { href: '#japanese', ja: '日本人選手の去就', en: 'Japanese players' },
            { href: '#reactions', ja: '海外の反応', en: 'Reactions' },
            { href: '#ranking', ja: 'FA注目選手', en: 'Top free agents' },
            { href: '#about', ja: 'ストーブリーグとは', en: 'What it is' },
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
        rows={boardRows}
        total={fa.total}
        signed={fa.done}
        moreHref="/stove-league/fa"
        en={en}
        source={{ name: en ? cat.ranking.nameEn : cat.ranking.name, url: cat.ranking.url }}
        sourceDate={fmtDate(cat.ranking.date, en)}
        statsAsOf={stats.asOf ? fmtDate(stats.asOf.slice(0, 10), en) : ''}
      />

      {/* 「mlb ストーブリーグ とは／いつから／いつまで／期間」への答え。定義1段落＋今オフの実日付。 */}
      <section id="about" className="space-y-3">
        <SectionHeading
          label={en ? 'What the hot stove is, and when it runs' : 'ストーブリーグとは｜今オフはいつからいつまで'}
          lead
        />
        <p className="max-w-prose text-[15px] leading-[1.8] text-ink">{en ? about.en : about.ja}</p>
        {thisYear.length > 0 && (
          <p className="max-w-prose text-[15px] leading-[1.8] text-ink">
            {en
              ? `This winter (${off}): ${thisYear.map((x) => x.en).join('; ')}. All dates are Japan time.`
              : `今オフ（${off}）は、${thisYear.map((x) => x.ja).join('。')}。日付はすべて日本時間。`}
          </p>
        )}
      </section>

      <StoveDates dates={dates} en={en} />

      <div id="faq">
        <FaqList faq={faq} en={en} heading={en ? 'Hot stove FAQ' : 'ストーブリーグのよくある質問'} />
      </div>

      <ShareButtons
        url={url}
        title={en ? `${title}: Japanese players and top free agents` : `${title}｜日本人選手の去就とFA注目選手`}
      />

      <div className="flex flex-col text-sm">
        <Link href="/stove-league/fa" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? `Free agent rankings ${off}: status of the top ${fa.total}` : `FAランキング${off}：上位${fa.total}人の契約状況`}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
        {movesFile && (
          <Link href="/stove-league/moves" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
            {en ? `MLB transactions ${off}: signings and trades by date` : `MLB移籍情報${off}：FA契約・トレードの一覧`}{' '}
            <span aria-hidden className="ml-1">→</span>
          </Link>
        )}
        <Link href="/stove-league/guide" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Offseason terms: qualifying offers, opt-outs and non-tenders explained' : 'オフの用語：クオリファイングオファー・オプトアウト・ノンテンダーとは'}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
        {lockout && (
          <Link href="/stove-league/lockout" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
            {en ? `MLB lockout ${off}: when, why and what it means` : `MLBロックアウト${off}：いつから・なぜ・日本人選手への影響`}{' '}
            <span aria-hidden className="ml-1">→</span>
          </Link>
        )}
        <Link href="/prospects" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Japanese players heading to MLB (NEXT MLB)' : `メジャー挑戦する日本人選手${cat.season + 1}（NEXT MLB）`}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link href="/player" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Japanese MLB players: stats hub' : '日本人メジャーリーガーの成績一覧'} <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>
    </div>
  );
}
