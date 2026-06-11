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
};

export default withNextIntl(nextConfig);
