import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllColumns, getColumn } from '@/lib/columns';
import { formatUpdatedAt } from '@/lib/format';
import { SPORT_INFO, pickImage } from '@/lib/sports';
import ArticleCover from '@/components/ArticleCover';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export async function generateStaticParams() {
  const columns = await getAllColumns();
  return columns.flatMap((column) => locales.map((locale) => ({ locale, id: column.id })));
}

export default async function ColumnDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const column = await getColumn(id);
  if (!column) notFound();

  const info = SPORT_INFO[column.sport];
  const sportLabel = locale === 'ja' ? info.labelJa : info.labelEn;
  const kindLabel = t(`columns.kind.${column.kind}`);
  const title = locale === 'ja' ? column.title.ja : column.title.en;
  const subtitle = locale === 'ja' ? column.title.en : column.title.ja;

  return (
    <article className="mx-auto max-w-prose">
      <ArticleCover
        sport={column.sport}
        locale={locale}
        imageUrl={pickImage(column.sport, column.id)}
        title={title}
        eyebrow={`${kindLabel} · ${sportLabel}`}
        variant="hero"
      />

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span className="font-medium uppercase tracking-wider text-accent">{kindLabel}</span>
        {column.source && <span>{column.source}</span>}
        <span className="ml-auto">{formatUpdatedAt(column.publishedAt, locale)}</span>
      </div>

      <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>

      {column.tags && column.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {column.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {column.heroQuote && (
        <figure className="mt-8 border-l-4 border-accent pl-5">
          <blockquote className="text-xl font-bold leading-relaxed text-ink sm:text-[1.7rem] sm:leading-snug">
            “{column.heroQuote.text}”
          </blockquote>
          {column.heroQuote.cite && (
            <figcaption className="mt-2 text-sm text-ink-soft">— {column.heroQuote.cite}</figcaption>
          )}
        </figure>
      )}

      <p className="mt-7 text-[15px] leading-relaxed text-ink-soft">{column.lead}</p>

      <div className="mt-8 space-y-6">
        {column.blocks.map((block, i) => {
          if (block.type === 'heading') {
            return (
              <h2
                key={i}
                className="mt-10 flex items-center gap-2 text-lg font-bold leading-snug text-ink sm:text-xl"
              >
                <span className="h-5 w-1 rounded-full bg-accent" />
                {block.text}
              </h2>
            );
          }
          if (block.type === 'quote') {
            return (
              <figure key={i} className="border-l-4 border-accent/50 pl-5">
                <blockquote className="text-[17px] font-medium leading-relaxed text-ink">
                  “{block.quote.text}”
                </blockquote>
                {block.quote.cite && (
                  <figcaption className="mt-1.5 text-xs text-ink-soft">
                    — {block.quote.cite}
                  </figcaption>
                )}
              </figure>
            );
          }
          return (
            <p key={i} className="text-[15px] leading-relaxed text-ink">
              {block.text}
            </p>
          );
        })}
      </div>

      {column.sourceUrl && (
        <footer className="mt-10 border-t border-line pt-5">
          <a
            href={column.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
          >
            {t('columns.viewSource')}
            <span aria-hidden>→</span>
          </a>
        </footer>
      )}
    </article>
  );
}
