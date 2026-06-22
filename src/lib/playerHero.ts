import type { PlayerSeason, Rank, League } from './playerStats';
import { HIT_GROUPS, PIT_GROUPS, war1, wrc } from './statGroups';

/**
 * 選手ハブのヒーロー指標を「誠実かつ映える」基準で1つだけ選ぶ純関数（サーバ・JSX なし）。
 *
 * 設計判断（ワークフロー合意・[[mlb-stats-enrichment-decision]] の誠実さ方針）:
 *  - ヒーローは「最小順位が勝つ」ではなく役割ごとの固定アローリスト。順位は“付随”するだけで選定はしない
 *    （でないと大谷のヒーローが本塁打でなく出塁率になる等、ファンの直感とズレる）。
 *  - 投手の率指標（防御率/WHIP）は“映えゲート”を通った時だけヒーロー。リリーフの防御率9.00を
 *    56pxで晒さない（通らなければ奪三振=必ず前向きな数にフォールバック）。
 *  - 順位は分母を持たない事実（位置）。ここでは数値を作らず、表示可否としきい値だけ扱う。
 */

export type Role = 'two-way' | 'batter' | 'pitcher';

// マーキー（注目の成績）で順位バー/キャプションを“目立つ順位”として出すしきい値。
// 詳細表はより厳しい（20/10）が、バーの伸び率スケールは別途グローバル固定（RankMeter 参照）。
export const NOTABLE_MLB = 40;
export const NOTABLE_LG = 20;

export type HeroKind = 'warTotal' | 'rate' | 'count' | 'wrc';
export type HeroCaption = { label: string; scope: 'mlb' | 'lg'; rank: number };
export type Hero = {
  role: Role;
  kind: HeroKind;
  /** 表示する大きな数字（整形済み）。 */
  value: string;
  /** kind=rate/count のときの日本語指標名（例: 本塁打 / 防御率 / 奪三振）。 */
  statLabel: string | null;
  /** 二刀流 WAR の内訳。 */
  warSplit: { bat: string; pit: string } | null;
  /** ヒーローに付く順位（kind=rate/count で目立つ順位がある時のみ）。 */
  rank: Rank | null;
  league: League | null;
  /** 二刀流の“もう片方の凄さ”を一言で添えるキャプション。 */
  caption: HeroCaption | null;
  /** wRC+ ヒーロー（薄い打者）の注記キーを出すフラグ。 */
  showWrcGloss: boolean;
  /** 目立つ順位がゼロのときの理由（注記の文言を選ぶ）。 */
  noRankReason: 'reliever' | 'belowThreshold' | null;
};

// 指標キー→日本語名（キャプション用）。HIT/PIT グループの実フィールドから引く。
const LABEL_BY_KEY: { hitting: Record<string, string>; pitching: Record<string, string> } = {
  hitting: Object.fromEntries(HIT_GROUPS.flatMap((g) => g.fields).flatMap((f) => (f.kind === 'field' ? [[f.key, f.label]] : []))),
  pitching: Object.fromEntries(PIT_GROUPS.flatMap((g) => g.fields).flatMap((f) => (f.kind === 'field' ? [[f.key, f.label]] : []))),
};

export function deriveRole(season: PlayerSeason): Role {
  if (season.hitting && season.pitching) return 'two-way';
  if (season.pitching && !season.hitting) return 'pitcher';
  return 'batter';
}

const num = (v: string | number | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** その順位が「目立つ」か（マーキーしきい値）。 */
export function isNotableRank(rank?: Rank): boolean {
  if (!rank) return false;
  return (rank.mlb != null && rank.mlb <= NOTABLE_MLB) || (rank.lg != null && rank.lg <= NOTABLE_LG);
}

/** 全成績から最も“映える”順位を1つ拾い、キャプション化する（無ければ null）。 */
export function pickBestRankCaption(season: PlayerSeason): HeroCaption | null {
  const groups: Array<['hitting' | 'pitching', Record<string, Rank> | undefined]> = [
    ['hitting', season.ranks?.hitting],
    ['pitching', season.ranks?.pitching],
  ];
  let best: { metric: string; group: 'hitting' | 'pitching'; rank: Rank } | null = null;
  for (const [group, ranks] of groups) {
    if (!ranks) continue;
    for (const [metric, rank] of Object.entries(ranks)) {
      if (!isNotableRank(rank)) continue;
      // MLB順位が小さいほど上位。MLBが無ければリーグ順位を後ろに置く。
      const score = rank.mlb ?? 1000 + (rank.lg ?? 999);
      const bestScore = best ? (best.rank.mlb ?? 1000 + (best.rank.lg ?? 999)) : Infinity;
      if (score < bestScore) best = { metric, group, rank };
    }
  }
  if (!best) return null;
  const label = LABEL_BY_KEY[best.group][best.metric] ?? best.metric;
  // リーグ上位(<=5)なら“ナ・リーグ1位”の方が刺さる。それ以外は MLB を見せる。
  if (best.rank.lg != null && best.rank.lg <= 5) return { label, scope: 'lg', rank: best.rank.lg };
  if (best.rank.mlb != null) return { label, scope: 'mlb', rank: best.rank.mlb };
  if (best.rank.lg != null) return { label, scope: 'lg', rank: best.rank.lg };
  return null;
}

function anyNotableRank(season: PlayerSeason): boolean {
  const h = season.ranks?.hitting ?? {};
  const p = season.ranks?.pitching ?? {};
  return Object.values(h).some(isNotableRank) || Object.values(p).some(isNotableRank);
}

export function noRankReason(season: PlayerSeason): 'reliever' | 'belowThreshold' | null {
  if (anyNotableRank(season)) return null;
  const role = deriveRole(season);
  return role === 'pitcher' ? 'reliever' : 'belowThreshold';
}

// 投手の率指標が“映える”か（防御率9.00を晒さないゲート）。順位が付いていれば文句なく採用。
function isFlattering(metric: 'era' | 'whip', value: number, rank?: Rank): boolean {
  if (isNotableRank(rank)) return true;
  if (metric === 'era') return value <= 4.5;
  return value <= 1.3;
}

const BAT_HERO_ORDER: Array<[string, string]> = [
  ['homeRuns', '本塁打'],
  ['ops', 'OPS'],
  ['avg', '打率'],
  ['rbi', '打点'],
];

/** ヒーロー指標を1つ決める。 */
export function pickHero(season: PlayerSeason): Hero {
  const role = deriveRole(season);
  const league = season.league ?? null;
  const base: Hero = {
    role,
    kind: 'count',
    value: '—',
    statLabel: null,
    warSplit: null,
    rank: null,
    league,
    caption: null,
    showWrcGloss: false,
    noRankReason: noRankReason(season),
  };

  if (role === 'two-way') {
    const bat = season.saber?.hit;
    const pit = season.saber?.pit;
    // 総合WARは「打・投の実数が両方ある時だけ」合算する。片側欠損(異常データ)を 0 と数えて
    // “持っていない値”を捏造しない（現データは hitting/pitching と saber.hit/pit が対で来るので未到達の保険）。
    if (typeof bat === 'number' && typeof pit === 'number') {
      return {
        ...base,
        kind: 'warTotal',
        value: (bat + pit).toFixed(1),
        warSplit: { bat: war1(bat) ?? '—', pit: war1(pit) ?? '—' },
        caption: pickBestRankCaption(season),
        noRankReason: null, // 二刀流はキャプションで凄さを出すので注記は不要
      };
    }
    // 片側欠損時は総合を作らず、下の投手カスケードで“ある側”の指標を1つヒーローにフォールバック。
  }

  if (role === 'batter') {
    const h = season.hitting;
    // 目立つ順位が無い薄い打者は wRC+（総合打力）をヒーローに。
    if (!anyNotableRank(season)) {
      const w = wrc(season.saber?.wrcplus);
      if (w) return { ...base, kind: 'wrc', value: w, statLabel: '総合打力', showWrcGloss: true };
    }
    for (const [key, label] of BAT_HERO_ORDER) {
      const v = h?.[key];
      if (v != null && v !== '') {
        const rank = season.ranks?.hitting?.[key];
        return {
          ...base,
          kind: ['avg', 'ops'].includes(key) ? 'rate' : 'count',
          value: String(v),
          statLabel: label,
          rank: isNotableRank(rank) ? rank ?? null : null,
          noRankReason: noRankReason(season),
        };
      }
    }
    // フォールバック（理論上ここには来ない）
    const w = wrc(season.saber?.wrcplus);
    if (w) return { ...base, kind: 'wrc', value: w, statLabel: '総合打力', showWrcGloss: true };
    return base;
  }

  // pitcher
  const p = season.pitching;
  for (const metric of ['era', 'whip'] as const) {
    const raw = p?.[metric];
    const n = num(raw);
    if (n == null) continue;
    const rank = season.ranks?.pitching?.[metric];
    if (isFlattering(metric, n, rank)) {
      return {
        ...base,
        kind: 'rate',
        value: String(raw),
        statLabel: metric === 'era' ? '防御率' : 'WHIP',
        rank: isNotableRank(rank) ? rank ?? null : null,
        noRankReason: noRankReason(season),
      };
    }
  }
  // 映えゲートを通らなければ奪三振（常に前向きな数）。
  const k = p?.strikeOuts;
  if (k != null) {
    const rank = season.ranks?.pitching?.strikeOuts;
    return {
      ...base,
      kind: 'count',
      value: String(k),
      statLabel: '奪三振',
      rank: isNotableRank(rank) ? rank ?? null : null,
      noRankReason: noRankReason(season),
    };
  }
  return base;
}
