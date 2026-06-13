import type { Metadata } from 'next';
import Image from 'next/image';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, unstable_setRequestLocale } from 'next-intl/server';
import { useTranslations, useLocale } from 'next-intl';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import ScrollToTop from '@/components/ScrollToTop';
import { Link } from '@/lib/navigation';
import { locales } from '@/lib/i18n';
import { SPORTS, SPORT_INFO } from '@/lib/sports';
import { SITE_URL } from '@/lib/site';
import '../globals.css';

// Google Analytics（GA4）測定 ID
const GA_ID = 'G-XSL1S5LQH0';

// Google AdSense パブリッシャー ID（審査・広告配信用）。公開値なので秘匿不要。
// 認証は public/ads.txt（google.com, pub-..., DIRECT, ...）と対で必要。
const ADSENSE_CLIENT = 'ca-pub-9743394669085618';

const TITLE = '海外の反応 — MLB / ボクシング / MMA';
const DESCRIPTION =
  'MLB・ボクシング・MMA（UFC・RIZIN）の海外掲示板や YouTube の反応を、現地の生のコメントつきで日本語まとめ';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // OG/Twitter カードにブランドロゴを表示（SNS 送客時の見栄え）
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: '海外の反応',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
  // RSS 自動検出（リーダー・アンテナサイトがフィードを見つけられるように）
  alternates: {
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: TITLE }] },
  },
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col font-sans">
        {/* Google Analytics（GA4）。全ページで読み込む。 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
        {/* Google AdSense。審査・広告配信のため全ページで読み込む。 */}
        <Script
          id="adsbygoogle-init"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader />
          <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:py-14">{children}</main>
          <SiteFooter />
          <ScrollToTop />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function SiteHeader() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center" aria-label={t('site.title')}>
          <Image
            src="/logo.png"
            alt={t('site.title')}
            width={1358}
            height={428}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-ink-soft sm:flex">
          <Link href="/" className="transition-colors hover:text-ink">
            {t('nav.home')}
          </Link>
          <Link href="/watch" className="font-medium text-accent transition-colors hover:text-ink">
            {t('nav.watch')}
          </Link>
          {SPORTS.map((s) => (
            <Link key={s} href={`/${s}`} className="transition-colors hover:text-ink">
              {locale === 'ja' ? SPORT_INFO[s].labelJa : SPORT_INFO[s].labelEn}
            </Link>
          ))}
        </nav>
        <LocaleSwitcher />
      </div>
      {/* スマホ用ナビ */}
      <nav className="flex items-center gap-4 overflow-x-auto border-t border-line px-5 py-2 text-sm text-ink-soft sm:hidden">
        <Link href="/" className="whitespace-nowrap">
          {t('nav.home')}
        </Link>
        <Link href="/watch" className="whitespace-nowrap font-medium text-accent">
          ▶ {t('nav.watch')}
        </Link>
        {SPORTS.map((s) => (
          <Link key={s} href={`/${s}`} className="whitespace-nowrap">
            {SPORT_INFO[s].emoji} {locale === 'ja' ? SPORT_INFO[s].labelJa : SPORT_INFO[s].labelEn}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function SiteFooter() {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 sm:flex-row sm:justify-between">
        <div>
          <p className="text-lg font-bold text-ink">{t('site.title')}</p>
          <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-soft">
            {t('site.footer')}
          </p>
        </div>
        {/* フッターにも回遊ナビを置く（記事を読み終えた読者の次の一歩） */}
        <div className="flex flex-col gap-3">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            <Link href="/" className="transition-colors hover:text-ink">
              {t('nav.home')}
            </Link>
            <Link href="/watch" className="font-medium text-accent transition-colors hover:text-ink">
              {t('nav.watch')}
            </Link>
            {SPORTS.map((s) => (
              <Link key={s} href={`/${s}`} className="whitespace-nowrap transition-colors hover:text-ink">
                {locale === 'ja' ? SPORT_INFO[s].labelJa : SPORT_INFO[s].labelEn}
              </Link>
            ))}
          </nav>
          {/* 運営者情報・規約系リンク（AdSense 審査要件・サイトの信頼性） */}
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">
            <Link href="/about" className="transition-colors hover:text-ink">
              {t('nav.about')}
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-ink">
              {t('nav.privacy')}
            </Link>
            <Link href="/contact" className="transition-colors hover:text-ink">
              {t('nav.contact')}
            </Link>
            <a href="/feed.xml" className="transition-colors hover:text-ink">
              RSS
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
