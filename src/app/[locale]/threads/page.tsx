import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { getThreads } from '@/lib/data';
import { formatUpdatedAt } from '@/lib/format';
import type { Locale } from '@/lib/i18n';

export default async function ThreadsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const threads = await getThreads();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-mlbnavy">{t('nav.threads')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('threads.lead')}</p>
      </header>

      {threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
          {t('threads.empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/threads/${thread.id}`}
                className="block rounded-xl border border-gray-200 p-4 transition hover:border-mlbnavy hover:bg-gray-50"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="rounded bg-mlbnavy/10 px-2 py-0.5 font-medium text-mlbnavy">
                    {thread.subreddit}
                  </span>
                  {thread.flair && <span className="text-gray-400">{thread.flair}</span>}
                  {thread.isSample && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                      {t('threads.sampleBadge')}
                    </span>
                  )}
                  <span className="ml-auto">{formatUpdatedAt(thread.fetchedAt, locale)}</span>
                </div>
                <h2 className="mt-2 font-semibold text-mlbnavy">
                  {locale === 'ja' ? thread.title.ja : thread.title.en}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{thread.summaryJa}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {t('threads.commentCount', { count: thread.totalComments })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
