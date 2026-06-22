import type { Rank, League } from '@/lib/playerStats';
import type { RankLabels } from '@/components/RankBadges';
import RankMeter from './RankMeter';

/**
 * マーキーと詳細で“同一構造”の単一バリュー・レール。
 * 行 = [ラベル左 | 数値右揃え | 84px固定メーター枠]。数値が1本の右端に揃ってスキャンが速く、
 * メーター枠を常に確保するので「順位ありセルだけ背高」のレンガ壁＆奇数枚のオーファンが構造的に消える。
 */
export type RailRow = { label: string; value: string; rank?: Rank | null };

export default function StatRail({
  rows,
  league,
  labels,
  dense = false,
}: {
  rows: RailRow[];
  league?: League | null;
  labels: RankLabels;
  /** 詳細表（厳しめの順位しきい値＆やや低い行高）。 */
  dense?: boolean;
}) {
  if (rows.length === 0) return null;
  const rowH = dense ? 'h-11' : 'h-12';
  const maxMlb = dense ? 20 : 40;
  const maxLg = dense ? 10 : 20;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="divide-y divide-line">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`grid grid-cols-[minmax(0,1fr)_auto_84px] items-center gap-3 px-4 ${rowH}`}
          >
            <div className="min-w-0 truncate text-sm text-ink-soft">{r.label}</div>
            <div className="justify-self-end text-base font-semibold tabular-nums text-ink">
              {r.value}
            </div>
            <div className="w-[84px] shrink-0">
              <RankMeter rank={r.rank} league={league} labels={labels} maxMlb={maxMlb} maxLg={maxLg} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
