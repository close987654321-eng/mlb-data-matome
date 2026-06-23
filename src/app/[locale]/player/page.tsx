import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { PLAYERS } from '@/lib/players';
import { getPlayersSnapshot, type PlayerSeason } from '@/lib/playerStats';
import CompareTable, { type CompareCol, type CompareRow } from '@/components/CompareTable';
import { localeAlternates } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t('player.indexTitle'),
    description: t('player.indexLead'),
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
  const snap = await getPlayersSnapshot();

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

  // 日本人の比較表。ライバル（非日本人）は混ぜず、専用ブロックに出す（rival を除外）。
  const batRows: CompareRow[] = withStats
    .filter((x) => x.s!.hitting && !x.p.rival)
    .map(({ p, s }) => {
      const h = s!.hitting!;
      const sb = s!.saber;
      return {
        slug: p.slug,
        name: p.nameJa,
        team: s!.team,
        values: {
          avg: num(h.avg),
          homeRuns: num(h.homeRuns),
          rbi: num(h.rbi),
          stolenBases: num(h.stolenBases),
          ops: num(h.ops),
          wrcplus: num(sb?.wrcplus, sb?.wrcplus != null ? String(Math.round(sb.wrcplus)) : undefined),
          war: num(sb?.hit, sb?.hit != null ? sb.hit.toFixed(1) : undefined),
        },
      };
    });

  const pitRows: CompareRow[] = withStats
    .filter((x) => x.s!.pitching && !x.p.rival)
    .map(({ p, s }) => ({ slug: p.slug, name: p.nameJa, team: s!.team, values: pitValues(s!) }));

  // サイヤング争い：日本人の候補（大谷・山本）＋ライバル投手（rival）を1つの表で見比べる。
  const cyJpSlugs = new Set(['shohei-ohtani', 'yoshinobu-yamamoto']);
  const cyRows: CompareRow[] = withStats
    .filter((x) => x.s!.pitching && (x.p.rival || cyJpSlugs.has(x.p.slug)))
    .map(({ p, s }) => ({ slug: p.slug, name: p.nameJa, team: s!.team, values: pitValues(s!) }));

  return (
    <div className="space-y-10">
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

      <p className="text-xs text-ink-soft">{t('player.statsNote')}</p>
    </div>
  );
}
