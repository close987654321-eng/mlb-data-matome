import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { headshotUrl, teamLogoUrl } from '@/lib/teams';
import type { MvpRow, MvpBoard } from '@/lib/mvpBoard';
import { dayAtLeastBefore, leaderStreak, previousDay, type RoyHistory } from '@/lib/boardHistory';

/**
 * /mvp の表の前に置く「いまのレース」＝表を読む前に、検索者の問いに先に答える面（RoyRaceNow / CyRaceNow の野手版）。
 *   1) 各リーグの首位は誰で、何日座っていて、2位との差はいくらか
 *   2) 日本人は何位で、首位とどれだけ離れていて、1週間でどう動いたか
 *   3) その順位はスコアのどの内訳（wRC+／xwOBA／本塁打／WAR／走塁／守備）から来ているか
 * すべてボード JSON と日次履歴の再表示だけ＝文章の値は毎日CIで組み替わる。断定の語は使わない。
 */
export default function MvpRaceNow({ board, history, locale }: { board: MvpBoard; history: RoyHistory | null; locale: string }) {
  const en = locale === 'en';
  const prev = previousDay(history, board.asOf);
  const weekAgo = dayAtLeastBefore(history, board.asOf, 6);
  const jpRows = [...board.leagues.NL, ...board.leagues.AL].filter((r) => r.isJp).sort((a, b) => a.rank - b.rank);

  const t = en
    ? {
        heading: 'The race right now',
        leader: (lg: 'AL' | 'NL') => (lg === 'AL' ? 'AL leader' : 'NL leader'),
        gap: 'gap to 2nd',
        streak: (d: number, c: number, back: boolean, from: string) =>
          d > 1
            ? `${d} straight recorded days on top · ${c} lead change${c === 1 ? '' : 's'} since ${from}`
            : `${back ? 'back on top today' : 'took the lead today'} · ${c} lead change${c === 1 ? '' : 's'} since ${from}`,
        jpHeading: 'Where the Japanese hitters stand',
        toLeader: 'behind the leader',
        vs: (d: string) => `vs ${d}`,
        breakdown: 'Score breakdown (percentile within league)',
        labels: { wrc: 'wRC+', xwoba: 'xwOBA', hr: 'HR', war: 'WAR', run: 'BsR', def: 'Def' },
        detail: 'Full breakdown',
        noHistory: 'Daily history starts accumulating from today.',
      }
    : {
        heading: 'いまのレース',
        leader: (lg: 'AL' | 'NL') => (lg === 'AL' ? 'ア・リーグ首位' : 'ナ・リーグ首位'),
        gap: '2位との差',
        streak: (d: number, c: number, back: boolean, from: string) =>
          d > 1 ? `記録のある${d}日連続で首位・${from}以降の首位交代${c}回` : `${back ? 'きょう首位に戻った' : 'きょう首位に立った'}・${from}以降の首位交代${c}回`,
        jpHeading: '日本人打者の現在地',
        toLeader: '首位との差',
        vs: (d: string) => `${d}比`,
        breakdown: 'スコアの内訳（リーグ内の上位％）',
        labels: { wrc: 'wRC+', xwoba: 'xwOBA', hr: '本塁打', war: 'WAR', run: '走塁', def: '守備' },
        detail: 'スコアの内訳を見る',
        noHistory: '日次の履歴はきょうから積み上がります。',
      };

  return (
    <section className="space-y-5">
      <SectionHeading label={t.heading} lead level="h2" />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-2">
        {(['NL', 'AL'] as const).map((lg) => {
          const rows = board.leagues[lg];
          const top = rows[0];
          if (!top) return null;
          const second = rows[1];
          const st = leaderStreak(history, lg, top.id);
          const name = en ? top.nameEn : top.nameJa;
          const from = st.from ? shortDateLabel(st.from, en) : '';
          return (
            <div key={lg} className="bg-paper px-4 py-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-mute">{t.leader(lg)}</p>
              <div className="mt-2 flex items-start gap-3">
                <Avatar mlbId={top.id} teamId={top.teamId} name={name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold leading-tight text-ink">
                    <Link href={`/mvp/${top.id}`} className="hover:underline">
                      {name}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    {en ? top.teamEn : top.teamJa} · {top.avg} · {top.ops} OPS · {top.hr} {en ? 'HR' : '本'} · WAR {top.warTotal?.toFixed(1) ?? '—'}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="text-2xl font-bold leading-none text-ink">{top.score.toFixed(1)}</p>
                  {second && (
                    <p className="mt-1 text-[11px] text-ink-mute">
                      {t.gap} {(top.score - second.score).toFixed(1)}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">
                {history && st.leaders.length ? t.streak(st.days, st.changes, st.leaders.length > 1 && st.leaders[0].id === top.id, from) : t.noHistory}
                {second ? (
                  <>
                    {' '}
                    · {en ? '2nd:' : '2位'} {en ? second.nameEn : second.nameJa}（{second.score.toFixed(1)}）
                  </>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>

      {jpRows.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold tracking-wide text-ink">{t.jpHeading}</h3>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
            {jpRows.map((row) => (
              <JpCard
                key={row.id}
                row={row}
                board={board}
                prevRank={prev?.[row.league].find((r) => r.id === row.id)?.rank ?? null}
                week={weekAgo ? { date: weekAgo.date, row: weekAgo[row.league].find((r) => r.id === row.id) ?? null } : null}
                en={en}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

type T = {
  toLeader: string;
  vs: (d: string) => string;
  breakdown: string;
  labels: { wrc: string; xwoba: string; hr: string; war: string; run: string; def: string };
  detail: string;
};

function JpCard({
  row,
  board,
  prevRank,
  week,
  en,
  t,
}: {
  row: MvpRow;
  board: MvpBoard;
  prevRank: number | null;
  week: { date: string; row: { rank: number; score: number } | null } | null;
  en: boolean;
  t: T;
}) {
  const leader = board.leagues[row.league][0];
  const name = en ? row.nameEn : row.nameJa;
  const gap = leader && leader.id !== row.id ? (leader.score - row.score).toFixed(1) : null;
  const delta = prevRank == null ? null : prevRank - row.rank;
  const weekDelta = week?.row ? week.row.rank - row.rank : null;
  const weekScore = week?.row ? row.score - week.row.score : null;
  const lgLabel = en ? row.league : row.league === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';
  const warTxt =
    row.warPitch != null && row.warTotal != null
      ? en
        ? `${row.warTotal.toFixed(1)} WAR (incl. ${row.warPitch.toFixed(1)} pitching)`
        : `WAR${row.warTotal.toFixed(1)}（投手${row.warPitch.toFixed(1)}込み）`
      : en
        ? `${row.warTotal?.toFixed(1) ?? '—'} WAR`
        : `WAR${row.warTotal?.toFixed(1) ?? '—'}`;
  const stat = en
    ? `${row.avg} · ${row.ops} OPS · ${row.hr} HR · ${row.sbs} SB · ${warTxt}`
    : `打率${row.avg} · OPS${row.ops} · ${row.hr}本 · ${row.sbs}盗塁 · ${warTxt}`;
  const bars: { label: string; v: number }[] = [
    { label: t.labels.wrc, v: row.pct.wrc },
    { label: t.labels.xwoba, v: row.pct.xwoba },
    { label: t.labels.hr, v: row.pct.hr },
    { label: t.labels.war, v: row.pct.war },
    { label: t.labels.run, v: row.pct.run },
    ...(row.pos === 'TWP' ? [] : [{ label: t.labels.def, v: row.pct.def }]),
  ];

  return (
    <div className="bg-paper px-4 py-3.5">
      <div className="flex items-start gap-3">
        <Avatar mlbId={row.id} teamId={row.teamId} name={name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight text-ink">
            <Link href={`/mvp/${row.id}`} className="hover:underline">
              {name}
            </Link>
          </p>
          <p className="mt-0.5 text-xs text-ink-mute">
            {en ? row.teamEn : row.teamJa} · {lgLabel}
          </p>
        </div>
        <div className="text-right tabular-nums">
          <p className="text-2xl font-bold leading-none text-ink">
            {row.rank}
            <span className="text-sm font-medium text-ink-mute">{en ? ord(row.rank) : '位'}</span>
          </p>
          {delta != null && delta !== 0 && (
            <p className="mt-1 text-[11px] text-ink-mute">
              {delta > 0 ? '▲' : '▼'}
              {Math.abs(delta)} {en ? 'vs yesterday' : '前日比'}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums">
        <div>
          <dt className="text-ink-mute">{en ? 'Score' : 'スコア'}</dt>
          <dd className="font-bold text-ink">{row.score.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-ink-mute">{t.toLeader}</dt>
          <dd className="font-medium text-ink">{gap == null ? (en ? 'leads' : '首位') : `-${gap}`}</dd>
        </div>
        {week?.row && (
          <div className="col-span-2">
            <dt className="text-ink-mute">{t.vs(shortDateLabel(week.date, en))}</dt>
            <dd className="text-ink-soft">
              {weekDelta === 0 ? (en ? 'same rank' : '順位は同じ') : `${weekDelta! > 0 ? '▲' : '▼'}${Math.abs(weekDelta!)}`}
              {' · '}
              {en ? 'score' : 'スコア'} {weekScore! >= 0 ? '+' : ''}
              {weekScore!.toFixed(1)}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{stat}</p>

      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">{t.breakdown}</p>
        <ul className="mt-1.5 space-y-1">
          {bars.map((b) => (
            <li key={b.label} className="flex items-center gap-2 text-[11px] tabular-nums">
              <span className="w-12 shrink-0 text-ink-mute">{b.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-[1px] bg-line" aria-hidden>
                <span className="block h-full bg-ink" style={{ width: `${Math.max(2, Math.min(100, b.v))}%` }} />
              </span>
              <span className="w-12 shrink-0 text-right text-ink">{en ? `${b.v}` : `上位${100 - b.v}%`}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-right text-[11px]">
          <Link href={`/mvp/${row.id}`} className="text-ink-soft hover:text-ink hover:underline">
            {t.detail} <span aria-hidden>→</span>
          </Link>
        </p>
      </div>
    </div>
  );
}

function Avatar({ mlbId, teamId, name, size = 40 }: { mlbId: number; teamId: number | null; name: string; size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない） */}
      <img
        src={headshotUrl(mlbId, 'spot')}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        className="h-full w-full rounded-full bg-line object-cover object-top"
      />
      {teamId ? (
        // eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク
        <img
          src={teamLogoUrl(teamId)}
          alt=""
          width={16}
          height={16}
          loading="lazy"
          className="absolute -bottom-1 -right-1 h-4 w-4 rounded-[2px] bg-paper object-contain p-px ring-1 ring-line"
        />
      ) : null}
    </span>
  );
}

function ord(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

function shortDateLabel(date: string, en: boolean): string {
  const m = date.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return date;
  return en ? `${Number(m[1])}/${Number(m[2])}` : `${Number(m[1])}月${Number(m[2])}日`;
}
