import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * チームLPの試合タイムラインに挟む「中の人メモ」＝その試合について中の人（寝不足MLBオタク・
 * 一人称「俺」／声の正典は .claude/skills/x-post）が一言書いたもの。data/team-notes.json が唯一の正。
 *
 * なぜ手書きか: 数字の言い換えを自動生成すると「AIが作った実況」になって、Xで育てた声の資産と
 * ちぐはぐになる。全試合には付けず**節目の試合にだけ**書く（村山「ちょいちょい挟んでほしい」＝
 * 2026-08-07）。書いていい内容は裏が取れる事実だけ＝スコア・順位・記事のコメント（捏造しない・
 * CLAUDE.md §4.4）。キーは teams.ts の slug（whitesox / dodgers …）→ 試合日（JST）。
 */
export type TeamNote = {
  /** 試合日（JST・YYYY-MM-DD）。タイムラインの行と突き合わせる。 */
  date: string;
  /** 中の人の一言（ja）。1〜3行。 */
  noteJa: string;
};

const FILE = path.join(process.cwd(), 'data', 'team-notes.json');

let cache: Record<string, TeamNote[]> | null = null;

async function load(): Promise<Record<string, TeamNote[]>> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as Record<string, TeamNote[]>;
  } catch {
    cache = {}; // 未生成でもビルドは通す（メモなしのタイムラインになるだけ）
  }
  return cache;
}

/** そのチームのメモを「試合日 → 本文」で引ける形に。メモが無いチームは空の Map。 */
export async function getTeamNotes(slug: string): Promise<Map<string, string>> {
  const all = await load();
  return new Map((all[slug] ?? []).map((n) => [n.date, n.noteJa]));
}
