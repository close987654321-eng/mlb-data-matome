import { playerLabel } from '@/lib/playerNames';
import { getTeam } from '@/lib/teams';
import type { ThreadGame, ThreadScoringPlay } from '@/types/thread';

/**
 * 得点経過（Thread.game.scoring）を読める1行ずつに組む。
 *
 * 「1回に失策で2点を先制される → 4回に村上のタイムリーで1点 → 6回に2点二塁打で逆転」という
 * **試合の流れ**を、結果のスコアだけでなく事実の列で見せるためのもの（2026-10-06 村山
 * 「ポストシーズンの結果と海外の反応は流れがわかるように」）。チームLPのポストシーズン欄が使う。
 *
 * 値は API の scoringPlays の再表示だけ＝打者・プレーの種類・その時点のスコア。打球の方向や
 * 球種のような説明文の中身は持っていないので書かない（捏造しない）。プレーの名前は分かる範囲で
 * 日本語に当て、知らない event は「◯◯の打席で」に倒す＝外れた言葉を当てない。
 */

export type ScoringLine = {
  /** 「4回表」/「Top 4」 */
  inning: string;
  /** 得点したのが視点のチームか（視点が無いときは false） */
  self: boolean;
  /** 得点したチームの短い名前 */
  team: string;
  /** 得点したチームの日本語短縮名（teams.ts のキー＝略号・ロゴを引ける） */
  teamJa: string;
  /** 「村上宗隆のタイムリー」「ナサニエル・ローの打球で失策」 */
  text: string;
  /** このプレーで入った点 */
  runs: number;
  /** このプレー直後のスコア（視点のチームが先・視点が無ければ ビジター-ホーム） */
  score: string;
  /** 試合の流れの節目（先制・同点・逆転・勝ち越し・サヨナラ）。それ以外は null */
  turn: string | null;
};

type Kind = 'hit' | 'by' | 'error' | 'out' | 'misc';

/** event → 日本語の言い方と文型。本塁打だけ点数で名前が変わるので関数にする。 */
const EVENT_JA: Record<string, { kind: Kind; ja: (runs: number) => string }> = {
  Single: { kind: 'hit', ja: () => 'タイムリー' },
  Double: { kind: 'hit', ja: () => 'タイムリー二塁打' },
  Triple: { kind: 'hit', ja: () => 'タイムリー三塁打' },
  'Home Run': { kind: 'hit', ja: (r) => (r === 1 ? 'ソロ本塁打' : r === 4 ? '満塁本塁打' : `${r}ラン本塁打`) },
  'Sac Fly': { kind: 'hit', ja: () => '犠牲フライ' },
  'Sac Bunt': { kind: 'hit', ja: () => 'スクイズ' },
  Walk: { kind: 'by', ja: () => '押し出し四球' },
  'Intent Walk': { kind: 'by', ja: () => '押し出しの敬遠' },
  'Hit By Pitch': { kind: 'by', ja: () => '押し出し死球' },
  'Catcher Interference': { kind: 'by', ja: () => '打撃妨害' },
  Error: { kind: 'error', ja: () => '打球で失策' },
  'Field Error': { kind: 'error', ja: () => '打球で失策' },
  'Fielders Choice': { kind: 'out', ja: () => '野選' },
  'Fielders Choice Out': { kind: 'out', ja: () => '野選' },
  Groundout: { kind: 'out', ja: () => 'ゴロの間' },
  'Bunt Groundout': { kind: 'out', ja: () => 'バントゴロの間' },
  Forceout: { kind: 'out', ja: () => 'ゴロの間' },
  'Grounded Into DP': { kind: 'out', ja: () => '併殺打の間' },
  'Double Play': { kind: 'out', ja: () => '併殺の間' },
  Flyout: { kind: 'out', ja: () => '外野フライの間' },
  Lineout: { kind: 'out', ja: () => 'ライナーの間' },
  'Pop Out': { kind: 'out', ja: () => '凡打の間' },
  'Field Out': { kind: 'out', ja: () => '凡打の間' },
  'Wild Pitch': { kind: 'misc', ja: () => '暴投' },
  'Passed Ball': { kind: 'misc', ja: () => '捕逸' },
  Balk: { kind: 'misc', ja: () => 'ボーク' },
};

function textJa(name: string, event: string, runs: number): string {
  const e = EVENT_JA[event];
  if (!e) return `${name}の打席で得点`;
  const label = e.ja(runs);
  switch (e.kind) {
    case 'hit':
      return `${name}の${label}`;
    case 'error':
      return `${name}の${label}`;
    case 'out':
      return `${name}の${label}に`;
    default:
      return `${name}の打席で${label}`;
  }
}

function textEn(name: string, event: string, runs: number): string {
  if (event === 'Home Run') return `${name} ${runs === 1 ? 'solo homer' : runs === 4 ? 'grand slam' : `${runs}-run homer`}`;
  return `${name} — ${event}`;
}

/** 節目の言葉。得点したチームの視点で、プレー前後のスコアから決める（事実の言い換えだけ）。 */
function turnOf(
  p: ThreadScoringPlay,
  before: { away: number; home: number },
  en: boolean,
): string | null {
  const [sB, oB, sA, oA] = p.top
    ? [before.away, before.home, p.away, p.home]
    : [before.home, before.away, p.home, p.away];
  if (!p.top && p.inning >= 9 && sB <= oB && sA > oA) return en ? 'Walk-off' : 'サヨナラ';
  if (sB === 0 && oB === 0) return en ? 'First run' : '先制';
  if (sB < oB && sA === oA) return en ? 'Tied' : '同点';
  if (sB < oB && sA > oA) return en ? 'Go-ahead' : '逆転';
  if (sB === oB && sA > oA) return en ? 'Go-ahead' : '勝ち越し';
  return null;
}

/**
 * 得点経過の行。selfJa を渡すとそのチームの視点（スコアが「自軍-相手」の順・自軍の得点に印）で組む。
 * 経過を持たない試合は空配列。
 */
export async function scoringLines(
  game: ThreadGame,
  locale: string,
  selfJa?: string,
): Promise<ScoringLine[]> {
  const plays = game.scoring ?? [];
  if (plays.length === 0) return [];
  const en = locale === 'en';
  const selfIsHome = selfJa ? game.home.ja === selfJa : false;
  const shortName = (top: boolean) => {
    const side = top ? game.away : game.home;
    return en ? (getTeam(side.ja)?.nameEn ?? side.en) : side.ja;
  };
  let before = { away: 0, home: 0 };
  const out: ScoringLine[] = [];
  for (const p of plays) {
    const runs = p.top ? p.away - before.away : p.home - before.home;
    if (runs <= 0) {
      before = { away: p.away, home: p.home };
      continue; // 得点の入らない行は経過に出さない（API が守備側の得点を同じ打席に寄せた等）
    }
    const { label } = await playerLabel(p.batter, { locale, mlbId: p.batterId });
    const self = selfJa ? p.top !== selfIsHome : false;
    const score = selfJa
      ? selfIsHome
        ? `${p.home}-${p.away}`
        : `${p.away}-${p.home}`
      : `${p.away}-${p.home}`;
    out.push({
      inning: en ? `${p.top ? 'Top' : 'Bot'} ${p.inning}` : `${p.inning}回${p.top ? '表' : '裏'}`,
      self,
      team: shortName(p.top),
      teamJa: (p.top ? game.away : game.home).ja,
      text: en ? textEn(label, p.event, runs) : textJa(label, p.event, runs),
      runs,
      score,
      turn: turnOf(p, before, en),
    });
    before = { away: p.away, home: p.home };
  }
  return out;
}
