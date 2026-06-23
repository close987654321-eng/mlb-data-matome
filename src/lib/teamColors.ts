/**
 * 球団（日本語表記）→ アクセント色（hex）の固定マップ。
 *
 * 用途は選手OG画像（opengraph-image.tsx）のチーム識別だけ。色は商標保護の対象外なので
 * ロゴ/名称マークを一切使わずに「自分のチームの色だ」という所有感を出すための合法的な手段。
 * キーは scripts/fetch-mlb-stats.mjs の TEAM_JA（snapshot の `team` に入る短い日本語名）と一致させる。
 *
 * 色は各球団の象徴色をベースにしつつ、OGの暗い背景（#16130F）で細い下線/小さな四角として
 * 視認できるよう、紺・黒など暗すぎる球団は明度を持ち上げた変種にしている（識別が目的で再現が目的ではない）。
 */
const TEAM_COLOR: Record<string, string> = {
  ダイヤモンドバックス: '#30CED8', // teal（DBacks の差し色）
  ブレーブス: '#E8204E',
  オリオールズ: '#FF6A00',
  レッドソックス: '#E8384F',
  カブス: '#2D6DE0',
  ホワイトソックス: '#C4CED4', // 黒は暗背景で消えるのでシルバーに
  レッズ: '#E8233A',
  ガーディアンズ: '#E31937',
  ロッキーズ: '#8A5CF0', // purple（持ち上げ）
  タイガース: '#FA7D2B', // navy は暗いのでオレンジ差し色
  アストロズ: '#F4792B',
  ロイヤルズ: '#2C7BE5',
  エンゼルス: '#E81537',
  ドジャース: '#2E8BD6', // dodger blue（持ち上げ）
  マーリンズ: '#00B7E0',
  ブルワーズ: '#FFC52F', // gold（navy は暗いので金）
  ツインズ: '#E8284C',
  メッツ: '#FF6A1A', // orange
  ヤンキース: '#5C7FC0', // navy 持ち上げ
  アスレチックス: '#2FA968', // green 持ち上げ
  フィリーズ: '#ED2B47',
  パイレーツ: '#FDB827', // gold
  パドレス: '#E5A33C', // brown/gold は暗いのでサンドゴールド
  ジャイアンツ: '#FD5A1E',
  マリナーズ: '#2A9D8F', // northwest green/teal 持ち上げ
  カージナルス: '#E81C39',
  レイズ: '#3FA0E0',
  レンジャーズ: '#2C5BD6',
  ブルージェイズ: '#2C7DE0',
  ナショナルズ: '#E8294A',
};

/** ブランドのアクセント赤。未登録チーム・マイナー・null のフォールバック。 */
export const ACCENT = '#C8102E';

/** 球団（日本語表記）→ アクセント色。未知/未指定は ACCENT 赤を返す純関数。 */
export function getTeamColor(team?: string | null): string {
  if (!team) return ACCENT;
  return TEAM_COLOR[team] ?? ACCENT;
}
