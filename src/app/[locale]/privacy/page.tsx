import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import LegalArticle from '@/components/LegalArticle';
import { getPrivacyDoc, LEGAL_UPDATED } from '@/lib/legal';
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
  const doc = getPrivacyDoc(locale);
  return { title: doc.title, description: doc.intro };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <LegalArticle
      doc={getPrivacyDoc(locale)}
      updated={LEGAL_UPDATED}
      updatedLabel={t('legal.updated')}
    />
  );
}
