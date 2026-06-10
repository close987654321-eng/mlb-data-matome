import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getJapanesePlayers } from '@/lib/data';
import { METRICS_BY_KEY } from '@/lib/metrics';
import { formatUpdatedAt } from '@/lib/format';
import RankingTable from '@/components/RankingTable';
import type { Player } from '@/types/mlb';
import type { Locale } from '@/lib/i18n';

/** "DH/SP" → "DH", "SP (IL)" → "SP". 主ポジションを返す */
function primaryPosition(position: string): string {
  return position.split('/')[0].replace(/\s*\(.*\)$/, '').trim();
}

/** position に SP/RP/P が含まれるか (Ohtani の "DH/SP" も該当する) */
function hasPitcherRole(player: Player): boolean {
  return /\b(SP|RP|P)\b/.test(player.position);
}

/** 主ポジションが投手でなければ打者として扱う (Ohtani の "DH/SP" は DH 優先 → 打者) */
function hasBatterRole(player: Player): boolean {
  const p = primaryPosition(player.position);
  return p !== 'SP' && p !== 'RP' && p !== 'P';
}

export default async function JapanesePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const { items, updatedAt } = await getJapanesePlayers();

  const fWAR = METRICS_BY_KEY['fWAR'];
  const batterExtras = ['wRC+', 'OPS', 'wOBA', 'xwOBA', 'Barrel%']
    .map((k) => METRICS_BY_KEY[k])
    .filter(Boolean);
  const pitcherExtras = ['FIP', 'xFIP', 'Stuff+', 'Location+']
    .map((k) => METRICS_BY_KEY[k])
    .filter(Boolean);

  const batters = items.filter(hasBatterRole);
  const pitchers = items.filter(hasPitcherRole);

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-mlbnavy">{t('nav.japanese')}</h1>
        {updatedAt && (
          <span className="text-xs text-gray-500">
            {t('home.lastUpdated')}: {formatUpdatedAt(updatedAt, locale)}
          </span>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-mlbnavy">{t('japanese.batters')}</h2>
        <RankingTable
          rows={batters}
          primaryMetric={fWAR}
          extraMetrics={batterExtras}
          locale={locale}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-mlbnavy">{t('japanese.pitchers')}</h2>
        <RankingTable
          rows={pitchers}
          primaryMetric={fWAR}
          extraMetrics={pitcherExtras}
          locale={locale}
        />
      </section>
    </div>
  );
}
