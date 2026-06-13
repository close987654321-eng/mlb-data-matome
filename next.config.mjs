import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
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
