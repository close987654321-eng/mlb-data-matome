/**
 * MLB 30球団のメタ（日本語短縮名 → 公式ロゴ用 teamId・主要カラー・英語名）。
 *
 * キーは snapshot（data/jp-players-stats.json）の `team` 文字列＝scripts/fetch-mlb-stats.mjs の
 * TEAM_JA と同じ短縮カタカナ。これでスナップショットの所属からロゴ/カラーを引ける。
 *
 * ⚠️ 法務 posture: ロゴ画像・顔写真は **MLB 公式 CDN（mlbstatic）から直リンク**で参照し、
 * 自サイトに再ホスト（コピー保存）しない。商用利用は規約グレー〜商標領域だが、運営判断で
 * 「引用の範囲＋直リンク」で運用する（2026-06-29 合意）。数値は従来どおり公知の事実。
 */
export type TeamInfo = {
  id: number;
  color: string;
  slug: string;
  nameEn: string;
  nameFull: string;
  /** 日本語検索で主流の別表記（GSC実測）。チームLPの title/H1/description に併記する。 */
  aliasJa?: string;
};

const TEAMS: Record<string, TeamInfo> = {
  エンゼルス: { id: 108, color: '#BA0021', slug: 'angels', nameEn: 'Angels', nameFull: 'Los Angeles Angels' },
  // 検索は「Dバックス」表記が主流（GSC 2026-07: 「dバックス 対 ジャイアンツ」1,604表示）。
  ダイヤモンドバックス: { id: 109, color: '#A71930', slug: 'dbacks', nameEn: 'D-backs', nameFull: 'Arizona Diamondbacks', aliasJa: 'Dバックス' },
  オリオールズ: { id: 110, color: '#DF4601', slug: 'orioles', nameEn: 'Orioles', nameFull: 'Baltimore Orioles' },
  レッドソックス: { id: 111, color: '#BD3039', slug: 'redsox', nameEn: 'Red Sox', nameFull: 'Boston Red Sox' },
  カブス: { id: 112, color: '#0E3386', slug: 'cubs', nameEn: 'Cubs', nameFull: 'Chicago Cubs' },
  レッズ: { id: 113, color: '#C6011F', slug: 'reds', nameEn: 'Reds', nameFull: 'Cincinnati Reds' },
  ガーディアンズ: { id: 114, color: '#00385D', slug: 'guardians', nameEn: 'Guardians', nameFull: 'Cleveland Guardians' },
  ロッキーズ: { id: 115, color: '#333366', slug: 'rockies', nameEn: 'Rockies', nameFull: 'Colorado Rockies' },
  タイガース: { id: 116, color: '#0C2340', slug: 'tigers', nameEn: 'Tigers', nameFull: 'Detroit Tigers' },
  アストロズ: { id: 117, color: '#EB6E1F', slug: 'astros', nameEn: 'Astros', nameFull: 'Houston Astros' },
  ロイヤルズ: { id: 118, color: '#004687', slug: 'royals', nameEn: 'Royals', nameFull: 'Kansas City Royals' },
  ドジャース: { id: 119, color: '#005A9C', slug: 'dodgers', nameEn: 'Dodgers', nameFull: 'Los Angeles Dodgers' },
  ナショナルズ: { id: 120, color: '#AB0003', slug: 'nationals', nameEn: 'Nationals', nameFull: 'Washington Nationals' },
  メッツ: { id: 121, color: '#002D72', slug: 'mets', nameEn: 'Mets', nameFull: 'New York Mets' },
  // 2025年以降は都市名を外した「Athletics」が公式名（ラスベガス移転までの暫定）。
  アスレチックス: { id: 133, color: '#003831', slug: 'athletics', nameEn: 'Athletics', nameFull: 'Athletics' },
  パイレーツ: { id: 134, color: '#FDB827', slug: 'pirates', nameEn: 'Pirates', nameFull: 'Pittsburgh Pirates' },
  パドレス: { id: 135, color: '#4E342E', slug: 'padres', nameEn: 'Padres', nameFull: 'San Diego Padres' },
  マリナーズ: { id: 136, color: '#0C2C56', slug: 'mariners', nameEn: 'Mariners', nameFull: 'Seattle Mariners' },
  ジャイアンツ: { id: 137, color: '#FD5A1E', slug: 'giants', nameEn: 'Giants', nameFull: 'San Francisco Giants' },
  カージナルス: { id: 138, color: '#C41E3A', slug: 'cardinals', nameEn: 'Cardinals', nameFull: 'St. Louis Cardinals' },
  レイズ: { id: 139, color: '#092C5C', slug: 'rays', nameEn: 'Rays', nameFull: 'Tampa Bay Rays' },
  レンジャーズ: { id: 140, color: '#003278', slug: 'rangers', nameEn: 'Rangers', nameFull: 'Texas Rangers' },
  ブルージェイズ: { id: 141, color: '#134A8E', slug: 'bluejays', nameEn: 'Blue Jays', nameFull: 'Toronto Blue Jays' },
  ツインズ: { id: 142, color: '#002B5C', slug: 'twins', nameEn: 'Twins', nameFull: 'Minnesota Twins' },
  フィリーズ: { id: 143, color: '#E81828', slug: 'phillies', nameEn: 'Phillies', nameFull: 'Philadelphia Phillies' },
  ブレーブス: { id: 144, color: '#CE1141', slug: 'braves', nameEn: 'Braves', nameFull: 'Atlanta Braves' },
  ホワイトソックス: { id: 145, color: '#27251F', slug: 'whitesox', nameEn: 'White Sox', nameFull: 'Chicago White Sox' },
  マーリンズ: { id: 146, color: '#00A3E0', slug: 'marlins', nameEn: 'Marlins', nameFull: 'Miami Marlins' },
  ヤンキース: { id: 147, color: '#003087', slug: 'yankees', nameEn: 'Yankees', nameFull: 'New York Yankees' },
  ブルワーズ: { id: 158, color: '#12284B', slug: 'brewers', nameEn: 'Brewers', nameFull: 'Milwaukee Brewers' },
};

/** 所属チーム（snapshot の team 文字列）→ チーム情報。未知（AAA等）は undefined。 */
export function getTeam(teamJa?: string | null): TeamInfo | undefined {
  if (!teamJa) return undefined;
  return TEAMS[teamJa];
}

/** 公式チームロゴ（SVG）の直リンクURL。 */
export function teamLogoUrl(id: number): string {
  return `https://www.mlbstatic.com/team-logos/${id}.svg`;
}

/**
 * teamId → 公式3文字略号（statsapi /teams の abbreviation 実測値）。
 * 線スコア表の行見出しに使う＝スコアボードの慣習表記で、日本語名より桁が揃い狭い画面に収まる。
 * 移転で変わりうる（例: 133 は Oakland 時代 OAK → 現 ATH）ので、変わったらここだけ直す。
 */
const TEAM_ABBR: Record<number, string> = {
  108: 'LAA', 109: 'AZ', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN',
  114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU', 118: 'KC', 119: 'LAD',
  120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT', 135: 'SD', 136: 'SEA',
  137: 'SF', 138: 'STL', 139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN',
  143: 'PHI', 144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL',
};

/** 公式3文字略号。未知チームは undefined（呼び出し側で日本語名にフォールバックする）。 */
export function teamAbbr(id?: number): string | undefined {
  return id == null ? undefined : TEAM_ABBR[id];
}

/** MLB 公式チームサイトの URL（構造化データの sameAs＝エンティティ照合用）。 */
export function teamOfficialUrl(slug: string): string {
  return `https://www.mlb.com/${slug}`;
}

/**
 * 選手の公式顔写真の直リンクURL。
 * - 'portrait': 顔のカットアウト（淡色背景・JPEG）。ヒーロー帯用。
 * - 'spot': 丸く収まる小さなヘッドショット（PNG）。一覧・レーンのアバター用。
 */
export function headshotUrl(mlbId: number, kind: 'portrait' | 'spot' = 'portrait'): string {
  return kind === 'spot'
    ? `https://midfield.mlbstatic.com/v1/people/${mlbId}/spots/120`
    : `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_360,q_auto:best/v1/people/${mlbId}/headshot/67/current`;
}
