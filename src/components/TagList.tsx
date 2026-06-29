import { Link } from '@/lib/navigation';
import { playerSlugByJaName } from '@/lib/players';

/**
 * 記事のタグ。クリックで回遊させる導線。
 * - 選手名タグ（playerSlugByJaName で解決＝必ず記事が1本ある＝ハブが存在）は、滞在の長い選手ハブ
 *   /player/{slug} へ送る（小さなバーチャート印＋濃いめの枠で見分ける）。内部リンクを全記事規模で増やす。
 * - それ以外（チーム名・概念タグ）は従来どおり /tag/{タグ} のタグ別一覧へ。日本語タグは URL エンコードする。
 */
export default function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {tags.map((tag) => {
        const slug = playerSlugByJaName(tag);
        if (slug) {
          return (
            <Link
              key={tag}
              href={`/player/${slug}`}
              className="inline-flex items-center gap-1.5 rounded-[2px] border border-ink/25 bg-ink/[0.03] px-2.5 py-0.5 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.06]"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden>
                <rect x="3" y="13" width="4" height="8" />
                <rect x="10" y="8" width="4" height="13" />
                <rect x="17" y="4" width="4" height="17" />
              </svg>
              {tag}
            </Link>
          );
        }
        return (
          <Link
            key={tag}
            href={`/tag/${encodeURIComponent(tag)}`}
            className="rounded-[2px] border border-line px-2.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            #{tag}
          </Link>
        );
      })}
    </div>
  );
}
