import { getAllThreads } from '@/lib/data';
import { getAllColumns } from '@/lib/columns';
import { buildFeed, type FeedItem } from '@/lib/feed';
import { SITE_URL } from '@/lib/site';

// RSS は日本語（デフォルトロケール＝接頭辞なし）の本文で配信する。
// 用途はブログ村・アンテナサイト登録と RSS リーダー購読（CLAUDE.md §8）。
const FEED_TITLE = '海外の反応 — MLB / ボクシング / MMA';
const FEED_DESCRIPTION =
  'MLB・ボクシング・MMA（UFC・RIZIN）の海外掲示板や YouTube の反応を、現地の生のコメントつきで日本語まとめ。';
const MAX_ITEMS = 50; // 直近のみ配信すれば十分（アンテナ・リーダー用途）

// 1時間ごとに再生成（記事追加はビルドで入るが、ISR で取りこぼしを防ぐ）。
export const revalidate = 3600;

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
  const items = buildFeed(threads, columns).slice(0, MAX_ITEMS);
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
        `      <description>${escapeXml(description)}</description>`,
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
