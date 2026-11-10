import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';

type Bi = { ja: string; en: string };

export type StoveBoardRow = {
  rank: number;
  name: string;
  nameSub?: string;
  /** 日本人＝選手LP、外国人＝その選手を語ったオフの記事（無ければリンクしない）。 */
  href?: string;
  /** href が記事のとき true（リンクの言い方を「海外の反応」に変える）。 */
  hrefIsArticle?: boolean;
  photo?: string;
  japanese: boolean;
  pos: Bi;
  team?: Bi;
  status: { label: Bi; done: boolean; team?: Bi };
  statLine: string;
  note: Bi;
};

function Row({ r, en }: { r: StoveBoardRow; en: boolean }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-3 border-b border-line py-4">
      <span className="pt-1 text-lg font-bold tabular-nums text-ink">{r.rank}</span>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          {r.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない）
            <img src={r.photo} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-full bg-ink/[0.04] object-cover" />
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {r.href && !r.hrefIsArticle ? (
                <Link href={r.href} className="font-bold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                  {r.name}
                </Link>
              ) : (
                <span className="font-bold text-ink">{r.name}</span>
              )}
              {r.nameSub && <span className="text-xs text-ink-mute">{r.nameSub}</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
              <span className="text-xs text-ink-soft">
                {en ? r.pos.en : r.pos.ja}
                {r.team && ` · ${en ? r.team.en : r.team.ja}`}
              </span>
            </div>
          </div>
        </div>
        {r.statLine && <p className="mt-2 text-sm tabular-nums text-ink">{r.statLine}</p>}
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{en ? r.note.en : r.note.ja}</p>
        {r.href && r.hrefIsArticle && (
          <Link
            href={r.href}
            className="inline-flex min-h-[44px] items-center text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
          >
            {en ? 'Fan reactions' : '海外の反応を読む'} <span aria-hidden className="ml-1">→</span>
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * FA注目選手の抜粋（入口ページ用）。全員ぶんの表は専用ページ（/stove-league/fa）にある。
 *
 * 順位は MLB.com の記者が出したもの＝出典を見出しの直下に必ず出す（編集部の予想に見せない）。
 * 成績は statsapi の値（scripts/fetch-stove-stats.mjs）、状況は人の決着＞公式の契約記録＞道筋。
 * 以前はここに30人を並べ（上位10人を開いて残りを畳む）ていたが、2026-11-10 に一覧を専用ページへ分けた。
 * 「FAランキング」の検索はそちらが受ける＝ここは上位と日本人だけを見せて、一覧へ送る。
 */
export default function StoveBoard({
  rows,
  total,
  signed,
  moreHref,
  en,
  source,
  sourceDate,
  statsAsOf,
}: {
  /** ここに出す行（上位と日本人）。 */
  rows: StoveBoardRow[];
  /** ランキング全体の人数と、そのうち決着した人数（一覧への送り文に使う）。 */
  total: number;
  signed: number;
  moreHref: string;
  en: boolean;
  source: { name: string; url: string };
  /** 「10月27日」形式に整えた日付。 */
  sourceDate: string;
  statsAsOf: string;
}) {
  if (!rows.length) return null;
  return (
    <section id="ranking">
      <SectionHeading
        label={en ? 'Top free agents' : 'FA注目選手（上位と日本人）'}
        seeAllHref={moreHref}
        seeAllLabel={en ? `All ${total}` : `${total}人の一覧`}
        lead
      />
      <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
        {en ? (
          <>
            Order follows{' '}
            <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-ink">
              {source.name}
            </a>{' '}
            ({sourceDate}). Stats are the 2026 regular season from MLB&apos;s official data ({statsAsOf}).
            {signed > 0 && ` ${signed} of the top ${total} have settled so far.`}
          </>
        ) : (
          <>
            並びは
            <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-ink">
              {source.name}
            </a>
            のFAランキング（{sourceDate}付）。成績は2026年レギュラーシーズン（MLB公式・{statsAsOf}時点）。
            {signed > 0 && `上位${total}人のうち${signed}人が決着した。`}
          </>
        )}
      </p>

      <ol className="mt-4 grid border-t border-line lg:grid-cols-2 lg:gap-x-10">
        {rows.map((r) => (
          <Row key={`${r.rank}-${r.name}`} r={r} en={en} />
        ))}
      </ol>
      <Link
        href={moreHref}
        className="flex min-h-[52px] items-center justify-center gap-2 border-b border-line text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.02]"
      >
        {en
          ? `All ${total}: status, projections and qualifying offers`
          : `${total}人の契約状況・予想契約・QOの回答を一覧で見る`}
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
