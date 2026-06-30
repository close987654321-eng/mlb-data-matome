import { getTranslations } from 'next-intl/server';
import type { Player } from '@/lib/players';
import type { PlayerSeason } from '@/lib/playerStats';
import type { Hero } from '@/lib/playerHero';
import type { WarRank } from '@/lib/warRace';
import type { RankLabels } from '@/components/RankBadges';
import { getTeam, teamLogoUrl, headshotUrl } from '@/lib/teams';
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
  warRank,
}: {
  player: Player;
  season: PlayerSeason;
  hero: Hero;
  labels: RankLabels;
  asOf: string;
  year: number;
  /** H1 直下に出す「今季の地の文」（playerLede 生成・実在値のみ）。薄ページ回避＋クエリ面拡大。 */
  lede?: string;
  /** WARレース由来の全体順位。rank===1 のときだけ唯一の赤「MLB 1位」エンブレムを発火する（捏造防止＝§4.4）。 */
  warRank?: WarRank | null;
}) {
  const t = await getTranslations('player');

  // 二刀流の積み上げ二連バー用の比率（投=ink / 打=中グレー）。warSplit は整形済み文字列。
  const pitN = hero.warSplit ? parseFloat(hero.warSplit.pit) || 0 : 0;
  const batN = hero.warSplit ? parseFloat(hero.warSplit.bat) || 0 : 0;
  const pitPct = Math.round((pitN / (pitN + batN || 1)) * 100);
  const isWarLeader = warRank?.rank === 1;

  const roleText =
    hero.role === 'two-way' ? t('roleTwoWay') : hero.role === 'pitcher' ? t('rolePitcher') : t('roleBatter');
  const roleClass =
    hero.role === 'two-way'
      ? 'bg-ink/[0.06] text-ink-soft'
      : 'bg-paper text-ink-soft ring-1 ring-line';

  const lgLabel = season.league === 'AL' ? labels.al : season.league === 'NL' ? labels.nl : null;
  // 顔写真（MLB公式・直リンク／再ホストしない）＋所属チームのロゴ・カラー。新デザインに合わせ、
  // 写真はグレースケール基調＋チームカラーの下罫で個性を出す（ホバーで原色に戻す）。
  const team = getTeam(season.team);
  const portrait = headshotUrl(player.mlbId, 'portrait');

  const heroLabel =
    hero.kind === 'warTotal' ? t('heroWar') : hero.kind === 'wrc' ? t('heroTotalHitting') : hero.statLabel ?? '';

  const captionText = hero.caption
    ? `${hero.caption.label} ${hero.caption.scope === 'mlb' ? labels.mlb : lgLabel} ${hero.caption.rank}${labels.unit}`
    : null;

  return (
    <section className="border-b border-line pb-6 motion-safe:animate-[rise_.32s_ease-out_both]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center rounded-[2px] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${roleClass}`}
          >
            {roleText}
          </span>

          <h1 className="mt-2.5 text-3xl font-bold leading-tight tracking-[-0.01em] text-ink sm:text-4xl">
            {player.nameJa}
            <span className="ml-2 align-baseline text-base font-normal text-ink-soft">{player.nameEn}</span>
          </h1>

          {/* H1 直下に成績キーワードを可視化（「{選手}＋今季成績」の検索適合を底上げ）。
              年は文字列で渡す（ICU の数値引数が桁区切りで「2,026」になるのを防ぐ）。 */}
          <p className="mt-1 text-sm font-semibold text-ink-soft">{t('hubH1Sub', { year: String(year) })}</p>
        </div>

        {/* 顔写真（カラー）＋所属ロゴのバッジ＋チームカラーの下罫。公式CDNの素材は 2:3 の縦長なので
            器も縦長にしてクロップ（見切れ）を避ける。画像は MLB 公式 CDN から直リンク（再ホストしない）。 */}
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない） */}
          <img
            src={portrait}
            alt={season.team ? `${player.nameJa}（${season.team}）` : player.nameJa}
            width={108}
            height={162}
            className="h-[144px] w-[96px] rounded-[2px] bg-paper object-cover object-top sm:h-[162px] sm:w-[108px]"
            style={team ? { borderBottom: `3px solid ${team.color}` } : undefined}
          />
          {team && (
            // eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク
            <img
              src={teamLogoUrl(team.id)}
              alt={team.nameEn}
              width={28}
              height={28}
              loading="lazy"
              className="absolute -bottom-2 -right-2 h-7 w-7 rounded-[2px] bg-surface object-contain p-0.5 shadow-sm ring-1 ring-line"
            />
          )}
        </div>
      </div>

      {(season.team || lgLabel || asOf) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-soft">
          {season.team && <span className="font-medium text-ink">{season.team}</span>}
          {lgLabel && (
            <>
              <span className="text-ink-mute">·</span>
              <span>{lgLabel}</span>
            </>
          )}
          {asOf && (
            <>
              <span className="text-ink-mute">·</span>
              <span>{t('asOf', { date: asOf })}</span>
            </>
          )}
        </p>
      )}

      {/* ヒーロー指標（数字ファースト）。最初の数秒で「何が・どれだけ凄いか」を大数値で殴る。 */}
      <div className="mt-5">
        {/* ラベル行の右に、唯一の赤エンブレム「MLB 1位」。発火源は warRank(WARレース由来の全体順位)に固定。
            rank===1 のときだけ・stagger で最後にスッと載る（rise は from/to を含む＝レイアウトは即確保＝CLSゼロ）。
            塗り面の赤は作らず罫＋文字で上品に。literal は「MLB 1位」のみ（%・母数は出さない＝RankMeter の誠実さを赤でも死守）。 */}
        <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-ink-soft">
          <span>{heroLabel}</span>
          {isWarLeader && (
            <span className="inline-flex items-center rounded-[2px] border border-accent px-2 py-0.5 text-[11px] font-bold normal-case tracking-wide text-accent tabular-nums motion-safe:animate-[rise_.4s_ease-out_.34s_both]">
              {t('warLeaderEmblem')}
            </span>
          )}
        </div>
        <div className="text-[52px] font-bold leading-none tabular-nums text-ink [font-feature-settings:'palt'] sm:text-[56px]">
          {hero.value}
        </div>

        {/* 二刀流＝投/打の積み上げ二連バー。「一人で二人分」を足し算でなく二本の柱の絵にする。 */}
        {hero.warSplit && (
          <div className="mt-3 max-w-[280px]">
            <div className="flex h-2 w-full overflow-hidden rounded-[2px]" aria-hidden="true">
              <span className="block h-full bg-ink" style={{ width: `${pitPct}%` }} />
              <span className="block h-full bg-ink-soft/45" style={{ width: `${100 - pitPct}%` }} />
            </div>
            <p className="mt-1.5 text-sm tabular-nums text-ink-soft">
              {t('heroWarSplit', { bat: hero.warSplit.bat, pit: hero.warSplit.pit })}
            </p>
          </div>
        )}
        {hero.showWrcGloss && <p className="mt-1.5 text-xs text-ink-soft">{t('wrcGloss')}</p>}

        {captionText && (
          <p className="mt-3 inline-flex items-center rounded-[2px] border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft">
            {captionText}
          </p>
        )}

        {hero.rank && (
          <div className="mt-3 max-w-[220px]">
            <RankMeter rank={hero.rank} league={season.league} labels={labels} maxMlb={40} maxLg={20} variant="hero" />
          </div>
        )}
      </div>

      {/* 今季の地の文（独自散文・SEO）。大数値の“驚きの絵”をファーストビューに収めるため数値ブロックの下へ。DOM保持。 */}
      {lede && <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-soft">{lede}</p>}
    </section>
  );
}
