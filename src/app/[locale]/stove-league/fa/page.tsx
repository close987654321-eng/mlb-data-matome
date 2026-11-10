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
  stoveThreads,
  rowStatus,
  fmtDate,
  offseasonLabel,
  ROUTE_LABEL,
} from '@/lib/stoveLeague';
import { buildFaRows, buildFaFaq, faCounts, type FaRow } from '@/lib/stoveBoard';
import StoveFaList from '@/components/StoveFaList';
import SectionHeading from '@/components/SectionHeading';
import ShareButtons from '@/components/ShareButtons';
import FaqList from '@/components/FaqList';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

/**
 * FAランキングと契約状況（/stove-league/fa）。
 *
 * なぜ入口（/stove-league）から分けたか: 2026-11-10 の計測で、入口1枚が「ストーブリーグ」「FAランキング」
 * 「移籍情報」「制度」「日本人の去就」の5種類の検索を受けていて、「mlb fa ランキング」「fa 一覧」は
 * 表示がほぼ0だった。賞レースのボードが勝った型は「1ページ＝1つの問い＋毎日動く表」＝FA一覧を
 * その型にする。冬の後半は問いが「誰が残っているか」に変わるので、同じURLで未契約の絞り込みまで受ける。
 *
 * 中身はすべて data の再配置: 順位＝MLB公式／もう1つの順位＝ESPN／予想契約＝MLB Trade Rumors（いずれも出典を
 * 見出しの下に出す＝このサイトの予想に見せない）／成績と契約の記録＝statsapi／状況の文＝毎朝の定期実行。
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function load(locale: Locale) {
  const cat = await getStoveLeague();
  if (!cat) return null;
  const [stats, npb, all, wsEnd] = await Promise.all([
    getStoveStats(),
    getNpbStats(),
    getAllThreads(),
    worldSeriesEnd(cat.season),
  ]);
  const en = locale === 'en';
  const npbLine = (slug: string) => {
    const ns = npb.players[slug];
    if (!ns) return '';
    return headlineStats(ns, locale)
      .map((x) => (en ? `${x.label} ${x.value}` : `${x.label}${x.value}`))
      .join(en ? ', ' : '・');
  };
  const threads = stoveThreads(all, cat.season);
  const rows = await buildFaRows({ cat, stats, threads, npbLine, locale, faOpen: Boolean(wsEnd) });
  return { cat, stats, wsEnd, rows };
}

/** 出典名から記者名のかっこを外した短い呼び名（「MLB.com（◯◯記者）」→「MLB.com」）。 */
const short = (name: string) => name.replace(/[（(].*[）)]$/, '').trim();

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const data = await load(locale);
  if (!data) return {};
  const { cat, rows } = data;
  const en = locale === 'en';
  const off = offseasonLabel(cat.season);
  const c = faCounts(rows);
  const top = rows[0];
  const jp = rows.filter((r) => r.japanese);
  const title = en
    ? `MLB Free Agent Rankings ${off}: Top ${rows.length} Tracker, Signings & Projections`
    : `MLB FAランキング${off}｜上位${rows.length}人の契約状況・移籍先一覧`;
  const description = en
    ? `Where the top ${rows.length} MLB free agents stand this winter: ${c.open} unsigned, ${c.done} settled. Rankings from ${short(cat.ranking.nameEn)}, contract projections, qualifying offer decisions and 2026 stats, updated ${fmtDate(cat.checkedAt ?? cat.asOf, true)}.`
    : `${cat.season}年オフ（${cat.season + 1}年シーズンに向けた）MLBのFAランキング上位${rows.length}人の契約状況と移籍先。1位は${top?.name ?? ''}、日本人は${jp.map((r) => `${r.name}${r.rank}位`).join('・')}。${c.done ? `未契約${c.open}人・決着${c.done}人。` : `${c.total}人ともまだ未契約。`}予想契約、QOを提示された${c.qoAll}人の回答、今季成績を一覧で（${fmtDate(cat.checkedAt ?? cat.asOf, false)}確認）。`;
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/stove-league/fa'),
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/stove-league/fa'), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
  };
}

function SourceLink({ name, url }: { name: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-2 hover:text-ink">
      {name}
    </a>
  );
}

export default async function StoveFaPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await load(locale);
  if (!data) notFound();
  const { cat, stats, wsEnd, rows } = data;
  const t = await getTranslations();
  const en = locale === 'en';
  const off = offseasonLabel(cat.season);
  const c = faCounts(rows);
  const faq = buildFaFaq(cat, rows);
  const qoRows = rows.filter((r) => r.qo);
  const qoAccept = cat.dates.find((d) => d.key === 'qo-accept' && d.date);
  const altName = cat.altRanking ? short(en ? cat.altRanking.nameEn : cat.altRanking.name) : '';
  const projName = cat.projection ? (en ? cat.projection.nameEn : cat.projection.name) : '';

  // ランキングの外にいる日本人（MLB組＝菅野智之や残留を決めた選手／NPB組＝伊藤大海・髙橋光成）。
  // 「FA 日本人 一覧」で来た人に、30人の表だけ見せて終わらせない。
  const onBoardJp = new Set(cat.board.map((b) => b.jpSlug).filter(Boolean));
  const onBoardProspect = new Set(cat.board.map((b) => b.prospectSlug).filter(Boolean));
  const others = [
    ...cat.japanese
      .filter((j) => !onBoardJp.has(j.slug))
      .flatMap((j) => {
        const p = getPlayer(j.slug);
        if (!p) return [];
        const st = rowStatus(j.route, j.outcome, stats.players[String(p.mlbId)], Boolean(wsEnd));
        return [{ href: `/player/${p.slug}`, name: en ? p.nameEn : p.nameJa, label: st.label, team: st.team, done: st.done }];
      }),
    ...prospectsOnTheMove()
      .filter((p) => !onBoardProspect.has(p.slug))
      .map((p) => ({
        href: `/prospects/${p.slug}`,
        name: en ? p.nameEn : p.nameJa,
        label: p.postingWatch!.route === 'intl-fa' ? { ja: '海外FA', en: 'International FA' } : ROUTE_LABEL.posting,
        team: undefined,
        done: false,
      })),
  ];

  const title = en ? `MLB Free Agent Rankings ${off}` : `MLB FAランキング ${off}`;
  const hubTitle = en ? `MLB Hot Stove ${off}` : `MLBストーブリーグ ${off}`;
  const url = absoluteUrl(locale, '/stove-league/fa');
  const modified = [cat.asOf, stats.asOf.slice(0, 10)].filter(Boolean).sort().at(-1) ?? cat.asOf;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, url, dateModified: `${modified}T00:00:00+09:00` },
      {
        '@type': 'ItemList',
        name: en ? 'Top MLB free agents' : 'MLBのFAランキング',
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
          { '@type': 'ListItem', position: 2, name: hubTitle, item: absoluteUrl(locale, '/stove-league') },
          { '@type': 'ListItem', position: 3, name: title, item: url },
        ],
      },
    ],
  };

  const checked = fmtDate(cat.checkedAt ?? cat.asOf, en);
  const qoReply = (r: FaRow): string => {
    if (r.qo === 'accepted') return en ? 'Accepted' : '受諾（残留）';
    if (r.qo === 'declined') return en ? 'Declined' : '拒否';
    return en ? 'Pending' : '回答待ち';
  };

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="space-y-4">
        <Breadcrumbs
          items={[{ name: t('nav.home'), href: '/' }, { name: hubTitle, href: '/stove-league' }, { name: title }]}
        />
        <PlayerHubNav />
      </div>

      <section>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">Free Agents</span>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          MLB <span className="inline-block">{en ? 'Free Agent Rankings' : 'FAランキング'}</span>{' '}
          <span className="inline-block">{off}</span>
        </h1>
        {/* 問い「いま誰が決まって、誰が残っているか」に、表の前で答える（数はすべて表からの数え上げ）。 */}
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink">
          {en
            ? `${c.done ? `Of the top ${c.total} free agents, ${c.open} are unsigned and ${c.done} are settled.` : `None of the top ${c.total} free agents has signed yet.`}${c.qoPending && qoAccept ? ` ${c.qoPending} players are weighing a qualifying offer, due ${fmtDate(qoAccept.date!, true)} Japan time.` : ''}`
            : `${c.done ? `上位${c.total}人のうち、${c.open}人が未契約、${c.done}人が決着。` : `上位${c.total}人は、まだ誰も契約を決めていない。`}${c.qoPending && qoAccept ? `クオリファイング・オファー（QO）を提示された${c.qoPending}人の回答期限は、日本時間${fmtDate(qoAccept.date!, false)}${qoAccept.time?.ja ?? ''}。` : ''}`}
        </p>
        <p className="mt-1 text-xs text-ink-mute">
          {en
            ? `Checked ${checked} · signings sync from MLB's transaction log every 3 hours`
            : `${checked}確認・契約の記録はMLB公式の取引記録から3時間ごとに自動で反映`}
        </p>
      </section>

      <section id="ranking" className="space-y-3">
        <SectionHeading label={en ? 'Rankings and status' : 'FAランキングと契約状況'} count={rows.length} lead />
        <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
          {en ? (
            <>
              Order follows <SourceLink name={cat.ranking.nameEn} url={cat.ranking.url} /> ({fmtDate(cat.ranking.date, true)}).
              {cat.altRanking && (
                <>
                  {' '}
                  A second ranking is from <SourceLink name={cat.altRanking.nameEn} url={cat.altRanking.url} />
                </>
              )}
              {cat.projection && (
                <>
                  , and contract projections are from <SourceLink name={cat.projection.nameEn} url={cat.projection.url} /> — not
                  ours
                </>
              )}
              . Stats are the {cat.season} regular season (MLB official).
            </>
          ) : (
            <>
              並びは
              <SourceLink name={cat.ranking.name} url={cat.ranking.url} />
              のFAランキング（{fmtDate(cat.ranking.date, false)}付）。
              {cat.altRanking && (
                <>
                  もう1つの順位は
                  <SourceLink name={cat.altRanking.name} url={cat.altRanking.url} />
                  、
                </>
              )}
              {cat.projection && (
                <>
                  予想契約は
                  <SourceLink name={cat.projection.name} url={cat.projection.url} />
                  の数字で、このサイトの予想ではありません。
                </>
              )}
              成績は{cat.season}年レギュラーシーズン（MLB公式）。
            </>
          )}
        </p>
        <StoveFaList rows={rows} en={en} altName={altName} projName={projName} />
      </section>

      {qoRows.length > 0 && (
        <section id="qo" className="space-y-3">
          <SectionHeading
            label={en ? 'Qualifying offers' : 'クオリファイング・オファー（QO）を提示された選手'}
            count={qoRows.length}
            lead
          />
          <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
            {en
              ? `A one-year, ${cat.qualifyingOffer.amountEn} offer a club can make to its own free agent. If he declines and signs elsewhere, the new club gives up a draft pick.${qoAccept ? ` Answers are due ${fmtDate(qoAccept.date!, true)}${qoAccept.time ? `, ${qoAccept.time.en}` : ''} Japan time.` : ''}`
              : `元の球団がFAになる自軍の選手に出せる、1年${cat.qualifyingOffer.amountJa}の提示。断って他球団と契約すると、その球団はドラフト指名権を失う。${qoAccept ? `回答の期限は日本時間${fmtDate(qoAccept.date!, false)}${qoAccept.time?.ja ?? ''}。` : ''}`}
          </p>
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th scope="col" className="px-3 py-2.5 font-medium">{en ? 'Player' : '選手'}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{en ? 'Club' : '提示した球団'}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{en ? 'Answer' : '回答'}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    {en ? 'Projection' : '予想契約'}
                    {projName && <span className="ml-1 font-normal text-ink-mute">{projName}</span>}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {qoRows.map((r) => (
                  <tr key={r.rank}>
                    <th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-semibold text-ink">
                      {r.href && !r.hrefIsArticle ? (
                        <Link href={r.href} className="underline decoration-line underline-offset-4 hover:decoration-ink">
                          {r.name}
                        </Link>
                      ) : (
                        r.name
                      )}
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-soft">{r.team ? (en ? r.team.en : r.team.ja) : ''}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink">{qoReply(r)}</td>
                    <td className="px-3 py-3 tabular-nums text-ink-soft">{r.projection ? (en ? r.projection.en : r.projection.ja) : '−'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cat.qualifyingOffer.offered && (
            <p className="text-xs text-ink-mute">
              {en ? 'Source: ' : '出典：'}
              <SourceLink name={cat.qualifyingOffer.offered.sourceName} url={cat.qualifyingOffer.offered.source} />
              {en ? ` (offers made ${fmtDate(cat.qualifyingOffer.offered.date, true)} Japan time)` : `（提示は日本時間${fmtDate(cat.qualifyingOffer.offered.date, false)}）`}
            </p>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <SectionHeading label={en ? 'Other Japanese players on the market' : 'ランキングの外にいる日本人選手'} count={others.length} lead />
          <ul className="divide-y divide-line border-y border-line">
            {others.map((o) => (
              <li key={o.href}>
                <Link href={o.href} className="group flex min-h-[52px] items-center gap-3 py-2 transition-colors hover:bg-ink/[0.02]">
                  <span className="font-bold text-ink">{o.name}</span>
                  <span
                    className={`inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 text-[11px] ${
                      o.done ? 'border-ink bg-ink text-surface' : 'border-line text-ink'
                    }`}
                  >
                    {en ? o.label.en : o.label.ja}
                    {o.team && (en ? `: ${o.team.en}` : `：${o.team.ja}`)}
                  </span>
                  <span aria-hidden className="ml-auto shrink-0 text-ink-mute transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div id="faq">
        <FaqList faq={faq} en={en} heading={en ? 'Free agent FAQ' : 'FAランキングのよくある質問'} />
      </div>

      <ShareButtons url={url} title={en ? `${title}: tracker` : `${title}｜契約状況と移籍先の一覧`} />

      <div className="flex flex-col text-sm">
        <Link href="/stove-league" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Hot stove hub: Japanese players, calendar and reactions' : 'ストーブリーグ：日本人選手の去就・日程・海外の反応'}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link href="/prospects" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Japanese players heading to MLB (posting and international FA)' : `メジャー挑戦する日本人選手${cat.season + 1}（ポスティング・海外FA）`}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>
    </div>
  );
}
