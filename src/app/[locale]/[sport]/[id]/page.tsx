import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getThread, getThreadsBySport, getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { formatUpdatedAt } from '@/lib/format';
import { SPORTS, SPORT_INFO, isSport } from '@/lib/sports';
import { threadTitle, seriesTitle, getSeries } from '@/lib/series';
import { coverImage, ogCover } from '@/lib/media';
import { rankNextReads } from '@/lib/nextRead';
import { tagCountMap } from '@/lib/tags';
import ArticleCover from '@/components/ArticleCover';
import MediaEmbed from '@/components/MediaEmbed';
import SeriesBadge from '@/components/SeriesBadge';
import Transcript from '@/components/Transcript';
import StatBox from '@/components/StatBox';
import GameResultCard from '@/components/GameResultCard';
import WatchAlong from '@/components/WatchAlong';
import RelatedArticles from '@/components/RelatedArticles';
import NextReadCard from '@/components/NextReadCard';
import SeriesNav from '@/components/SeriesNav';
import TagList from '@/components/TagList';
import Breadcrumbs from '@/components/Breadcrumbs';
import ShareButtons from '@/components/ShareButtons';
import VodCta from '@/components/VodCta';
import { absoluteUrl, SITE_URL, localeAlternates } from '@/lib/site';
import { getPlayerByJaName, primaryPlayerOf } from '@/lib/players';
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
  // OGP/Discover は 1200px 幅以上を要求するので、動画は maxresdefault(1280x720) を優先する
  // 大きいカバーを使う（カード表示の coverImage=hqdefault とは別物）。
  const cover = await ogCover(thread);

  return {
    title,
    description,
    alternates: localeAlternates(locale, `/${sport}/${id}`),
    openGraph: {
      title,
      description,
      type: 'article',
      images: [{ url: cover.url, width: cover.width, height: cover.height }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [cover.url],
    },
  };
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; sport: string; id: string }>;
}) {
  const { locale, sport, id } = await params;
  setRequestLocale(locale);
  if (!isSport(sport)) notFound();
  const t = await getTranslations();
  const thread = await getThread(sport, id);
  if (!thread) notFound();

  // 回遊導線（記事末尾）用に全記事を読む。SSG なのでビルド時のみ走る。
  const [allThreads, allColumns] = await Promise.all([getAllThreads(), getAllColumns()]);

  // タグの回遊価値判定用: 全記事横断のタグ出現数（singleton の非リンク化に使う。追加 I/O 無し）。
  const tagCounts = tagCountMap(allThreads);
  // この記事の「主役選手」＝パンくずの選手階層。タグに居る選手は必ずハブが生成済み＝リンク安全。
  const primaryPlayer = primaryPlayerOf(thread);
  const primaryPlayerName = primaryPlayer
    ? locale === 'ja'
      ? primaryPlayer.nameJa
      : primaryPlayer.nameEn
    : null;

  // 「次に読む」ランキング（選手優先＋共有タグ IDF＋多様性）。先頭をオチ直後のプライムカードに、
  // 残りを記事末の関連枠に回す（1回の順位付けを分けるので多様性キャップが card+grid をまたいで効く）。
  const currentKey = `thread/${sport}/${thread.id}`;
  const ranked = rankNextReads({
    current: { sport, key: currentKey, tags: thread.tags, thread },
    threads: allThreads,
    columns: allColumns,
    limit: 5,
  });
  const nextPick = ranked[0] ?? null;
  const relatedRanked = ranked.slice(1, 5);

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
  // コメントの出所で表示を変える: reddit=u/接頭辞+▲ / interview=名前のみ / youtube=名前そのまま+👍
  const isInterview = thread.format === 'interview';
  const isYoutube = thread.format === 'youtube';
  const authorLabel = (a: string) => (isInterview || isYoutube ? a : `u/${a}`);
  const scoreMark = isYoutube ? '👍' : '▲';

  // 構造化データ（JSON-LD）。Discover/検索のリッチリザルト＝パンくず表示・記事カードに効く。
  // VideoObject は動画公開日(uploadDate)が必須だが手元に無いので入れない（捏造しない）。
  const articleUrl = absoluteUrl(locale, `/${sport}/${id}`);
  const cover = await ogCover(thread);
  const categoryLabel = locale === 'ja' ? info.labelJa : info.labelEn;
  // 記事をエンティティ（選手）に接続する。tags の選手名から選手カタログを引き、Person(sameAs) で
  // Knowledge Graph に紐づけ、選手ハブ(url)へも結ぶ＝Discover/エンティティ理解の地ならし。
  const taggedPlayers = (thread.tags ?? [])
    .map((tag) => getPlayerByJaName(tag)) // nameJa＋エイリアスで解決（表記ゆれ吸収）
    .filter((p): p is NonNullable<typeof p> => p != null)
    // 同一選手が nameJa とエイリアスで二重に出ないよう slug で重複排除。
    .filter((p, i, arr) => arr.findIndex((x) => x.slug === p.slug) === i);

  // 成績ボックスは「注目選手の成績」＝日本人とは限らない（対戦相手の主役なども載る）。
  // ドジャース枠だけは打線全員(stats)が積まれて長くなるので、日本人選手（カタログの非 rival）だけに絞り、
  // 残りのチームメイトは件数だけ数えて「{自軍}選手の成績を見る」で /player 一覧へ畳む（series.ts の
  // statsJpOnly が正）。他のシリーズ・単発の試合は編集者が選んだ注目選手(stats 全件)をそのまま出す
  // ＝PCA/Wood/Abrams のような非日本人スターも表示する（matome R10）。
  const jpStats = (thread.stats ?? []).filter((s) => {
    const pl = getPlayerByJaName(s.player);
    return pl != null && !pl.rival;
  });
  const seriesInfo = thread.series ? getSeries(thread.series.id) : null;
  const seriesTeam = seriesInfo?.team;
  const jpOnlyBox = Boolean(seriesInfo?.statsJpOnly);
  const boxStats = jpOnlyBox ? jpStats : (thread.stats ?? []);
  const hiddenTeammates = jpOnlyBox ? (thread.stats ?? []).length - jpStats.length : 0;
  const seriesId = thread.series?.id; // 一覧リンクの自軍アンカー（/player#dodgers 等）
  // 試合ページ→選手ハブの個別リンクは日本人選手だけに絞る（打線全員のチップで埋めない。
  // 非日本人は「{自軍}選手の成績を見る」一覧リンクに集約）。JSON-LD の about は全員のまま（SEO）。
  const jpTagged = taggedPlayers.filter((p) => !p.rival);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        // ブランド実体を @id 付きで1回定義し、記事の author/publisher をここへ名寄せする（ホーム #organization と同一 @id）。
        // 素の Organization のままだと記事の発行者がホームの #organization と別実体扱いになり、公式X等の外部シグナル（sameAs）が
        // 記事の発行者に紐づかない。@id 参照で1実体に束ねる。#organization ノードを同グラフに置くので publisher.name/logo も満たす。
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: '海外の反応',
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 1358, height: 428 },
        sameAs: ['https://x.com/gogogo123ka'],
      },
      {
        // 試合直後の反応まとめ＝時事コンテンツなので NewsArticle（Top Stories/News 適格の鍵）。
        '@type': 'NewsArticle',
        headline: title,
        description: thread.summaryJa.slice(0, 200),
        image: { '@type': 'ImageObject', url: cover.url, width: cover.width, height: cover.height },
        datePublished: thread.fetchedAt,
        dateModified: thread.fetchedAt,
        inLanguage: locale,
        // author/publisher は上の #organization（@id）へ名寄せ＝別実体化を防ぐ。同グラフ内で name/logo/sameAs に解決される。
        author: { '@id': `${SITE_URL}/#organization` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
        ...(taggedPlayers.length
          ? {
              about: taggedPlayers.map((p) => ({
                '@type': 'Person',
                name: p.nameJa,
                alternateName: p.nameEn,
                url: absoluteUrl(locale, `/player/${p.slug}`),
                ...(p.sameAs.length ? { sameAs: p.sameAs } : {}),
              })),
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          {
            '@type': 'ListItem',
            position: 2,
            name: categoryLabel,
            item: absoluteUrl(locale, `/${sport}`),
          },
          // 主役選手ハブを挟む4階層（可視パンくずと一致）。選手が居ない記事は3階層のまま。
          ...(primaryPlayer && primaryPlayerName
            ? [
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: primaryPlayerName,
                  item: absoluteUrl(locale, `/player/${primaryPlayer.slug}`),
                },
              ]
            : []),
          {
            '@type': 'ListItem',
            position: primaryPlayer && primaryPlayerName ? 4 : 3,
            name: title,
          },
        ],
      },
    ],
  };

  return (
    <article className="mx-auto max-w-prose">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { name: t('nav.home'), href: '/' },
            { name: categoryLabel, href: `/${sport}` },
            // 主役選手の常緑ハブを挟んで、検索着地→選手ハブ→他記事の回遊を作る。
            ...(primaryPlayer && primaryPlayerName
              ? [{ name: primaryPlayerName, href: `/player/${primaryPlayer.slug}` }]
              : []),
            { name: title },
          ]}
        />
      </div>
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
          {/* 記事詳細ではバッジをシリーズ棚（/watch/series/{id}）への回遊リンクにする。 */}
          <SeriesBadge series={thread.series} locale={locale} asLink />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span className="font-medium uppercase tracking-wider text-ink-soft">
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

      {thread.tags && <TagList tags={thread.tags} counts={tagCounts} />}

      {hook && (
        <figure className="mt-8 border-l-4 border-ink pl-5">
          <blockquote className="text-xl font-bold leading-relaxed text-ink sm:text-[1.7rem] sm:leading-snug">
            “{hook.bodyJa}”
          </blockquote>
          <figcaption className="mt-2 text-sm text-ink-soft">
            — {hook.sourceUrl ? (
              <a href={hook.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-2 transition-colors hover:text-ink">
                {authorLabel(hook.author)}
              </a>
            ) : (
              authorLabel(hook.author)
            )}
          </figcaption>
        </figure>
      )}

      <p className="mt-7 text-[15px] leading-relaxed text-ink-soft">{thread.summaryJa}</p>

      {/* 注目選手の成績ボックス（R10）。MLB の試合まとめで summaryJa の直下に出す。数値は編集時に
          fetch-mlb-stats.mjs で取得した公知の事実のみ（サイト本体は API を叩かない）。
          単発の試合は注目選手(boxStats=stats全件・非日本人も含む)、シリーズ戦は日本人だけ＝残りは下のリンクへ。 */}
      {boxStats.length > 0 && (
        <StatBox
          stats={boxStats}
          heading={t('threads.statsHeading')}
          todayLabel={t('threads.statToday')}
          seasonLabel={t('threads.statSeason')}
          warLabel={t('threads.statWar')}
          deltaLabel={t('threads.statDelta')}
          rankLabel={t('threads.statRank')}
        />
      )}
      {/* 残りのチームメイト（非日本人）は畳んで、自軍の選手成績一覧（/player）へ送る。 */}
      {seriesTeam && hiddenTeammates > 0 && (
        <p className="mt-3">
          <Link
            href={`/player${seriesId ? `#${seriesId}` : ''}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink hover:underline"
          >
            {t('threads.teamRosterStats', { team: locale === 'ja' ? seriesTeam.ja : seriesTeam.en })}
            <span aria-hidden="true">→</span>
          </Link>
        </p>
      )}

      {/* 試合ページ → 選手の今季成績ハブ（相互送客＝回遊／エンティティ強化）。日本人選手のみ（jpTagged）。 */}
      {sport === 'mlb' && jpTagged.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-2">
          {jpTagged.map((p) => (
            <Link
              key={p.slug}
              href={`/player/${p.slug}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[3px] bg-surface px-4 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-paper"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current text-ink-mute" aria-hidden>
                <rect x="3" y="13" width="4" height="8" />
                <rect x="10" y="8" width="4" height="13" />
                <rect x="17" y="4" width="4" height="17" />
              </svg>
              {t('player.hubCta', { name: p.nameJa })}
              <span aria-hidden="true" className="text-ink-mute">→</span>
            </Link>
          ))}
        </p>
      )}

      {/* 試合結果カード（横展開）。最終スコア（thread.game・公知数値）がある MLB 記事だけ、Topps 調の
          スコアボード1枚を画像出力できる＝記事＝拡散の起点。日本人選手のこの試合の成績(stats.today)も同梱。 */}
      {sport === 'mlb' && thread.game && (
        <div className="mt-6">
          <GameResultCard
            game={thread.game}
            dateLabel={(() => {
              const g = (thread.series?.date ?? thread.id.slice(0, 10)).split('-');
              return `${g[0]}.${Number(g[1])}.${Number(g[2])}`;
            })()}
            stats={jpStats
              .filter((s) => s.today)
              .map((s) => ({ player: s.player, line: s.today as string }))}
            articleUrl={absoluteUrl(locale, `/${sport}/${thread.id}`)}
            locale={locale}
          />
        </div>
      )}

      {isWatchAlong ? (
        // この記事だけ：動画をピン留めし、その裏をコメントが試合の時系列順に流れる。
        <WatchAlong
          thread={thread}
          comments={comments}
          pickedLabel={t('threads.pickedComments', { total: thread.totalComments })}
          hintLabel={t('threads.watchAlongHint')}
          transcriptLabel={t('threads.transcript')}
        />
      ) : (
        <>
          {/* 動画は本文に埋め込む（hero は再生できないため）。画像は hero で見せ済みなので重複させない。 */}
          {thread.media?.kind === 'video' && (
            <MediaEmbed media={thread.media} sourceUrl={thread.sourceUrl} />
          )}

          {/* 番組トーク（あれば）を動画とコメントの間に挟む。 */}
          {thread.transcript && thread.transcript.length > 0 && (
            <Transcript segments={thread.transcript} heading={t('threads.transcript')} />
          )}

          {/* 追加メディア（連続フレーム等）は本文に順に差し込む。 */}
          {thread.gallery?.map((m, i) => (
            <MediaEmbed key={i} media={m} sourceUrl={thread.sourceUrl} />
          ))}

          <section className="mt-10">
            <h2 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <span className="h-3 w-[2px] bg-ink" />
              {t('threads.pickedComments', { total: thread.totalComments })}
            </h2>
            <ul className="space-y-5">
              {comments.map((c, i) => (
                <li
                  key={i}
                  className={`rounded-xl border p-5 ${
                    c.isHighlight ? 'border-ink/20 bg-ink/[0.03]' : 'border-line bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-ink-soft">
                    {/* 媒体引用は著者名から出典へ送客（海外メディア評価の記事＝媒体ごとにリンク）。 */}
                    {c.sourceUrl ? (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="font-medium underline decoration-line underline-offset-2 transition-colors hover:text-ink"
                      >
                        {authorLabel(c.author)}
                      </a>
                    ) : (
                      <span className="font-medium">{authorLabel(c.author)}</span>
                    )}
                    {!isInterview && (
                      <span className="tabular-nums">
                        {scoreMark} {c.score.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink">{c.bodyJa}</p>
                  {/* 原文（英語）の併記。日本語ソース（Netflix Japan 等の日本語コメント）では原文＝訳で
                      重複するので bodyEn を空にして併記を省く */}
                  {c.bodyEn && (
                    <p className="mt-2 border-t border-line/70 pt-2 text-xs italic leading-relaxed text-ink-soft">
                      {c.bodyEn}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* シリーズ記事なら前試合/次試合の直列ナビ（毎試合追う読者の回遊）。1本しか無い間は何も出さない。 */}
      <SeriesNav thread={thread} threads={allThreads} locale={locale} />

      {/* オチ直後（感情のピーク）＝回遊の一等地。ページ唯一の塗り CTA をここへ移す。 */}
      {nextPick && <NextReadCard pick={nextPick} locale={locale} />}

      {/* 元スレ導線はテキストリンクに降格（送客の引用要件は維持しつつ「去る」導線は主役から外す）。 */}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <a
          href={thread.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft underline-offset-2 transition-colors hover:text-ink hover:underline"
        >
          {t('threads.viewSource')}
          <span aria-hidden>↗</span>
        </a>
        <ShareButtons url={absoluteUrl(locale, `/${sport}/${thread.id}`)} title={title} />
      </footer>

      {/* 記事下 VOD CTA（収益化の器②）。競技ごとの視聴サービスを案内。提携前は公式URL、確定後にアフィリンクへ差し替え。 */}
      <VodCta
        sport={sport}
        locale={locale}
        heading={t('vod.heading', { sport: locale === 'ja' ? info.labelJa : info.labelEn })}
        prLabel={t('vod.pr')}
        watchLabel={t('vod.watch')}
      />

      {/* 記事末の関連枠は「次に読む」カードと同じ順位付けの続き（多様性キャップが両方をまたいで効く）。 */}
      <RelatedArticles ranked={relatedRanked} locale={locale} />
    </article>
  );
}
