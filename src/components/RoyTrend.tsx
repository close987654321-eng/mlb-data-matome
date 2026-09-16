import SectionHeading from '@/components/SectionHeading';
import type { RoyBoard } from '@/lib/royBoard';
import { shortDate, type RoyHistory, type RoyHistRow } from '@/lib/royHistory';

const MAX_DAYS = 12; // 表に出す日数（横スクロールで読める幅）
const TOP_FOR_ROWS = 3; // 期間内に一度でもこの順位以内に入った選手を行に出す

/**
 * 順位の推移＝日次履歴を「行＝選手・列＝日付・セル＝順位」で並べる表。
 * ボードページは今日の表しか出せないので、「首位が替わった日」「日本人が抜いた／抜かれた日」は
 * この表でしか見えない。行は各リーグで期間内に上位 TOP_FOR_ROWS に入ったことのある選手＋日本人。
 * 図でなく表なのは、値が離散（順位）で日数も十数日＝数字をそのまま読めるほうが早いから。
 * 表示名は今日のボードの名前を優先（履歴の古い日はカタカナ未整備の英語名が残っていることがある）。
 */
export default function RoyTrend({ board, history, locale }: { board: RoyBoard; history: RoyHistory | null; locale: string }) {
  if (!history || history.days.length < 2) return null;
  const en = locale === 'en';
  const days = history.days.slice(-MAX_DAYS);

  const nameOf = new Map<number, { ja: string; en: string }>();
  for (const lg of ['AL', 'NL'] as const) for (const r of board.leagues[lg]) nameOf.set(r.id, { ja: r.nameJa, en: r.nameEn });
  for (const d of days) for (const lg of ['AL', 'NL'] as const) for (const r of d[lg]) if (!nameOf.has(r.id)) nameOf.set(r.id, { ja: r.nameJa, en: r.nameEn });

  const t = en
    ? {
        heading: 'How the order has moved',
        lead: `Daily rank on this board, ${shortDate(days[0].date)} to ${shortDate(days[days.length - 1].date)}. Rows are anyone who reached the top ${TOP_FOR_ROWS} in that span, plus the Japanese rookies.`,
        leagues: { AL: 'AL', NL: 'NL' },
        player: 'Player',
        out: 'outside the recorded range',
        note: 'A dash means the player was outside the recorded rows that day (top 12 plus Japanese players). Days without a board update are not shown.',
      }
    : {
        heading: '順位の推移',
        lead: `${shortDate(days[0].date)}から${shortDate(days[days.length - 1].date)}までの、このボード上の日ごとの順位。行は期間内に一度でも${TOP_FOR_ROWS}位以内に入った選手と日本人ルーキーです。`,
        leagues: { AL: 'ア・リーグ', NL: 'ナ・リーグ' },
        player: '選手',
        out: '記録範囲外',
        note: '「-」はその日に記録した行（上位12人と日本人）の外にいたことを示します。ボードが更新されなかった日は列に出ません。',
      };

  return (
    <section className="space-y-4">
      <SectionHeading label={t.heading} lead level="h2" />
      <p className="max-w-prose text-sm text-ink-soft">{t.lead}</p>
      {(['AL', 'NL'] as const).map((lg) => {
        const ids: number[] = [];
        for (const d of days) for (const r of d[lg]) if ((r.rank <= TOP_FOR_ROWS || r.isJp) && !ids.includes(r.id)) ids.push(r.id);
        // 並びは今日の順位（今日居ない選手は末尾）。
        const today = new Map(board.leagues[lg].map((r) => [r.id, r.rank]));
        ids.sort((a, b) => (today.get(a) ?? 999) - (today.get(b) ?? 999));
        if (!ids.length) return null;
        const isJp = (id: number) => days.some((d) => d[lg].some((r) => r.id === id && r.isJp));
        return (
          <div key={lg}>
            <h3 className="mb-2 text-sm font-bold tracking-wide text-ink">{t.leagues[lg]}</h3>
            <div className="overflow-x-auto rounded-[2px] border border-line">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-line text-ink-mute">
                    <th className="sticky left-0 bg-paper px-3 py-2 text-left font-medium">{t.player}</th>
                    {days.map((d) => (
                      <th key={d.date} className="px-2 py-2 text-center font-medium">
                        {shortDate(d.date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ids.map((id) => {
                    const n = nameOf.get(id);
                    const jp = isJp(id);
                    return (
                      <tr key={id} className={`border-b border-line last:border-0 ${jp ? 'bg-ink/[0.04]' : ''}`}>
                        <td className={`sticky left-0 whitespace-nowrap bg-paper px-3 py-1.5 ${jp ? 'font-bold text-ink' : 'font-medium text-ink'}`}>
                          {en ? n?.en : n?.ja}
                        </td>
                        {days.map((d) => {
                          const r: RoyHistRow | undefined = d[lg].find((x) => x.id === id);
                          const first = r?.rank === 1;
                          return (
                            <td key={d.date} className={`px-2 py-1.5 text-center ${first ? 'font-bold text-ink' : r ? 'text-ink-soft' : 'text-ink-mute'}`} title={r ? `${r.score.toFixed(1)}` : t.out}>
                              {r ? r.rank : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] leading-relaxed text-ink-mute">{t.note}</p>
    </section>
  );
}
