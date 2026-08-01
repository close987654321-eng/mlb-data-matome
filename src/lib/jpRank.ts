import { PLAYERS, type Player } from '@/lib/players';
import type { PlayersSnapshot, PlayerSeason } from '@/lib/playerStats';

/**
 * 「日本人◯位」＝日本人選手内のWAR順位。タグLPのスタットパネルが「この選手の現在地」を
 * 1行で言うために使う。プールと構造判定は /ranking のWARボードと同じ規則に揃える
 * （rival除外・league必須・投手ゲート・二刀流は打撃側）＝ページ間で順位が食い違わない。
 */
export type JpRank = { side: 'bat' | 'pit'; rank: number; total: number };

const num = (raw: unknown): number => {
  const v = Number(raw);
  return Number.isNaN(v) ? 0 : v;
};

/** /ranking と同じ投手ゲート（先発 or 一定投球回＝野手の火消し登板を弾く）。 */
const isRealPitcher = (s: PlayerSeason): boolean =>
  !!s.pitching && (num(s.pitching.gamesStarted) >= 1 || num(s.pitching.inningsPitched) >= 10);

const sideOf = (s: PlayerSeason): 'bat' | 'pit' | null =>
  s.hitting && num(s.hitting.plateAppearances) > 0 ? 'bat' : isRealPitcher(s) ? 'pit' : null;

export function jpWarRank(snap: PlayersSnapshot, player: Player): JpRank | null {
  const pool = PLAYERS.filter((p) => !p.rival)
    .map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined }))
    .filter((x): x is { p: Player; s: PlayerSeason } => Boolean(x.s && x.s.league));
  const me = pool.find((x) => x.p.slug === player.slug);
  if (!me) return null;
  const side = sideOf(me.s);
  if (!side) return null;
  const key = side === 'bat' ? 'hit' : 'pit';
  const rows = pool
    .filter((x) => sideOf(x.s) === side)
    .map((x) => ({ slug: x.p.slug, war: x.s.saber?.[key] ?? null }))
    .filter((x): x is { slug: string; war: number } => x.war != null)
    .sort((a, b) => b.war - a.war);
  const i = rows.findIndex((r) => r.slug === player.slug);
  return i < 0 ? null : { side, rank: i + 1, total: rows.length };
}
