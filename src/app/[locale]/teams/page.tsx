import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getTeams } from '@/lib/data';
import { formatUpdatedAt } from '@/lib/format';
import StandingsTable from '@/components/StandingsTable';
import type { Locale } from '@/lib/i18n';

export default async function TeamsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const { items, updatedAt } = await getTeams();

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-mlbnavy">{t('nav.teams')}</h1>
        {updatedAt && (
          <span className="text-xs text-gray-500">
            {t('home.lastUpdated')}: {formatUpdatedAt(updatedAt, locale)}
          </span>
        )}
      </header>
      <StandingsTable teams={items} locale={locale} />
    </div>
  );
}
