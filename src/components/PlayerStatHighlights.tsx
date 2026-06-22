import type { StatRecord, Saber, Ranks, Rank, League } from '@/lib/playerStats';
import RankBadges, { type RankLabels } from './RankBadges';

// 「パッと見てスッと入る」マーキー成績。各選手の代表指標を大きく＋順位ピル。
// 二刀流（打＋投）は「打者として/投手として」の2グループで見せる。
type Item = { label: string; value: string | number | null; rank?: Rank };

const wrc = (v?: number) => (typeof v === 'number' ? String(Math.round(v)) : null);
const war1 = (v?: number) => (typeof v === 'number' ? v.toFixed(1) : null);

function Card({
  item,
  league,
  labels,
}: {
  item: Item;
  league?: League | null;
  labels: RankLabels;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-4 text-center">
      <div className="text-xs font-medium text-ink-soft">{item.label}</div>
      <div className="mt-1.5 text-[28px] font-bold leading-none tabular-nums text-ink sm:text-3xl">
        {item.value ?? '—'}
      </div>
      <div className="mt-2.5 flex min-h-[18px] justify-center">
        <RankBadges rank={item.rank} league={league} labels={labels} maxMlb={40} maxLg={20} />
      </div>
    </div>
  );
}

// 項目数に応じて大画面の列数を合わせる（5個=5列 / 6個=6列）。中途半端な空セルを作らない。
const LG_COLS: Record<number, string> = {
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

function Group({
  heading,
  items,
  league,
  labels,
}: {
  heading?: string;
  items: Item[];
  league?: League | null;
  labels: RankLabels;
}) {
  const lg = LG_COLS[items.length] ?? 'lg:grid-cols-5';
  return (
    <div>
      {heading && (
        <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-ink-soft">
          <span className="h-3 w-1 rounded-full bg-accent" />
          {heading}
        </div>
      )}
      <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${lg}`}>
        {items.map((it) => (
          <Card key={it.label} item={it} league={league} labels={labels} />
        ))}
      </div>
    </div>
  );
}

export default function PlayerStatHighlights({
  hitting,
  pitching,
  saber,
  ranks,
  league,
  labels,
  roleBat,
  rolePit,
}: {
  hitting: StatRecord | null;
  pitching: StatRecord | null;
  saber: Saber | null;
  ranks?: Ranks;
  league?: League | null;
  labels: RankLabels;
  roleBat: string;
  rolePit: string;
}) {
  const twoWay = Boolean(hitting && pitching);

  const batItems: Item[] = hitting
    ? [
        { label: '打率', value: hitting.avg ?? null, rank: ranks?.hitting?.avg },
        { label: '本塁打', value: hitting.homeRuns ?? null, rank: ranks?.hitting?.homeRuns },
        { label: '打点', value: hitting.rbi ?? null, rank: ranks?.hitting?.rbi },
        { label: 'OPS', value: hitting.ops ?? null, rank: ranks?.hitting?.ops },
        { label: 'wRC+', value: wrc(saber?.wrcplus) },
        { label: twoWay ? 'WAR(打)' : 'WAR', value: war1(saber?.hit) },
      ]
    : [];

  const pitItems: Item[] = pitching
    ? [
        { label: '防御率', value: pitching.era ?? null, rank: ranks?.pitching?.era },
        { label: '勝', value: pitching.wins ?? null, rank: ranks?.pitching?.wins },
        { label: '奪三振', value: pitching.strikeOuts ?? null, rank: ranks?.pitching?.strikeOuts },
        { label: 'WHIP', value: pitching.whip ?? null, rank: ranks?.pitching?.whip },
        { label: 'WAR(投)', value: war1(saber?.pit) },
      ]
    : [];

  return (
    <div className="space-y-5">
      {batItems.length > 0 && (
        <Group heading={twoWay ? roleBat : undefined} items={batItems} league={league} labels={labels} />
      )}
      {pitItems.length > 0 && (
        <Group heading={twoWay ? rolePit : undefined} items={pitItems} league={league} labels={labels} />
      )}
    </div>
  );
}
