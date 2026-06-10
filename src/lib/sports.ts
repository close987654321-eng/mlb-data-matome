export const SPORTS = ['mlb', 'boxing', 'ufc'] as const;
export type Sport = (typeof SPORTS)[number];

export type SportInfo = {
  slug: Sport;
  labelJa: string;
  labelEn: string;
  emoji: string;
  // 取得元の subreddit（手動・API どちらの運用でも参照する）
  subreddits: string[];
  // 競技ごとのキービジュアル写真プール（Unsplash ライセンス: 商用可・帰属不要）。
  // カード／記事見出し／カテゴリヘッダーの背景に使う。記事ごとに pickImage で振り分ける。
  heroImages: string[];
};

const U = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`;

export const SPORT_INFO: Record<Sport, SportInfo> = {
  mlb: {
    slug: 'mlb',
    labelJa: 'MLB',
    labelEn: 'MLB',
    emoji: '⚾️',
    subreddits: ['r/baseball', 'r/mlb'],
    heroImages: [
      U('1471295253337-3ceaaedca402'), // 野球場の空撮（夜）
      U('1508344928928-7165b67de128'), // バッター
    ],
  },
  boxing: {
    slug: 'boxing',
    labelJa: 'ボクシング',
    labelEn: 'Boxing',
    emoji: '🥊',
    subreddits: ['r/Boxing'],
    heroImages: [
      U('1552072092-7f9b8d63efcb'), // リング入場のシルエット
      U('1591117207239-788bf8de6c3b'), // モノクロのパンチ
      U('1622599511051-16f55a1234d0'), // ネオン光のボクサー
    ],
  },
  ufc: {
    slug: 'ufc',
    labelJa: 'UFC',
    labelEn: 'UFC',
    emoji: '🥋',
    subreddits: ['r/MMA', 'r/ufc'],
    heroImages: [
      U('1615117972428-28de67cda58e'), // マットでのグラップリング
    ],
  },
};

export function isSport(value: string): value is Sport {
  return (SPORTS as readonly string[]).includes(value);
}

/** seed（記事 id など）から、その競技の写真プールを決定論的に1枚選ぶ（同じ写真の連発を防ぐ） */
export function pickImage(sport: Sport, seed: string): string {
  const imgs = SPORT_INFO[sport].heroImages;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return imgs[h % imgs.length];
}
