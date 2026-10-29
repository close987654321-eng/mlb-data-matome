import SectionHeading from '@/components/SectionHeading';
import type { ResolvedDate } from '@/lib/stoveLeague';

/**
 * オフの日程（FA解禁→QO期限→労使協定の期限→ウィンターミーティング）。
 *
 * 「MLB FA いつから」「ロックアウト いつ」は日付そのものを問うクエリ＝表で即答する。
 * ワールドシリーズ決着前は「終了から5日後」のまま出し、決着した瞬間に実日付へ変わる
 * （postseason.json の最終戦から数える＝手で書き換えない）。日付は現地（ET）。
 */
export default function StoveDates({ dates, en }: { dates: ResolvedDate[]; en: boolean }) {
  const nextIdx = dates.findIndex((d) => !d.past);
  const fmt = (iso: string) =>
    en
      ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      : `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日`;
  const when = (d: ResolvedDate) => {
    if (d.on) return d.end ? `${fmt(d.on)}${en ? '–' : '〜'}${fmt(d.end)}` : fmt(d.on);
    if (d.afterWs === 1) return en ? 'Day after WS' : 'WS終了の翌日';
    return en ? `WS end +${d.afterWs}d` : `WS終了の${d.afterWs}日後`;
  };
  return (
    <section id="dates">
      <SectionHeading label={en ? 'Offseason calendar' : 'ストーブリーグの日程'} lead />
      <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
        {en
          ? 'Dates are U.S. Eastern. Dates tied to the end of the World Series fill in once it is over.'
          : '日付は現地時間（日本時間は半日ほど先）。ワールドシリーズ終了から数える日程は、決着すると実際の日付に変わります。'}
      </p>
      <ol className="mt-4 divide-y divide-line border-y border-line">
        {dates.map((d, i) => (
          <li
            key={d.key}
            className={`grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4 ${d.past ? 'text-ink-mute' : ''}`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold tabular-nums text-ink">
              <span className={d.past ? 'text-ink-mute line-through decoration-line' : ''}>{when(d)}</span>
              {i === nextIdx && (
                <span className="border border-ink px-1.5 py-0.5 text-[11px] font-medium">{en ? 'Next' : '次'}</span>
              )}
            </p>
            <div>
              <p className={`max-w-prose text-sm leading-relaxed ${d.past ? 'text-ink-mute' : 'text-ink-soft'}`}>
                {en ? d.en : d.ja}
              </p>
              <a
                href={d.source}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-xs text-ink-mute underline decoration-line underline-offset-2 hover:text-ink"
              >
                {d.sourceName} <span aria-hidden>↗</span>
              </a>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
