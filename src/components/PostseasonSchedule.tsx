import SectionHeading from '@/components/SectionHeading';
import { gameWhen, leagueName, roundName, scheduleByJstDay, teamLabel, type PostseasonData, type ScheduleDay, type ScheduleRow } from '@/lib/postseason';
import type { Locale } from '@/lib/i18n';

/**
 * 試合日程・結果（日本時間）。トーナメント表はシリーズ単位で日程を <details> に畳んでいるので、
 * 「mlb ポストシーズン 日程」「日本時間」で来た人が日付から引ける面が無かった（2026-10-06 の GSC と
 * Google トレンドで「日程」「日本時間」「結果」が急上昇）。ここは日付→試合の順に開いたまま並べる。
 *
 * これからの試合は全部、終わった試合は直近3日だけ開き、残りは <details> に畳む（JSなし・HTMLには全文載る）。
 * 値は data/postseason.json の再表示だけ（scheduleByJstDay）。
 */
const OPEN_PAST_DAYS = 3;

export default function PostseasonSchedule({ data, locale }: { data: PostseasonData; locale: Locale }) {
  const en = locale === 'en';
  const { upcoming, past } = scheduleByJstDay(data, en);
  if (!upcoming.length && !past.length) return null;
  const openPast = past.slice(0, OPEN_PAST_DAYS);
  const foldedPast = past.slice(OPEN_PAST_DAYS);

  return (
    <section id="schedule" className="space-y-5">
      <div>
        <SectionHeading label={en ? 'Schedule & results (JST)' : '試合日程・結果（日本時間）'} lead level="h2" />
        <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
          {en
            ? 'All times in Japan Standard Time. “If necessary” games are played only if the series is still undecided. Games whose start time is not set yet show the US date.'
            : '時刻はすべて日本時間です。「必要な場合」の試合は、それまでに勝ち抜けが決まっていなければ行われます。開始時刻が未定の試合は現地の日付で載せています。'}
        </p>
      </div>

      {upcoming.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-ink">{en ? 'Upcoming' : 'これからの試合'}</h3>
          <DayList days={upcoming} en={en} />
        </div>
      )}

      {openPast.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-ink">{en ? 'Results' : 'これまでの結果'}</h3>
          <DayList days={openPast} en={en} />
          {foldedPast.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-ink-soft hover:text-ink">
                {en ? `Earlier results (${foldedPast.length} days)` : `それより前の結果（${foldedPast.length}日分）`}
              </summary>
              <div className="mt-3">
                <DayList days={foldedPast} en={en} />
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function DayList({ days, en }: { days: ScheduleDay[]; en: boolean }) {
  return (
    <div className="border-y border-line">
      {days.map((day) => (
        <div key={day.key} className="border-b border-line py-3 last:border-b-0">
          <p className="text-xs font-semibold tabular-nums text-ink-mute">{day.label}</p>
          <ul className="mt-1.5 space-y-1.5">
            {day.rows.map((r) => (
              <GameLine key={r.game.gamePk} row={r} en={en} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GameLine({ row, en }: { row: ScheduleRow; en: boolean }) {
  const { game: g, series: s } = row;
  const away = teamLabel(g.away.id!, en);
  const home = teamLabel(g.home.id!, en);
  const final = g.state === 'Final';
  const live = g.state === 'Live';
  // 時刻だけを左に出す（日付は見出しにある）。gameWhen は「10/7（水）9:00」の形なので時刻部分を取り出す。
  const when = g.tbd ? (en ? 'TBD' : '未定') : gameWhen(g, en).replace(/^.*?(\d{1,2}:\d{2}).*$/, '$1');
  const round = `${s.league ? `${en ? s.league : leagueName(s.league, false)} ` : ''}${roundName(s.round, en, true)}`;
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
      <span className="w-12 shrink-0 tabular-nums text-ink-soft">{when}</span>
      <span className="text-xs text-ink-mute">
        {round} {en ? `G${g.n}` : `第${g.n}戦`}
        {g.ifNecessary && !final && <span className="ml-1">{en ? '(if necessary)' : '（必要な場合）'}</span>}
      </span>
      <span className="text-ink">
        {final && g.away.score != null && g.home.score != null ? (
          <>
            <span className={g.away.score > g.home.score ? 'font-bold' : ''}>{away}</span>{' '}
            <span className="tabular-nums">
              {g.away.score}-{g.home.score}
            </span>{' '}
            <span className={g.home.score > g.away.score ? 'font-bold' : ''}>{home}</span>
          </>
        ) : (
          <>
            {away} {en ? 'at' : '対'} {home}
            {live && <span className="ml-2 text-xs font-semibold text-ink">{en ? 'In progress' : '試合中'}</span>}
          </>
        )}
      </span>
    </li>
  );
}
