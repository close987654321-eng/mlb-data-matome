import { Link } from '@/lib/navigation';

/**
 * 可視パンくず。記事・選手ハブの先頭に置き、親階層（競技ハブ／選手ピラー／ホーム）への上向きリンクを与える。
 * 構造化データ（BreadcrumbList JSON-LD）は各ページ側で別途出している＝ここは UI 導線（回遊＋クロール深度）専用。
 * 最後の項目（現在地）はリンクにしない。
 */
export type Crumb = { name: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="パンくず" className="text-xs text-ink-soft">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-x-1.5">
            {i > 0 && (
              <span aria-hidden="true" className="text-line">
                /
              </span>
            )}
            {c.href ? (
              <Link href={c.href} className="transition-colors hover:text-ink hover:underline">
                {c.name}
              </Link>
            ) : (
              <span className="text-ink-soft">{c.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
