export const SPORTS = ['mlb', 'boxing', 'ufc'] as const;
export type Sport = (typeof SPORTS)[number];

export type SportInfo = {
  slug: Sport;
  labelJa: string;
  labelEn: string;
  emoji: string;
  // 取得元の subreddit（手動・API どちらの運用でも参照する）
  subreddits: string[];
  // 生成カバー用のアクセント色（濃→淡のグラデにする）
  accent: string;
  accentDark: string;
  // カテゴリページのヘッダー写真（Unsplash ライセンス: 商用可・帰属不要）
  heroImage: string;
};

const UNSPLASH = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`;

export const SPORT_INFO: Record<Sport, SportInfo> = {
  mlb: {
    slug: 'mlb',
    labelJa: 'MLB',
    labelEn: 'MLB',
    emoji: '⚾️',
    subreddits: ['r/baseball', 'r/mlb'],
    accent: '#14507A',
    accentDark: '#0C3552',
    heroImage: UNSPLASH('1471295253337-3ceaaedca402'), // 野球場の空撮（夜）
  },
  boxing: {
    slug: 'boxing',
    labelJa: 'ボクシング',
    labelEn: 'Boxing',
    emoji: '🥊',
    subreddits: ['r/Boxing'],
    accent: '#9A1B22',
    accentDark: '#6B1217',
    heroImage: UNSPLASH('1552072092-7f9b8d63efcb'), // リング入場のシルエット
  },
  ufc: {
    slug: 'ufc',
    labelJa: 'UFC',
    labelEn: 'UFC',
    emoji: '🥋',
    subreddits: ['r/MMA', 'r/ufc'],
    accent: '#B07A1E',
    accentDark: '#7C5512',
    heroImage: UNSPLASH('1615117972428-28de67cda58e'), // マットでのグラップリング
  },
};

export function isSport(value: string): value is Sport {
  return (SPORTS as readonly string[]).includes(value);
}
