import { Link } from '@/lib/navigation';
import { PLAYERS } from '@/lib/players';
import SectionHeading from '@/components/SectionHeading';
import { warRank, type WarRace as WarRaceData, type WarRacePlayer } from '@/lib/warRace';

/** "2026-06-30" を n 日戻す（Δ7日の基準点を引くため）。 */
function subDays(d: string, n: number): string {
  const dt = new Date(`${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

type Entry = WarRacePlayer & { id: string; war: number };

/**
 * WARレース＝大谷＋主なライバルの今季累計WAR（公式）を日次で比較。MVP/サイヤング争いの"第三の山場"。
 * 章見出しを h2 級へ昇格し、折れ線の上にスコアボード（順位＋2位との差リードバー）を置いて独走を絵にする。
 * ⚠️ 大数値(5.8)はヒーローに集約し、ここでは再掲しない（縦二度出し回避＝1点ルール/ファーストビュー予算）。
 * サーバーコンポーネント（静的）。順位は warRank(lib)から動的算出＝ヒーローの赤エンブレムと同じ事実を指す。
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

  const wr = warRank(race, focusId); // {rank, war, runnerUp, gap}＝スコアボードの単一ソース
  const focus = entries.find((e) => e.id === focusKey);

  // 重ねる折れ線は focus＋上位（最大6本）。focus=濃いインク、ライバルは3段濃淡（上位2人=中グレー/以下=薄）。
  const shown = [...new Set([focus, ...entries].filter(Boolean) as Entry[])].slice(0, 6);
  const allDates = [...new Set(shown.flatMap((p) => p.warHistory.map((x) => x.d)))].sort((a, b) => a.localeCompare(b));
  const xi = new Map(allDates.map((d, i) => [d, i]));
  const vals = shown.flatMap((p) => p.warHistory.map((x) => x.war));
  const maxWar = Math.max(...vals);
  const minWar = Math.min(0, ...vals);
  const W = 600;
  const H = 150;
  const pad = 10;
  const span = maxWar - minWar || 1;
  const X = (d: string) => pad + (allDates.length > 1 ? ((xi.get(d) ?? 0) / (allDates.length - 1)) * (W - pad * 2) : 0);
  const Y = (v: number) => H - pad - ((v - minWar) / span) * (H - pad * 2);
  const pathOf = (p: Entry) =>
    p.warHistory.map((x, i) => `${i === 0 ? 'M' : 'L'}${X(x.d).toFixed(1)},${Y(x.war).toFixed(1)}`).join(' ');
  // ライバル線の濃淡：shown 内の順位（focus を除く並び）で上位2人=中グレー、以下=薄。
  const rivalTone = (id: string) => {
    const place = shown.filter((p) => p.id !== focusKey).findIndex((p) => p.id === id);
    return place < 2 ? '#9A9A9D' : '#CDCCC9';
  };
  const focusTopPct = focus ? (Y(focus.war) / H) * 100 : 50; // 終点ラベルの縦位置（overlay）

  const delta7 = (p: Entry): number | null => {
    const latest = p.warHistory.at(-1);
    if (!latest) return null;
    const cut = subDays(latest.d, 7);
    const base = [...p.warHistory].reverse().find((x) => x.d <= cut);
    return base ? Math.round((latest.war - base.war) * 10) / 10 : null;
  };

  const t = en
    ? { title: 'WAR race', sub: 'Season WAR (official) vs key rivals, one point per day. Tracking from when snapshots began.', overall: (r: number) => `MLB #${r} overall`, second: (r: number) => (r === 1 ? '#2' : '#1'), d7: 'Δ7d', war: 'WAR', short: '大谷' }
    : { title: 'WARレース', sub: '今季の累計WAR（公式）を主なライバルと日次で比較。MVP/サイヤング争いを可視化（スナップショット開始以降）。', overall: (r: number) => `MLB 全体${r}位`, second: (r: number) => (r === 1 ? '2位' : '1位'), d7: '直近7日', war: 'WAR', short: '大谷' };

  const refWar = wr?.runnerUp ?? 0;
  const top = Math.max(wr?.war ?? 0, refWar) || 1;

  return (
    <section className="space-y-4" aria-label={t.title}>
      <div>
        <SectionHeading label={t.title} lead level="h2" />
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{t.sub}</p>
      </div>

      {/* スコアボード＝順位＋2位との差リードバー。大数値(5.8)は出さず、長さの差で独走を見せる。 */}
      {wr && (
        <div className="rounded-[2px] border border-line p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-wide text-ink sm:text-lg">{t.overall(wr.rank)}</span>
            {wr.runnerUp != null && wr.gap != null && (
              <span className="text-xs tabular-nums text-ink-mute">
                {t.second(wr.rank)} {wr.runnerUp.toFixed(1)}・{wr.gap >= 0 ? '+' : '−'}
                {Math.abs(wr.gap).toFixed(1)}
              </span>
            )}
          </div>
          {wr.runnerUp != null && (
            <div className="mt-2.5 max-w-[300px] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 truncate text-[11px] font-semibold text-ink">{focus ? focus.nameJa.slice(0, 4) : t.short}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-[2px] bg-line">
                  <span className="block h-full bg-ink" style={{ width: `${((wr.war ?? 0) / top) * 100}%` }} />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-[11px] text-ink-mute">{t.second(wr.rank)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-[2px] bg-line">
                  <span className="block h-full bg-ink-soft/45" style={{ width: `${(refWar / top) * 100}%` }} />
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 重ね折れ線（focus=濃いインク2px／ライバル=3段濃淡）。終点に focus 名のチップ＋0基準線。 */}
      <div className="relative rounded-[2px] border border-line p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none" role="img" aria-label={t.title}>
          {/* 0基準線（最小値が0でないときの底） */}
          <line x1={pad} y1={Y(minWar)} x2={W - pad} y2={Y(minWar)} stroke="#E7E6E3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {shown
            .filter((p) => p.id !== focusKey)
            .map((p) => (
              <path key={p.id} d={pathOf(p)} fill="none" stroke={rivalTone(p.id)} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            ))}
          {focus && <path d={pathOf(focus)} fill="none" stroke="#191A1C" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
          {focus && <circle cx={X(focus.warHistory.at(-1)!.d)} cy={Y(focus.war)} r={2.5} fill="#191A1C" />}
        </svg>
        {/* 終点ラベル（HTMLオーバーレイ＝SVGのpreserveAspectRatio none による文字の歪みを避ける）。名前のみ（5.8は再掲しない）。 */}
        {focus && (
          <span
            className="pointer-events-none absolute right-2 -translate-y-1/2 rounded-[2px] bg-paper/90 px-1.5 text-[11px] font-bold text-ink"
            style={{ top: `${focusTopPct}%` }}
          >
            {focus.nameJa.slice(0, 4)}
          </span>
        )}
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
                <tr key={p.id} className={`border-b border-line last:border-0 ${isFocus ? 'bg-ink/[0.04]' : ''}`}>
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
