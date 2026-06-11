import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import { formatUpdatedAt } from '@/lib/format';
import { SPORT_INFO, pickImage } from '@/lib/sports';
import ArticleCover from '@/components/ArticleCover';
import type { Column } from '@/types/column';
import type { Locale } from '@/lib/i18n';

type Props = {
  column: Column;
  locale: Locale;
  /** 注目記事を大きく見せる */
  featured?: boolean;
};

export default function ColumnCard({ column, locale, featured = false }: Props) {
  const t = useTranslations();
  const info = SPORT_INFO[column.sport];
  const sportLabel = locale === 'ja' ? info.labelJa : info.labelEn;
  const kindLabel = t(`columns.kind.${column.kind}`);
  const title = locale === 'ja' ? column.title.ja : column.title.en;

  return (
    <Link href={`/columns/${column.id}`} className="group block">
      <article className={featured ? 'grid gap-5 sm:grid-cols-2 sm:items-center' : ''}>
        <div className="overflow-hidden rounded-lg">
          <div className="transition-transform duration-500 group-hover:scale-[1.03]">
            <ArticleCover
              sport={column.sport}
              locale={locale}
              imageUrl={pickImage(column.sport, column.id)}
              eyebrow={`${kindLabel} · ${sportLabel}`}
            />
          </div>
        </div>

        <div className={featured ? '' : 'pt-3'}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
            <span className="font-medium uppercase tracking-wider text-accent">{kindLabel}</span>
            {column.source && <span>{column.source}</span>}
          </div>

          <h3
            className={`mt-2 font-bold leading-snug text-ink decoration-accent/40 underline-offset-4 group-hover:underline ${
              featured ? 'text-2xl sm:text-[1.7rem]' : 'text-lg'
            }`}
          >
            {title}
          </h3>

          <p
            className={`mt-2 text-sm leading-relaxed text-ink-soft ${
              featured ? 'line-clamp-3' : 'line-clamp-2'
            }`}
          >
            {column.lead}
          </p>

          <div className="mt-3 flex items-center gap-3 text-xs text-ink-soft">
            <time>{formatUpdatedAt(column.publishedAt, locale)}</time>
          </div>
        </div>
      </article>
    </Link>
  );
}
