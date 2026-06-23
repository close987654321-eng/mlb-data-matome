import { getTranslations } from 'next-intl/server';
import type { Player } from '@/lib/players';
import type { PlayerSeason } from '@/lib/playerStats';
import type { Hero } from '@/lib/playerHero';
import type { RankLabels } from '@/components/RankBadges';
import RankMeter from './RankMeter';

/**
 * ヒーロー帯。役割バッジ → 名前 → 静かなメタ1行 → ヒーロー指標1つ、の順で
 * 「誰が・何が凄いか」を最初の ~110px で伝える。経歴は下の「選手について」へ移送（DOM には残す）。
 */
export default async function PlayerHero({
  player,
  season,
  hero,
  labels,
  asOf,
  year,
  lede,
}: {
  player: Player;
  season: PlayerSeason;
  hero: Hero;
  labels: RankLabels;
  asOf: string;
  year: number;
  /** H1 直下に出す「今季の地の文」（playerLede 生成・実在値のみ）。薄ページ回避＋クエリ面拡大。 */
  lede?: string;
}) {
  const t = await getTranslations('player');

  const roleText =
    hero.role === 'two-way' ? t('roleTwoWay') : hero.role === 'pitcher' ? t('rolePitcher') : t('roleBatter');
  const roleClass =
    hero.role === 'two-way'
      ? 'bg-accent/10 text-accent'
      : 'bg-paper text-ink-soft ring-1 ring-line';

  const lgLabel = season.league === 'AL' ? labels.al : season.league === 'NL' ? labels.nl : null;
  const metaParts = [season.team, lgLabel, asOf ? t('asOf', { date: asOf }) : null].filter(Boolean);

  const heroLabel =
    hero.kind === 'warTotal' ? t('heroWar') : hero.kind === 'wrc' ? t('heroTotalHitting') : hero.statLabel ?? '';

  const captionText = hero.caption
    ? `${hero.caption.label} ${hero.caption.scope === 'mlb' ? labels.mlb : lgLabel} ${hero.caption.rank}${labels.unit}`
    : null;

  return (
    <section className="border-b border-line pb-6 motion-safe:animate-[rise_.32s_ease-out_both]">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${roleClass}`}
      >
        {roleText}
      </span>

      <h1 className="mt-2.5 text-3xl font-bold leading-tight text-ink sm:text-4xl">
        {player.nameJa}
        <span className="ml-2 align-baseline text-base font-normal text-ink-soft">{player.nameEn}</span>
      </h1>

      {/* H1 直下に成績キーワードを可視化（「{選手}＋今季成績」の検索適合を底上げ）。
          年は文字列で渡す（ICU の数値引数が桁区切りで「2,026」になるのを防ぐ）。 */}
      <p className="mt-1 text-sm font-semibold text-ink-soft">{t('hubH1Sub', { year: String(year) })}</p>

      {metaParts.length > 0 && (
        <p className="mt-2 text-xs text-ink-soft">{metaParts.join(' · ')}</p>
      )}

      {/* 今季の地の文（独自散文）。数値表の外に選手別テキストを置き“薄ページ”を脱する。 */}
      {lede && <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{lede}</p>}

      {/* ヒーロー指標 */}
      <div className="mt-5">
        <div className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-ink-soft">{heroLabel}</div>
        <div className="text-[52px] font-bold leading-none tabular-nums text-ink [font-feature-settings:'palt'] sm:text-[56px]">
          {hero.value}
        </div>

        {hero.warSplit && (
          <p className="mt-2 text-sm text-ink-soft tabular-nums">
            {t('heroWarSplit', { bat: hero.warSplit.bat, pit: hero.warSplit.pit })}
          </p>
        )}
        {hero.showWrcGloss && <p className="mt-1.5 text-xs text-ink-soft">{t('wrcGloss')}</p>}

        {captionText && (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
            <span aria-hidden="true" className="text-[7px] leading-none">●</span>
            {captionText}
          </p>
        )}

        {hero.rank && (
          <div className="mt-3 max-w-[220px]">
            <RankMeter rank={hero.rank} league={season.league} labels={labels} maxMlb={40} maxLg={20} variant="hero" />
          </div>
        )}
      </div>
    </section>
  );
}
