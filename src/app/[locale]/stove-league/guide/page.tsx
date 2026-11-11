import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import {
  getStoveLeague,
  getStoveStats,
  worldSeriesEnd,
  resolveDates,
  stoveThreads,
  fmtDate,
  offseasonLabel,
  ROUTE_LABEL,
  type ResolvedDate,
} from '@/lib/stoveLeague';
import { buildFaRows } from '@/lib/stoveBoard';
import { getStoveMoves, moveCounts } from '@/lib/stoveMoves';
import { getLockout } from '@/lib/lockout';
import { getNpbStats, headlineStats } from '@/lib/npbStats';
import { getPlayer } from '@/lib/players';
import { GUIDE_TERMS, CBT_THRESHOLDS, buildGuideFaq, guideSourceName, type GuideTermId } from '@/lib/stoveGuide';
import SectionHeading from '@/components/SectionHeading';
import ShareButtons from '@/components/ShareButtons';
import FaqList from '@/components/FaqList';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

/**
 * オフの用語（/stove-league/guide）。定義の正は src/lib/stoveGuide.ts（MLB公式の用語集に書かれた決まりだけ）、
 * 「今年の実例」はストーブリーグの data の再表示＝このページで新しい事実は作らない。
 * 並びは問いの順＝FAとは → QO → オプトアウト → ノンテンダー → 年俸調停 → ルール5 → ぜいたく税。
 */

type Bi = { ja: string; en: string };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function load(locale: Locale) {
  const cat = await getStoveLeague();
  if (!cat) return null;
  const [stats, npb, all, wsEnd, moves, lockout] = await Promise.all([
    getStoveStats(),
    getNpbStats(),
    getAllThreads(),
    worldSeriesEnd(cat.season),
    getStoveMoves(),
    getLockout(),
  ]);
  const en = locale === 'en';
  const npbLine = (slug: string) => {
    const ns = npb.players[slug];
    if (!ns) return '';
    return headlineStats(ns, locale)
      .map((x) => (en ? `${x.label} ${x.value}` : `${x.label}${x.value}`))
      .join(en ? ', ' : '・');
  };
  const rows = await buildFaRows({ cat, stats, threads: stoveThreads(all, cat.season), npbLine, locale, faOpen: Boolean(wsEnd) });
  const dates = resolveDates(cat, wsEnd);
  return { cat, rows, dates, moves, lockout };
}

/** 日程表の1行を「11月18日午前6時（日本時間）」の形に。 */
function when(d: ResolvedDate | undefined, en: boolean): string {
  if (!d?.on) return '';
  const day = fmtDate(d.on, en);
  const end = d.end ? `${en ? '–' : '〜'}${fmtDate(d.end, en)}` : '';
  return en ? `${day}${end}${d.time ? `, ${d.time.en}` : ''} Japan time` : `${day}${end}${d.time ? d.time.ja : ''}（日本時間）`;
}

/** 百万ドル → 「2億4400万ドル」。 */
const jaUsdM = (m: number) => `${Math.floor(m / 100)}億${m % 100 ? `${m % 100}00万` : ''}ドル`;

const QO_LABEL: Record<'offered' | 'accepted' | 'declined', Bi> = {
  offered: { ja: '回答待ち', en: 'Pending' },
  accepted: { ja: '受諾', en: 'Accepted' },
  declined: { ja: '拒否', en: 'Declined' },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const data = await load(locale);
  if (!data) return {};
  const en = locale === 'en';
  const off = offseasonLabel(data.cat.season);
  const title = en
    ? `MLB Offseason Terms ${off}: Qualifying Offers, Opt-Outs and Non-Tenders Explained`
    : `MLBオフの用語${off}｜クオリファイングオファー・オプトアウト・ノンテンダーとは`;
  const qo = data.rows.filter((r) => r.qo).length;
  const description = en
    ? `What a qualifying offer, opt-out, non-tender, salary arbitration, the Rule 5 Draft and the luxury tax mean, from MLB's own glossary, each with this winter's real examples: the ${qo} players who got a qualifying offer, who opted out, and the deadlines in Japan time.`
    : `クオリファイングオファー（QO）・オプトアウト・ノンテンダー・年俸調停・ルール5ドラフト・ぜいたく税とは何かを、MLB公式の用語集をもとに説明。QOを提示された${qo}人と回答、オプトアウトの結果、各期限の日本時間など、${off}オフの実例つき。`;
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/stove-league/guide'),
    openGraph: { title, description, type: 'article', url: absoluteUrl(locale, '/stove-league/guide'), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
  };
}

function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4 border border-line bg-surface p-4">
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

const more = 'inline-flex min-h-[44px] items-center text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink';

export default async function StoveGuidePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await load(locale);
  if (!data) notFound();
  const { cat, rows, dates, moves, lockout } = data;
  const t = await getTranslations();
  const en = locale === 'en';
  const off = offseasonLabel(cat.season);
  const day = (key: string) => dates.find((d) => d.key === key);
  const src = guideSourceName(en);

  // ── 今年の実例（すべて data の再表示）
  const qoRows = rows.filter((r) => r.qo);
  const qoWhen = when(day('qo-accept'), en);
  const qoAmount = en ? cat.qualifyingOffer.amountEn : cat.qualifyingOffer.amountJa;
  // オプトアウト・球団オプション：日本人（去就の欄）＋FA注目選手（一覧の行）。同じ選手を2度出さない。
  const optionRows: { name: string; href?: string; kind: Bi; text: string }[] = [
    ...cat.japanese
      .filter((j) => j.route === 'opt-out' || j.route === 'club-option')
      .flatMap((j) => {
        const p = getPlayer(j.slug);
        return p
          ? [{ name: en ? p.nameEn : p.nameJa, href: `/player/${p.slug}`, kind: ROUTE_LABEL[j.route], text: en ? (j.outcome ?? j.headline).en : (j.outcome ?? j.headline).ja }]
          : [];
      }),
    ...cat.board
      .filter((b) => (b.route === 'opt-out' || b.route === 'club-option') && !b.jpSlug)
      .flatMap((b) => {
        const r = rows.find((x) => x.rank === b.rank);
        if (!r) return [];
        const st = en
          ? `${r.status.label.en}${r.status.team ? `: ${r.status.team.en}` : ''}`
          : `${r.status.label.ja}${r.status.team ? `：${r.status.team.ja}` : ''}`;
        const out = b.outcome ? (en ? b.outcome.en : b.outcome.ja) : '';
        return [{ name: r.name, href: r.hrefIsArticle ? undefined : r.href, kind: ROUTE_LABEL[b.route], text: out || `${en ? 'Now: ' : 'いま：'}${st}` }];
      }),
  ];
  const faCount = moves ? moveCounts(moves).fa : 0;
  const faFrom = moves ? fmtDate(moves.from, en) : '';
  const ntWhen = when(day('non-tender'), en);
  const r5When = when(day('rule5-protect'), en);
  const wm = day('winter-meetings');

  const extra: Partial<Record<GuideTermId, Bi>> = {
    ...(faCount
      ? { fa: { ja: `${off}オフは、FA解禁（米国時間${faFrom}）から${faCount}人がFAになった。`, en: `This ${off} offseason, ${faCount} players have become free agents since the market opened on ${faFrom} ET.` } }
      : {}),
    ...(qoRows.length
      ? {
          qo: {
            ja: `${off}オフの金額は${cat.qualifyingOffer.amountJa}で、${qoRows.length}人が提示を受けた${qoWhen ? `（回答の期限は${qoWhen}）` : ''}。`,
            en: `This winter the amount is ${cat.qualifyingOffer.amountEn} and ${qoRows.length} players received one${qoWhen ? ` (answers are due ${qoWhen})` : ''}.`,
          },
        }
      : {}),
    ...(ntWhen ? { 'non-tender': { ja: `${cat.season}年の期限は${ntWhen}。`, en: `The ${cat.season} deadline is ${ntWhen}.` } } : {}),
    ...(r5When
      ? { rule5: { ja: `指名から守るために40人枠へ入れる期限は、${cat.season}年は${r5When}。`, en: `In ${cat.season}, the deadline to protect players by adding them to the 40-man roster is ${r5When}.` } }
      : {}),
    cbt: {
      ja: `${cat.season}年の基準額は${jaUsdM(CBT_THRESHOLDS.at(-1)!.usdM)}。`,
      en: `The ${cat.season} threshold is $${CBT_THRESHOLDS.at(-1)!.usdM} million.`,
    },
  };
  const faq = buildGuideFaq(extra);

  const title = en ? `MLB Offseason Terms ${off}` : `MLBオフの用語 ${off}`;
  const hubTitle = en ? `MLB Hot Stove ${off}` : `MLBストーブリーグ ${off}`;
  const url = absoluteUrl(locale, '/stove-league/guide');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: title,
        url,
        dateModified: `${cat.asOf}T00:00:00+09:00`,
      },
      {
        '@type': 'DefinedTermSet',
        name: title,
        url,
        hasDefinedTerm: GUIDE_TERMS.map((g) => ({
          '@type': 'DefinedTerm',
          name: en ? g.title.en : g.title.ja,
          description: en ? g.summary.en : g.summary.ja,
          url: `${url}#${g.id}`,
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
          { '@type': 'ListItem', position: 2, name: hubTitle, item: absoluteUrl(locale, '/stove-league') },
          { '@type': 'ListItem', position: 3, name: title, item: url },
        ],
      },
    ],
  };

  // 用語ごとの「今年の実例」。無い用語は定義だけ出す。
  const examples: Partial<Record<GuideTermId, ReactNode>> = {
    fa: faCount ? (
      <Example label={en ? `This winter (${off})` : `${off}オフの実例`}>
        <p>{en ? extra.fa!.en : extra.fa!.ja}</p>
        <div className="flex flex-col">
          <Link href="/stove-league/fa" className={more}>
            {en ? 'Free agent rankings and who has signed' : 'FAランキングと契約状況を見る'} <span aria-hidden className="ml-1">→</span>
          </Link>
          <Link href="/stove-league/moves" className={more}>
            {en ? 'All signings and trades by date' : '移籍情報（FA契約・トレードの一覧）を見る'} <span aria-hidden className="ml-1">→</span>
          </Link>
        </div>
      </Example>
    ) : null,
    qo: qoRows.length ? (
      <Example label={en ? `This winter's qualifying offers (${qoRows.length})` : `${off}オフにQOを提示された${qoRows.length}人`}>
        <p>
          {en
            ? `Amount: ${qoAmount}.${qoWhen ? ` Answers due: ${qoWhen}.` : ''}`
            : `金額は${qoAmount}。${qoWhen ? `回答の期限は${qoWhen}。` : ''}`}
        </p>
        <ul className="divide-y divide-line border-y border-line">
          {qoRows.map((r) => (
            <li key={r.rank} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              {r.href && !r.hrefIsArticle ? (
                <Link href={r.href} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                  {r.name}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{r.name}</span>
              )}
              {r.team && <span className="text-xs text-ink-mute">{en ? r.team.en : r.team.ja}</span>}
              <span
                className={`inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 text-[11px] ${
                  r.qo === 'offered' ? 'border-line text-ink' : 'border-ink bg-ink text-surface'
                }`}
              >
                {en ? QO_LABEL[r.qo!].en : QO_LABEL[r.qo!].ja}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-mute">
          {en ? 'Sources: ' : '出典：'}
          <a href={cat.qualifyingOffer.source} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-2 hover:text-ink">
            {cat.qualifyingOffer.sourceName}
          </a>
          {cat.qualifyingOffer.offered && (
            <>
              {en ? ', ' : '・'}
              <a href={cat.qualifyingOffer.offered.source} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-2 hover:text-ink">
                {cat.qualifyingOffer.offered.sourceName}
              </a>
            </>
          )}
        </p>
      </Example>
    ) : null,
    option: optionRows.length ? (
      <Example label={en ? `This winter's decisions (${off})` : `${off}オフの実例`}>
        <ul className="divide-y divide-line border-y border-line">
          {optionRows.map((r) => (
            <li key={r.name} className="py-2.5">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {r.href ? (
                  <Link href={r.href} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                    {r.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{r.name}</span>
                )}
                <span className="inline-flex items-center whitespace-nowrap border border-line px-1.5 py-0.5 text-[11px] text-ink">
                  {en ? r.kind.en : r.kind.ja}
                </span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{r.text}</p>
            </li>
          ))}
        </ul>
        <Link href="/stove-league" className={more}>
          {en ? 'Sources and the latest on each player' : '出典と各選手の最新の動きはストーブリーグのページへ'} <span aria-hidden className="ml-1">→</span>
        </Link>
      </Example>
    ) : null,
    'non-tender': ntWhen ? (
      <Example label={en ? `This year (${cat.season})` : `${cat.season}年の期限`}>
        <p>{en ? extra['non-tender']!.en : extra['non-tender']!.ja}</p>
        <Link href="/stove-league/moves" className={more}>
          {en ? 'Players who became free agents, by date' : 'FAになった選手は移籍情報に日付順で載る'} <span aria-hidden className="ml-1">→</span>
        </Link>
      </Example>
    ) : null,
    rule5: r5When ? (
      <Example label={en ? `This year (${cat.season})` : `${cat.season}年の期限`}>
        <p>{en ? extra.rule5!.en : extra.rule5!.ja}</p>
      </Example>
    ) : null,
    cbt: (
      <Example label={en ? 'Thresholds under the 2022-26 CBA' : '基準額（2022〜26年の労使協定）'}>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 tabular-nums sm:grid-cols-5">
          {CBT_THRESHOLDS.map((x) => (
            <li key={x.year}>
              <span className="text-xs text-ink-mute">{en ? x.year : `${x.year}年`}</span>
              <span className="ml-2 font-semibold">{en ? `$${x.usdM}M` : jaUsdM(x.usdM)}</span>
            </li>
          ))}
        </ul>
        {lockout && (
          <>
            <p>
              {en
                ? 'What replaces these numbers from 2027 depends on the next CBA. MLB is seeking a salary cap and floor, which the union opposes.'
                : '2027年からの数字は、次の労使協定で決まる。MLB側は年俸総額の上限と下限（サラリーキャップ）を求め、選手会は反対している。'}
            </p>
            <Link href="/stove-league/lockout" className={more}>
              {en ? 'The CBA talks and the lockout' : '労使交渉とロックアウトの最新の動き'} <span aria-hidden className="ml-1">→</span>
            </Link>
          </>
        )}
      </Example>
    ),
  };

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="space-y-4">
        <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: hubTitle, href: '/stove-league' }, { name: title }]} />
        <PlayerHubNav />
      </div>

      <section>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">Glossary</span>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          MLB{en ? ' ' : ''}
          <span className="inline-block">{en ? 'Offseason Terms' : 'オフの用語'}</span> <span className="inline-block">{off}</span>
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-[1.8] text-ink">
          {en
            ? 'What the words in offseason news mean. Definitions follow MLB’s own glossary; under each one are this winter’s real examples.'
            : 'オフのニュースに出てくる言葉の意味をまとめました。決まりの説明はMLB公式の用語集にもとづき、その下に今オフの実例を置いています。'}
        </p>
        {/* ページ内の目次＝検索で来た人が自分の語へすぐ飛べる。 */}
        <nav aria-label={en ? 'Terms on this page' : 'このページの用語'} className="mt-4 flex flex-wrap gap-2">
          {GUIDE_TERMS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="inline-flex min-h-[40px] items-center border border-line px-3 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              {en ? g.title.en : g.title.ja}
            </a>
          ))}
        </nav>
      </section>

      {GUIDE_TERMS.map((g) => (
        <section key={g.id} id={g.id} className="space-y-3">
          <SectionHeading label={en ? g.title.en : g.title.ja} lead />
          <p className="max-w-prose text-[15px] leading-[1.8] text-ink">{en ? g.summary.en : g.summary.ja}</p>
          <ul className="max-w-prose space-y-2">
            {g.points.map((p) => (
              <li key={p.en} className="border-l-2 border-ink pl-3 text-[15px] leading-relaxed text-ink">
                {en ? p.en : p.ja}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-mute">
            {en ? 'Source: ' : '出典：'}
            <a href={g.source} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-2 hover:text-ink">
              {src}
            </a>
          </p>
          {examples[g.id]}
        </section>
      ))}

      <section id="more" className="space-y-3">
        <SectionHeading label={en ? 'Other offseason words' : 'そのほかの言葉'} lead />
        <ul className="max-w-prose space-y-3 text-[15px] leading-[1.8] text-ink">
          <li>
            <span className="font-bold">{en ? 'Posting system' : 'ポスティング'}</span>
            {en ? ': how NPB players move to MLB with their club’s consent. ' : '：NPBの選手が球団の承認を得てメジャーへ移る制度。'}
            <Link href="/prospects" className="underline decoration-line underline-offset-4 hover:decoration-ink">
              {en ? `Japanese players heading to MLB in ${cat.season + 1}` : `メジャー挑戦する日本人選手${cat.season + 1}（制度の説明つき）`}
            </Link>
          </li>
          {lockout && (
            <li>
              <span className="font-bold">{en ? 'Lockout' : 'ロックアウト'}</span>
              {en ? ': owners shutting players out when the CBA expires without a new deal. ' : '：労使協定が切れたあと、球団経営者側が選手を球団の活動から締め出す措置。'}
              <Link href="/stove-league/lockout" className="underline decoration-line underline-offset-4 hover:decoration-ink">
                {en ? `MLB lockout ${off}` : `MLBロックアウト${off}`}
              </Link>
            </li>
          )}
          {wm?.on && (
            <li>
              <span className="font-bold">{en ? 'Winter Meetings' : 'ウィンターミーティング'}</span>
              {en
                ? `: ${when(wm, true)}. ${wm.en.replace(/^Winter Meetings\s*/, '')}. `
                : `：${when(wm, false)}。${wm.ja.replace(/^ウィンターミーティング/, '').replace(/^（(.+?)）。?/, '$1。')}。`}
              <a href={wm.source} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-ink-mute underline decoration-line underline-offset-2 hover:text-ink">
                {wm.sourceName}
              </a>
            </li>
          )}
        </ul>
      </section>

      <div id="faq">
        <FaqList faq={faq} en={en} heading={en ? 'Offseason terms FAQ' : 'オフの用語のよくある質問'} />
      </div>

      <ShareButtons url={url} title={title} />

      <div className="flex flex-col text-sm">
        <Link href="/stove-league" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Hot stove hub: Japanese players, calendar and reactions' : 'ストーブリーグ：日本人選手の去就・日程・海外の反応'} <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link href="/stove-league/fa" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Free agent rankings: who has signed, who is left' : 'FAランキング：誰が決まり、誰が残っているか'} <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link href="/stove-league/moves" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Transactions: signings and trades by date' : '移籍情報：FA契約・トレードの一覧'} <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>
    </div>
  );
}
