import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { PLAYERS } from '@/lib/players';
import { getPlayersSnapshot, seasonYear, type PlayerSeason } from '@/lib/playerStats';
import Leaderboard, { type LeaderRow } from '@/components/Leaderboard';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
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
  // 年は文字列で渡す（ICU 数値引数の桁区切り「2,026」を避ける）。
  const title = t('ranking.metaTitle', { year: String(year) });
  const description = t('ranking.metaDesc', { year: String(year) });
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/ranking') },
    twitter: { card: 'summary_large_image', title, description },
    alternates: localeAlternates(locale, '/ranking'),
  };
}

// 数値整形（捏造しない・スナップショットの値をそのまま表示形に）。
const num = (raw: unknown): number | null => {
  if (raw == null) return null;
  const v = Number(raw);
  return Number.isNaN(v) ? null : v;
};
const fix1 = (v: number) => v.toFixed(1); // WAR
const int = (v: number) => String(Math.round(v)); // 本塁打・奪三振
const rate3 = (v: number) => v.toFixed(3).replace(/^0\./, '.'); // 打率/OPS（.296 表記）
const era2 = (v: number) => v.toFixed(2); // 防御率

// 率指標の最低出場（少サンプルのノイズを弾く）。年間規定には満たない中盤時点でも意味が出る緩い閾値。
const MIN_PA = 100;
const MIN_IP = 30;

type BoardDef = {
  key: string;
  side: 'bat' | 'pit';
  label: string;
  get: (s: PlayerSeason) => number | null;
  fmt: (v: number) => string;
  better: 'high' | 'low';
  gate?: (s: PlayerSeason) => boolean;
  gated?: boolean; // 率指標＝最低出場ゲートあり（注記の対象）
};

export default async function RankingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const en = locale === 'en';
  const snap = await getPlayersSnapshot();
  const year = seasonYear(snap);

  // 日本人選手（rival=非日本人の比較枠は除く）で、今季 MLB 成績がある者だけ。AAA 等（league=null）は除外。
  const withStats = PLAYERS.filter((p) => !p.rival)
    .map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined }))
    .filter((x): x is { p: (typeof PLAYERS)[number]; s: PlayerSeason } => Boolean(x.s && x.s.league));

  const batters = withStats.filter((x) => x.s.hitting && num(x.s.hitting.plateAppearances)! > 0);
  // 投手ゲート：先発 or 一定投球回（野手の火消し登板を弾く／一覧ページと同じ構造判定）。
  const isRealPitcher = (s: PlayerSeason) =>
    !!s.pitching && (num(s.pitching.gamesStarted)! >= 1 || num(s.pitching.inningsPitched)! >= 10);
  const pitchers = withStats.filter((x) => isRealPitcher(x.s));

  const boards: BoardDef[] = [
    // 打者
    { key: 'bat-war', side: 'bat', label: t('ranking.war'), get: (s) => s.saber?.hit ?? null, fmt: fix1, better: 'high' },
    { key: 'hr', side: 'bat', label: t('ranking.hr'), get: (s) => num(s.hitting?.homeRuns), fmt: int, better: 'high' },
    { key: 'avg', side: 'bat', label: t('ranking.avg'), get: (s) => num(s.hitting?.avg), fmt: rate3, better: 'high',
      gate: (s) => num(s.hitting?.plateAppearances)! >= MIN_PA, gated: true },
    { key: 'ops', side: 'bat', label: t('ranking.ops'), get: (s) => num(s.hitting?.ops), fmt: rate3, better: 'high',
      gate: (s) => num(s.hitting?.plateAppearances)! >= MIN_PA, gated: true },
    // 投手
    { key: 'pit-war', side: 'pit', label: t('ranking.war'), get: (s) => s.saber?.pit ?? null, fmt: fix1, better: 'high' },
    { key: 'era', side: 'pit', label: t('ranking.era'), get: (s) => num(s.pitching?.era), fmt: era2, better: 'low',
      gate: (s) => num(s.pitching?.inningsPitched)! >= MIN_IP, gated: true },
    { key: 'so', side: 'pit', label: t('ranking.so'), get: (s) => num(s.pitching?.strikeOuts), fmt: int, better: 'high' },
  ];

  const buildRows = (b: BoardDef): LeaderRow[] => {
    const pool = b.side === 'bat' ? batters : pitchers;
    const items = pool
      .map((x) => ({ p: x.p, s: x.s, raw: b.get(x.s) }))
      .filter((x) => x.raw != null && (!b.gate || b.gate(x.s)))
      .sort((a, b2) => (b.better === 'high' ? b2.raw! - a.raw! : a.raw! - b2.raw!));
    return items.map((x, i) => ({
      rank: i + 1,
      slug: x.p.slug,
      name: en ? x.p.nameEn : x.p.nameJa,
      team: x.s.team,
      mlbId: x.p.mlbId,
      value: b.fmt(x.raw!),
    }));
  };

  const built = boards.map((b) => ({ b, rows: buildRows(b) })).filter((x) => x.rows.length > 0);
  const batBoards = built.filter((x) => x.b.side === 'bat');
  const pitBoards = built.filter((x) => x.b.side === 'pit');
  const hasGated = built.some((x) => x.b.gated && x.rows.length > 0);

  // 構造化データ: CollectionPage ＋ 各ボードの ItemList（順位つき）＋パンくず。ランキング面の被検索性を上げる。
  const pageTitle = t('ranking.metaTitle', { year: String(year) });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: pageTitle,
        description: t('ranking.metaDesc', { year: String(year) }),
        url: absoluteUrl(locale, '/ranking'),
      },
      ...built.map(({ b, rows }) => ({
        '@type': 'ItemList',
        name: `${b.side === 'bat' ? t('ranking.battingGroup') : t('ranking.pitchingGroup')} ${b.label}`,
        itemListElement: rows.map((r) => ({
          '@type': 'ListItem',
          position: r.rank,
          name: r.name,
          url: absoluteUrl(locale, `/player/${r.slug}`),
        })),
      })),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t('ranking.title'), item: absoluteUrl(locale, '/ranking') },
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: t('ranking.title') }]} />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">{t('ranking.eyebrow')}</span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
          {t('ranking.titleYear', { year: String(year) })}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{t('ranking.lead')}</p>
        {snap.asOf && <p className="mt-1 text-xs text-ink-soft">{t('player.asOf', { date: snap.asOf })}</p>}
      </section>

      {/* 打者ランキング（WAR / 本塁打 / 打率 / OPS）。各行は選手ハブへの内部リンク。 */}
      {batBoards.length > 0 && (
        <section className="space-y-8">
          <SectionHeading label={t('ranking.battingGroup')} lead />
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {batBoards.map(({ b, rows }) => (
              <div key={b.key}>
                <SectionHeading label={b.label} count={rows.length} />
                <Leaderboard rows={rows} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 投手ランキング（WAR / 防御率 / 奪三振）。 */}
      {pitBoards.length > 0 && (
        <section className="space-y-8">
          <SectionHeading label={t('ranking.pitchingGroup')} lead />
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {pitBoards.map(({ b, rows }) => (
              <div key={b.key}>
                <SectionHeading label={b.label} count={rows.length} />
                <Leaderboard rows={rows} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-1 border-t border-line pt-4">
        {hasGated && <p className="text-xs text-ink-soft">{t('ranking.gateNote', { pa: String(MIN_PA), ip: String(MIN_IP) })}</p>}
        <p className="text-xs text-ink-soft">{t('player.statsNote')}</p>
      </div>
    </div>
  );
}
