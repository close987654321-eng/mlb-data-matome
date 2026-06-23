import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { PLAYERS, hubEligible } from '@/lib/players';
import { getPlayersSnapshot, seasonYear, type PlayerSeason } from '@/lib/playerStats';
import CompareTable, { type CompareCol, type CompareRow } from '@/components/CompareTable';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const snap = await getPlayersSnapshot();
  const year = seasonYear(snap);
  const en = locale === 'en';
  // 指名検索のロングテール（「大谷 山本 成績」等）を拾うため代表選手名を description 末尾へ。
  const names = PLAYERS.filter((p) => !p.rival)
    .slice(0, 4)
    .map((p) => (en ? p.nameEn : p.nameJa));
  const description = en
    ? `${t('player.indexLead')} Featuring ${names.join(', ')} and more.`
    : `${t('player.indexLead')} ${names.join('・')}ほか。`;
  // 年は文字列で渡す（ICU 数値引数の桁区切り「2,026」を避ける）。
  const title = t('player.indexTitleYear', { year: String(year) });
  return {
    title,
    description,
    // openGraph/twitter を「ここで」定義する＝親(layout)の twitter.images:/og.png を外し、
    // ファイルベースの opengraph-image.tsx（ハブ専用カード）を og と twitter の両方に充当させる。
    // images は敢えて指定しない（指定すると規約画像が固定され opengraph-image が効かなくなる）。
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/player') },
    twitter: { card: 'summary_large_image', title, description },
    alternates: localeAlternates(locale, '/player'),
  };
}

const num = (raw: string | number | null | undefined, d?: string): { v: number | null; d: string } => {
  if (raw == null) return { v: null, d: '—' };
  const v = Number(raw);
  return { v: Number.isNaN(v) ? null : v, d: d ?? String(raw) };
};

const BAT_COLS: CompareCol[] = [
  { key: 'avg', label: '打率', better: 'high' },
  { key: 'homeRuns', label: '本', better: 'high' },
  { key: 'rbi', label: '打点', better: 'high' },
  { key: 'stolenBases', label: '盗', better: 'high' },
  { key: 'ops', label: 'OPS', better: 'high' },
  { key: 'wrcplus', label: 'wRC+', better: 'high' },
  { key: 'war', label: 'WAR', better: 'high' },
];
const PIT_COLS: CompareCol[] = [
  { key: 'era', label: '防御率', better: 'low' },
  { key: 'wins', label: '勝', better: 'high' },
  { key: 'losses', label: '敗', better: 'low' },
  { key: 'inningsPitched', label: '回', better: 'high' },
  { key: 'strikeOuts', label: '奪三', better: 'high' },
  { key: 'whip', label: 'WHIP', better: 'low' },
  { key: 'war', label: 'WAR', better: 'high' },
];

export default async function PlayerIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const [snap, all] = await Promise.all([getPlayersSnapshot(), getAllThreads()]);
  const year = seasonYear(snap);

  // 比較に出すのは MLBロースターで今季成績がある選手（＝ハブが必ず存在＝行クリックが必ず有効）。
  // AAA等（league=null）は MLB比較に混ぜない。
  const withStats = PLAYERS.map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined })).filter(
    (x) => x.s && x.s.league,
  );

  // 投手1行ぶんの値（日本人投手表とサイヤング争いブロックで共用）。
  const pitValues = (s: PlayerSeason) => {
    const pi = s.pitching!;
    const sb = s.saber;
    return {
      era: num(pi.era),
      wins: num(pi.wins),
      losses: num(pi.losses),
      inningsPitched: num(pi.inningsPitched),
      strikeOuts: num(pi.strikeOuts),
      whip: num(pi.whip),
      war: num(sb?.pit, sb?.pit != null ? sb.pit.toFixed(1) : undefined),
    };
  };

  // 打者1行ぶんの値（日本人打者表とスター野手比較ブロックで共用）。
  const batValues = (s: PlayerSeason) => {
    const h = s.hitting!;
    const sb = s.saber;
    return {
      avg: num(h.avg),
      homeRuns: num(h.homeRuns),
      rbi: num(h.rbi),
      stolenBases: num(h.stolenBases),
      ops: num(h.ops),
      wrcplus: num(sb?.wrcplus, sb?.wrcplus != null ? String(Math.round(sb.wrcplus)) : undefined),
      war: num(sb?.hit, sb?.hit != null ? sb.hit.toFixed(1) : undefined),
    };
  };

  // 日本人の比較表。ライバル（非日本人）は混ぜず、専用ブロックに出す（rival を除外）。
  const batRows: CompareRow[] = withStats
    .filter((x) => x.s!.hitting && !x.p.rival)
    .map(({ p, s }) => ({ slug: p.slug, name: p.nameJa, team: s!.team, values: batValues(s!) }));

  // 今季のスター野手（大谷と比較）＝大谷＋強打者ライバル（野手 rival）。リーグ横断（AL/NL）で打WAR降順に見比べる。
  const mvpRows: CompareRow[] = withStats
    .filter((x) => x.s!.hitting && (x.p.rival || x.p.slug === 'shohei-ohtani'))
    .map(({ p, s }) => ({ slug: p.slug, name: p.nameJa, team: s!.team, values: batValues(s!) }));

  const pitRows: CompareRow[] = withStats
    .filter((x) => x.s!.pitching && !x.p.rival)
    .map(({ p, s }) => ({ slug: p.slug, name: p.nameJa, team: s!.team, values: pitValues(s!) }));

  // サイヤング争い：日本人の候補（大谷・山本）＋ライバル投手（rival）を1つの表で見比べる。
  const cyJpSlugs = new Set(['shohei-ohtani', 'yoshinobu-yamamoto']);
  const cyRows: CompareRow[] = withStats
    .filter((x) => x.s!.pitching && (x.p.rival || cyJpSlugs.has(x.p.slug)))
    .map(({ p, s }) => ({ slug: p.slug, name: p.nameJa, team: s!.team, values: pitValues(s!) }));

  // ピラー（/player）から全ハブへ内部リンクを閉じる。比較表に出ない（MLB今季成績が無い）が記事のある
  // 選手（村上・岡本・ヌートバー等）への入口を一覧に持たせ、子ハブに評価・回遊を届ける。
  const hubPlayers = PLAYERS.filter((p) => hubEligible(p, all, snap.players[String(p.mlbId)]));
  const tableSlugs = new Set([...batRows, ...pitRows, ...cyRows, ...mvpRows].map((r) => r.slug));
  const moreHubs = hubPlayers.filter((p) => !tableSlugs.has(p.slug));

  // 一覧（GA4最強回遊面）の構造化データ。CollectionPage＋ItemList（全ハブを列挙）＋パンくず。
  const indexTitle = t('player.indexTitleYear', { year: String(year) });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: indexTitle,
        description: t('player.indexLead'),
        url: absoluteUrl(locale, '/player'),
      },
      {
        '@type': 'ItemList',
        itemListElement: hubPlayers.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: locale === 'en' ? p.nameEn : p.nameJa,
          url: absoluteUrl(locale, `/player/${p.slug}`),
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t('player.indexTitle'), item: absoluteUrl(locale, '/player') },
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: t('player.indexTitle') }]} />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {t('player.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{t('player.indexTitle')}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{t('player.indexLead')}</p>
        {snap.asOf && (
          <p className="mt-1 text-xs text-ink-soft">{t('player.asOf', { date: snap.asOf })}</p>
        )}
      </section>

      {cyRows.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-bold text-ink">{t('player.cyYoung')}</h2>
          <p className="mb-3 max-w-prose text-sm text-ink-soft">{t('player.cyYoungLead')}</p>
          <CompareTable rows={cyRows} cols={PIT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {mvpRows.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-bold text-ink">{t('player.mvpRace')}</h2>
          <p className="mb-3 max-w-prose text-sm text-ink-soft">{t('player.mvpRaceLead')}</p>
          <CompareTable rows={mvpRows} cols={BAT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {batRows.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">{t('player.batting')}</h2>
          <CompareTable rows={batRows} cols={BAT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {pitRows.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">{t('player.pitching')}</h2>
          <CompareTable rows={pitRows} cols={PIT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {moreHubs.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">{t('player.moreTitle')}</h2>
          <div className="flex flex-wrap gap-2">
            {moreHubs.map((p) => (
              <Link
                key={p.slug}
                href={`/player/${p.slug}`}
                className="inline-flex items-center gap-1 rounded-full bg-surface px-3.5 py-1.5 text-sm text-accent ring-1 ring-line transition-colors hover:bg-paper"
              >
                <span aria-hidden="true">📊</span>
                {locale === 'en' ? p.nameEn : p.nameJa}
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-ink-soft">{t('player.statsNote')}</p>
    </div>
  );
}
