import { Link } from '@/lib/navigation';

/**
 * 記事のタグ。クリックで /tag/{タグ} のタグ別一覧へ送る回遊導線。
 * 日本語タグは URL エンコードして渡す（タグページ側で decode する）。
 */
export default function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Link
          key={tag}
          href={`/tag/${encodeURIComponent(tag)}`}
          className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          #{tag}
        </Link>
      ))}
    </div>
  );
}
