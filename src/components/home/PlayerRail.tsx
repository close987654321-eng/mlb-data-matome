import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import { headshotUrl } from '@/lib/teams';
import Rail from './Rail';

/** 1 選手ぶんの表示データ（page.tsx 側で pickHero から整形して渡す＝この層は数値を作らない）。 */
export type PlayerRailItem = {
  slug: string;
  /** 行き先。原則は選手LP（/tag/{名前}）＝内部リンクをLPに集める。記事ゼロの選手のみ成績ハブ。 */
  href: string;
  name: string;
  statValue: string;
  statLabel: string | null;
  mlbId: number;
  /** 所属チームの主要カラー（アバターのリング）。未所属なら無し。 */
  teamColor?: string;
};

/**
 * 注目選手レーン。今季の大きな生数字を主役にしたスタッツ・タイル。
 * 休止時は罫も枠もない（編集的に軽い）。ホバー/タップで二枚看板と同じく bg-surface へ微かに持ち上げ＋名前が赤。
 * 数値は公知の事実（スナップショット）のみ＝honest-authority。TOP から選手LP（/tag）への動線
 * （2026-08-01 に成績ハブ行きから変更＝内部リンクをLPに集める）。
 */
export default function PlayerRail({ items }: { items: PlayerRailItem[] }) {
  const t = useTranslations();
  if (items.length === 0) return null;
  return (
    <Rail label={t('home.players')} seeAllHref="/player" seeAllLabel={t('home.playersAll')}>
      {items.map((p) => (
        <li key={p.slug} className="shrink-0 snap-start">
          <Link
            href={p.href}
            className="group block w-32 rounded-[3px] p-3 transition-colors hover:bg-surface"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない） */}
            <img
              src={headshotUrl(p.mlbId, 'spot')}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              className="h-11 w-11 rounded-full bg-paper object-cover"
              style={p.teamColor ? { boxShadow: `0 0 0 2px ${p.teamColor}` } : undefined}
            />
            <span className="mt-2.5 block text-sm font-bold text-ink transition-colors group-hover:text-ink-soft">
              {p.name}
            </span>
            <span className="mt-3 block text-[2rem] font-bold leading-none tracking-[-0.02em] tabular-nums text-ink">
              {p.statValue}
            </span>
            {p.statLabel && (
              <span className="mt-1.5 block text-[10px] uppercase tracking-[0.15em] text-ink-mute">
                {p.statLabel}
              </span>
            )}
          </Link>
        </li>
      ))}
    </Rail>
  );
}
