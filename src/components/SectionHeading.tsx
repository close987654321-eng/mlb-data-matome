import { Link } from '@/lib/navigation';

/**
 * セクション見出しの統一プリミティブ。
 * 旧来の「赤い縦バー＋uppercase ラベル」をサイト全面で反復していたのが“テンプレ感（AIっぽさ）”の
 * 主因だったため、無彩色の編集的見出しに置き換える: ラベル → 任意の件数 → 行末まで伸びるヘアライン罫 →
 * 任意の「すべて見る →」。罫が行を満たす雑誌的なレイアウトで、色を使わずに区切りと階層を出す。
 */
export default function SectionHeading({
  label,
  count,
  seeAllHref,
  seeAllLabel,
  lead = false,
  level = 'h2',
}: {
  label: React.ReactNode;
  /** その競技/棚の総数（在庫量を実数で添える）。 */
  count?: number;
  seeAllHref?: string;
  seeAllLabel?: string;
  /** 主役セクション（MLB 等）。見出しを一段大きく。 */
  lead?: boolean;
  /** 見出しの論理レベル。級数整理（関連選手=h3降格 / WARレース=h2昇格）で見出しアウトラインを平坦化させない。 */
  level?: 'h2' | 'h3';
}) {
  const Heading = level;
  return (
    <div className="flex items-baseline gap-3">
      <Heading
        className={`tracking-wide text-ink ${lead ? 'text-base font-bold sm:text-lg' : 'text-sm font-semibold'}`}
      >
        {label}
      </Heading>
      {typeof count === 'number' && (
        <span className="text-xs tabular-nums text-ink-mute">{count}</span>
      )}
      <span className="h-px flex-1 self-center bg-line" aria-hidden />
      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="shrink-0 text-xs text-ink-soft transition-colors hover:text-ink"
        >
          {seeAllLabel} <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
