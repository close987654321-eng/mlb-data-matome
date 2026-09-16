import SectionHeading from '@/components/SectionHeading';
import { ROY_SEASON_END } from '@/lib/royFaq';

/**
 * MVPレースの「見方」＝日程・決め方・規定打席・日本人の受賞歴。
 * 表の数字だけでは答えられない検索意図（いつ決まる／誰が選ぶ／日本人は何回獲った）を定型の事実で受ける面。
 * 出典は BBWAA の投票方式と公開されている投票結果、MLB 公式の日程。制度が変わったらここを直す。
 */

/** 日本人の MVP 受賞（BBWAA 投票結果）。 */
const JP_WINNERS = [
  { year: 2001, league: 'AL', nameJa: 'イチロー', nameEn: 'Ichiro Suzuki', teamJa: 'マリナーズ', teamEn: 'Mariners', lineJa: '打率.350・242安打・56盗塁。新人王と同時受賞', lineEn: '.350, 242 hits, 56 SB; also Rookie of the Year' },
  { year: 2021, league: 'AL', nameJa: '大谷翔平', nameEn: 'Shohei Ohtani', teamJa: 'エンゼルス', teamEn: 'Angels', lineJa: '二刀流で満票', lineEn: 'Two-way season, unanimous' },
  { year: 2023, league: 'AL', nameJa: '大谷翔平', nameEn: 'Shohei Ohtani', teamJa: 'エンゼルス', teamEn: 'Angels', lineJa: '満票。2度目', lineEn: 'Unanimous, second award' },
  { year: 2024, league: 'NL', nameJa: '大谷翔平', nameEn: 'Shohei Ohtani', teamJa: 'ドジャース', teamEn: 'Dodgers', lineJa: '満票。打者専任で50本50盗塁', lineEn: 'Unanimous; 50-50 as a full-time hitter' },
  { year: 2025, league: 'NL', nameJa: '大谷翔平', nameEn: 'Shohei Ohtani', teamJa: 'ドジャース', teamEn: 'Dodgers', lineJa: '満票。史上初の満票4回、通算4回はボンズの7回に次ぐ', lineEn: 'Unanimous; first-ever fourth unanimous MVP, four total behind only Bonds’ seven' },
];

/** 受賞は逃したが上位に入った日本人。 */
const JP_NEAR = [{ year: 2022, league: 'AL', nameJa: '大谷翔平', nameEn: 'Shohei Ohtani', teamJa: 'エンゼルス', teamEn: 'Angels', placeJa: '2位（1位票2）', placeEn: '2nd (2 first-place votes)' }];

export default function MvpGuide({ locale, season, qualifyPa }: { locale: string; season: number; qualifyPa: number }) {
  const en = locale === 'en';
  const t = en
    ? {
        heading: 'How the award is decided',
        steps: [
          { k: `Regular season ends ${ROY_SEASON_END.en}`, v: 'Everything on this board counts through the final day. Postseason games do not.' },
          { k: 'Ballots due before the postseason', v: 'Two BBWAA writers per club, 30 per league, each rank ten players. Points run 14-9-8-7-6-5-4-3-2-1.' },
          { k: 'Winners announced in November', v: 'After the World Series. One winner per league; hitters and pitchers are eligible alike.' },
        ],
        qualTitle: 'Plate-appearance qualification',
        qual: `3.1 PA per team game (502 for a full season). Mid-season the bar is the games played so far, which is why this board’s line sits around ${qualifyPa} PA right now. Voters are not bound by it; this table is.`,
        winnersTitle: 'Japanese MVP winners',
        nearTitle: 'Close calls',
        cols: { year: 'Year', player: 'Player', team: 'Team', line: 'Season' },
        place: 'Finish',
        note: 'Vote results from the BBWAA.',
      }
    : {
        heading: 'MVPの決まり方',
        steps: [
          { k: `レギュラーシーズン最終日は${ROY_SEASON_END.ja}`, v: 'このボードの成績は最終日まで動きます。ポストシーズンの成績は評価に入りません。' },
          { k: '投票はポストシーズン開幕前に締め切り', v: '全米野球記者協会（BBWAA）の記者が各球団2名×15球団＝リーグ30人。1〜10位を記入し、1位14点・2位9点・3位8点、以下7・6・5・4・3・2・1点。' },
          { k: '発表は11月', v: 'ワールドシリーズ終了後に発表。各リーグ1人で、打者と投手を分けずに選びます。' },
        ],
        qualTitle: '規定打席',
        qual: `チームの試合数×3.1打席（シーズン全体で502打席）。シーズン途中はその時点の試合数で判定するので、このボードの目安はいま約${qualifyPa}打席です。投票する記者は規定に縛られませんが、この順位表は規定到達者だけを比べています。`,
        winnersTitle: '日本人のMVP受賞',
        nearTitle: '受賞に迫った日本人',
        cols: { year: '年', player: '選手', team: '球団', line: 'その年' },
        place: '順位',
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
        <h3 className="mb-2 text-sm font-bold tracking-wide text-ink">{t.winnersTitle}</h3>
        <div className="overflow-x-auto rounded-[2px] border border-line">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-mute">
                <th className="px-3 py-2 text-left font-medium">{t.cols.year}</th>
                <th className="px-3 py-2 text-left font-medium">{t.cols.player}</th>
                <th className="px-3 py-2 text-left font-medium">{t.cols.team}</th>
                <th className="px-3 py-2 text-left font-medium">{t.cols.line}</th>
              </tr>
            </thead>
            <tbody>
              {JP_WINNERS.map((w) => (
                <tr key={w.year} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 tabular-nums text-ink-soft">
                    {w.year} {w.league}
                  </td>
                  <td className="px-3 py-2 font-bold text-ink">{en ? w.nameEn : w.nameJa}</td>
                  <td className="px-3 py-2 text-ink-soft">{en ? w.teamEn : w.teamJa}</td>
                  <td className="px-3 py-2 text-xs leading-relaxed text-ink-soft">{en ? w.lineEn : w.lineJa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mb-2 mt-4 text-sm font-bold tracking-wide text-ink">{t.nearTitle}</h3>
        <ul className="divide-y divide-line rounded-[2px] border border-line text-sm">
          {JP_NEAR.map((w) => (
            <li key={w.year} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span>
                <span className="tabular-nums text-ink-soft">
                  {w.year} {w.league}
                </span>{' '}
                <span className="font-bold text-ink">{en ? w.nameEn : w.nameJa}</span>{' '}
                <span className="text-xs text-ink-mute">{en ? w.teamEn : w.teamJa}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-soft">
                {t.place} {en ? w.placeEn : w.placeJa}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
          {t.note} {en ? `${season} season.` : `${season}年シーズン。`}
        </p>
      </div>
    </section>
  );
}
