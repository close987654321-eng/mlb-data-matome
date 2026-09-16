import type { NpbRank } from '@/lib/npbStats';

/**
 * 今季のリーグ内順位（NPB公式リーダーズ由来）のチップ列。成績ブロックの直下に置く。
 *
 * なぜ順位なのか: 生の数値（.315 / 1.36）だけでは、そのシーズンでどれだけ figure なのかが
 * 日本のプロ野球を追っていない読者に伝わらない。「セ・リーグ1位」の1語が付くと、
 * 「{選手名} タイトル」「{選手名} 三冠王」「{選手名} 最優秀防御率」まで面が伸びる。
 * トップ3の部門だけ出す（下位の順位は情報にならず、表を薄める）。
 */
export default function ProspectRanks({
  ranks,
  en,
  label,
}: {
  ranks: NpbRank[];
  en: boolean;
  /** 「2026年 セ・リーグ内順位」等の既訳文字列。 */
  label: string;
}) {
  if (!ranks.length) return null;
  return (
    <div className="mt-4 border-t border-line/70 pt-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {ranks.map((r) => (
          <li
            key={r.ja}
            className={`inline-flex items-baseline gap-1.5 rounded-[2px] border px-2.5 py-1 text-xs ${
              // 1位だけ罫を濃くする＝色を使わずに「トップ」を立てる（サイトの無彩色規律）
              r.rank === 1 ? 'border-ink text-ink' : 'border-line text-ink-soft'
            }`}
          >
            <span>{en ? r.en : r.ja}</span>
            <span className="font-semibold tabular-nums">
              {en ? `#${r.rank}` : `${r.rank}位`}
            </span>
            <span className="tabular-nums text-ink-mute">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
