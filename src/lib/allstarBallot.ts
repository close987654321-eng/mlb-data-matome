import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * オールスター投票候補（ballot）＝ scripts/fetch-allstar.mjs が書き出す静的 JSON。
 * リーグ×守備位置の投票候補と各候補の今季打撃成績（OPS等）を持つ。⚠️ 投票数は公式APIに無いので持たない
 * ＝「成績で争いを見せる＋公式ballotへ送客」方針。サイト本体はこの JSON を読むだけ（API は叩かない）。
 */
export type BallotPlayer = {
  id: number;
  name: string;
  pos: string;
  rank: number; // ポジション内の OPS 順位（1始まり）
  teamId: number | null;
  team: string | null;
  ops: number | null;
  hr: number | null;
  avg: number | null;
  pa: number | null;
  jp?: boolean;
  ja?: string;
  slug?: string;
};
export type BallotPosition = { total: number; players: BallotPlayer[] };
export type BallotLeague = { positions: Record<string, BallotPosition> };
export type AllStarBallot = {
  season: number;
  fetchedAt: string;
  asOf: string;
  ballotUrl: string;
  leagues: Record<'AL' | 'NL', BallotLeague>;
};

const FILE = path.join(process.cwd(), 'data', 'allstar-ballot.json');
let cache: AllStarBallot | null = null;

/** 投票候補データを読む。未生成（ファイル無し）なら null＝呼び出し側でセクションを出さない。 */
export async function getAllStarBallot(): Promise<AllStarBallot | null> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as AllStarBallot;
  } catch {
    return null;
  }
  return cache;
}
