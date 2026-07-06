import type { MetadataRoute } from 'next';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://matome-mlb-kaigai.jp').replace(
  /\/$/,
  '',
);

// LLM「学習専用」クローラーだけを遮断する。数千URL（記事×日英＋ハブ/タグ）を舐められると
// 無料枠を食い潰す一方、本文を学習に吸われても見返り（送客）が無いため。
// 残す＝Googlebot/Bingbot（SEOの生命線）、GPTBot/ClaudeBot/PerplexityBot（AI検索からの引用・送客の芽）、
// SNSのリンクカード生成bot（*で許可のまま）。
// Google-Extended は Gemini 学習用トークンで Googlebot（検索/Discover）とは別系統＝遮断してもSEO無害。
const AI_TRAINING_BOTS = [
  'CCBot', // Common Crawl（多くのLLM学習データの元）
  'Google-Extended', // Gemini/Vertex の学習（検索ランキングには影響しない）
  'Applebot-Extended', // Apple AI 学習（検索用 Applebot とは別）
  'Meta-ExternalAgent', // Meta の AI 学習クローラー
  'Bytespider', // ByteDance。robots を無視しがちなので Firewall 側でも二重に絞る
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: AI_TRAINING_BOTS, disallow: '/' },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
