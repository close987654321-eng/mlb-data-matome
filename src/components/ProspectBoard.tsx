import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import type { NpbProspect } from '@/lib/npbPlayers';
import type { NpbStats } from '@/lib/npbStats';
import { headlineStats } from '@/lib/npbStats';
import type { Locale } from '@/lib/i18n';

/**
 * /prospects ハブの「今オフ動く選手」比較表。
 *
 * なぜ名簿カードと別に要るか: オフの検索意図は個々の選手より先に「今オフ誰が出るのか」で来る
 * （"NPB posting 2026"・"ポスティング 今オフ 誰"）。カードを縦に並べただけの名簿では、
 * 3人を横に並べて比べる、というその問いに直接答えられない。
 * 行は expected → rumored の順で、成績は NPB公式由来の静的JSONから引く（ここで計算しない）。
 */
export default function ProspectBoard({
  players,
  stats,
  locale,
  heading,
  cols,
  routeLabels,
  asOfLabel,
}: {
  players: NpbProspect[];
  stats: NpbStats;
  locale: Locale;
  heading: string;
  cols: { player: string; team: string; route: string; timing: string; stats: string };
  /** 「ポスティング」「海外FA」の既訳ラベル（表の中で文字列を組み立てない）。 */
  routeLabels: { posting: string; intlFa: string };
  asOfLabel: string;
}) {
  if (!players.length) return null;
  const en = locale === 'en';
  return (
    <section>
      <div className="mb-3">
        <SectionHeading label={heading} count={players.length} />
      </div>
      <div className="overflow-x-auto rounded-[2px] border border-line bg-surface">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {[cols.player, cols.team, cols.route, cols.timing, cols.stats].map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-ink-soft"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {players.map((p) => {
              const s = stats.players[p.slug];
              const line = s
                ? headlineStats(s, locale)
                    .slice(1, 4)
                    .map((x) => `${x.label} ${x.value}`)
                    .join(' · ')
                : '';
              const w = p.postingWatch;
              return (
                <tr key={p.slug}>
                  <th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                    <Link href={`/prospects/${p.slug}`} className="text-ink underline-offset-2 hover:underline">
                      {en ? p.nameEn : p.nameJa}
                    </Link>
                  </th>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-soft">
                    {en ? p.team.en : p.team.ja}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-soft">
                    {w ? (w.route === 'intl-fa' ? routeLabels.intlFa : routeLabels.posting) : '−'}
                  </td>
                  {/* 「いつ」は表の主役。報じられた時期をそのまま短く出す（無ければ空欄にする＝推測しない）。 */}
                  <td className="px-3 py-3 text-ink-soft">
                    {w?.window ? shorten(en ? w.window.en : w.window.ja) : '−'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-ink">{line || '−'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">{asOfLabel}</p>
    </section>
  );
}

/** 表のセルに入る長さへ。1文目だけを取る（丸ごと入れると表が縦に伸びて比較にならない）。 */
function shorten(s: string): string {
  const first = s.split(/(?<=[。.])\s*/)[0] ?? s;
  return first.length > 70 ? `${first.slice(0, 68)}…` : first;
}
