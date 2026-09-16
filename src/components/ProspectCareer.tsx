import SectionHeading from '@/components/SectionHeading';
import type { NpbPlayerStats, NpbBattingRow, NpbPitchingRow } from '@/lib/npbStats';

/**
 * NEXT MLB 選手LPの年度別成績（NPB公式 npb.jp 由来）。
 *
 * なぜ要るか: LPの成績が「今季の5指標」だけだと、「{選手名} 成績」「{選手名} 通算」で来た読者に
 * 返すものが無い。年度別はその選手固有の実データで、ページの独自性がそのまま増える面でもある。
 * 数値は `scripts/fetch-npb-stats.mjs` が公式から取った実在値のみ＝サイト側で計算しない。
 *
 * 横スクロールは表だけに閉じ込める（ページ本体は横に溢れさせない）。
 */
const BAT_COLS: { key: keyof NpbBattingRow; ja: string; en: string }[] = [
  { key: 'year', ja: '年度', en: 'Year' },
  { key: 'team', ja: '球団', en: 'Team' },
  { key: 'g', ja: '試合', en: 'G' },
  { key: 'ab', ja: '打数', en: 'AB' },
  { key: 'h', ja: '安打', en: 'H' },
  { key: 'hr', ja: '本塁打', en: 'HR' },
  { key: 'rbi', ja: '打点', en: 'RBI' },
  { key: 'bb', ja: '四球', en: 'BB' },
  { key: 'so', ja: '三振', en: 'SO' },
  { key: 'sb', ja: '盗塁', en: 'SB' },
  { key: 'avg', ja: '打率', en: 'AVG' },
  { key: 'obp', ja: '出塁率', en: 'OBP' },
  { key: 'slg', ja: '長打率', en: 'SLG' },
];

const PIT_COLS: { key: keyof NpbPitchingRow; ja: string; en: string }[] = [
  { key: 'year', ja: '年度', en: 'Year' },
  { key: 'team', ja: '球団', en: 'Team' },
  { key: 'g', ja: '登板', en: 'G' },
  { key: 'w', ja: '勝', en: 'W' },
  { key: 'l', ja: '敗', en: 'L' },
  { key: 'sv', ja: 'S', en: 'SV' },
  { key: 'ip', ja: '投球回', en: 'IP' },
  { key: 'h', ja: '安打', en: 'H' },
  { key: 'hr', ja: '本塁打', en: 'HR' },
  { key: 'bb', ja: '四球', en: 'BB' },
  { key: 'so', ja: '奪三振', en: 'SO' },
  { key: 'era', ja: '防御率', en: 'ERA' },
];

export default function ProspectCareer({
  stats,
  en,
  heading,
  sourceLabel,
  caption,
}: {
  stats: NpbPlayerStats;
  en: boolean;
  heading: string;
  sourceLabel: string;
  /** 「{選手名}の年度別成績（NPB公式）」等。表の <caption> に入れて読み上げにも効かせる。 */
  caption: string;
}) {
  if (!stats.career.length) return null;
  const pitching = stats.kind === 'pitching';
  const cols = pitching ? PIT_COLS : BAT_COLS;
  const rows = stats.career;
  const latest = rows[rows.length - 1];

  return (
    <section>
      <div className="mb-3">
        <SectionHeading label={heading} count={rows.length} />
      </div>
      <div className="overflow-x-auto rounded-[2px] border border-line bg-surface">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line">
              {cols.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2.5 text-xs font-medium text-ink-soft ${
                    c.key === 'year' || c.key === 'team' ? 'text-left' : 'text-right'
                  }`}
                >
                  {en ? c.en : c.ja}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.map((row) => {
              // 今季の行だけ太字＝表の中で「いま」がどこかを一目で分かるようにする
              const isLatest = row === latest;
              return (
                <tr key={row.year} className={isLatest ? 'bg-surface font-semibold text-ink' : ''}>
                  {cols.map((c) => {
                    const value = (row as Record<string, string>)[c.key] ?? '';
                    return (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap px-3 py-2.5 ${
                          c.key === 'year' || c.key === 'team'
                            ? 'text-left text-ink-soft'
                            : 'text-right tabular-nums text-ink'
                        } ${isLatest ? 'text-ink' : ''}`}
                      >
                        {value || '−'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        <a
          href={stats.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline hover:text-ink"
        >
          {sourceLabel}
        </a>
      </p>
    </section>
  );
}
