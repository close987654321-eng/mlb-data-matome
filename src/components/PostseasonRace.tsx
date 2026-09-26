import { Link } from '@/lib/navigation';
import { teamLogoUrl } from '@/lib/teams';
import SectionHeading from '@/components/SectionHeading';
import { leagueName, teamLabel, type League, type PostseasonData, type RaceRow } from '@/lib/postseason';
import type { Locale } from '@/lib/i18n';

/**
 * レギュラーシーズン終盤の「ワイルドカード争い」表（phase が race の間だけ出す）。
 *
 * 並びは「いま終わったらこの12球団」: 各リーグの地区首位3チーム → ワイルドカード順位。
 * 状況の文言は MLB公式の確定マーク（x/y/z/w）と自力消滅の数の言い換えだけ＝勝率の予想は出さない。
 */
function status(row: RaceRow, en: boolean): { text: string; strong: boolean } {
  if (row.clinch === 'y' || row.clinch === 'z') return { text: en ? 'Clinched division' : '地区優勝', strong: true };
  if (row.clinch === 'x' || row.clinch === 'w') return { text: en ? 'Clinched berth' : '進出決定', strong: true };
  // 地区首位と同率（gb が "-"）は API 上 divisionLeader でなくても首位争いの当事者。
  if (!row.divisionLeader && row.gb === '-') return { text: en ? 'Tied for division lead' : '地区首位と同率', strong: false };
  const inside = row.divisionLeader || (row.wcRank != null && row.wcRank <= 3);
  if (inside) return { text: en ? 'In position' : '圏内で争い中', strong: false };
  return row.wcElim === 'E'
    ? { text: en ? 'Division only' : '地区優勝のみ可能性', strong: false }
    : { text: en ? 'Chasing' : '追う立場', strong: false };
}

function RaceTable({ league, rows, en, linkable }: { league: League; rows: RaceRow[]; en: boolean; linkable: Set<string> }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{leagueName(league, en)}</h3>
      <div className="overflow-x-auto rounded-[4px] border border-line">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-xs text-ink-soft">
              <th className="px-3 py-2 text-left font-medium">{en ? 'Team' : 'チーム'}</th>
              <th className="px-3 py-2 text-right font-medium">{en ? 'W-L' : '勝敗'}</th>
              <th className="px-3 py-2 text-right font-medium">{en ? 'Div GB' : '地区差'}</th>
              <th className="px-3 py-2 text-right font-medium">{en ? 'WC GB' : 'WC差'}</th>
              <th className="px-3 py-2 text-right font-medium">{en ? 'Left' : '残り'}</th>
              <th className="px-3 py-2 text-left font-medium">{en ? 'Status' : '状況'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const st = status(row, en);
              // 地区首位3＋ワイルドカード3＝6枠。7番目以降の手前に罫を太く引いて「圏内/圏外」の境目を見せる。
              const cut = i === 6;
              const name = (
                <span className="inline-flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク（再ホストしない） */}
                  <img src={teamLogoUrl(row.id)} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 object-contain" />
                  {en ? teamLabel(row.id, true) : row.nameJa}
                </span>
              );
              return (
                <tr key={row.id} className={`border-b border-line last:border-b-0 ${cut ? 'border-t-2 border-t-ink-mute' : ''}`}>
                  <td className="px-3 py-2">
                    {linkable.has(row.nameJa) ? (
                      <Link
                        href={`/tag/${encodeURIComponent(row.nameJa)}`}
                        className="text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
                      >
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.w}-{row.l}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.gb}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.divisionLeader ? '—' : row.wcGb ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.remaining}</td>
                  <td className={`px-3 py-2 ${st.strong ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{st.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PostseasonRace({
  data,
  locale,
  linkable,
}: {
  data: PostseasonData;
  locale: Locale;
  linkable: Set<string>;
}) {
  const en = locale === 'en';
  if (data.phase !== 'race') return null;
  return (
    <section id="race" className="scroll-mt-20">
      <SectionHeading label={en ? 'The Wild Card race' : 'ワイルドカード争い・地区優勝争い'} lead />
      <p className="mb-4 mt-1.5 max-w-prose text-sm text-ink-soft">
        {en
          ? 'Top three rows are division leaders, then the Wild Card order. The first six make the postseason. WC GB is the gap to the third Wild Card spot.'
          : '上3行が地区首位、その下がワイルドカードの順位。上から6チームがポストシーズンに進みます。WC差はワイルドカード3位とのゲーム差（＋は圏内の余裕）。'}
      </p>
      <div className="space-y-6">
        {(['AL', 'NL'] as League[]).map((lg) => (
          <RaceTable key={lg} league={lg} rows={data.race[lg]} en={en} linkable={linkable} />
        ))}
      </div>
    </section>
  );
}
