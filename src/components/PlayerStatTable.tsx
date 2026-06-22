import type { StatRecord, Saber } from '@/lib/playerStats';

// 「細かい項目まで極限まで」見せる詳細成績。表示順＝日本人ファンが見たい順。
const HIT_LABELS: [string, string][] = [
  ['gamesPlayed', '試合'],
  ['plateAppearances', '打席'],
  ['atBats', '打数'],
  ['hits', '安打'],
  ['avg', '打率'],
  ['homeRuns', '本塁打'],
  ['rbi', '打点'],
  ['runs', '得点'],
  ['doubles', '二塁打'],
  ['triples', '三塁打'],
  ['stolenBases', '盗塁'],
  ['baseOnBalls', '四球'],
  ['strikeOuts', '三振'],
  ['obp', '出塁率'],
  ['slg', '長打率'],
  ['ops', 'OPS'],
  ['babip', 'BABIP'],
];
const PIT_LABELS: [string, string][] = [
  ['gamesPlayed', '試合'],
  ['gamesStarted', '先発'],
  ['wins', '勝'],
  ['losses', '敗'],
  ['saves', 'セーブ'],
  ['holds', 'ホールド'],
  ['era', '防御率'],
  ['whip', 'WHIP'],
  ['inningsPitched', '投球回'],
  ['strikeOuts', '奪三振'],
  ['baseOnBalls', '与四球'],
  ['hits', '被安打'],
  ['homeRuns', '被本塁打'],
  ['earnedRuns', '自責'],
  ['runs', '失点'],
  ['avg', '被打率'],
  ['strikeoutsPer9Inn', 'K/9'],
  ['walksPer9Inn', 'BB/9'],
  ['strikeoutWalkRatio', 'K/BB'],
  ['homeRunsPer9', '被HR/9'],
  ['winPercentage', '勝率'],
];

const war1 = (v?: number) => (typeof v === 'number' ? v.toFixed(1) : null);
const woba3 = (v?: number) => (typeof v === 'number' ? v.toFixed(3).replace(/^0/, '') : null);
const wrc = (v?: number) => (typeof v === 'number' ? String(Math.round(v)) : null);

function Cell({ label, value }: { label: string; value: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <div className="text-[11px] font-medium text-ink-soft">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function Grid({
  heading,
  fields,
  rec,
  extras,
}: {
  heading: string;
  fields: [string, string][];
  rec: StatRecord;
  extras: { label: string; value: string | null }[];
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
        <span className="h-3 w-1 rounded-full bg-accent" />
        {heading}
      </h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {fields.map(([key, label]) => (
          <Cell key={key} label={label} value={rec[key] ?? null} />
        ))}
        {extras.map((e) => (
          <Cell key={e.label} label={e.label} value={e.value} />
        ))}
      </div>
    </section>
  );
}

/** 選手ハブの詳細成績（打撃・投球を“極限まで”並べる）。値は編集時スナップショットの公知の事実。 */
export default function PlayerStatTable({
  hitting,
  pitching,
  saber,
}: {
  hitting: StatRecord | null;
  pitching: StatRecord | null;
  saber: Saber | null;
}) {
  return (
    <>
      {hitting && (
        <Grid
          heading="打撃成績"
          fields={HIT_LABELS}
          rec={hitting}
          extras={[
            { label: 'wOBA', value: woba3(saber?.woba) },
            { label: 'wRC+', value: wrc(saber?.wrcplus) },
            { label: 'WAR(打)', value: war1(saber?.hit) },
          ]}
        />
      )}
      {pitching && (
        <Grid
          heading="投球成績"
          fields={PIT_LABELS}
          rec={pitching}
          extras={[{ label: 'WAR(投)', value: war1(saber?.pit) }]}
        />
      )}
    </>
  );
}
