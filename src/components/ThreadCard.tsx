import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import { formatUpdatedAt } from '@/lib/format';
import { SPORT_INFO } from '@/lib/sports';
import { threadTitle } from '@/lib/series';
import { coverImage } from '@/lib/media';
import ArticleCover from '@/components/ArticleCover';
import SeriesBadge from '@/components/SeriesBadge';
import type { Thread } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

type Props = {
  thread: Thread;
  locale: Locale;
  /** 全競技横断（ホーム）では競技名ラベルを出す。競技ページ内では省略。 */
  showSport?: boolean;
  /** 注目記事を大きく見せる */
  featured?: boolean;
};

export default function ThreadCard({ thread, locale, showSport = true, featured = false }: Props) {
  const t = useTranslations();
  const info = SPORT_INFO[thread.sport];
  const sportLabel = locale === 'ja' ? info.labelJa : info.labelEn;
  const title = threadTitle(thread, locale);

  return (
    <Link href={`/${thread.sport}/${thread.id}`} className="group block">
      <article className={featured ? 'grid gap-5 sm:grid-cols-2 sm:items-center' : ''}>
        <div className="overflow-hidden rounded-lg">
          <div className="transition-transform duration-500 group-hover:scale-[1.03]">
            <ArticleCover
              sport={thread.sport}
              locale={locale}
              imageUrl={coverImage(thread)}
              hasVideo={thread.media?.kind === 'video'}
            />
          </div>
        </div>

        <div className={featured ? '' : 'pt-3'}>
          {thread.series && (
            <div className="mb-2">
              <SeriesBadge series={thread.series} locale={locale} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
            {showSport && (
              <span className="font-medium uppercase tracking-wider text-accent">{sportLabel}</span>
            )}
            <span>{thread.subreddit}</span>
            {thread.isSample && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
                {t('threads.sampleBadge')}
              </span>
            )}
          </div>

          <h3
            className={`mt-2 font-bold leading-snug text-ink decoration-accent/40 underline-offset-4 group-hover:underline ${
              featured ? 'text-2xl sm:text-[1.7rem]' : 'text-lg'
            }`}
          >
            {title}
          </h3>

          <p className={`mt-2 text-sm leading-relaxed text-ink-soft ${featured ? 'line-clamp-3' : 'line-clamp-2'}`}>
            {thread.summaryJa}
          </p>

          <div className="mt-3 flex items-center gap-3 text-xs text-ink-soft">
            <span>{t('threads.commentCount', { count: thread.totalComments })}</span>
            <span className="h-1 w-1 rounded-full bg-line" />
            <time>{formatUpdatedAt(thread.fetchedAt, locale)}</time>
          </div>
        </div>
      </article>
    </Link>
  );
}
