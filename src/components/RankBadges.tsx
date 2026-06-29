import type { Rank, League } from '@/lib/playerStats';

// 順位ピル（MLB全体／所属リーグ）。値は編集時スナップショットの公知の事実。
// 「目立つ順位だけ」を出す（下位はノイズなので閾値で間引く）。t は親で getTranslations 済みのラベル。
export type RankLabels = { mlb: string; al: string; nl: string; unit: string };

export default function RankBadges({
  rank,
  league,
  labels,
  maxMlb = 30,
  maxLg = 15,
  size = 'sm',
}: {
  rank?: Rank;
  league?: League | null;
  labels: RankLabels;
  maxMlb?: number;
  maxLg?: number;
  size?: 'sm' | 'md';
}) {
  if (!rank) return null;
  const showMlb = typeof rank.mlb === 'number' && rank.mlb <= maxMlb;
  const showLg = typeof rank.lg === 'number' && rank.lg <= maxLg;
  if (!showMlb && !showLg) return null;

  const strong = (rank.mlb != null && rank.mlb <= 10) || (rank.lg != null && rank.lg <= 5);
  const lgLabel = league === 'AL' ? labels.al : labels.nl;
  const pad = size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-px text-[10px]';
  const tone = strong
    ? 'bg-ink/[0.06] text-ink-soft'
    : 'bg-paper text-ink-soft';

  return (
    <div className="flex flex-wrap items-center gap-1">
      {showMlb && (
        <span className={`rounded-full font-semibold tabular-nums ${pad} ${tone}`}>
          {labels.mlb} {rank.mlb}
          {labels.unit}
        </span>
      )}
      {showLg && league && (
        <span className={`rounded-full font-semibold tabular-nums ${pad} ${tone}`}>
          {lgLabel} {rank.lg}
          {labels.unit}
        </span>
      )}
    </div>
  );
}
