import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { formatUpdatedAt } from '@/lib/format';
import type { Column } from '@/types/column';
import type { Locale } from '@/lib/i18n';

/**
 * 予測ボードの表の直下に置く「このレースの読み解き」。表を見終わった読者を、
 * 順位が動いた理由を書いたコラム（データ定点分析）へ送る内部リンク。
 *
 * 置き場所が表の直後なのは、順位を見た直後がいちばん「で、何が起きてるの」と思う瞬間だから。
 * 表示の溜まっているボードLPから読み解き側の面へ配線する狙いは boardColumns.ts のコメントが正。
 * 配色は無彩色（サイトの design system＝赤は題字罫とシリーズバッジ専用）。
 */
export default function BoardColumns({
  columns,
  locale,
  heading,
  lead,
}: {
  columns: Column[];
  locale: Locale;
  heading: string;
  lead: string;
}) {
  if (!columns.length) return null;
  const en = locale === 'en';

  return (
    <section>
      <SectionHeading label={heading} count={columns.length} lead level="h2" />
      <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{lead}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-[2px] border border-line">
        {columns.map((c) => (
          <li key={c.id}>
            <Link
              href={`/columns/${c.id}`}
              className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-ink/[0.04]"
            >
              <div className="min-w-0">
                <p className="font-bold leading-snug text-ink group-hover:underline">
                  {en ? c.title.en : c.title.ja}
                </p>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">{c.lead}</p>
                <p className="mt-1.5 text-xs text-ink-mute">{formatUpdatedAt(c.publishedAt, locale)}</p>
              </div>
              <span
                aria-hidden
                className="mt-0.5 shrink-0 text-ink-mute transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
              >
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
