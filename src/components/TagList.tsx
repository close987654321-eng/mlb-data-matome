import { Link } from '@/lib/navigation';
import { playerSlugByJaName } from '@/lib/players';
import { isStopTag } from '@/lib/tags';

type Props = {
  tags: string[];
  /** 全記事でのタグ出現数。1（singleton）は踏むと自分1件のページに落ちるので非リンク化する。 */
  counts?: Map<string, number>;
};

/**
 * 記事のタグ。回遊価値で3段に振り分ける（回遊の入口を良質なものだけにする）:
 *  1) 選手名タグ … 選手LP /tag/{名前} へ送る最良の回遊先（バーチャート印＋濃いめの枠）。
 *     旧 /player/{slug} 行きは 2026-08-01 に変更＝内部リンクをLPに集める（成績ハブへはLP内CTAで届く）
 *  2) 通常タグ（複数記事あり） … /tag/{タグ} のタグ別一覧へ
 *  3) singleton・汎用（STOPLIST） … リンクにしない（行き止まり／識別力ゼロの leak を作らない）
 * 日本語タグは URL エンコードして渡す（タグページ側で decode する）。
 */
export default function TagList({ tags, counts }: Props) {
  if (tags.length === 0) return null;

  // 選手チップ（slug で重複排除＝別表記が同じ選手を指しても1つだけ）。
  const seenSlug = new Set<string>();
  const playerChips: { slug: string; name: string }[] = [];
  for (const tag of tags) {
    const slug = playerSlugByJaName(tag);
    if (slug && !seenSlug.has(slug)) {
      seenSlug.add(slug);
      playerChips.push({ slug, name: tag });
    }
  }

  // 残り（選手タグ以外）を、複数記事のある通常タグ（リンク）と、singleton/汎用（非リンク）に分ける。
  const linkTags: string[] = [];
  const mutedTags: string[] = [];
  for (const tag of tags) {
    if (playerSlugByJaName(tag)) continue; // 選手チップで既出
    if (isStopTag(tag)) continue; // 汎用は表示ごと省く（識別力ゼロの定型）
    const count = counts?.get(tag) ?? 2; // counts 未指定時はリンク扱い（後方互換）
    if (count <= 1) mutedTags.push(tag);
    else linkTags.push(tag);
  }

  if (playerChips.length === 0 && linkTags.length === 0 && mutedTags.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {playerChips.map((p) => (
        <Link
          key={`player-${p.slug}`}
          href={`/tag/${encodeURIComponent(p.name)}`}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-ink/25 bg-ink/[0.03] px-2.5 py-0.5 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.06]"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden>
            <rect x="3" y="13" width="4" height="8" />
            <rect x="10" y="8" width="4" height="13" />
            <rect x="17" y="4" width="4" height="17" />
          </svg>
          {p.name}
        </Link>
      ))}
      {linkTags.map((tag) => (
        <Link
          key={tag}
          href={`/tag/${encodeURIComponent(tag)}`}
          className="rounded-[2px] border border-line px-2.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          #{tag}
        </Link>
      ))}
      {mutedTags.map((tag) => (
        // singleton は一覧が薄いので非リンク（文脈は残すが行き止まりにしない）。
        <span key={tag} className="rounded-[2px] px-2.5 py-0.5 text-xs text-ink-mute">
          #{tag}
        </span>
      ))}
    </div>
  );
}
