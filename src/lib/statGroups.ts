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

/** 守備（主ポジション）の表示項目。順位は付かない（守備順位はデータに無い）。 */
export const FIELD_LABELS: [string, string][] = [
  ['gamesPlayed', '試合'],
  ['gamesStarted', '先発'],
  ['putOuts', '刺殺'],
  ['assists', '補殺'],
  ['errors', '失策'],
  ['fielding', '守備率'],
  ['doublePlays', '併殺'],
];

// ── Statcast 先進指標のフォーマッタ（数値→表示文字列。値が無ければ null＝行を出さない＝捏造しない）──
const toNumOrNaN = (v?: number | string): number =>
  typeof v === 'number' ? v : v != null && v !== '' ? Number(v) : NaN;
/** 平均より上(+)/下(−)を符号で示す（OAA・守備run）。0 は "0"、負は "−3"（U+2212）。 */
export const signedInt = (v?: number | string): string | null => {
  const n = toNumOrNaN(v);
  if (!Number.isFinite(n)) return null;
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
};
/** 小数1桁（送球 mph・走力 ft/s）。 */
export const oneDecimal = (v?: number | string): string | null => {
  const n = toNumOrNaN(v);
  return Number.isFinite(n) ? n.toFixed(1) : null;
};

/**
 * 守備ブロックに足す Statcast 先進守備（順位は付かない）。守備位置に就く野手のみ値を持つ。
 * OAA=守備範囲（プレー数換算・符号付き）、守備run=同ラン換算（FRV相当）、送球=最速 mph。
 */
export const ADV_FIELD: { key: string; label: string; fmt: (v?: number | string) => string | null }[] = [
  { key: 'oaa', label: 'OAA', fmt: signedInt },
  { key: 'runsPrevented', label: '守備run', fmt: signedInt },
  { key: 'arm', label: '送球 最速mph', fmt: oneDecimal },
];
/** 走力（Sprint speed・ft/s）。守備位置を問わず出る＝DH の選手にも出せる唯一の身体能力指標。 */
export const SPEED_FIELD = { key: 'sprintSpeed', label: 'トップスピード ft/s', fmt: oneDecimal } as const;

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
