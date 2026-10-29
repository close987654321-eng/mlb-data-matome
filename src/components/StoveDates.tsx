import SectionHeading from '@/components/SectionHeading';
import { fmtDate, type ResolvedDate } from '@/lib/stoveLeague';

/**
 * オフの日程（FA解禁→QO期限→労使協定の期限→ウィンターミーティング）。
 *
 * 「MLB FA いつから」「ロックアウト いつ」は日付そのものを問うクエリ＝表で即答する。
 * 日付は**日本時間**（サイトの規約）。現地の締め切りは data の段階で JST に直してある。
 * ワールドシリーズ決着前は「終了から5日後」のまま出し、決着した瞬間に実日付へ変わる。
 * 日本人選手に関わる日は、その一言（jp）を太字で添える＝日本の読者が読み飛ばさない。
 * 出典は行ごとに繰り返すと「Just Baseball ↗」が8回並ぶので、下にまとめて1回だけ出す。
 */
export default function StoveDates({ dates, en }: { dates: ResolvedDate[]; en: boolean }) {
  const nextIdx = dates.findIndex((d) => !d.past);
  const when = (d: ResolvedDate) => {
    if (d.on) return d.end ? `${fmtDate(d.on, en)}${en ? '–' : '〜'}${fmtDate(d.end, en)}` : fmtDate(d.on, en);
    if (d.afterWs === 1) return en ? 'Day after the WS' : 'WS終了の翌日';
    return en ? `${d.afterWs} days after the WS` : `WS終了の${d.afterWs}日後`;
  };
  const sources = [...new Map(dates.map((d) => [d.source, d.sourceName])).entries()];
  return (
    <section id="dates">
      <SectionHeading label={en ? 'Offseason calendar' : 'ストーブリーグの日程'} lead />
      <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
        {en
          ? 'All times are Japan time. Dates tied to the end of the World Series fill in once it is over.'
          : '日付と時刻は日本時間。ワールドシリーズの終了から数える日程は、決着すると実際の日付に変わります。'}
      </p>
      <ol className="mt-4 divide-y divide-line border-y border-line">
        {dates.map((d, i) => (
          <li key={d.key} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold tabular-nums">
              <span className={d.past ? 'text-ink-mute line-through decoration-line' : 'text-ink'}>{when(d)}</span>
              {d.time && !d.past && <span className="text-xs font-normal text-ink-soft">{en ? d.time.en : d.time.ja}</span>}
              {i === nextIdx && (
                <span className="border border-ink px-1.5 py-0.5 text-[11px] font-medium text-ink">{en ? 'Next' : '次'}</span>
              )}
            </p>
            <div>
              <p className={`text-sm leading-relaxed ${d.past ? 'text-ink-mute' : 'text-ink-soft'}`}>{en ? d.en : d.ja}</p>
              {d.jp && (
                <p className={`mt-0.5 text-sm font-semibold leading-relaxed ${d.past ? 'text-ink-mute' : 'text-ink'}`}>
                  {en ? d.jp.en : d.jp.ja}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-mute">
        {en ? 'Sources: ' : '出典：'}
        {sources.map(([url, name], i) => (
          <span key={url}>
            {i > 0 && (en ? ', ' : '、')}
            <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-2 hover:text-ink">
              {name}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}
