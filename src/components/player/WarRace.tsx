import { Link } from '@/lib/navigation';
import { PLAYERS } from '@/lib/players';
import SectionHeading from '@/components/SectionHeading';
import { type WarRace as WarRaceData, type WarRacePlayer } from '@/lib/warRace';

/** "2026-06-30" を n 日戻す（Δ7日の基準点を引くため）。 */
function subDays(d: string, n: number): string {
  const dt = new Date(`${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

type Entry = WarRacePlayer & { id: string; war: number };

/**
 * WARレース＝大谷＋主なライバルの今季累計WAR（公式）を順位表で比較。MVP/サイヤング争いの“第三の山場”。
 * 折れ線＋スコアボード（リードバー）の2グラフは「わかりづらい」とのオーナー判断で撤去し、選手が並ぶ
 * 順位表だけに集約（2026-06-30）。順位の特別扱い（赤エンブレム）はヒーローに隔離＝ここは無彩色の表のみ。
 * サーバーコンポーネント（静的）。順位は war 降順、大谷の行を強調＋直近7日の伸び(Δ7日)を併記。
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

  const delta7 = (p: Entry): number | null => {
    const latest = p.warHistory.at(-1);
    if (!latest) return null;
    const cut = subDays(latest.d, 7);
    const base = [...p.warHistory].reverse().find((x) => x.d <= cut);
    return base ? Math.round((latest.war - base.war) * 10) / 10 : null;
  };

  const t = en
    ? { title: 'WAR race', sub: 'Season WAR (official) vs key rivals — the MVP / Cy Young race, with each rival’s last-7-day gain.', war: 'WAR', d7: 'Δ7d' }
    : { title: 'WARレース', sub: '今季の累計WAR（公式）でMVP/サイヤング争いを順位表に。直近7日の伸び（Δ7日）も併記。', war: 'WAR', d7: '直近7日' };

  return (
    <section className="space-y-4" aria-label={t.title}>
      <div>
        <SectionHeading label={t.title} lead level="h2" />
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{t.sub}</p>
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
