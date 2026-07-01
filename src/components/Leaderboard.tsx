import { Link } from '@/lib/navigation';
import { headshotUrl } from '@/lib/teams';

/**
 * 順位付きリーダーボード（1指標＝1ボード）。CompareTable が「見比べ（横に指標を並べる）」なのに対し、
 * こちらは「1指標で縦に順位を付ける」＝『日本人MLB選手 WAR/本塁打 ランキング』の検索意図に一致する面。
 * 各行は選手ハブ /player/[slug] への内部リンク＝検索で着地→ハブへ沈める母艦動線を担う。
 * デザインは無彩色規律（[[design-system-monochrome]]）: チーム色を使わず、上位の強調も濃淡だけで表す。
 * サーバーコンポーネント（ソート不要＝順位確定済みで渡す）。数値は捏造せずスナップショット由来のみ。
 */
export type LeaderRow = {
  rank: number;
  slug: string;
  name: string;
  team?: string;
  mlbId: number;
  value: string; // 整形済みの表示値（例 "3.1" / ".296" / "1.58"）
};

export default function Leaderboard({ rows, unit }: { rows: LeaderRow[]; unit?: string }) {
  if (rows.length === 0) return null;
  return (
    <ol className="mt-3 border-y border-line">
      {rows.map((r) => (
        <li key={r.slug} className="border-t border-line first:border-t-0">
          <Link
            href={`/player/${r.slug}`}
            className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-paper sm:gap-4"
          >
            <span
              className={`w-6 shrink-0 text-center text-sm font-bold tabular-nums ${
                r.rank <= 3 ? 'text-ink' : 'text-ink-mute'
              }`}
            >
              {r.rank}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない） */}
            <img
              src={headshotUrl(r.mlbId, 'spot')}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              className="h-9 w-9 shrink-0 rounded-full bg-paper object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink group-hover:underline">
                {r.name}
              </span>
              {r.team && <span className="block truncate text-xs text-ink-soft">{r.team}</span>}
            </span>
            <span className="shrink-0 whitespace-nowrap text-right">
              <span className="text-base font-bold tabular-nums text-ink sm:text-lg">{r.value}</span>
              {unit && <span className="ml-0.5 text-xs text-ink-soft">{unit}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
