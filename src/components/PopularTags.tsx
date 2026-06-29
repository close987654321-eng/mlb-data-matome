import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { getAllTags } from '@/lib/tags';

/**
 * 人気タグ（記事数の多い順）の回遊導線。サイト内検索の代替＝興味のある選手・話題へ
 * 1クリックで横断できる。SSR で全リンクを出すのでクロール経路にもなる。
 * トップ・各カテゴリ一覧の上部に置く。
 */
export default async function PopularTags({ limit = 12 }: { limit?: number }) {
  const tags = (await getAllTags()).slice(0, limit);
  if (tags.length === 0) return null;
  const t = await getTranslations();

  return (
    <section aria-label={t('popularTags.heading')} className="rounded-[4px] border border-line bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-ink-soft">
        {t('popularTags.heading')}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/tag/${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1 rounded-[2px] border border-line px-3 py-1 text-sm text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            #{tag}
            <span className="text-xs text-ink-mute">{count}</span>
          </Link>
        ))}
        {/* ロングテール（13位以下・1件タグ）への到達経路。これが無いと人気タグが行き止まりになる。 */}
        <Link
          href="/tags"
          className="inline-flex items-center px-2 py-1 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          {t('tags.viewAll')} →
        </Link>
      </div>
    </section>
  );
}
