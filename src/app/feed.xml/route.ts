import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { buildFeed, type FeedItem } from '@/lib/feed';
import { isThreadIndexable } from '@/lib/threadIndex';
import { SITE_URL } from '@/lib/site';

// RSS は日本語（デフォルトロケール＝接頭辞なし）の本文で配信する。
// 用途はブログ村・アンテナサイト登録と RSS リーダー購読（CLAUDE.md §8）。
const FEED_TITLE = '海外の反応 — MLB / ボクシング / MMA';
const FEED_DESCRIPTION =
  'MLB・ボクシング・MMA（UFC・RIZIN）の海外掲示板や YouTube の反応を、現地の生のコメントつきで日本語まとめ。';
const MAX_ITEMS = 30; // 直近のみ配信すれば十分（アンテナ・リーダー用途）

// description はこの文字数で抜粋に切り詰める。
// 理由: 人気ブログランキング等の RSS 取り込みは PHP の mb_ereg（Oniguruma）で本文を
// 正規表現処理しており、長い description を渡すとバックトラッキングの再試行上限
// （mbstring.regex_retry_limit・既定100万）を超えて
// "mb_ereg_search(): ... retry-limit-in-match over" となり Ping が失敗する。
// アンテナ・リーダー用途では抜粋で十分なので短く配信する（WordPress の「全文→抜粋」と同じ対処）。
const DESCRIPTION_MAX = 120;

// 1時間ごとに再生成（記事追加はビルドで入るが、ISR で取りこぼしを防ぐ）。
export const revalidate = 3600;

/** RSS の description 用に本文を抜粋へ短縮する（改行・タブは空白に均す）。 */
function excerpt(s: string): string {
  const t = s.replace(/[\r\n\t]+/g, ' ').trim();
  return t.length > DESCRIPTION_MAX ? t.slice(0, DESCRIPTION_MAX).trimEnd() + '…' : t;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function itemFields(item: FeedItem): { title: string; link: string; description: string } {
  if (item.kind === 'thread') {
    const t = item.thread;
    return {
      title: t.title.ja,
      link: `${SITE_URL}/${t.sport}/${t.id}`,
      description: t.summaryJa,
    };
  }
  const c = item.column;
  return {
    title: c.title.ja,
    link: `${SITE_URL}/columns/${c.id}`,
    description: c.lead,
  };
}

export async function GET(): Promise<Response> {
  const [threads, columns] = await Promise.all([getAllThreads(), getAllColumns()]);
  // noindex の薄記事はアンテナ・リーダーにも流さない（検索面から下げた記事を外部配信で
  // 薄いまま拡散させない＝sitemap / meta robots と言い分を揃える。index 可否の正は isThreadIndexable）。
  const items = buildFeed(threads.filter(isThreadIndexable), columns).slice(0, MAX_ITEMS);
  const lastBuild = items[0] ? new Date(items[0].date) : new Date();

  const itemsXml = items
    .map((item) => {
      const { title, link, description } = itemFields(item);
      return [
        '    <item>',
        `      <title>${escapeXml(title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${new Date(item.date).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(excerpt(description))}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>ja</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
