import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // CSS を <style> で HTML にインライン化し、描画をブロックする外部 CSS <link> を無くす
  // （Next 15.2+ 第一者機能。critters/optimizeCss と違い追加依存なし）。本サイトは Discover
  // 由来のワンショット流入が主で回遊が少ないため、ページ毎インラインの欠点が出にくく FCP/LCP に効く。
  experimental: {
    inlineCss: true,
  },
  images: {
    // Vercel は画像1枚を「横幅 × 形式」の組み合わせ単位で変換し、その個数を課金カウント
    // （無料枠=5,000/月）する。デフォルトは横幅8段階×小サイズ8段階で1枚あたりの変換数が多く、
    // 更新頻度の高い本サイトでは枠をすぐ使い切る。Discover 用の 1200px 画質は残しつつ刻みを間引いて
    // 1枚あたりの変換数を半分以下に抑える（見た目はほぼ変わらない）。
    deviceSizes: [640, 828, 1200, 1920], // モバイル / タブレット / Discover(1200px) / デスクトップ高DPI
    imageSizes: [128, 256], // サムネ・アバター等の小画像用（既定の極小サイズは未使用）
    formats: ['image/webp'], // AVIF を足すと変換数が倍になるので webp のみに固定
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
