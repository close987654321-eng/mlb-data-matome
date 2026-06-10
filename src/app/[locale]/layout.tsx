import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, unstable_setRequestLocale } from 'next-intl/server';
import { useTranslations, useLocale } from 'next-intl';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { Link } from '@/lib/navigation';
import { locales } from '@/lib/i18n';
import { SPORTS, SPORT_INFO } from '@/lib/sports';
import '../globals.css';

export const metadata: Metadata = {
  title: '海外の反応 — MLB / ボクシング / UFC',
  description: 'MLB・ボクシング・UFC の海外掲示板（Reddit）スレを、現地の生の反応つきで日本語まとめ',
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
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader />
          <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:py-14">{children}</main>
          <SiteFooter />
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
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold tracking-tight text-ink">
            {t('site.title')}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-ink-soft sm:flex">
          <Link href="/" className="transition-colors hover:text-ink">
            {t('nav.home')}
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
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-lg font-bold text-ink">{t('site.title')}</p>
        <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-soft">{t('site.footer')}</p>
      </div>
    </footer>
  );
}
