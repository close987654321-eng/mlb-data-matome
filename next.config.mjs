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
    // 2026-06-13 にカテゴリを ufc → mma へ改名。既に共有済みの旧 URL を恒久転送する。
    return [
      { source: '/ufc', destination: '/mma', permanent: true },
      { source: '/ufc/:path*', destination: '/mma/:path*', permanent: true },
      { source: '/en/ufc', destination: '/en/mma', permanent: true },
      { source: '/en/ufc/:path*', destination: '/en/mma/:path*', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
