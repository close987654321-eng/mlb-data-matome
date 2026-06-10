import type { MetricKey } from '@/types/mlb';

export type MetricCategory = 'war' | 'batting' | 'pitching' | 'defense' | 'clutch';

/**
 * 数値の見せ方。
 * - 'plain'    : そのまま小数表示 (例: fWAR 3.3 / FIP 2.87 / wRC+ 132)
 * - 'avg'      : 打率系で先頭の0を落とす (例: 0.393 → .393)
 * - 'percent'  : 末尾に % を付ける (例: 16.5 → 16.5%)
 * - 'plusSign' : 正の値に + を付ける (例: 1.5 → +1.5 / -0.4 → -0.4)
 */
export type FormatStyle = 'plain' | 'avg' | 'percent' | 'plusSign';

export type MetricInfo = {
  key: MetricKey;
  category: MetricCategory;
  /** URL slug used in /stats/[metric] */
  slug: string;
  label: { ja: string; en: string };
  short: { ja: string; en: string };
  description: { ja: string; en: string };
  /** true = higher is better, false = lower is better */
  higherIsBetter: boolean;
  /** Primary source for documentation links */
  sourceUrl: string;
  /** Decimal places for display */
  precision: number;
  /** Number formatting style (defaults to 'plain') */
  formatStyle?: FormatStyle;
};

export const METRICS: MetricInfo[] = [
  // ─── WAR family ───────────────────────────────────────────
  {
    key: 'fWAR', category: 'war', slug: 'fwar',
    label: { ja: 'fWAR', en: 'fWAR' },
    short: { ja: 'FanGraphs版WAR', en: 'FanGraphs WAR' },
    description: {
      ja: 'FanGraphsが算出するWAR。打撃はwRC+、投手はFIP系を軸に総合貢献を評価する。',
      en: 'WAR as computed by FanGraphs, using wRC+ for hitters and FIP-based metrics for pitchers.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 1,
  },
  {
    key: 'bWAR', category: 'war', slug: 'bwar',
    label: { ja: 'bWAR', en: 'bWAR' },
    short: { ja: 'Baseball-Reference版WAR', en: 'Baseball-Reference WAR' },
    description: {
      ja: 'Baseball-Reference算出のWAR。投手評価でRA9（実失点）を使う点がfWARと異なる。',
      en: 'WAR by Baseball-Reference. Differs from fWAR mainly in pitcher evaluation (RA9-based).',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.baseball-reference.com/leaders/',
    precision: 1,
  },

  // ─── Hitting ──────────────────────────────────────────────
  {
    key: 'wRC+', category: 'batting', slug: 'wrc-plus',
    label: { ja: 'wRC+', en: 'wRC+' },
    short: { ja: '球場補正済み総合打撃指標', en: 'Park-adjusted overall hitting' },
    description: {
      ja: 'リーグ平均=100。球場やリーグを補正した総合打撃成績。120で平均より20%優秀。',
      en: 'League average = 100. Park- and league-adjusted overall offensive production.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 0,
  },
  {
    key: 'wOBA', category: 'batting', slug: 'woba',
    label: { ja: 'wOBA', en: 'wOBA' },
    short: { ja: '加重出塁率', en: 'Weighted On-Base Average' },
    description: {
      ja: '打席結果を得点価値で重み付けした出塁率。.340が平均、.400以上で優秀。',
      en: 'On-base average weighted by the run value of each outcome. .340 is average, .400+ is elite.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 3,
    formatStyle: 'avg',
  },
  {
    key: 'OPS', category: 'batting', slug: 'ops',
    label: { ja: 'OPS', en: 'OPS' },
    short: { ja: '出塁率+長打率', en: 'On-base + Slugging' },
    description: {
      ja: '出塁率と長打率を単純加算した古典的指標。.800で良打者、.900以上でオールスター級。',
      en: 'Classic combined stat (OBP+SLG). .800 is good, .900+ is All-Star tier.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 3,
    formatStyle: 'avg',
  },
  {
    key: 'xwOBA', category: 'batting', slug: 'xwoba',
    label: { ja: 'xwOBA', en: 'xwOBA' },
    short: { ja: '打球の質から見た期待wOBA', en: 'Expected wOBA from batted-ball quality' },
    description: {
      ja: '打球速度と角度から導く期待値wOBA。実成績の「運」を取り除いた打撃指標。',
      en: 'Expected wOBA derived from exit velocity and launch angle — strips out batted-ball luck.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://baseballsavant.mlb.com/leaderboard/expected_statistics',
    precision: 3,
    formatStyle: 'avg',
  },
  {
    key: 'Barrel%', category: 'batting', slug: 'barrel-rate',
    label: { ja: 'Barrel%', en: 'Barrel%' },
    short: { ja: '理想的な打球の割合', en: 'Rate of ideal contact' },
    description: {
      ja: 'バレル（速度と角度が最も長打になりやすい打球）を打った割合。パワー指標。',
      en: 'Share of batted balls hit at the optimal exit velocity/launch angle for extra bases.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://baseballsavant.mlb.com/leaderboard/statcast',
    precision: 1,
    formatStyle: 'percent',
  },
  {
    key: 'HardHit%', category: 'batting', slug: 'hard-hit-rate',
    label: { ja: 'HardHit%', en: 'HardHit%' },
    short: { ja: '強い打球の割合', en: 'Rate of hard-hit balls' },
    description: {
      ja: '打球速度95mph以上の打球の割合。安定した打球の質を示すパワー指標。',
      en: 'Share of batted balls with exit velocity ≥95 mph. Indicates consistent quality contact.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://baseballsavant.mlb.com/leaderboard/statcast',
    precision: 1,
    formatStyle: 'percent',
  },

  // ─── Pitching ─────────────────────────────────────────────
  {
    key: 'FIP', category: 'pitching', slug: 'fip',
    label: { ja: 'FIP', en: 'FIP' },
    short: { ja: '守備を除いた投手力', en: 'Defense-independent pitching' },
    description: {
      ja: '本塁打・四球・三振のみで算出する投手指標。守備の影響を排除した「真の投手力」。',
      en: 'Pitcher metric based only on HR, BB, and K — removes defense from the equation.',
    },
    higherIsBetter: false,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 2,
  },
  {
    key: 'xFIP', category: 'pitching', slug: 'xfip',
    label: { ja: 'xFIP', en: 'xFIP' },
    short: { ja: 'HR運を補正したFIP', en: 'FIP normalized for HR luck' },
    description: {
      ja: 'FIPの被本塁打率を平均化した版。長期的な投手力をより安定して示すとされる。',
      en: 'FIP variant that normalizes HR rate to league average — better long-term indicator.',
    },
    higherIsBetter: false,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 2,
  },
  {
    key: 'Stuff+', category: 'pitching', slug: 'stuff-plus',
    label: { ja: 'Stuff+', en: 'Stuff+' },
    short: { ja: '球質の純粋な評価', en: 'Pure stuff quality' },
    description: {
      ja: '球速・回転・変化量などピッチの「物理的な質」を100=平均としてモデル化した指標。',
      en: 'Model-based grade of raw pitch quality (velocity, spin, movement) with 100 = average.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 0,
  },
  {
    key: 'Location+', category: 'pitching', slug: 'location-plus',
    label: { ja: 'Location+', en: 'Location+' },
    short: { ja: '投球コースの質', en: 'Pitch-location quality' },
    description: {
      ja: '投じた場所の質を100=平均でモデル化。Stuff+と組み合わせて投手を多面的に評価。',
      en: 'Model-based grade of where pitches are located; pairs with Stuff+ for a fuller picture.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 0,
  },

  // ─── Defense / Baserunning ───────────────────────────────
  {
    key: 'OAA', category: 'defense', slug: 'oaa',
    label: { ja: 'OAA', en: 'OAA' },
    short: { ja: 'Statcast守備指標', en: 'Statcast defensive runs' },
    description: {
      ja: '打球の難易度を確率モデル化し、平均的守備者と比べた「アウト数の差」を表す。',
      en: 'Outs Above Average — outs made versus expected, using Statcast difficulty modeling.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://baseballsavant.mlb.com/leaderboard/outs_above_average',
    precision: 0,
    formatStyle: 'plusSign',
  },
  {
    key: 'BsR', category: 'defense', slug: 'bsr',
    label: { ja: 'BsR', en: 'BsR' },
    short: { ja: '走塁による得点貢献', en: 'Baserunning runs' },
    description: {
      ja: '盗塁・進塁判断などを総合した走塁の得点貢献。0が平均、+5以上で優秀。',
      en: 'Total baserunning value in runs (steals + extra bases). 0 is average, +5 is elite.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 1,
    formatStyle: 'plusSign',
  },

  // ─── Clutch (high-leverage performance) ──────────────────
  {
    key: 'Clutch', category: 'clutch', slug: 'clutch',
    label: { ja: 'Clutch', en: 'Clutch' },
    short: { ja: '勝負強さ（文脈補正済み）', en: 'Clutchness (context-adjusted)' },
    description: {
      ja: '高レバレッジ局面の成績が、その選手自身の文脈中立成績（WPA/LI）と比べてどれだけ上振れたかを示す。+2.0以上で「勝負強い」、-2.0以下で「弱い」が目安。',
      en: 'How much a player outperformed their own context-neutral baseline in high-leverage spots. +2.0 is "Excellent clutch"; -2.0 is "Awful". Formula: WPA/pLI − WPA/LI.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 2,
    formatStyle: 'plusSign',
  },
  {
    key: 'WPA', category: 'clutch', slug: 'wpa',
    label: { ja: 'WPA', en: 'WPA' },
    short: { ja: '勝利確率への貢献合計', en: 'Win Probability Added' },
    description: {
      ja: '各打席が自軍の勝利確率をどれだけ動かしたかの累計。シーズン+3以上で優秀、+6以上でMVP級が目安。',
      en: 'Sum of the win-probability shift caused by each plate appearance. +3 is good, +6 is MVP-tier.',
    },
    higherIsBetter: true,
    sourceUrl: 'https://www.fangraphs.com/leaders/major-league',
    precision: 2,
    formatStyle: 'plusSign',
  },
];

export const METRICS_BY_KEY: Record<string, MetricInfo> = Object.fromEntries(
  METRICS.map((m) => [m.key, m]),
);

export const METRICS_BY_SLUG: Record<string, MetricInfo> = Object.fromEntries(
  METRICS.map((m) => [m.slug, m]),
);

export function metricsInCategory(category: MetricCategory): MetricInfo[] {
  return METRICS.filter((m) => m.category === category);
}
