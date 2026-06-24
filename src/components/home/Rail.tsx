import { Link } from '@/lib/navigation';

/**
 * トップの横スクロール棚。見出し（accent バー＋ラベル）＋任意の「すべて見る」リンク＋
 * scroll-snap の行。記事が数百本に増えても一等地は固定長で、続きは横スクロール／実 URL へ逃がす。
 * モバイルでは画面端まで馴染むよう -mx-5（main の px-5 を相殺）でブリードさせる。
 */
export default function Rail({
  label,
  count,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  label: string;
  count?: number;
  seeAllHref?: string;
  seeAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-4 w-1 rounded-full bg-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">{label}</h2>
        {typeof count === 'number' && <span className="text-xs text-ink-soft">{count}</span>}
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="ml-auto text-xs font-medium text-accent transition-colors hover:text-accent-ink"
          >
            {seeAllLabel} →
          </Link>
        )}
      </div>
      <ul className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2">{children}</ul>
    </section>
  );
}
