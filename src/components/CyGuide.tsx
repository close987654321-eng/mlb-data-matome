import SectionHeading from '@/components/SectionHeading';
import { ROY_SEASON_END } from '@/lib/royFaq';

/**
 * サイ・ヤング賞レースの「見方」＝日程・決め方・規定投球回・日本人の歴代最高順位。
 * 表の数字だけでは答えられない検索意図（いつ決まる／誰が選ぶ／日本人は過去に何位）を定型の事実で受ける面。
 * 出典は BBWAA の投票方式と公開されている投票結果、MLB 公式の日程。制度が変わったらここを直す。
 */

/** サイ・ヤング賞投票で上位に入った日本人（BBWAA 投票結果）。受賞者はまだいない。 */
const JP_FINISHES = [
  { year: 2013, league: 'AL', nameJa: 'ダルビッシュ有', nameEn: 'Yu Darvish', teamJa: 'レンジャーズ', teamEn: 'Rangers', placeJa: '2位', placeEn: '2nd' },
  { year: 2020, league: 'NL', nameJa: 'ダルビッシュ有', nameEn: 'Yu Darvish', teamJa: 'カブス', teamEn: 'Cubs', placeJa: '2位', placeEn: '2nd' },
  { year: 2013, league: 'AL', nameJa: '岩隈久志', nameEn: 'Hisashi Iwakuma', teamJa: 'マリナーズ', teamEn: 'Mariners', placeJa: '3位', placeEn: '3rd' },
  { year: 2025, league: 'NL', nameJa: '山本由伸', nameEn: 'Yoshinobu Yamamoto', teamJa: 'ドジャース', teamEn: 'Dodgers', placeJa: '3位', placeEn: '3rd' },
  { year: 1995, league: 'NL', nameJa: '野茂英雄', nameEn: 'Hideo Nomo', teamJa: 'ドジャース', teamEn: 'Dodgers', placeJa: '4位', placeEn: '4th' },
  { year: 1996, league: 'NL', nameJa: '野茂英雄', nameEn: 'Hideo Nomo', teamJa: 'ドジャース', teamEn: 'Dodgers', placeJa: '4位', placeEn: '4th' },
  { year: 2008, league: 'AL', nameJa: '松坂大輔', nameEn: 'Daisuke Matsuzaka', teamJa: 'レッドソックス', teamEn: 'Red Sox', placeJa: '4位', placeEn: '4th' },
  { year: 2022, league: 'AL', nameJa: '大谷翔平', nameEn: 'Shohei Ohtani', teamJa: 'エンゼルス', teamEn: 'Angels', placeJa: '4位', placeEn: '4th' },
  { year: 2024, league: 'NL', nameJa: '今永昇太', nameEn: 'Shota Imanaga', teamJa: 'カブス', teamEn: 'Cubs', placeJa: '5位', placeEn: '5th' },
];

export default function CyGuide({ locale, season, qualifyIp }: { locale: string; season: number; qualifyIp: number }) {
  const en = locale === 'en';
  const t = en
    ? {
        heading: 'How the award is decided',
        steps: [
          { k: `Regular season ends ${ROY_SEASON_END.en}`, v: 'Everything on this board counts through the final day. Postseason starts do not.' },
          { k: 'Ballots due before the postseason', v: 'Two BBWAA writers per club, 30 per league, each rank five pitchers. Points run 7-4-3-2-1.' },
          { k: 'Winners announced in November', v: 'After the World Series. One winner per league; starters and relievers compete together.' },
        ],
        qualTitle: 'Innings qualification',
        qual: `One inning per team game (162 for a full season). Mid-season the bar is the games played so far, which is why this board’s line sits around ${qualifyIp} IP right now. Voters are not bound by it; this table is.`,
        finishesTitle: 'Best Cy Young finishes by Japanese pitchers',
        finishesLead: 'No Japanese pitcher has won yet. These are the top-five finishes in BBWAA voting.',
        cols: { year: 'Year', player: 'Pitcher', team: 'Team', place: 'Finish' },
        note: 'Vote results from the BBWAA.',
      }
    : {
        heading: 'サイ・ヤング賞の決まり方',
        steps: [
          { k: `レギュラーシーズン最終日は${ROY_SEASON_END.ja}`, v: 'このボードの成績は最終日まで動きます。ポストシーズンでの投球は評価に入りません。' },
          { k: '投票はポストシーズン開幕前に締め切り', v: '全米野球記者協会（BBWAA）の記者が各球団2名×15球団＝リーグ30人。1〜5位の投手を記入し、1位7点・2位4点・3位3点・4位2点・5位1点。' },
          { k: '発表は11月', v: 'ワールドシリーズ終了後に発表。各リーグ1人で、先発と救援を分けずに選びます。' },
        ],
        qualTitle: '規定投球回',
        qual: `チームの試合数×1回（シーズン全体で162回）。シーズン途中はその時点の試合数で判定するので、このボードの目安はいま約${qualifyIp}回です。投票する記者は規定に縛られませんが、この順位表は規定到達者だけを比べています。`,
        finishesTitle: '日本人投手のサイ・ヤング賞投票 最高順位',
        finishesLead: '日本人の受賞者はまだいません。BBWAA投票で5位以内に入った投手を並べています。',
        cols: { year: '年', player: '投手', team: '球団', place: '順位' },
        note: '投票結果はBBWAAに基づきます。',
      };

  return (
    <section className="space-y-5">
      <SectionHeading label={t.heading} lead level="h2" />
      <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-3">
        {t.steps.map((s, i) => (
          <li key={s.k} className="bg-paper px-4 py-3.5">
            <p className="text-[11px] font-medium tabular-nums tracking-[0.18em] text-ink-mute">0{i + 1}</p>
            <p className="mt-1 text-sm font-bold leading-snug text-ink">{s.k}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{s.v}</p>
          </li>
        ))}
      </ol>

      <div className="rounded-[2px] border border-line p-4">
        <h3 className="text-sm font-bold text-ink">{t.qualTitle}</h3>
        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-ink-soft">{t.qual}</p>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold tracking-wide text-ink">{t.finishesTitle}</h3>
        <p className="mb-2 max-w-prose text-xs text-ink-soft">{t.finishesLead}</p>
        <div className="overflow-x-auto rounded-[2px] border border-line">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-mute">
                <th className="px-3 py-2 text-left font-medium">{t.cols.year}</th>
                <th className="px-3 py-2 text-left font-medium">{t.cols.player}</th>
                <th className="px-3 py-2 text-left font-medium">{t.cols.team}</th>
                <th className="px-3 py-2 text-right font-medium">{t.cols.place}</th>
              </tr>
            </thead>
            <tbody>
              {JP_FINISHES.map((w) => (
                <tr key={`${w.year}-${w.nameEn}`} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 tabular-nums text-ink-soft">
                    {w.year} {w.league}
                  </td>
                  <td className="px-3 py-2 font-bold text-ink">{en ? w.nameEn : w.nameJa}</td>
                  <td className="px-3 py-2 text-ink-soft">{en ? w.teamEn : w.teamJa}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">{en ? w.placeEn : w.placeJa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
          {t.note} {en ? `${season} season.` : `${season}年シーズン。`}
        </p>
      </div>
    </section>
  );
}
