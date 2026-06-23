import { Link } from '@/lib/navigation';
import { playerSlugByJaName } from '@/lib/players';

/**
 * 記事のタグ。クリックで回遊させる導線。
 * - 選手名タグ（playerSlugByJaName で解決＝必ず記事が1本ある＝ハブが存在）は、滞在の長い選手ハブ
 *   /player/{slug} へ送る（📊チップで見分ける）。エンティティ集約面への内部リンクを全記事規模で増やす。
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
              className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/[0.06] px-2.5 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
            >
              <span aria-hidden="true">📊</span>
              {tag}
            </Link>
          );
        }
        return (
          <Link
            key={tag}
            href={`/tag/${encodeURIComponent(tag)}`}
            className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
          >
            #{tag}
          </Link>
        );
      })}
    </div>
  );
}
