import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';

/**
 * ヘッダー常設の検索ピル（全ページ）。動く /search への入口をどの面からも 1 タップで届かせる。
 * モバイルはアイコンのみ、sm 以上でラベルも出す。
 */
export default function SearchPill() {
  const t = useTranslations();
  return (
    <Link
      href="/search"
      aria-label={t('search.heading')}
      className="inline-flex items-center gap-1.5 rounded-[3px] border border-line px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink sm:px-3"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" strokeLinecap="round" />
      </svg>
      <span className="hidden sm:inline">{t('nav.search')}</span>
    </Link>
  );
}
