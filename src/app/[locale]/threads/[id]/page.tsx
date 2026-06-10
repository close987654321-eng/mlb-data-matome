import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getThread, getThreads } from '@/lib/data';
import { formatUpdatedAt } from '@/lib/format';
import { locales, type Locale } from '@/lib/i18n';

export async function generateStaticParams() {
  const threads = await getThreads();
  return locales.flatMap((locale) => threads.map((thread) => ({ locale, id: thread.id })));
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const thread = await getThread(id);
  if (!thread) notFound();

  // upvote 降順で、人気コメントが上に来るようにする
  const comments = [...thread.comments].sort((a, b) => b.score - a.score);

  return (
    <article className="space-y-6">
      <header className="space-y-2">
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
          <span>{formatUpdatedAt(thread.fetchedAt, locale)}</span>
        </div>
        <h1 className="text-2xl font-bold text-mlbnavy">
          {locale === 'ja' ? thread.title.ja : thread.title.en}
        </h1>
        <p className="text-sm text-gray-400">
          {locale === 'ja' ? thread.title.en : thread.title.ja}
        </p>
        {thread.tags && thread.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {thread.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <p className="rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
        {thread.summaryJa}
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500">
          {t('threads.pickedComments', { total: thread.totalComments })}
        </h2>
        <ul className="space-y-3">
          {comments.map((c, i) => (
            <li
              key={i}
              className={`rounded-xl border p-4 ${
                c.isHighlight ? 'border-mlbnavy/40 bg-mlbnavy/5' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium">u/{c.author}</span>
                <span className="tabular-nums">▲ {c.score.toLocaleString()}</span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-900">{c.bodyJa}</p>
              <p className="mt-1 text-xs italic leading-relaxed text-gray-400">{c.bodyEn}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-gray-200 pt-4 text-sm">
        <a
          href={thread.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-mlbnavy underline hover:no-underline"
        >
          {t('threads.viewSource')} →
        </a>
      </footer>
    </article>
  );
}
