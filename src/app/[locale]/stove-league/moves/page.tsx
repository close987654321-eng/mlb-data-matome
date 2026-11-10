import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getPlayer } from '@/lib/players';
import { getStoveLeague, getStoveStats, worldSeriesEnd, resolveDates, rowStatus, fmtDate, offseasonLabel } from '@/lib/stoveLeague';
import { getStoveMoves, buildMoveDays, moveCounts, moveTeams } from '@/lib/stoveMoves';
import { getLockout } from '@/lib/lockout';
import type { FaqItem } from '@/components/FaqList';
import StoveMovesList from '@/components/StoveMovesList';
import SectionHeading from '@/components/SectionHeading';
import ShareButtons from '@/components/ShareButtons';
import FaqList from '@/components/FaqList';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

/**
 * MLBの移籍情報（/stove-league/moves）＝今オフの契約・トレードを日付順に並べた全記録。
 *
 * なぜ要るか: 「mlb 移籍情報／移籍 一覧／移籍 最新／移籍 2027」は、きょうまでに何が起きたかを時系列で
 * 探す検索で、選手別に並べた入口では表示がほぼ0だった（2026-11-10 の計測）。賞レースのボードと同じ型
 * （1ページ＝1つの問い＋自動で動く表）にする。行は MLB公式の取引記録から3時間ごとに自動で入り、
 * 契約の年数・金額だけ、FA一覧に出典つきで書かれたものを添える。日付は取引記録の日付（米東部）。
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function load() {
  const [file, cat] = await Promise.all([getStoveMoves(), getStoveLeague()]);
  if (!file || !cat) return null;
  return { file, cat };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const data = await load();
  if (!data) return {};
  const { file, cat } = data;
  const en = locale === 'en';
  const off = offseasonLabel(cat.season);
  const c = moveCounts(file);
  const day = fmtDate(file.asOf.slice(0, 10), en);
  const title = en
    ? `MLB Offseason Transactions ${off}: Signings, Trades & Waivers by Date`
    : `MLB移籍情報${off}｜FA契約・トレードの一覧（毎日更新）`;
  const description = en
    ? `Every MLB signing, trade and waiver claim of the ${off} offseason by date, from MLB's official transaction log: ${c.signings} signings, ${c.trades} trades and ${c.waivers} waiver claims since free agency opened. Filter by team or type. Updated ${day}.`
    : `${cat.season}年オフ（${cat.season + 1}年シーズンに向けた）MLBの移籍情報を日付順に。FA解禁（${fmtDate(file.from, false)}）からのFA契約${c.signings}件・トレード${c.trades}件・ウェーバー${c.waivers}件を、MLB公式の取引記録から3時間ごとに更新。球団別・種類別に絞り込める（${day}更新）。`;
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/stove-league/moves'),
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/stove-league/moves'), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
  };
}

export default async function StoveMovesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await load();
  if (!data) notFound();
  const { file, cat } = data;
  const t = await getTranslations();
  const en = locale === 'en';
  const off = offseasonLabel(cat.season);
  const [days, stats, wsEnd, lockout] = await Promise.all([
    buildMoveDays(file, cat, locale),
    getStoveStats(),
    worldSeriesEnd(cat.season),
    getLockout(),
  ]);
  const c = moveCounts(file);
  const teams = moveTeams(file, en);
  const dates = resolveDates(cat, wsEnd);
  const optionsDay = dates.find((d) => d.key === 'options');
  const cbaDay = dates.find((d) => d.key === 'cba');

  // 日本人選手（MLB組）のいまの状況。FAQ の答えに使う（中身は入口と同じ data）。
  const jp = cat.japanese.flatMap((j) => {
    const p = getPlayer(j.slug);
    if (!p) return [];
    const st = rowStatus(j.route, j.outcome, stats.players[String(p.mlbId)], Boolean(wsEnd));
    return [{ ja: p.nameJa, en: p.nameEn, st }];
  });
  const jpOpen = jp.filter((x) => !x.st.done);
  const jpDone = jp.filter((x) => x.st.done);

  const faq: FaqItem[] = [
    {
      q: { ja: `${cat.season}年オフのMLBの移籍市場はいつ動く？`, en: `When does the ${off} MLB market move?` },
      a: {
        ja: `FAは${fmtDate(file.from, false)}（米国時間）に解禁された。${optionsDay?.on ? `全球団と契約できるようになったのは日本時間${fmtDate(optionsDay.on, false)}から。` : ''}${cbaDay?.on ? `日本時間${fmtDate(cbaDay.on, false)}に労使協定の期限があり、ロックアウトに入れば契約もトレードも止まるため、その前に動きが集中するとみられている。` : ''}`,
        en: `Free agency opened on ${fmtDate(file.from, true)} (ET).${optionsDay?.on ? ` Players could sign with any club from ${fmtDate(optionsDay.on, true)} Japan time.` : ''}${cbaDay?.on ? ` The CBA expires on ${fmtDate(cbaDay.on, true)} Japan time; a lockout would freeze signings and trades, so activity is expected to bunch up before then.` : ''}`,
      },
    },
    ...(jp.length
      ? [
          {
            q: { ja: '今オフ、日本人選手の移籍はどうなっている？', en: 'Where do the Japanese players stand this winter?' },
            a: {
              ja: `${jpOpen.length ? `${jpOpen.map((x) => x.ja).join('・')}は${fmtDate(cat.checkedAt ?? cat.asOf, false)}時点で行き先が決まっていない。` : ''}${jpDone.length ? `${jpDone.map((x) => `${x.ja}（${x.st.label.ja}${x.st.team ? `：${x.st.team.ja}` : ''}）`).join('・')}は決着した。` : ''}NPBからポスティング・海外FAで挑戦する選手は「メジャー挑戦」のページにまとめている。`,
              en: `${jpOpen.length ? `${jpOpen.map((x) => x.en).join(', ')} ${jpOpen.length > 1 ? 'are' : 'is'} unsigned as of ${fmtDate(cat.checkedAt ?? cat.asOf, true)}. ` : ''}${jpDone.length ? `${jpDone.map((x) => `${x.en} (${x.st.label.en}${x.st.team ? `: ${x.st.team.en}` : ''})`).join(', ')} ${jpDone.length > 1 ? 'are' : 'is'} settled. ` : ''}Players coming from NPB are on the separate page.`,
            },
          },
        ]
      : []),
    ...(lockout
      ? [
          {
            q: { ja: 'ロックアウトになると移籍はどうなる？', en: 'What happens to moves in a lockout?' },
            a: {
              ja: `${lockout.what.items[0].ja}。${lockout.headline.ja}`,
              en: `${lockout.what.items[0].en}. ${lockout.headline.en}`,
            },
          },
        ]
      : []),
    {
      q: { ja: 'この一覧の情報はどこから？', en: 'Where does this list come from?' },
      a: {
        ja: 'MLB公式の取引記録（Stats API）から3時間ごとに自動で取り込んでいる。日付は記録の日付（米東部）。契約の年数や金額は取引記録に無いので、報道で確認できたものだけ出典つきで添えている。',
        en: "It is pulled automatically every three hours from MLB's official transaction log (Stats API). Dates are the log's dates (ET). Contract years and money are not in the log, so we add them only when confirmed by reporting, with the source.",
      },
    },
  ];

  const title = en ? `MLB Transactions ${off}` : `MLB移籍情報 ${off}`;
  const hubTitle = en ? `MLB Hot Stove ${off}` : `MLBストーブリーグ ${off}`;
  const url = absoluteUrl(locale, '/stove-league/moves');
  const mainRows = days.flatMap((d) => d.main).slice(0, 30);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, url, dateModified: `${file.asOf.slice(0, 10)}T00:00:00+09:00` },
      ...(mainRows.length
        ? [
            {
              '@type': 'ItemList',
              name: en ? 'Latest MLB moves' : 'MLBの最新の移籍',
              itemListElement: mainRows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.text })),
            },
          ]
        : []),
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

  const stamp = `${fmtDate(file.asOf.slice(0, 10), en)} ${file.asOf.slice(11, 16).replace(/^0/, '')}`;

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
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">Transactions</span>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          MLB<span className="inline-block">{en ? ' Transactions' : '移籍情報'}</span>{' '}
          <span className="inline-block">{off}</span>
        </h1>
        {/* 「いままでに何件動いたか」を題のすぐ下で（数はすべて記録からの数え上げ）。 */}
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink">
          {en
            ? `Since free agency opened on ${fmtDate(file.from, true)}: ${c.signings} signings (${c.signings - c.majorSignings} of them minor league deals), ${c.trades} trades and ${c.waivers} waiver claims. ${c.fa} players have become free agents.`
            : `FA解禁（${fmtDate(file.from, false)}）から、FA契約${c.signings}件（うちマイナー契約${c.signings - c.majorSignings}件）・トレード${c.trades}件・ウェーバーでの移籍${c.waivers}件。FAになった選手は${c.fa}人。`}
        </p>
        <p className="mt-1 text-xs text-ink-mute">
          {en
            ? `Updated ${stamp} JST · synced from MLB's official transaction log every 3 hours · dates are ET`
            : `${stamp}更新・MLB公式の取引記録から3時間ごとに自動で反映・日付は米国時間`}
        </p>
      </section>

      <section id="moves" className="space-y-3">
        <SectionHeading label={en ? 'Moves by date' : '日付順の移籍・契約'} lead />
        <StoveMovesList days={days} teams={teams} en={en} />
      </section>

      <div id="faq">
        <FaqList faq={faq} en={en} heading={en ? 'Transactions FAQ' : '移籍情報のよくある質問'} />
      </div>

      <ShareButtons url={url} title={en ? title : `${title}｜FA契約・トレードの一覧`} />

      <div className="flex flex-col text-sm">
        <Link href="/stove-league/fa" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Free agent rankings: who has signed, who is left' : 'FAランキング：誰が決まり、誰が残っているか'}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link href="/stove-league" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Hot stove hub: Japanese players, calendar and reactions' : 'ストーブリーグ：日本人選手の去就・日程・海外の反応'}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
        {lockout && (
          <Link href="/stove-league/lockout" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
            {en ? 'MLB lockout: when, why and what it means' : 'MLBロックアウト：いつから・なぜ・日本人選手への影響'}{' '}
            <span aria-hidden className="ml-1">→</span>
          </Link>
        )}
        <Link href="/prospects" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Japanese players heading to MLB (posting and international FA)' : `メジャー挑戦する日本人選手${cat.season + 1}（ポスティング・海外FA）`}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>
    </div>
  );
}
