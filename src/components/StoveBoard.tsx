import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';

type Bi = { ja: string; en: string };

export type StoveBoardRow = {
  rank: number;
  name: string;
  nameSub?: string;
  href?: string;
  japanese: boolean;
  pos: Bi;
  team?: Bi;
  status: { label: Bi; done: boolean; team?: Bi };
  statLine: string;
  note: Bi;
};

/**
 * FA注目選手の一覧（MLB.com の順位順）。
 *
 * 順位は MLB.com の記者が出したもの＝出典を見出しの直下に必ず出す（編集部の予想に見せない）。
 * 成績は statsapi の値（scripts/fetch-stove-stats.mjs）、状況は人の決着＞公式の契約記録＞道筋。
 * 表組みにしないのは、ひと言（なぜ注目か）がこの面の中身で、横に詰めるとスマホで読めなくなるから。
 */
export default function StoveBoard({
  rows,
  en,
  source,
  statsAsOf,
}: {
  rows: StoveBoardRow[];
  en: boolean;
  source: { name: string; url: string; date: string };
  statsAsOf: string;
}) {
  if (!rows.length) return null;
  const signed = rows.filter((r) => r.status.done).length;
  return (
    <section id="ranking">
      <SectionHeading label={en ? 'Top free agents' : 'FA注目選手ランキング'} count={rows.length} lead />
      <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
        {en ? (
          <>
            Order follows{' '}
            <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-ink">
              {source.name}
            </a>{' '}
            ({source.date}). Stats are 2026 regular season from MLB&apos;s official data ({statsAsOf}).
            {signed > 0 && ` ${signed} have signed so far.`}
          </>
        ) : (
          <>
            並びは
            <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-ink">
              {source.name}
            </a>
            のFAランキング（{source.date.slice(5).replace('-', '/')}付）。成績は2026年レギュラーシーズン（MLB公式・{statsAsOf}取得）。
            {signed > 0 && `すでに${signed}人が契約を決めた。`}
          </>
        )}
      </p>

      <ol className="mt-4 divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li key={`${r.rank}-${r.name}`} className="grid grid-cols-[2.25rem_1fr] gap-x-3 py-4">
            <span className="pt-0.5 text-lg font-bold tabular-nums text-ink">{r.rank}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {r.href ? (
                  <Link href={r.href} className="font-bold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                    {r.name}
                  </Link>
                ) : (
                  <span className="font-bold text-ink">{r.name}</span>
                )}
                {r.nameSub && <span className="text-xs text-ink-mute">{r.nameSub}</span>}
                <span
                  className={`inline-flex items-center border px-1.5 py-0.5 text-[11px] ${
                    r.status.done ? 'border-ink bg-ink text-surface' : 'border-line text-ink-soft'
                  }`}
                >
                  {en ? r.status.label.en : r.status.label.ja}
                  {r.status.team && (en ? `: ${r.status.team.en}` : `：${r.status.team.ja}`)}
                </span>
                {r.japanese && (
                  <span className="inline-flex items-center border border-line px-1.5 py-0.5 text-[11px] text-ink">
                    {en ? 'Japanese' : '日本人'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {en ? r.pos.en : r.pos.ja}
                {r.team && ` · ${en ? r.team.en : r.team.ja}`}
              </p>
              {r.statLine && <p className="mt-1.5 text-sm tabular-nums text-ink">{r.statLine}</p>}
              <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-soft">{en ? r.note.en : r.note.ja}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
