import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import LegalArticle from '@/components/LegalArticle';
import { Link } from '@/lib/navigation';
import { getAboutDoc } from '@/lib/legal';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const doc = getAboutDoc(locale);
  return { title: doc.title, description: doc.sections[1]?.paragraphs?.[0] };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <LegalArticle doc={getAboutDoc(locale)}>
      <div className="mt-8 border-t border-line pt-6">
        <Link
          href="/contact"
          className="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('nav.contact')}
        </Link>
      </div>
    </LegalArticle>
  );
}
