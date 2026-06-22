import type { StatRecord, Saber } from './playerStats';

/**
 * 選手ハブ詳細成績のカテゴリ定義と値フォーマッタ（データのみ・JSX を持たない）。
 * 旧 PlayerStatTable の key→ラベル・派生セイバー（wOBA/wRC+/WAR）をそのまま移植して
 * 「基本／率／…」の4カテゴリに再編する。ラベルは従来どおり日本語固定（指標名は ja/en 共通表記）。
 * 全項目を必ずどれかのグループに入れる（打撃17＋投球21＋派生 → 取りこぼし無し＝表示パリティ）。
 */

// 派生セイバーの整形（旧コンポーネントと同一）。
export const war1 = (v?: number): string | null => (typeof v === 'number' ? v.toFixed(1) : null);
export const woba3 = (v?: number): string | null =>
  typeof v === 'number' ? v.toFixed(3).replace(/^0/, '') : null;
export const wrc = (v?: number): string | null => (typeof v === 'number' ? String(Math.round(v)) : null);

/** 行の素材。`field`=成績レコードの実数、`saber`=派生値（順位は付かない）。 */
export type StatField =
  | { kind: 'field'; key: string; label: string }
  | { kind: 'saber'; id: 'woba' | 'wrcplus' | 'hit' | 'pit'; label: string };

export type StatGroup = { id: string; titleKey: string; fields: StatField[] };

const f = (key: string, label: string): StatField => ({ kind: 'field', key, label });
const sb = (id: 'woba' | 'wrcplus' | 'hit' | 'pit', label: string): StatField => ({
  kind: 'saber',
  id,
  label,
});

export const HIT_GROUPS: StatGroup[] = [
  { id: 'basic', titleKey: 'player.grpBatBasic', fields: [f('gamesPlayed', '試合'), f('plateAppearances', '打席'), f('atBats', '打数'), f('hits', '安打')] },
  { id: 'rate', titleKey: 'player.grpBatRate', fields: [f('avg', '打率'), f('obp', '出塁率'), f('slg', '長打率'), f('ops', 'OPS'), f('babip', 'BABIP'), sb('woba', 'wOBA')] },
  { id: 'power', titleKey: 'player.grpBatPower', fields: [f('homeRuns', '本塁打'), f('doubles', '二塁打'), f('triples', '三塁打'), f('rbi', '打点'), f('runs', '得点'), f('stolenBases', '盗塁')] },
  { id: 'value', titleKey: 'player.grpBatValue', fields: [f('baseOnBalls', '四球'), f('strikeOuts', '三振'), sb('wrcplus', 'wRC+'), sb('hit', 'WAR(打)')] },
];

export const PIT_GROUPS: StatGroup[] = [
  { id: 'basic', titleKey: 'player.grpPitBasic', fields: [f('gamesPlayed', '試合'), f('gamesStarted', '先発'), f('wins', '勝'), f('losses', '敗'), f('winPercentage', '勝率'), f('saves', 'セーブ'), f('holds', 'ホールド')] },
  { id: 'stability', titleKey: 'player.grpPitStability', fields: [f('era', '防御率'), f('whip', 'WHIP'), f('avg', '被打率'), f('inningsPitched', '投球回')] },
  { id: 'k', titleKey: 'player.grpPitK', fields: [f('strikeOuts', '奪三振'), f('baseOnBalls', '与四球'), f('strikeoutsPer9Inn', 'K/9'), f('walksPer9Inn', 'BB/9'), f('strikeoutWalkRatio', 'K/BB')] },
  { id: 'runs', titleKey: 'player.grpPitRuns', fields: [f('hits', '被安打'), f('homeRuns', '被本塁打'), f('earnedRuns', '自責'), f('runs', '失点'), f('homeRunsPer9', '被HR/9'), sb('pit', 'WAR(投)')] },
];

/** StatField を表示文字列に解決する（無ければ null＝行を出さない）。 */
export function resolveStatValue(
  field: StatField,
  rec: StatRecord | null,
  saber: Saber | null,
): string | null {
  if (field.kind === 'saber') {
    if (field.id === 'woba') return woba3(saber?.woba);
    if (field.id === 'wrcplus') return wrc(saber?.wrcplus);
    return war1(saber?.[field.id]);
  }
  const v = rec?.[field.key];
  return v == null || v === '' ? null : String(v);
}
