import { getTranslations } from 'next-intl/server';
import type { PlayerSeason, Rank, League } from '@/lib/playerStats';
import type { Hero } from '@/lib/playerHero';
import type { RankLabels } from '@/components/RankBadges';
import { HIT_GROUPS, PIT_GROUPS, FIELD_LABELS, ADV_FIELD, SPEED_FIELD, resolveStatValue, type StatGroup } from '@/lib/statGroups';
import StatRail, { type RailRow } from './StatRail';

/**
 * 今季成績（詳細）。旧 PlayerStatTable の代替。
 *  - <details> で畳む（段階開示・JSゼロ）。深掘りしたい人だけ開く。
 *  - 行は全カテゴリで同一の単一レール（reserved メーター枠）＝レンガ壁を構造的に排除。
 *  - 二刀流は打/投を peer-radio の CSS だけで切替（クライアントJS増分ゼロ）。単一役割はタブ無し。
 */

function groupRows(
  group: StatGroup,
  rec: PlayerSeason['hitting'],
  ranks: Record<string, Rank> | undefined,
  saber: PlayerSeason['saber'],
): RailRow[] {
  const rows: RailRow[] = [];
  for (const field of group.fields) {
    const value = resolveStatValue(field, rec, saber);
    if (value == null) continue;
    rows.push({ label: field.label, value, rank: field.kind === 'field' ? ranks?.[field.key] ?? null : null });
  }
  return rows;
}

function RoleGroups({
  groups,
  rec,
  ranks,
  saber,
  league,
  labels,
  titleOf,
}: {
  groups: StatGroup[];
  rec: PlayerSeason['hitting'];
  ranks: Record<string, Rank> | undefined;
  saber: PlayerSeason['saber'];
  league: League | null | undefined;
  labels: RankLabels;
  titleOf: (key: string) => string;
}) {
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const rows = groupRows(g, rec, ranks, saber);
        if (rows.length === 0) return null;
        return (
          <div key={g.id}>
            <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <span className="h-3 w-[2px] bg-ink" />
              {titleOf(g.titleKey)}
            </h3>
            <StatRail rows={rows} league={league} labels={labels} dense />
          </div>
        );
      })}
    </div>
  );
}

export default async function PlayerDetail({
  season,
  hero,
  labels,
}: {
  season: PlayerSeason;
  hero: Hero;
  labels: RankLabels;
}) {
  const t = await getTranslations('player');
  const titleOf = (key: string) => t(key.replace(/^player\./, ''));
  const hasBat = Boolean(season.hitting);
  const hasPit = Boolean(season.pitching);
  const twoWay = hasBat && hasPit;

  const fielding = season.fielding;
  // 伝統的守備（刺殺〜併殺）＋ Statcast 先進守備（OAA/守備run/送球）を同じレールに。
  // 先進指標は守備位置に就く野手だけが値を持つ＝無ければ行を出さない（投手/DH に 0 を捏造しない）。
  const fieldRows: RailRow[] = fielding
    ? [
        ...FIELD_LABELS.flatMap(([key, label]) => {
          const v = fielding[key];
          return v == null || v === '' ? [] : [{ label, value: String(v) }];
        }),
        ...ADV_FIELD.flatMap(({ key, label, fmt }) => {
          const s = fmt(fielding[key] as number | string | undefined);
          return s == null ? [] : [{ label, value: s }];
        }),
      ]
    : [];
  // 走力は守備位置を問わず出る＝守備ブロックが無い選手（DH）にも独立して見せる。
  const speedValue = SPEED_FIELD.fmt(season.sprintSpeed ?? undefined);

  const batPanel = hasBat && (
    <RoleGroups groups={HIT_GROUPS} rec={season.hitting} ranks={season.ranks?.hitting} saber={season.saber} league={season.league} labels={labels} titleOf={titleOf} />
  );
  const pitPanel = hasPit && (
    <RoleGroups groups={PIT_GROUPS} rec={season.pitching} ranks={season.ranks?.pitching} saber={season.saber} league={season.league} labels={labels} titleOf={titleOf} />
  );

  return (
    <section className="motion-safe:animate-[rise_.32s_ease-out_120ms_both]">
      {/* 詳細ブロックの見出し（視覚は summary が担うので SR 向けに sr-only）。見出しナビの h2→h3 の階層を保つ。 */}
      <h2 className="sr-only">{t('statsTitle')}</h2>
      <details className="group">
        <summary className="flex w-full cursor-pointer list-none items-center justify-between border-y border-line py-3 text-sm font-semibold text-ink transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
          {t('detailToggle')}
          <span aria-hidden="true" className="text-ink-soft transition-transform group-open:rotate-180">▾</span>
        </summary>

        <div className="pt-5">
          {twoWay ? (
            // CSS のみの打/投タブ（フラット兄弟の peer-radio）。JS無効でも動く。
            <div className="flex flex-wrap items-center gap-1">
              <input id="pd-bat" type="radio" name="player-detail-role" defaultChecked className="peer/dbat sr-only" aria-label={t('tabBat')} />
              <input id="pd-pit" type="radio" name="player-detail-role" className="peer/dpit sr-only" aria-label={t('tabPit')} />
              <label htmlFor="pd-bat" className="order-1 inline-flex min-h-[44px] cursor-pointer select-none items-center rounded-lg px-4 text-sm text-ink-soft ring-1 ring-transparent transition-colors peer-checked/dbat:bg-surface peer-checked/dbat:font-semibold peer-checked/dbat:text-ink peer-checked/dbat:ring-line peer-focus-visible/dbat:ring-2 peer-focus-visible/dbat:ring-accent">
                {t('tabBat')}
              </label>
              <label htmlFor="pd-pit" className="order-2 inline-flex min-h-[44px] cursor-pointer select-none items-center rounded-lg px-4 text-sm text-ink-soft ring-1 ring-transparent transition-colors peer-checked/dpit:bg-surface peer-checked/dpit:font-semibold peer-checked/dpit:text-ink peer-checked/dpit:ring-line peer-focus-visible/dpit:ring-2 peer-focus-visible/dpit:ring-accent">
                {t('tabPit')}
              </label>
              <div className="order-3 mt-5 hidden w-full peer-checked/dbat:block">{batPanel}</div>
              <div className="order-4 mt-5 hidden w-full peer-checked/dpit:block">{pitPanel}</div>
            </div>
          ) : (
            <div>{hasBat ? batPanel : pitPanel}</div>
          )}

          {fieldRows.length > 0 && season.fielding && (
            <div className="mt-6">
              <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                <span className="h-3 w-[2px] bg-ink" />
                {t('grpFielding')}（{season.fielding.position}）
              </h3>
              <StatRail rows={fieldRows} league={season.league} labels={labels} dense />
            </div>
          )}

          {/* 走力（Sprint speed）。守備に就かない DH（大谷ら）にも出せる唯一の身体能力指標なので独立表示。 */}
          {speedValue && (
            <div className="mt-6">
              <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                <span className="h-3 w-[2px] bg-ink" />
                {t('grpSpeed')}
              </h3>
              <StatRail rows={[{ label: SPEED_FIELD.label, value: speedValue }]} league={season.league} labels={labels} dense />
            </div>
          )}

          <p className="mt-5 text-[11px] leading-relaxed text-ink-soft">{t('statsNote')}</p>
        </div>
      </details>
    </section>
  );
}
