import SectionHeading from '@/components/SectionHeading';
import { ROY_SEASON_END } from '@/lib/royFaq';

/**
 * 新人王レースの「見方」＝日程・決め方・日本人の歴代。
 * 表の数字だけでは答えられない検索意図（いつ決まる／誰が選ぶ／日本人は過去に何人）を、
 * 定型の事実で受ける面。出典は MLB 公式（ルーキー資格の glossary・日程）と BBWAA の公開情報。
 * 制度が変わったらここを直す（年ごとの日付は royFaq.ts の ROY_SEASON_END が正）。
 */

/** NPB を経て MLB 新人王を受賞した日本人（BBWAA 投票結果）。 */
const JP_WINNERS = [
  { year: 1995, league: 'NL', nameJa: '野茂英雄', nameEn: 'Hideo Nomo', teamJa: 'ドジャース', teamEn: 'Dodgers', lineJa: '13勝6敗・防御率2.54・236奪三振（奪三振王）', lineEn: '13-6, 2.54 ERA, 236 K (led NL)' },
  { year: 2000, league: 'AL', nameJa: '佐々木主浩', nameEn: 'Kazuhiro Sasaki', teamJa: 'マリナーズ', teamEn: 'Mariners', lineJa: '37セーブ・防御率3.16', lineEn: '37 saves, 3.16 ERA' },
  { year: 2001, league: 'AL', nameJa: 'イチロー', nameEn: 'Ichiro Suzuki', teamJa: 'マリナーズ', teamEn: 'Mariners', lineJa: '打率.350・242安打・56盗塁。同年MVPも受賞', lineEn: '.350, 242 hits, 56 SB; also won MVP' },
  { year: 2018, league: 'AL', nameJa: '大谷翔平', nameEn: 'Shohei Ohtani', teamJa: 'エンゼルス', teamEn: 'Angels', lineJa: '22本塁打・OPS.925、投手として10試合で防御率3.31', lineEn: '22 HR, .925 OPS; 3.31 ERA in 10 starts' },
];

/** 受賞は逃したが上位票を集めた日本人（BBWAA 投票結果）。 */
const JP_NEAR = [
  { year: 2003, league: 'AL', nameJa: '松井秀喜', nameEn: 'Hideki Matsui', teamJa: 'ヤンキース', teamEn: 'Yankees', placeJa: '2位', placeEn: '2nd' },
  { year: 2024, league: 'NL', nameJa: '今永昇太', nameEn: 'Shota Imanaga', teamJa: 'カブス', teamEn: 'Cubs', placeJa: '4位', placeEn: '4th' },
];

export default function RoyGuide({ locale, season }: { locale: string; season: number }) {
  const en = locale === 'en';
  const t = en
    ? {
        heading: 'How the award is decided',
        steps: [
          { k: `Regular season ends ${ROY_SEASON_END.en}`, v: 'Everything on this board counts through the final day. October games do not.' },
          { k: 'Ballots due before the postseason', v: 'Two BBWAA writers per club, 30 per league, each rank three rookies. 5 points for first, 3 for second, 1 for third.' },
          { k: 'Winners announced in November', v: 'After the World Series. One winner per league, hitters and pitchers judged together.' },
        ],
        eligTitle: 'Who counts as a rookie',
        elig: 'Fewer than 130 at-bats, fewer than 50 innings and fewer than 45 days on an active roster in prior seasons. Years in NPB or any other league do not affect eligibility.',
        winnersTitle: 'Japanese winners',
        nearTitle: 'Close calls',
        cols: { year: 'Year', player: 'Player', team: 'Team', line: 'Season' },
        place: 'Finish',
        note: 'Vote results from the BBWAA. Eligibility per MLB’s official rookie definition.',
      }
    : {
        heading: '新人王の決まり方',
        steps: [
          { k: `レギュラーシーズン最終日は${ROY_SEASON_END.ja}`, v: 'このボードの成績は最終日まで動きます。10月のポストシーズンの成績は評価に入りません。' },
          { k: '投票はポストシーズン開幕前に締め切り', v: '全米野球記者協会（BBWAA）の記者が各球団2名×15球団＝リーグ30人。1〜3位を記入し、1位5点・2位3点・3位1点。' },
          { k: '発表は11月', v: 'ワールドシリーズ終了後に発表。各リーグ1人で、野手と投手を分けずに選びます。' },
        ],
        eligTitle: 'ルーキー資格',
        elig: '前年までのメジャーで130打数未満・50投球回未満・アクティブロースター登録45日未満のすべてを満たす選手。NPBなど海外リーグでの年数は資格に影響しません。',
        winnersTitle: '日本人の歴代新人王',
        nearTitle: '受賞に迫った日本人',
        cols: { year: '年', player: '選手', team: '球団', line: 'その年の成績' },
        place: '順位',
        note: '投票結果はBBWAA、ルーキー資格の定義はMLB公式に基づきます。',
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
        <h3 className="text-sm font-bold text-ink">{t.eligTitle}</h3>
        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-ink-soft">{t.elig}</p>
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
