import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 選手・ファイター・チームタグLP（/tag/{名前}）の「編集部ノート」＝その主題が海外で
 * どう見られているかの300字前後の編集部要約。data/editor-notes.json が唯一の正。
 * キーは選手・ファイター＝カタログの slug、チーム＝teams.ts の slug（whitesox 等・衝突しない）。
 *
 * 現地ファンの声ピックアップ（tagHubVoices）が「生のコメント（日替わりで最大20件）」を見せるのに対し、
 * ノートはそれを横断した傾向の言語化＝「◯◯ 海外の反応」で来た人が30秒で全体像を掴める
 * 独自テキスト。実在するコメント群の要約のみを書く（捏造しない＝CLAUDE.md §4.4）。
 * 反応の傾向が動いたら手動で書き直し、updatedAt を更新する運用。
 */
export type EditorNote = {
  /** ノート本文（ja・300字前後）。実際の記事コメントに基づく要約のみ。 */
  noteJa: string;
  /** 最終更新日（YYYY-MM-DD）。表示と鮮度シグナルに使う。 */
  updatedAt: string;
};

const FILE = path.join(process.cwd(), 'data', 'editor-notes.json');

let cache: Record<string, EditorNote> | null = null;

async function load(): Promise<Record<string, EditorNote>> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as Record<string, EditorNote>;
  } catch {
    // 未生成でもビルドは通す（ノートなしのLPは従来どおり voices＋フィードだけ出す）
    cache = {};
  }
  return cache;
}

/** slug の選手にノートがあれば返す（無ければ null＝セクション自体を出さない）。 */
export async function getEditorNote(slug: string): Promise<EditorNote | null> {
  const notes = await load();
  return notes[slug] ?? null;
}
