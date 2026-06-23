import { getTranslations } from 'next-intl/server';
import type { PlayerSeason } from '@/lib/playerStats';
import type { Hero } from '@/lib/playerHero';
import type { RankLabels } from '@/components/RankBadges';
import { war1, wrc } from '@/lib/statGroups';
import StatRail, { type RailRow } from './StatRail';

/**
 * 注目の成績（マーキー）。旧 PlayerStatHighlights の代替。代表5〜6指標を単一レールで。
 * 二刀流は打/投を“両方積む”（全体俯瞰）。打/投の切替タブは詳細側にだけ置く。
 */
function buildRows(
  defs: Array<[string, string | number | null | undefined, { mlb?: number; lg?: number } | undefined]>,
): RailRow[] {
  const rows: RailRow[] = [];
  for (const [label, value, rank] of defs) {
    if (value == null || value === '') continue;
    rows.push({ label, value: String(value), rank: rank ?? null });
  }
  return rows;
}

export default async function PlayerMarquee({
  season,
  hero,
  labels,
  name,
}: {
  season: PlayerSeason;
  hero: Hero;
  labels: RankLabels;
  /** 可視 H2 を「{選手名} 今季の注目成績」にして“選手名＋成績”の検索適合を上げる。 */
  name: string;
}) {
  const t = await getTranslations('player');
  const twoWay = hero.role === 'two-way';
  const h = season.hitting;
  const p = season.pitching;
  const rh = season.ranks?.hitting;
  const rp = season.ranks?.pitching;
  const s = season.saber;

  const batRows = h
    ? buildRows([
        ['打率', h.avg, rh?.avg],
        ['本塁打', h.homeRuns, rh?.homeRuns],
        ['打点', h.rbi, rh?.rbi],
        ['OPS', h.ops, rh?.ops],
        ['wRC+', wrc(s?.wrcplus), undefined],
        [twoWay ? 'WAR(打)' : 'WAR', war1(s?.hit), undefined],
      ])
    : [];
  const pitRows = p
    ? buildRows([
        ['防御率', p.era, rp?.era],
        ['勝', p.wins, rp?.wins],
        ['奪三振', p.strikeOuts, rp?.strikeOuts],
        ['WHIP', p.whip, rp?.whip],
        [twoWay ? 'WAR(投)' : 'WAR', war1(s?.pit), undefined],
      ])
    : [];

  const note =
    hero.noRankReason === 'reliever'
      ? t('noRankNoteReliever')
      : hero.noRankReason === 'belowThreshold'
        ? t('noRankNoteThreshold')
        : null;

  const tick = (label: string) => (
    <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-ink-soft">
      <span className="h-3 w-1 rounded-full bg-accent" />
      {label}
    </div>
  );

  return (
    <section className="motion-safe:animate-[rise_.32s_ease-out_60ms_both]">
      <h2 className="mb-4 text-lg font-bold text-ink">{t('marqueeHeading', { name })}</h2>
      <div className="space-y-5">
        {batRows.length > 0 && (
          <div>
            {twoWay && tick(t('roleBatter'))}
            <StatRail rows={batRows} league={season.league} labels={labels} />
          </div>
        )}
        {pitRows.length > 0 && (
          <div>
            {twoWay && tick(t('rolePitcher'))}
            <StatRail rows={pitRows} league={season.league} labels={labels} />
          </div>
        )}
      </div>
      {note && <p className="mt-3 text-xs leading-relaxed text-ink-soft">{note}</p>}
    </section>
  );
}
