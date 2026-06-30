import { Link } from '@/lib/navigation';
import { PLAYERS } from '@/lib/players';
import type { WarRace as WarRaceData, WarRacePlayer } from '@/lib/warRace';

/** "2026-06-30" を n 日戻す（Δ7日の基準点を引くため）。 */
function subDays(d: string, n: number): string {
  const dt = new Date(`${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

type Entry = WarRacePlayer & { id: string; war: number };

/**
 * WARレース＝大谷＋主なライバルの今季累計WAR（公式）を日次で比較。MVP/サイヤング争いの可視化。
 * 上位を重ねた折れ線（focus=大谷を濃く）＋順位表（Δ7日つき・focus強調）。サーバーコンポーネント（静的）。
 */
export default function WarRace({ race, focusId, locale }: { race: WarRaceData; focusId: number; locale: string }) {
  const en = locale === 'en';
  const focusKey = String(focusId);
  const slugByMlbId = new Map(PLAYERS.map((p) => [String(p.mlbId), p.slug]));

  const entries: Entry[] = Object.entries(race.players)
    .map(([id, p]) => ({ ...p, id, war: p.warHistory.at(-1)?.war ?? 0 }))
    .filter((p) => p.warHistory.length > 0)
    .sort((a, b) => b.war - a.war);
  if (entries.length < 2) return null;

  const rank = entries.findIndex((e) => e.id === focusKey) + 1;
  const focus = entries.find((e) => e.id === focusKey);

  // 重ねる折れ線は focus＋上位（最大6本）。
  const shown = [...new Set([focus, ...entries].filter(Boolean) as Entry[])].slice(0, 6);
  const allDates = [...new Set(shown.flatMap((p) => p.warHistory.map((x) => x.d)))].sort((a, b) => a.localeCompare(b));
  const xi = new Map(allDates.map((d, i) => [d, i]));
  const vals = shown.flatMap((p) => p.warHistory.map((x) => x.war));
  const maxWar = Math.max(...vals);
  const minWar = Math.min(0, ...vals);
  const W = 600;
  const H = 120;
  const pad = 8;
  const span = maxWar - minWar || 1;
  const X = (d: string) => pad + (allDates.length > 1 ? ((xi.get(d) ?? 0) / (allDates.length - 1)) * (W - pad * 2) : 0);
  const Y = (v: number) => H - pad - ((v - minWar) / span) * (H - pad * 2);
  const pathOf = (p: Entry) =>
    p.warHistory.map((x, i) => `${i === 0 ? 'M' : 'L'}${X(x.d).toFixed(1)},${Y(x.war).toFixed(1)}`).join(' ');

  const delta7 = (p: Entry): number | null => {
    const latest = p.warHistory.at(-1);
    if (!latest) return null;
    const cut = subDays(latest.d, 7);
    const base = [...p.warHistory].reverse().find((x) => x.d <= cut);
    return base ? Math.round((latest.war - base.war) * 10) / 10 : null;
  };

  const t = en
    ? { title: 'WAR race', sub: 'Season WAR (official) vs key rivals, one point per day. Tracking from when snapshots began.', rankLine: `Ohtani — MLB #${rank} by WAR`, d7: 'Δ7d', war: 'WAR' }
    : { title: 'WARレース', sub: '今季の累計WAR（公式）を主なライバルと日次で比較。MVP/サイヤング争いを可視化（スナップショット開始以降）。', rankLine: `大谷 — WAR MLB${rank}位`, d7: '直近7日', war: 'WAR' };

  return (
    <section className="space-y-3" aria-label={t.title}>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-bold tracking-wide text-ink sm:text-lg">{t.title}</h3>
          {rank > 0 && <span className="text-sm font-bold tabular-nums text-ink">{t.rankLine}</span>}
        </div>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{t.sub}</p>
      </div>

      {/* 重ね折れ線（focus=濃いインク／他=薄いグレー）。凡例は下の順位表が兼ねる。 */}
      <div className="rounded-[2px] border border-line p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none" role="img" aria-label={t.title}>
          {shown.map((p) => {
            const isFocus = p.id === focusKey;
            return (
              <path
                key={p.id}
                d={pathOf(p)}
                fill="none"
                stroke={isFocus ? '#191A1C' : '#C9C8C5'}
                strokeWidth={isFocus ? 2 : 1}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            );
          })}
          {focus && <circle cx={X(focus.warHistory.at(-1)!.d)} cy={Y(focus.war)} r={2.5} fill="#191A1C" />}
        </svg>
      </div>

      {/* 順位表（Δ7日つき・大谷を強調）。各選手のハブへ横リンク（回遊）。 */}
      <div className="overflow-x-auto rounded-[2px] border border-line">
        <table className="w-full min-w-[420px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-ink-mute">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium"> </th>
              <th className="px-3 py-2 text-right font-semibold text-ink">{t.war}</th>
              <th className="px-3 py-2 text-right font-medium">{t.d7}</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 12).map((p, i) => {
              const isFocus = p.id === focusKey;
              const d7 = delta7(p);
              const slug = slugByMlbId.get(p.id);
              return (
                <tr key={p.id} className={`border-b border-line/50 last:border-0 ${isFocus ? 'bg-ink/[0.04]' : ''}`}>
                  <td className="px-3 py-1.5 text-left text-ink-mute">{i + 1}</td>
                  <td className={`px-3 py-1.5 text-left ${isFocus ? 'font-bold text-ink' : 'text-ink-soft'}`}>
                    {slug ? (
                      <Link href={`/player/${slug}`} className="hover:text-ink hover:underline">
                        {p.nameJa}
                      </Link>
                    ) : (
                      p.nameJa
                    )}
                    {p.league && <span className="ml-1.5 text-xs text-ink-mute">{p.league}</span>}
                  </td>
                  <td className={`px-3 py-1.5 text-right ${isFocus ? 'font-bold text-ink' : 'text-ink'}`}>{p.war.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-soft">
                    {d7 == null ? '—' : `${d7 >= 0 ? '+' : '−'}${Math.abs(d7).toFixed(1)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
