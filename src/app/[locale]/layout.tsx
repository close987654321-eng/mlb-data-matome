import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, unstable_setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { Link } from '@/lib/navigation';
import { locales } from '@/lib/i18n';
import '../globals.css';

export const metadata: Metadata = {
  title: 'MLB データまとめ',
  description: 'WARだけじゃない、現代MLB指標で見る選手・チームランキング',
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
      <body className="min-h-screen flex flex-col font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function SiteHeader() {
  const t = useTranslations();
  const nav: Array<{
    href: string;
    key: 'home' | 'batters' | 'pitchers' | 'teams' | 'japanese' | 'stats' | 'threads';
  }> = [
    { href: '/', key: 'home' },
    { href: '/batters', key: 'batters' },
    { href: '/pitchers', key: 'pitchers' },
    { href: '/teams', key: 'teams' },
    { href: '/japanese', key: 'japanese' },
    { href: '/stats', key: 'stats' },
    { href: '/threads', key: 'threads' },
  ];
  return (
    <header className="bg-mlbnavy text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          {t('site.title')}
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          {nav.map((item) => (
            <Link key={item.key} href={item.href} className="hover:underline">
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <LocaleSwitcher />
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-3 text-sm text-white/80">{t('site.tagline')}</div>
    </header>
  );
}

function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-gray-500">
        {t('site.footer')}
      </div>
    </footer>
  );
}
