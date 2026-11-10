import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { fmtDate, type StoveNewsItem } from '@/lib/stoveLeague';

/** 最初に開いておく件数。残りは畳む（HTMLには載る）。 */
const OPEN = 3;

function Item({ n, en }: { n: StoveNewsItem; en: boolean }) {
  return (
    <li className="grid gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[5.5rem_1fr]">
      <time dateTime={n.date} className="text-sm font-semibold tabular-nums text-ink">
        {fmtDate(n.date, en)}
      </time>
      <div className="min-w-0">
        <p className="text-sm leading-relaxed text-ink-soft">
          <Link href={n.href} className="mr-2 font-bold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            {en ? n.name.en : n.name.ja}
          </Link>
          {en ? n.en : n.ja}
        </p>
        <a
          href={n.source}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-0.5 inline-block text-xs text-ink-mute underline decoration-line underline-offset-2 hover:text-ink"
        >
          {n.sourceName}
        </a>
      </div>
    </li>
  );
}

/**
 * 日本人選手の「最新の動き」。入口（/stove-league）の先頭に置く日付順の一覧。
 *
 * なぜ要るか: このページは選手別の並びしか無く、「ストーブリーグ 最新」「移籍 情報」のように
 * 「きょうまでに何が起きたか」を時系列で探す検索に答える面が無かった（2026-11-10 の計測）。
 * 中身は各選手の報道の時系列（出典つき）の再表示だけ＝ここで新しい事実は作らない。
 */
export default function StoveNews({ items, en }: { items: StoveNewsItem[]; en: boolean }) {
  if (!items.length) return null;
  const head = items.slice(0, OPEN);
  const rest = items.slice(OPEN);
  return (
    <section id="news">
      <SectionHeading label={en ? 'Latest moves' : '最新の動き'} lead />
      <ol className="mt-2 divide-y divide-line border-y border-line">
        {head.map((n) => (
          <Item key={`${n.date}-${n.href}-${n.source}`} n={n} en={en} />
        ))}
      </ol>
      {rest.length > 0 && (
        <details className="group">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-center border-b border-line text-sm font-semibold text-ink hover:bg-ink/[0.02] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">{en ? `Show ${rest.length} earlier` : `その前の${rest.length}件を表示`}</span>
            <span className="hidden group-open:inline">{en ? 'Show fewer' : '閉じる'}</span>
          </summary>
          <ol className="divide-y divide-line border-b border-line">
            {rest.map((n) => (
              <Item key={`${n.date}-${n.href}-${n.source}`} n={n} en={en} />
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
