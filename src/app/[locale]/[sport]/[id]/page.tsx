import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Link } from '@/lib/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getThread, getThreadsBySport, getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { formatUpdatedAt } from '@/lib/format';
import { SPORTS, SPORT_INFO, isSport } from '@/lib/sports';
import { threadTitle, seriesTitle, getSeries } from '@/lib/series';
import { gameSeoTitle, gameSeoDescription, gameDateOf, gameDateLongJa } from '@/lib/gameSeo';
import { coverImage, ogCover, youTubeId } from '@/lib/media';
import { rankNextReads } from '@/lib/nextRead';
import { isThreadIndexable } from '@/lib/threadIndex';
import { allComments } from '@/lib/daily';
import { tagCountMap } from '@/lib/tags';
import { RIZIN5 } from '@/lib/rizin5';
import Rizin5Promo from '@/components/Rizin5Promo';
import ArticleCover from '@/components/ArticleCover';
import MediaEmbed from '@/components/MediaEmbed';
import SeriesBadge from '@/components/SeriesBadge';
import Transcript from '@/components/Transcript';
import StatBox from '@/components/StatBox';
import DailyArticle from '@/components/DailyArticle';
import StoryBlocks from '@/components/StoryBlocks';
import GameBox from '@/components/GameBox';
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
import { getTeam, teamOfficialUrl, teamLogoUrl } from '@/lib/teams';
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
  // 試合記事は検索結果に出すタイトル/説明文だけ組み直す＝スコアと日付を前に出して「対」クエリに答える
  // （記事本文の見出しは title のまま。理由と実測値は src/lib/gameSeo.ts）。
  const seoTitle = sport === 'mlb' ? gameSeoTitle(thread, locale) : null;
  const description = sport === 'mlb' ? gameSeoDescription(thread, locale) : thread.summaryJa;
  // OGP/Discover は 1200px 幅以上を要求するので、動画は maxresdefault(1280x720) を優先する
  // 大きいカバーを使う（カード表示の coverImage=hqdefault とは別物）。
  const cover = await ogCover(thread);

  // 編集タイトルの多くは末尾が【海外の反応】で、layout の '%s｜海外の反応' テンプレートと重なって
  // 「…【海外の反応】｜海外の反応」になっていた（indexable 121ページで実測）。SERP のタイトルは
  // 表示幅が限られるので重複語を捨てる。記事本文の見出し（h1）は編集タイトルのまま。
  const metaTitle = seoTitle ?? title.replace(/\s*【海外の反応】\s*$/, '');

  return {
    // absolute＝layout のテンプレートを回さない。試合レポートは専用タイトル、それ以外は
    // 「{編集タイトル}｜海外の反応」を自前で組む（ブランド語を1回だけに保つ）。
    title: { absolute: seoTitle ?? `${metaTitle}｜海外の反応` },
    description,
    // 薄い記事（isThreadIndexable=false）は検索に出さない。follow は残す＝リンク先の
    // 選手ハブ・チームLPへの評価の流れは保つ（AdSense再申請の薄コンテンツ手当て）。
    ...(isThreadIndexable(thread) ? {} : { robots: { index: false, follow: true } }),
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
  // 日次記事（きょうの日本人選手）はコーナー構成の読み物として描く＝1本のコメント列にしない。
  const daily = thread.daily ?? null;
  // 語り形式（matome R13）＝コメント列の代わりに「地の文×証言引用」で描く通常記事。daily が優先。
  const story = !daily && thread.story?.length ? thread.story : null;
  // フック引用は冒頭に大きく掲げ、本文リストからは外す（重複を避ける）。
  // 日次記事はコメントを本文の流れの中に持つので、冒頭のフックは出さない。
  const hook = daily ? undefined : thread.comments.find((c) => c.isHook);
  // JSON の配列順 = 編集した「会話の流れ」順をそのまま表示する（スコア順に並べ替えない）。
  // 最後がオチになるよう matome スキルの R1/R2 に従って並べてある前提。
  const comments = thread.comments.filter((c) => !c.isHook);
  // 動画つきの記事は「動画ピン留め＋コメントが裏を流れる」watch-along をデフォルトにする。
  // story 記事は動画があっても watch-along にしない（コメントが空＝流すものが無い。動画は本文に埋め込む）。
  const isWatchAlong = !daily && !story && thread.media?.kind === 'video';
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
  // 試合日の表示（JST）。試合結果ボックスと試合結果カード（画像）で共用する。
  const gameDateLabel = (() => {
    const g = (thread.series?.date ?? thread.id.slice(0, 10)).split('-');
    return `${g[0]}.${Number(g[1])}.${Number(g[2])}`;
  })();
  // 試合ページ→選手ハブの個別リンクは日本人選手だけに絞る（打線全員のチップで埋めない。
  // 非日本人は「{自軍}選手の成績を見る」一覧リンクに集約）。JSON-LD の about は全員のまま（SEO）。
  const jpTagged = taggedPlayers.filter((p) => !p.rival);

  // AEO: 「海外ファンは○○を何と言ったか」に答えるのがこのサイトの中身そのものなので、
  // 抜粋コメントを Comment として機械可読にする（回答エンジン向け。リッチリザルトは狙わない）。
  // 全件（25〜40件）入れると JSON-LD が本文より重くなり LCP を損ねるので、編集が「効く」と
  // 判断したコメント（フック・ハイライト）を優先し、残りをスコア順で足して上限10件に抑える。
  // 訳文(bodyJa)を text にし、原文(bodyEn)は無理に混ぜない＝ページの主言語(ja)と揃える。
  const AEO_COMMENT_LIMIT = 10;
  const flatComments = allComments(thread); // 日次記事はコメントを本文ブロックに持つので横断で拾う
  const pickedComments = [
    ...flatComments.filter((c) => c.isHook || c.isHighlight),
    ...flatComments
      .filter((c) => !c.isHook && !c.isHighlight)
      .sort((a, b) => b.score - a.score),
  ].slice(0, AEO_COMMENT_LIMIT);
  const commentLd = pickedComments.map((c) => ({
    '@type': 'Comment',
    text: c.bodyJa,
    author: { '@type': 'Person', name: c.author },
    // score は実測値のみ（捏造しない＝matome R7）。interview 形式はスコアを持たないので出さない。
    ...(!isInterview && c.score > 0 ? { upvoteCount: c.score } : {}),
    ...(c.sourceUrl ? { url: c.sourceUrl } : {}),
  }));

  // AEO: 動画記事（全492本のうち460本＝93%）を VideoObject で宣言する。
  // uploadDate は必須項目で、YouTube Data API 由来の実測値（media.publishedAt）がある記事にだけ出す
  // ＝取れていない記事（削除・非公開動画）は捏造せず VideoObject を省く。
  // これで動画リッチリザルト／Google の動画タブ／Discover の動画枠に載る資格ができる。
  const ytId = thread.media?.kind === 'video' ? youTubeId(thread.media.url) : null;
  // 要約を構造化データ用に詰める。途中でぶつ切りにせず句点で切り、無ければ … を足す。
  const ldDescription = (s: string, max = 200): string => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastStop = cut.lastIndexOf('。');
    return lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + '…';
  };
  // 日次記事は1本の記事に複数の公式ハイライト（主役＋ざわつき）が乗るので、それぞれ VideoObject を出す。
  const dailyVideoLd = [daily?.hero.media, ...(daily?.buzz ?? []).map((b) => b.media)]
    .filter((m) => m?.kind === 'video' && m.publishedAt)
    .map((m) => {
      const id = youTubeId(m!.url);
      return {
        '@type': 'VideoObject',
        name: m!.videoTitle || title,
        description: ldDescription(thread.summaryJa),
        thumbnailUrl: m!.thumbUrl ?? cover.url,
        uploadDate: m!.publishedAt,
        embedUrl: id ? `https://www.youtube.com/embed/${id}` : undefined,
        contentUrl: m!.url,
        inLanguage: 'en',
        ...(m!.credit ? { creditText: m!.credit } : {}),
        publisher: { '@id': `${SITE_URL}/#organization` },
      };
    });
  const videoLd =
    thread.media?.kind === 'video' && thread.media.publishedAt
      ? [
          {
            '@type': 'VideoObject',
            name: thread.media.videoTitle || title,
            description: ldDescription(thread.summaryJa),
            thumbnailUrl: cover.url,
            uploadDate: thread.media.publishedAt,
            embedUrl: ytId ? `https://www.youtube.com/embed/${ytId}` : undefined,
            contentUrl: thread.media.url,
            inLanguage: 'en', // 海外の公式ハイライト＝動画自体は英語
            ...(thread.media.credit ? { creditText: thread.media.credit } : {}),
            publisher: { '@id': `${SITE_URL}/#organization` },
          },
        ]
      : [];

  // AEO: 試合そのものを SportsEvent として宣言する。schema.org に「得点」の標準プロパティは
  // 無いので、スコアは name / description に文章で入れる（回答エンジンが引用できる形）。
  // 両チームは SportsTeam ＋ 公式サイトの sameAs で実体照合し、記事の about から参照させる。
  const eventId = `${articleUrl}#game`;
  const eventLd = (() => {
    const g = thread.game;
    if (sport !== 'mlb' || !g) return [];
    const team = (side: typeof g.away) => {
      const info = getTeam(side.ja);
      return {
        '@type': 'SportsTeam',
        name: side.en,
        alternateName: side.ja,
        ...(info ? { sameAs: teamOfficialUrl(info.slug), logo: teamLogoUrl(info.id) } : {}),
      };
    };
    const winner = g.away.score > g.home.score ? g.away : g.home;
    return [
      {
        '@type': 'SportsEvent',
        '@id': eventId,
        name: `${g.away.ja} 対 ${g.home.ja} ${g.away.score}-${g.home.score}`,
        description:
          `${gameDateLongJa(gameDateOf(thread))}の MLB 公式戦。` +
          `${g.away.ja} ${g.away.score} - ${g.home.score} ${g.home.ja} で${winner.ja}が勝利。`,
        startDate: gameDateOf(thread),
        sport: 'Baseball',
        awayTeam: team(g.away),
        homeTeam: team(g.home),
        // 勝敗投手が取れている試合は主要な出演者として出す（公式 decisions 由来）。
        ...(g.decisions?.winner
          ? { performer: [{ '@type': 'Person', name: g.decisions.winner }] }
          : {}),
        url: articleUrl,
      },
    ];
  })();

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
        // 説明文は試合記事だけスコアを先頭に置いた版（メタの description と同じ文＝SERP と一致させる）。
        description: ldDescription(
          sport === 'mlb' ? gameSeoDescription(thread, locale) : thread.summaryJa,
        ),
        image: { '@type': 'ImageObject', url: cover.url, width: cover.width, height: cover.height },
        datePublished: thread.fetchedAt,
        // 公開後に直した記事は updatedAt を立てる（無ければ公開日と同値）。fetchedAt は「取得日」で
        // 後から動かさないので、これが無いと修正・追記が鮮度シグナルとして伝わらない。
        dateModified: thread.updatedAt ?? thread.fetchedAt,
        inLanguage: locale,
        // author/publisher は上の #organization（@id）へ名寄せ＝別実体化を防ぐ。同グラフ内で name/logo/sameAs に解決される。
        author: { '@id': `${SITE_URL}/#organization` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
        // 抜粋コメント（AEO）。「現地ファンの声」がこの記事の主要な中身であることを機械可読にする。
        ...(commentLd.length ? { comment: commentLd, commentCount: thread.totalComments } : {}),
        // about＝この記事が何について書かれているか。選手（Person）に加え、試合記事は
        // その試合（SportsEvent）も主題として参照させる（同グラフの @id に解決される）。
        ...(taggedPlayers.length || eventLd.length
          ? {
              about: [
                ...eventLd.map(() => ({ '@id': eventId })),
                ...taggedPlayers.map((p) => ({
                  '@type': 'Person',
                  name: p.nameJa,
                  alternateName: p.nameEn,
                  url: absoluteUrl(locale, `/player/${p.slug}`),
                  ...(p.sameAs.length ? { sameAs: p.sameAs } : {}),
                })),
              ],
            }
          : {}),
      },
      // 動画記事の VideoObject（uploadDate が取れている記事だけ）。
      ...videoLd,
      ...dailyVideoLd,
      ...eventLd,
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
          // 主役選手のLPを挟む4階層（可視パンくずと一致）。選手が居ない記事は3階層のまま。
          // 行き先は選手LP（/tag）＝内部リンクをLPに集める（2026-08-01・村山指示）。primaryPlayer は
          // この記事のタグ由来なのでタグページの存在が保証される（404しない）。
          ...(primaryPlayer && primaryPlayerName
            ? [
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: primaryPlayerName,
                  item: absoluteUrl(locale, `/tag/${encodeURIComponent(primaryPlayer.nameJa)}`),
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
            // 主役選手の常緑LPを挟んで、検索着地→選手LP→他記事の回遊を作る（JSON-LD側と一致）。
            ...(primaryPlayer && primaryPlayerName
              ? [
                  {
                    name: primaryPlayerName,
                    href: `/tag/${encodeURIComponent(primaryPlayer.nameJa)}`,
                  },
                ]
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

      {/* 日次記事はリードを「きょうの3行」（DailyArticle ①）が担うので要約段落は出さない（メタ説明には使う）。 */}
      {!daily && (
        <p className="mt-7 text-[15px] leading-relaxed text-ink-soft">{thread.summaryJa}</p>
      )}

      {/* 試合結果ボックス。「◯◯ 対 ◯◯」で来た読者が先に知りたいのは勝敗＝結論を成績より上に置く。
          線スコア・順位・勝敗はすべて thread.game に焼き込んだ公知の数値（サイト本体は API を叩かない）。 */}
      {sport === 'mlb' && thread.game && (
        <GameBox game={thread.game} dateLabel={gameDateLabel} locale={locale} lpTags={thread.tags}>
          {/* 「試合結果カードを作る」はボックス下端に同居させる＝結果を読んだ直後（関心のピーク）に
              画像生成→X共有→UTM来訪の導線を出す。以前は記事のかなり下にあって繋がりが悪かった。 */}
          <GameResultCard
            game={thread.game}
            dateLabel={gameDateLabel}
            stats={jpStats
              .filter((s) => s.today)
              .map((s) => ({ player: s.player, line: s.today as string }))}
            articleUrl={absoluteUrl(locale, `/${sport}/${thread.id}`)}
            locale={locale}
          />
        </GameBox>
      )}

      {/* 注目選手の成績ボックス（R10）。MLB の試合まとめで summaryJa の直下に出す。数値は編集時に
          fetch-mlb-stats.mjs で取得した公知の事実のみ（サイト本体は API を叩かない）。
          単発の試合は注目選手(boxStats=stats全件・非日本人も含む)、シリーズ戦は日本人だけ＝残りは下のリンクへ。 */}
      {boxStats.length > 0 && (
        <StatBox
          stats={boxStats}
          lpTags={thread.tags}
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

      {/* 試合ページ → 選手LP（相互送客＝回遊／エンティティ強化）。日本人選手のみ（jpTagged）。
          行き先は成績ハブから選手LP（/tag）へ変更（2026-08-01・村山指示＝内部リンクをLPに集める。
          jpTagged はこの記事のタグ由来なのでタグページの存在が保証される）。成績ハブへは LP 内の
          PlayerNow CTA から1クリックで届く。
          日次記事は出さない＝②③の選手名が個別LPへリンク済みで、冒頭にチップを6個並べると開幕が渋滞する。 */}
      {sport === 'mlb' && !daily && jpTagged.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-2">
          {jpTagged.map((p) => (
            <Link
              key={p.slug}
              href={`/tag/${encodeURIComponent(p.nameJa)}`}
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

      {daily ? (
        <DailyArticle daily={daily} sourceUrl={thread.sourceUrl} locale={locale} />
      ) : isWatchAlong ? (
        // 動画つき記事：再生した人にだけ動画をピン留めし、その裏をコメントが流れる。
        <WatchAlong
          thread={thread}
          comments={comments}
          pickedLabel={t('threads.pickedComments', { total: thread.totalComments })}
          hintLabel={t('threads.watchAlongHint')}
          transcriptLabel={t('threads.transcript')}
          unpinLabel={t('threads.unpinVideo')}
          pinLabel={t('threads.pinVideo')}
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

          {/* 語り形式（R13）は地の文×証言引用で描き、コメント列は出さない（story がコメントを内包する）。 */}
          {story ? (
            <StoryBlocks blocks={story} scoreMark={isInterview ? null : scoreMark} />
          ) : (
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
          )}
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

      {/* 超RIZIN.5 特設ハブへの導線（RIZIN タグの記事のみ＝spoke→hub の内部リンク）。 */}
      {(thread.tags ?? []).some((tag) => RIZIN5.matchTags.includes(tag)) && <Rizin5Promo />}

      {/* 記事下 VOD CTA（収益化の器②）。競技ごとの視聴サービスを案内。
          日次記事は DailyArticle が「あすの日本人」直後に自前で出すので、ここでは出さない（1ページ1枠）。 */}
      {!daily && (
        <VodCta
          sport={sport}
          locale={locale}
          heading={t('vod.heading', { sport: locale === 'ja' ? info.labelJa : info.labelEn })}
          prLabel={t('vod.pr')}
          watchLabel={t('vod.watch')}
        />
      )}

      {/* 記事末の関連枠は「次に読む」カードと同じ順位付けの続き（多様性キャップが両方をまたいで効く）。 */}
      <RelatedArticles ranked={relatedRanked} locale={locale} />
    </article>
  );
}
