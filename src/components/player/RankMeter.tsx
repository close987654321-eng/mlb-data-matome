import type { Rank, League } from '@/lib/playerStats';
import type { RankLabels } from '@/components/RankBadges';

/**
 * 順位の“上位感”を誠実に視覚化するバー。
 *
 * ⚠️ 誠実さの核心（CLAUDE.md §4.4 / [[mlb-stats-enrichment-decision]]）:
 *  データの順位は「位置」だけで分母（母数）を持たない。ゆえに本当のパーセンタイルは作れない。
 *  - バーは “上位n位を並べたリーダーボード上の位置” を表す装飾で、固定の表示窓（SCALE_MLB/LG）で伸ばす。
 *    SCALE は母数や総数の主張ではない。% も「◯人中」も**絶対に文字出力しない**。
 *  - 真実（「MLB 12位」等の literal）はバーの隣に必ず併記し、aria-label もその literal だけ。
 *  - この SCALE を将来パーセンタイルに“直す”のは誤り。表示窓であってデータの分母ではない。
 */
const SCALE_MLB = 40; // 表示窓（=母数ではない）。マーキー/詳細で常に同一＝同じ実績が場所で違う伸びにならない。
const SCALE_LG = 20;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function RankMeter({
  rank,
  league,
  labels,
  maxMlb,
  maxLg,
  variant = 'rail',
}: {
  rank?: Rank | null;
  league?: League | null;
  labels: RankLabels;
  /** 表示しきい値（この順位までならバーを出す）。詳細は厳しめ(20/10)、マーキー/ヒーローは40/20。 */
  maxMlb: number;
  maxLg: number;
  variant?: 'rail' | 'hero';
}) {
  if (!rank) return null;
  const showMlb = typeof rank.mlb === 'number' && rank.mlb <= maxMlb;
  const showLg = typeof rank.lg === 'number' && rank.lg <= maxLg;
  if (!showMlb && !showLg) return null;

  // バーを動かす主順位（MLBがあればMLB＝ノイズを減らす）。伸び率スケールはしきい値と独立の固定値。
  const scope: 'mlb' | 'lg' = showMlb ? 'mlb' : 'lg';
  const driver = (scope === 'mlb' ? rank.mlb : rank.lg) as number;
  const scale = scope === 'mlb' ? SCALE_MLB : SCALE_LG;
  const fill = clamp(1 - (driver - 1) / scale, 0.06, 1);

  // 上位感を「赤や記号でなく」3段の濃淡＋字の太さ/字間で誠実に出す。
  // ⚠️ fill 幅だけだと 1位(1.0)と10位(0.775)が同 bg-ink で無差別になるため、トーンを3段に分ける。
  // 1位の特別扱い（赤）は RankMeter に絶対入れない（rail は全選手で共有＝赤が漏れる）。ヒーローに隔離。
  const tier =
    (rank.mlb != null && rank.mlb <= 3) || (rank.lg != null && rank.lg <= 2)
      ? 1
      : (rank.mlb != null && rank.mlb <= 10) || (rank.lg != null && rank.lg <= 5)
        ? 2
        : 3;
  const lgLabel = league === 'AL' ? labels.al : labels.nl;
  const prim = scope === 'mlb' ? `${labels.mlb} ${rank.mlb}${labels.unit}` : `${lgLabel} ${rank.lg}${labels.unit}`;
  // ヒーローでは両方あれば従順位を小さく添える（誠実：両方とも事実）。
  const secondary =
    variant === 'hero' && showMlb && showLg ? `${lgLabel} ${rank.lg}${labels.unit}` : null;
  const aria = secondary ? `${prim}・${secondary}` : prim;

  const trackH = variant === 'hero' ? 'h-[4px]' : 'h-[3px]';
  const labelSize = variant === 'hero' ? 'text-[11px]' : 'text-[10px]';
  const fillTone = tier === 1 ? 'bg-ink' : tier === 2 ? 'bg-ink-soft/70' : 'bg-ink-soft/40';
  const textTone =
    tier === 1 ? 'text-ink font-bold tracking-tight' : tier === 2 ? 'text-ink-soft font-semibold' : 'text-ink-soft font-medium';

  return (
    <div role="img" aria-label={aria} className="w-full">
      <div className={`relative w-full overflow-hidden rounded-full bg-line ${trackH}`}>
        <span
          className={`block h-full origin-left rounded-full ${fillTone} motion-safe:animate-[meter_.45s_ease-out_both]`}
          style={{ transform: `scaleX(${fill})` }}
        />
      </div>
      <div className={`mt-1 flex items-center gap-0.5 tabular-nums ${labelSize} ${textTone}`}>
        <span className="truncate">{prim}</span>
        {secondary && (
          <span aria-hidden="true" className="ml-1 font-medium text-ink-soft">
            {secondary}
          </span>
        )}
      </div>
    </div>
  );
}
