import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import Rail from './Rail';

/** 1 選手ぶんの表示データ（page.tsx 側で pickHero から整形して渡す＝この層は数値を作らない）。 */
export type PlayerRailItem = {
  slug: string;
  name: string;
  statValue: string;
  statLabel: string | null;
};

/**
 * 注目選手レーン。今季の大きな生数字を主役にしたスタッツ・タイル。
 * 休止時は罫も枠もない（編集的に軽い）。ホバー/タップで二枚看板と同じく bg-surface へ微かに持ち上げ＋名前が赤。
 * 数値は公知の事実（スナップショット）のみ＝honest-authority。TOP から選手ハブへの動線。
 */
export default function PlayerRail({ items }: { items: PlayerRailItem[] }) {
  const t = useTranslations();
  if (items.length === 0) return null;
  return (
    <Rail label={t('home.players')} seeAllHref="/player" seeAllLabel={t('home.playersAll')}>
      {items.map((p) => (
        <li key={p.slug} className="shrink-0 snap-start">
          <Link
            href={`/player/${p.slug}`}
            className="group block w-32 rounded-xl p-3 transition-colors hover:bg-surface"
          >
            <span className="block text-sm font-bold text-ink transition-colors group-hover:text-accent">
              {p.name}
            </span>
            <span className="mt-3 block text-[2rem] font-bold leading-none tabular-nums text-ink">
              {p.statValue}
            </span>
            {p.statLabel && (
              <span className="mt-1.5 block text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                {p.statLabel}
              </span>
            )}
          </Link>
        </li>
      ))}
    </Rail>
  );
}
