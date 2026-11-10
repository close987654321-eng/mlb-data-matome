import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { fmtDate } from '@/lib/format';
import type { MoveRow, TeamOffseasonData, TeamStoveSide } from '@/lib/stoveMoves';

/** 加入・退団の一覧で最初に開いておく件数。残りは畳む（HTMLには載る）。 */
const OPEN = 6;

function Rows({ rows, en, empty }: { rows: MoveRow[]; en: boolean; empty: string }) {
  if (!rows.length) return <p className="py-2 text-sm text-ink-mute">{empty}</p>;
  const head = rows.slice(0, OPEN);
  const rest = rows.slice(OPEN);
  const item = (r: MoveRow) => (
    <li key={r.id} className="grid grid-cols-[4.4rem_1fr] gap-x-3 py-2 text-sm leading-relaxed">
      <time dateTime={r.date} className="whitespace-nowrap tabular-nums text-ink-mute">
        {fmtDate(r.date, en)}
      </time>
      <span className={r.tier >= 2 || r.japanese ? 'font-semibold text-ink' : 'text-ink-soft'}>
        {r.text}
        {r.terms && <span className="ml-1 font-normal text-ink-soft">（{r.terms.text}）</span>}
      </span>
    </li>
  );
  return (
    <>
      <ul className="divide-y divide-line">{head.map(item)}</ul>
      {rest.length > 0 && (
        <details className="group border-t border-line">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-sm text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
            <span>{en ? `Show ${rest.length} more` : `残り${rest.length}件を表示`}</span>
            <span aria-hidden className="text-ink-mute transition-transform group-open:rotate-45">＋</span>
          </summary>
          <ul className="divide-y divide-line">{rest.map(item)}</ul>
        </details>
      )}
    </>
  );
}

/**
 * 球団LPの「オフの欄」＝今オフの補強（加入・退団・FAになった選手・関心が報じられた選手）。
 *
 * なぜ要るか: オフの球団の検索は「ドジャース 補強 2026 最新」「ヤンキース 補強 2027」のように補強の語で来るが、
 * 球団LPには試合と順位しか無く、ストーブリーグへのリンクも0本だった（2026-11-10 の点検）。
 * 中身は2つの data の並べ替えだけ: 出入り＝MLB公式の取引記録（stove-moves.json・3時間ごとに自動）、
 * FAの状況と関心球団＝FA一覧と去就（stove-league.json・毎朝の定期実行が出典つきで書く）。
 * ポストシーズンの欄と同じく、ページの先頭（「いま」の位置）に置く＝冬に来た人の第一の問いに先に答える。
 */
export default function TeamOffseason({
  name,
  off,
  data,
  side,
  locale,
}: {
  /** 球団名（表示用）。 */
  name: string;
  /** 「2026-2027」。 */
  off: string;
  data: TeamOffseasonData;
  side: TeamStoveSide;
  locale: string;
}) {
  const en = locale === 'en';
  const stamp = fmtDate(data.asOf.slice(0, 10), en);
  const faNotable = data.fa.names.filter((n) => n.tier >= 2);
  const quiet = data.in.length + data.out.length === 0;
  return (
    <section id="offseason" className="space-y-6">
      <div className="space-y-2">
        <SectionHeading
          label={en ? `${name} offseason ${off}: arrivals, departures and reactions` : `${name}の補強${off}｜加入・退団と海外の反応`}
          seeAllHref="/stove-league/moves"
          seeAllLabel={en ? 'All moves' : '移籍情報'}
          lead
        />
        {/* いまの状況を1文で（数はすべて取引記録からの数え上げ）。 */}
        <p className="max-w-prose text-[15px] leading-relaxed text-ink">
          {en
            ? `This winter so far: ${quiet ? 'no arrivals or departures yet' : `${data.in.length} in, ${data.out.length} out`}, and ${data.fa.count} players became free agents.`
            : `今オフはここまで、${quiet ? '加入・退団ともまだ動きなし' : `加入${data.in.length}件・退団${data.out.length}件`}。FAになった選手は${data.fa.count}人。`}
          <span className="ml-1 text-xs text-ink-mute">
            {en
              ? `(${stamp}, MLB's official transaction log; dates are US Eastern)`
              : `（${stamp}時点・MLB公式の取引記録・日付は米東部時間）`}
          </span>
        </p>
      </div>

      {side.fas.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-ink">{en ? `Free agents from the ${name}` : `${name}からFAになった主な選手`}</h3>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {side.fas.map((f) => (
              <li key={f.rank} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                {f.href ? (
                  <Link href={f.href} className="font-bold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                    {f.name}
                  </Link>
                ) : (
                  <span className="font-bold text-ink">{f.name}</span>
                )}
                <span
                  className={`inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 text-[11px] ${
                    f.done ? 'border-ink bg-ink text-surface' : 'border-line text-ink'
                  }`}
                >
                  {en ? f.label.en : f.label.ja}
                  {f.team && (en ? `: ${f.team.en}` : `：${f.team.ja}`)}
                </span>
                <span className="text-xs text-ink-mute">{en ? `FA No. ${f.rank}` : `FAランキング${f.rank}位`}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/stove-league/fa"
            className="inline-flex min-h-[44px] items-center text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
          >
            {en ? 'Free agent rankings: status and projections' : 'FAランキングと契約状況・予想契約を見る'}{' '}
            <span aria-hidden className="ml-1">→</span>
          </Link>
        </div>
      )}

      {side.linked.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-ink">
            {en ? `Players the ${name} are reported to be interested in` : `${name}の関心が報じられている選手`}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {side.linked.map((p, i) => (
              <span key={`${p.name}-${i}`}>
                {i > 0 && (en ? ', ' : '、')}
                <Link href={p.href} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                  {p.name}
                </Link>
              </span>
            ))}
            <span className="ml-1 text-xs text-ink-mute">
              {en ? '(reports and sources are on each player page)' : '（報道の出典は各選手のページ）'}
            </span>
          </p>
        </div>
      )}

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <div>
          <h3 className="border-b border-ink pb-1.5 text-sm font-bold text-ink">
            {en ? 'In' : '加入・再契約'}
            <span className="ml-2 text-xs font-normal tabular-nums text-ink-mute">{data.in.length}</span>
          </h3>
          <Rows rows={data.in} en={en} empty={en ? 'No arrivals yet.' : 'まだありません。'} />
        </div>
        <div>
          <h3 className="border-b border-ink pb-1.5 text-sm font-bold text-ink">
            {en ? 'Out' : '退団'}
            <span className="ml-2 text-xs font-normal tabular-nums text-ink-mute">{data.out.length}</span>
          </h3>
          <Rows rows={data.out} en={en} empty={en ? 'No departures yet.' : 'まだありません。'} />
        </div>
      </div>

      {data.fa.count > 0 && (
        <details className="group border-y border-line">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink hover:bg-ink/[0.02] [&::-webkit-details-marker]:hidden">
            <span>
              {en ? `All ${data.fa.count} free agents from the ${name}` : `${name}からFAになった選手（${data.fa.count}人）`}
              {faNotable.length > 0 && (
                <span className="ml-2 font-normal text-ink-soft">
                  {faNotable
                    .slice(0, 4)
                    .map((n) => n.name)
                    .join(en ? ', ' : '、')}
                  {en ? ' and others' : 'ほか'}
                </span>
              )}
            </span>
            <span aria-hidden className="shrink-0 text-ink-mute transition-transform group-open:rotate-45">＋</span>
          </summary>
          <p className="pb-3 text-sm leading-relaxed text-ink-soft">
            {data.fa.names.map((n, i) => (
              <span key={`${n.name}-${i}`}>
                {i > 0 && (en ? ', ' : '、')}
                {n.href ? (
                  <Link href={n.href} className="underline decoration-line underline-offset-2 hover:text-ink">
                    {n.name}
                  </Link>
                ) : (
                  n.name
                )}
              </span>
            ))}
          </p>
        </details>
      )}
    </section>
  );
}
