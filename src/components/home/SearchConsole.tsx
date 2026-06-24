import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/lib/navigation';
import type { TagCount } from '@/lib/tags';

/**
 * トップの「探す」入口。角丸ボックス＋塗りボタンの“ボタン感”をやめ、編集的な下線入力に。
 * 純 HTML の GET フォーム（method=get）なので JS 無しで送信でき SSG/perf を壊さない。
 * 遷移先は JSON-LD の SearchAction（urlTemplate=/search?q=...）と一致させる。
 * localePrefix は as-needed なので action は ja=/search, en=/en/search を手で組む。
 */
export default function SearchConsole({ tags }: { tags: TagCount[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const action = locale === 'ja' ? '/search' : `/${locale}/search`;

  return (
    <section>
      <form
        action={action}
        method="get"
        role="search"
        className="flex items-center gap-3 border-b-2 border-line pb-3 transition-colors focus-within:border-accent"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0 fill-none stroke-ink-soft"
          strokeWidth={2}
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          name="q"
          required
          placeholder={t('search.placeholder')}
          aria-label={t('search.heading')}
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-soft sm:text-lg"
        />
        <button
          type="submit"
          className="shrink-0 text-sm font-semibold text-accent transition-colors hover:text-accent-ink"
        >
          {t('search.button')}
        </button>
      </form>
      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs text-ink-soft">{t('home.popularSearches')}</span>
          {tags.map(({ tag }) => (
            <Link
              key={tag}
              href={`/tag/${encodeURIComponent(tag)}`}
              className="text-sm text-ink-soft transition-colors hover:text-accent"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
