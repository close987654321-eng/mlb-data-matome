import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import LegalArticle from '@/components/LegalArticle';
import { getContactDoc, CONTACT_FORM_URL } from '@/lib/legal';
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
  const doc = getContactDoc(locale);
  return { title: doc.title, description: doc.intro };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <LegalArticle doc={getContactDoc(locale)}>
      <div className="mt-8 border-t border-line pt-6">
        {/* 外部の Google フォームへ。target=_blank は noopener を必ず付ける。 */}
        <a
          href={CONTACT_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('contact.openForm')}
        </a>
      </div>
    </LegalArticle>
  );
}
