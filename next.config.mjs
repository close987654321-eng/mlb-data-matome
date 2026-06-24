import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 選手別 OG 画像（[slug]/opengraph-image）は generateImageMetadata 由来で動的レンダリングになる
  // （ハブ OG と違い prerender されない）。実行時に satori 用フォント・背景・成績JSON を
  // process.cwd() 経由で fs 読みするが、このパスは静的解析できず @vercel/nft がトレースしないため、
  // Vercel のサーバーレス関数バンドルに同梱されず実行時 500 になる（ローカルは cwd に実在し 200）。
  // → 該当ファイルを明示同梱して「ローカルで動く＝Vercel でも動く」状態に揃える。
  outputFileTracingIncludes: {
    '/**': ['./src/assets/fonts/*.ttf', './src/assets/og/*.jpg', './data/jp-players-stats.json'],
  },
  // CSS を <style> で HTML にインライン化し、描画をブロックする外部 CSS <link> を無くす
  // （Next 15.2+ 第一者機能。critters/optimizeCss と違い追加依存なし）。本サイトは Discover
  // 由来のワンショット流入が主で回遊が少ないため、ページ毎インラインの欠点が出にくく FCP/LCP に効く。
  experimental: {
    inlineCss: true,
  },
  images: {
    // Vercel の画像最適化(/_next/image)は無料枠=5,000変換/月で、更新頻度の高い本サイトでは
    // すぐ使い切る。枠が尽きると optimizer が 402(OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED)を
    // 返し、サムネ・カード・ロゴまでサイト全体の画像が一斉に壊れる（2026-06 に発生）。
    // → カスタムローダで Vercel を通さず各CDN直配信に切替（恒久無料・枠なし）。Unsplash は
    //   自前CDNでリサイズ、YouTube/redd/imgur/ローカルは直リンク（src/lib/imageLoader.js）。
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.js',
    // ↓ deviceSizes/imageSizes はカスタムローダが srcset を作る際の要求幅として今も有効
    //   （Unsplash の w= リサイズに効く）。formats/remotePatterns は Vercel optimizer 用なので
    //   カスタムローダでは未使用だが、許可ホストの記録として残す。
    deviceSizes: [640, 828, 1200, 1920], // モバイル / タブレット / Discover(1200px) / デスクトップ高DPI
    imageSizes: [128, 256], // サムネ・アバター等の小画像用
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' }, // 競技ストック写真
      { protocol: 'https', hostname: 'i.redd.it' }, // Reddit 直リンク画像
      { protocol: 'https', hostname: 'i.imgur.com' }, // imgur 直リンク画像
      { protocol: 'https', hostname: 'i.ytimg.com' }, // YouTube サムネ
    ],
  },
  async redirects() {
    return [
      // 本番の vercel.app は独自ドメインと重複コンテンツになるため、apex（正規）へ恒久転送して
      // SEO を一本化する。host 条件付きなのでプレビューデプロイの個別 URL には影響しない。
      // ドメイン正規化を先に効かせる（その後 ufc→mma は新ドメイン側で適用される）。
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'mlb-data-matome.vercel.app' }],
        destination: 'https://matome-mlb-kaigai.jp/:path*',
        permanent: true,
      },
      // 2026-06-13 にカテゴリを ufc → mma へ改名。既に共有済みの旧 URL を恒久転送する。
      { source: '/ufc', destination: '/mma', permanent: true },
      { source: '/ufc/:path*', destination: '/mma/:path*', permanent: true },
      { source: '/en/ufc', destination: '/en/mma', permanent: true },
      { source: '/en/ufc/:path*', destination: '/en/mma/:path*', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
