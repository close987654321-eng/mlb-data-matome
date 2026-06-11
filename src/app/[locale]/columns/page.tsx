import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllColumns } from '@/lib/columns';
import ColumnCard from '@/components/ColumnCard';
import { locales, type Locale } from '@/lib/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function ColumnsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const columns = await getAllColumns();
  const [featured, ...rest] = columns;

  return (
    <div className="space-y-10">
      <section className="border-b border-line pb-8">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {t('columns.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          {t('columns.sectionTitle')}
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
          {t('columns.lead')}
        </p>
      </section>

      {columns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          {t('columns.empty')}
        </p>
      ) : (
        <section className="space-y-8">
          {featured && <ColumnCard column={featured} locale={locale} featured />}
          {rest.length > 0 && (
            <ul className="grid gap-x-8 gap-y-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((column) => (
                <li key={column.id}>
                  <ColumnCard column={column} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
