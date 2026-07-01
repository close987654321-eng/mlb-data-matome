/**
 * オールスター特設ハブ（期間限定 /allstar）の設定＝唯一の正。
 * ⚠️ 公式発表で確認できた事実だけを埋める（未確認の日付/会場/選出選手を載せない＝サイトの事実整合ルール）。
 * 空文字/空配列なら画面に出さない設計。rosterAnnounced=false の間は「前半戦WAR上位＝選出が期待される候補」を出し、
 * 発表後に selectedMlbIds を埋めて rosterAnnounced=true にすると「選出選手」表示へ切り替わる。
 * 会期が終わったら enabled=false（またはこのハブ自体を撤去）。
 */
export const ALLSTAR = {
  enabled: true,
  year: 2026,
  // 確定（2026-07-01 公式日程で確認・ESPN/MLB.com）。本戦は 7/14（火）20:00 ET。空なら日程行を出さない。
  dateLabel: '2026年7月14日',
  // 確定＝シティズンズ・バンク・パーク（フィリーズ本拠地・フィラデルフィア）。
  venue: 'シティズンズ・バンク・パーク（フィラデルフィア）',
  // 選出ロースター発表後に true。
  rosterAnnounced: false,
  // 選出された日本人選手の mlbId（players.ts の mlbId と一致させる）。発表後に埋める。
  selectedMlbIds: [] as number[],
  // 海外の反応クラスタを束ねる記事タグ（該当記事の tags にこれを付けるとハブに自動で並ぶ）。
  tag: 'オールスター',
};
