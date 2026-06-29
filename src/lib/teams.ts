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
export type TeamInfo = { id: number; color: string; slug: string; nameEn: string };

const TEAMS: Record<string, TeamInfo> = {
  エンゼルス: { id: 108, color: '#BA0021', slug: 'angels', nameEn: 'Angels' },
  ダイヤモンドバックス: { id: 109, color: '#A71930', slug: 'dbacks', nameEn: 'D-backs' },
  オリオールズ: { id: 110, color: '#DF4601', slug: 'orioles', nameEn: 'Orioles' },
  レッドソックス: { id: 111, color: '#BD3039', slug: 'redsox', nameEn: 'Red Sox' },
  カブス: { id: 112, color: '#0E3386', slug: 'cubs', nameEn: 'Cubs' },
  レッズ: { id: 113, color: '#C6011F', slug: 'reds', nameEn: 'Reds' },
  ガーディアンズ: { id: 114, color: '#00385D', slug: 'guardians', nameEn: 'Guardians' },
  ロッキーズ: { id: 115, color: '#333366', slug: 'rockies', nameEn: 'Rockies' },
  タイガース: { id: 116, color: '#0C2340', slug: 'tigers', nameEn: 'Tigers' },
  アストロズ: { id: 117, color: '#EB6E1F', slug: 'astros', nameEn: 'Astros' },
  ロイヤルズ: { id: 118, color: '#004687', slug: 'royals', nameEn: 'Royals' },
  ドジャース: { id: 119, color: '#005A9C', slug: 'dodgers', nameEn: 'Dodgers' },
  ナショナルズ: { id: 120, color: '#AB0003', slug: 'nationals', nameEn: 'Nationals' },
  メッツ: { id: 121, color: '#002D72', slug: 'mets', nameEn: 'Mets' },
  アスレチックス: { id: 133, color: '#003831', slug: 'athletics', nameEn: 'Athletics' },
  パイレーツ: { id: 134, color: '#FDB827', slug: 'pirates', nameEn: 'Pirates' },
  パドレス: { id: 135, color: '#4E342E', slug: 'padres', nameEn: 'Padres' },
  マリナーズ: { id: 136, color: '#0C2C56', slug: 'mariners', nameEn: 'Mariners' },
  ジャイアンツ: { id: 137, color: '#FD5A1E', slug: 'giants', nameEn: 'Giants' },
  カージナルス: { id: 138, color: '#C41E3A', slug: 'cardinals', nameEn: 'Cardinals' },
  レイズ: { id: 139, color: '#092C5C', slug: 'rays', nameEn: 'Rays' },
  レンジャーズ: { id: 140, color: '#003278', slug: 'rangers', nameEn: 'Rangers' },
  ブルージェイズ: { id: 141, color: '#134A8E', slug: 'bluejays', nameEn: 'Blue Jays' },
  ツインズ: { id: 142, color: '#002B5C', slug: 'twins', nameEn: 'Twins' },
  フィリーズ: { id: 143, color: '#E81828', slug: 'phillies', nameEn: 'Phillies' },
  ブレーブス: { id: 144, color: '#CE1141', slug: 'braves', nameEn: 'Braves' },
  ホワイトソックス: { id: 145, color: '#27251F', slug: 'whitesox', nameEn: 'White Sox' },
  マーリンズ: { id: 146, color: '#00A3E0', slug: 'marlins', nameEn: 'Marlins' },
  ヤンキース: { id: 147, color: '#003087', slug: 'yankees', nameEn: 'Yankees' },
  ブルワーズ: { id: 158, color: '#12284B', slug: 'brewers', nameEn: 'Brewers' },
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
 * 選手の公式顔写真の直リンクURL。
 * - 'portrait': 顔のカットアウト（淡色背景・JPEG）。ヒーロー帯用。
 * - 'spot': 丸く収まる小さなヘッドショット（PNG）。一覧・レーンのアバター用。
 */
export function headshotUrl(mlbId: number, kind: 'portrait' | 'spot' = 'portrait'): string {
  return kind === 'spot'
    ? `https://midfield.mlbstatic.com/v1/people/${mlbId}/spots/120`
    : `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_360,q_auto:best/v1/people/${mlbId}/headshot/67/current`;
}
