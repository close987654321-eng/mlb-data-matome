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
  /** 一覧で最上部のカードだけ true。カバー画像を LCP として先取りする。 */
  priority?: boolean;
};

// カードに出す主要タグから外す汎用語（ほぼ全記事に付く＝回遊の手がかりにならない）。
const CARD_TAG_DENY = new Set(['海外の反応']);

export default function ThreadCard({
  thread,
  locale,
  showSport = true,
  featured = false,
  priority = false,
}: Props) {
  const t = useTranslations();
  const info = SPORT_INFO[thread.sport];
  const sportLabel = locale === 'ja' ? info.labelJa : info.labelEn;
  const title = threadTitle(thread, locale);
  // 話題回遊用の主要タグ（最大2つ）。多すぎるとジャケットの美観と CLS を損なうので絞る。
  const cardTags = (thread.tags ?? []).filter((tag) => !CARD_TAG_DENY.has(tag)).slice(0, 2);

  return (
    // relative + 見出しの stretched link（after:absolute inset-0）でカード全体をクリック可能にしつつ、
    // タグチップは relative z-10 でその上に乗せ、別リンクとして独立して押せる（入れ子アンカーを避ける）。
    <article className={`group relative ${featured ? 'grid gap-5 sm:grid-cols-2 sm:items-center' : ''}`}>
      <div className="overflow-hidden rounded-lg">
        <div className="transition-transform duration-500 group-hover:scale-[1.03]">
          <ArticleCover
            sport={thread.sport}
            locale={locale}
            imageUrl={coverImage(thread)}
            hasVideo={thread.media?.kind === 'video'}
            priority={priority}
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
          <Link
            href={`/${thread.sport}/${thread.id}`}
            className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {title}
          </Link>
        </h3>

        <p className={`mt-2 text-sm leading-relaxed text-ink-soft ${featured ? 'line-clamp-3' : 'line-clamp-2'}`}>
          {thread.summaryJa}
        </p>

        <div className="mt-3 flex items-center gap-3 text-xs text-ink-soft">
          <span>{t('threads.commentCount', { count: thread.totalComments })}</span>
          <span className="h-1 w-1 rounded-full bg-line" />
          <time>{formatUpdatedAt(thread.fetchedAt, locale)}</time>
        </div>

        {cardTags.length > 0 && (
          <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
            {cardTags.map((tag) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}`}
                className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
