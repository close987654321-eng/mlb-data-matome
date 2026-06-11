import Image from 'next/image';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import ThreadCard from '@/components/ThreadCard';
import ColumnCard from '@/components/ColumnCard';
import { Link } from '@/lib/navigation';
import type { Locale } from '@/lib/i18n';

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const [threads, columns] = await Promise.all([getAllThreads(), getAllColumns()]);
  const [featured, ...rest] = threads;

  return (
    <div className="space-y-12">
      <section className="border-b border-line pb-8">
        {/* メインビジュアル（ブランドのキービジュアル） */}
        <Image
          src="/logo.png"
          alt={t('site.title')}
          width={1358}
          height={428}
          priority
          className="mb-7 h-auto w-full max-w-xl"
        />
        <h1 className="text-3xl font-bold leading-tight text-ink sm:text-5xl">
          {t('home.heroTitle')}
        </h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-soft sm:text-base">
          {t('home.heroBody')}
        </p>
      </section>

      {threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          {t('threads.empty')}
        </p>
      ) : (
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="h-4 w-1 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
              {t('home.latest')}
            </h2>
          </div>

          {featured && <ThreadCard thread={featured} locale={locale} featured />}

          {rest.length > 0 && (
            <ul className="grid gap-x-8 gap-y-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((thread) => (
                <li key={`${thread.sport}/${thread.id}`}>
                  <ThreadCard thread={thread} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {columns.length > 0 && (
        <section className="space-y-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="h-4 w-1 rounded-full bg-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
                {t('columns.sectionTitle')}
              </h2>
            </div>
            <Link href="/columns" className="text-xs text-ink-soft transition-colors hover:text-ink">
              {t('columns.viewAll')} →
            </Link>
          </div>

          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {columns.slice(0, 3).map((column) => (
              <li key={column.id}>
                <ColumnCard column={column} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
