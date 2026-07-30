import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllColumns, getColumn } from '@/lib/columns';
import { getAllThreads } from '@/lib/data';
import { formatUpdatedAt } from '@/lib/format';
import { SPORT_INFO } from '@/lib/sports';
import { columnCover } from '@/lib/media';
import ArticleCover from '@/components/ArticleCover';
import MediaEmbed from '@/components/MediaEmbed';
import StickyVideo from '@/components/StickyVideo';
import RelatedArticles from '@/components/RelatedArticles';
import TagList from '@/components/TagList';
import ShareButtons from '@/components/ShareButtons';
import Breadcrumbs from '@/components/Breadcrumbs';
import { absoluteUrl, localeAlternates, SITE_URL } from '@/lib/site';
import { getPlayerByJaName } from '@/lib/players';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export async function generateStaticParams() {
  const columns = await getAllColumns();
  return columns.flatMap((column) => locales.map((locale) => ({ locale, id: column.id })));
}

// 記事と同様、コラムも個別の OG/Twitter カードを出す（無いと layout のロゴ固定になる）。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const column = await getColumn(id);
  if (!column) return {};

  const title = locale === 'ja' ? column.title.ja : column.title.en;
  const description = column.lead;
  const image = columnCover(column).url;

  return {
    title,
    description,
    alternates: localeAlternates(locale, `/columns/${id}`),
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

export default async function ColumnDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const column = await getColumn(id);
  if (!column) notFound();

  // 回遊導線（記事末尾）用に全記事を読む。SSG なのでビルド時のみ走る。
  const [allThreads, allColumns] = await Promise.all([getAllThreads(), getAllColumns()]);

  const info = SPORT_INFO[column.sport];
  const sportLabel = locale === 'ja' ? info.labelJa : info.labelEn;
  const kindLabel = t(`columns.kind.${column.kind}`);
  const title = locale === 'ja' ? column.title.ja : column.title.en;
  const subtitle = locale === 'ja' ? column.title.en : column.title.ja;
  // 動画つきコラムは記事と同じ「動画ピン留め＋本文が裏を流れる」形にする。
  // 最初の動画ブロックを上部に固定し、本文中では二重表示しないようそのブロックは飛ばす。
  const pinnedVideoIndex = column.blocks.findIndex((block) => block.type === 'video');
  const pinnedVideo = pinnedVideoIndex >= 0 ? column.blocks[pinnedVideoIndex] : undefined;

  // 構造化データ。コラムだけ JSON-LD もパンくずも無く、他の全コンテンツ型（記事/選手/タグLP）から
  // 取り残されていた（2026-07-30 実測）。まとめ記事は時事＝NewsArticle だが、コラムは論考・週刊総括
  // なので Article を使う。author/publisher は記事側と同じ #organization に名寄せして実体を1つに保つ。
  const columnUrl = absoluteUrl(locale, `/columns/${column.id}`);
  const cover = columnCover(column);
  // 本文の段落だけを繋いで語数を出す（見出し・引用・動画は除く）。日本語なので文字数＝おおよその分量。
  const bodyText = column.blocks
    .filter((b): b is { type: 'paragraph'; text: string } => b.type === 'paragraph')
    .map((b) => b.text)
    .join('');
  // タグに居る選手をエンティティ接続（記事側と同じ扱い＝Knowledge Graph への地ならし）。
  const taggedPlayers = (column.tags ?? [])
    .map((tag) => getPlayerByJaName(tag))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .filter((p, i, arr) => arr.findIndex((x) => x.slug === p.slug) === i);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: '海外の反応',
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 1358, height: 428 },
        sameAs: ['https://x.com/gogogo123ka'],
      },
      {
        '@type': 'Article',
        headline: title,
        description: column.lead,
        image: { '@type': 'ImageObject', url: cover.url },
        datePublished: column.publishedAt,
        dateModified: column.publishedAt,
        inLanguage: locale,
        author: { '@id': `${SITE_URL}/#organization` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': columnUrl },
        articleSection: kindLabel,
        ...(bodyText ? { wordCount: bodyText.length } : {}),
        ...(column.tags?.length ? { keywords: column.tags.join(', ') } : {}),
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
            name: sportLabel,
            item: absoluteUrl(locale, `/${column.sport}`),
          },
          { '@type': 'ListItem', position: 3, name: title },
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
            { name: sportLabel, href: `/${column.sport}` },
            { name: title },
          ]}
        />
      </div>
      <ArticleCover
        sport={column.sport}
        locale={locale}
        imageUrl={columnCover(column).url}
        title={title}
        eyebrow={`${kindLabel} · ${sportLabel}`}
        variant="hero"
      />

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span className="font-medium uppercase tracking-wider text-ink-soft">{kindLabel}</span>
        {column.source && <span>{column.source}</span>}
        <span className="ml-auto">{formatUpdatedAt(column.publishedAt, locale)}</span>
      </div>

      <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>

      {column.tags && <TagList tags={column.tags} />}

      {column.heroQuote && (
        <figure className="mt-8 border-l-4 border-ink pl-5">
          <blockquote className="text-xl font-bold leading-relaxed text-ink sm:text-[1.7rem] sm:leading-snug">
            “{column.heroQuote.text}”
          </blockquote>
          {column.heroQuote.cite && (
            <figcaption className="mt-2 text-sm text-ink-soft">— {column.heroQuote.cite}</figcaption>
          )}
        </figure>
      )}

      <p className="mt-7 text-[15px] leading-relaxed text-ink-soft">{column.lead}</p>

      {/* 動画は本文と同じ親の中に置いて sticky を成立させる（本文が動画の裏を流れる）。 */}
      <div className="mt-8 space-y-6">
        {pinnedVideo?.type === 'video' && (
          <StickyVideo
            media={pinnedVideo.media}
            sourceUrl={column.sourceUrl ?? ''}
            hintLabel={t('threads.watchAlongHint')}
            unpinLabel={t('threads.unpinVideo')}
            pinLabel={t('threads.pinVideo')}
          />
        )}
        {column.blocks.map((block, i) => {
          if (i === pinnedVideoIndex) return null; // 上部にピン留め済みなので本文では飛ばす
          if (block.type === 'heading') {
            return (
              <h2
                key={i}
                className="mt-10 flex items-center gap-2 text-lg font-bold leading-snug text-ink sm:text-xl"
              >
                <span className="h-5 w-[2px] bg-ink" />
                {block.text}
              </h2>
            );
          }
          if (block.type === 'quote') {
            return (
              <figure key={i} className="border-l-4 border-ink/50 pl-5">
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
          if (block.type === 'video') {
            // 出典クリップは送客にもなるので、本文と同じ流れで埋め込む
            return <MediaEmbed key={i} media={block.media} sourceUrl={column.sourceUrl ?? ''} />;
          }
          return (
            <p key={i} className="text-[15px] leading-relaxed text-ink">
              {block.text}
            </p>
          );
        })}
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        {column.sourceUrl && (
          <a
            href={column.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            {t('columns.viewSource')}
            <span aria-hidden>→</span>
          </a>
        )}
        <ShareButtons url={absoluteUrl(locale, `/columns/${column.id}`)} title={title} />
      </footer>

      <RelatedArticles
        threads={allThreads}
        columns={allColumns}
        currentKey={`column/${column.id}`}
        sport={column.sport}
        currentTags={column.tags}
        locale={locale}
      />
    </article>
  );
}
