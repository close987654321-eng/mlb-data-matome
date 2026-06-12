import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getThread, getThreadsBySport, getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { formatUpdatedAt } from '@/lib/format';
import { SPORTS, SPORT_INFO, isSport } from '@/lib/sports';
import { threadTitle, seriesTitle } from '@/lib/series';
import { coverImage } from '@/lib/media';
import ArticleCover from '@/components/ArticleCover';
import MediaEmbed from '@/components/MediaEmbed';
import SeriesBadge from '@/components/SeriesBadge';
import WatchAlong from '@/components/WatchAlong';
import RelatedArticles from '@/components/RelatedArticles';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export async function generateStaticParams() {
  const lists = await Promise.all(SPORTS.map((sport) => getThreadsBySport(sport)));
  return lists.flat().flatMap((thread) =>
    locales.map((locale) => ({ locale, sport: thread.sport, id: thread.id })),
  );
}

// 記事ごとに OG/Twitter カードを出し分ける。これが無いと layout の固定 OGP（ロゴ）を
// 全記事が継いでしまい、X 等で共有するとどの記事もロゴ画像になる。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; sport: string; id: string }>;
}): Promise<Metadata> {
  const { locale, sport, id } = await params;
  if (!isSport(sport)) return {};
  const thread = await getThread(sport, id);
  if (!thread) return {};

  const title = threadTitle(thread, locale);
  const description = thread.summaryJa;
  // coverImage は外部絶対URL（i.redd.it / i.ytimg.com / Unsplash）かローカル相対パス。
  // 相対パスは layout の metadataBase で絶対化される。
  const image = coverImage(thread);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; sport: string; id: string }>;
}) {
  const { locale, sport, id } = await params;
  unstable_setRequestLocale(locale);
  if (!isSport(sport)) notFound();
  const t = await getTranslations();
  const thread = await getThread(sport, id);
  if (!thread) notFound();

  // 回遊導線（記事末尾）用に全記事を読む。SSG なのでビルド時のみ走る。
  const [allThreads, allColumns] = await Promise.all([getAllThreads(), getAllColumns()]);

  const info = SPORT_INFO[sport];
  const otherLocale = locale === 'ja' ? 'en' : 'ja';
  // シリーズ記事はタイトルを定型で自動生成し、副題も反対ロケールの定型タイトルにする。
  const title = threadTitle(thread, locale);
  const subtitle = thread.series
    ? seriesTitle(thread.series, otherLocale)
    : thread.title[otherLocale];
  // フック引用は冒頭に大きく掲げ、本文リストからは外す（重複を避ける）。
  const hook = thread.comments.find((c) => c.isHook);
  // JSON の配列順 = 編集した「会話の流れ」順をそのまま表示する（スコア順に並べ替えない）。
  // 最後がオチになるよう matome スキルの R1/R2 に従って並べてある前提。
  const comments = thread.comments.filter((c) => !c.isHook);
  // 動画つきの記事は「動画ピン留め＋コメントが裏を流れる」watch-along をデフォルトにする。
  const isWatchAlong = thread.media?.kind === 'video';

  return (
    <article className="mx-auto max-w-prose">
      <ArticleCover
        sport={sport}
        locale={locale}
        imageUrl={coverImage(thread)}
        title={title}
        variant="hero"
        credit={thread.media?.kind === 'image' ? thread.media.credit : undefined}
      />

      {thread.series && (
        <div className="mt-6">
          <SeriesBadge series={thread.series} locale={locale} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span className="font-medium uppercase tracking-wider text-accent">
          {locale === 'ja' ? info.labelJa : info.labelEn}
        </span>
        <span>{thread.subreddit}</span>
        {thread.flair && <span>{thread.flair}</span>}
        {thread.isSample && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
            {t('threads.sampleBadge')}
          </span>
        )}
        <span className="ml-auto">{formatUpdatedAt(thread.fetchedAt, locale)}</span>
      </div>

      <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>

      {thread.tags && thread.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {thread.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {hook && (
        <figure className="mt-8 border-l-4 border-accent pl-5">
          <blockquote className="text-xl font-bold leading-relaxed text-ink sm:text-[1.7rem] sm:leading-snug">
            “{hook.bodyJa}”
          </blockquote>
          <figcaption className="mt-2 text-sm text-ink-soft">— u/{hook.author}</figcaption>
        </figure>
      )}

      <p className="mt-7 text-[15px] leading-relaxed text-ink-soft">{thread.summaryJa}</p>

      {isWatchAlong ? (
        // この記事だけ：動画をピン留めし、その裏をコメントが試合の時系列順に流れる。
        <WatchAlong
          thread={thread}
          comments={comments}
          pickedLabel={t('threads.pickedComments', { total: thread.totalComments })}
          hintLabel={t('threads.watchAlongHint')}
        />
      ) : (
        <>
          {/* 動画は本文に埋め込む（hero は再生できないため）。画像は hero で見せ済みなので重複させない。 */}
          {thread.media?.kind === 'video' && (
            <MediaEmbed media={thread.media} sourceUrl={thread.sourceUrl} />
          )}

          {/* 追加メディア（連続フレーム等）は本文に順に差し込む。 */}
          {thread.gallery?.map((m, i) => (
            <MediaEmbed key={i} media={m} sourceUrl={thread.sourceUrl} />
          ))}

          <section className="mt-10">
            <h2 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <span className="h-3 w-1 rounded-full bg-accent" />
              {t('threads.pickedComments', { total: thread.totalComments })}
            </h2>
            <ul className="space-y-5">
              {comments.map((c, i) => (
                <li
                  key={i}
                  className={`rounded-xl border p-5 ${
                    c.isHighlight ? 'border-accent/30 bg-accent/[0.04]' : 'border-line bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-ink-soft">
                    <span className="font-medium">u/{c.author}</span>
                    <span className="tabular-nums">▲ {c.score.toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink">{c.bodyJa}</p>
                  <p className="mt-2 border-t border-line/70 pt-2 text-xs italic leading-relaxed text-ink-soft">
                    {c.bodyEn}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <footer className="mt-10 border-t border-line pt-5">
        <a
          href={thread.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
        >
          {t('threads.viewSource')}
          <span aria-hidden>→</span>
        </a>
      </footer>

      <RelatedArticles
        threads={allThreads}
        columns={allColumns}
        currentKey={`thread/${sport}/${thread.id}`}
        sport={sport}
        currentTags={thread.tags}
        locale={locale}
      />
    </article>
  );
}
