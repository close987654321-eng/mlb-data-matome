import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 選手タグLP（/tag/{選手名}）の「シーズン観測日誌」＝海外ファンの評価がシーズンを通じて
 * どう動いたかを、試合（記事）ごとの実在コメント引用で時系列に積んでいく成長型セクション。
 * data/player-journal/{slug}.json が唯一の正。
 *
 * 役割分担: tagHubVoices が「今なにを言われているか」（質順・日替わり）、日誌が「評価の推移」
 * （時系列・追記型）。狙いは「{選手名} 海外の反応」で再着地した読者に“前に来たときから物語が
 * 進んでいる”継続性を見せてリピーター化すること。
 *
 * 規律（捏造防止＝CLAUDE.md §4.4）:
 *  - quotes は data/threads の記事JSONからの逐語コピーのみ。threadId で出典記事に必ずリンクする
 *  - editorJa（編集部の地の文）は山場の試合だけ。記事にある事実と実在コメントの範囲で書く
 */

export type JournalQuote = {
  author: string;
  score: number;
  bodyEn?: string;
  bodyJa?: string;
};

export type JournalEntry = {
  /** 試合/話題の日付（YYYY-MM-DD・出典記事の fetchedAt 基準＝JST）。 */
  date: string;
  /** 「対レッズ、2打席連発」のような事実見出し（記事にある事実だけ）。 */
  headingJa: string;
  /** 出典記事＝引用の逐語元。リンク先 /{sport}/{threadId}。 */
  threadId: string;
  sport: string;
  /** 出典記事の format（youtube/reddit/interview）。票数アイコンの出し分けに使う。 */
  format?: string;
  /** 山場の試合だけに書く編集部の地の文（2〜3行）。 */
  editorJa?: string;
  /** 出典記事からの逐語引用（1〜2件）。 */
  quotes: JournalQuote[];
};

export type PlayerJournal = { entries: JournalEntry[] };

const DIR = path.join(process.cwd(), 'data', 'player-journal');

/** slug の選手に日誌があれば開幕→現在の昇順で返す（無ければ null＝セクション自体を出さない）。 */
export async function getPlayerJournal(slug: string): Promise<PlayerJournal | null> {
  try {
    const raw = await fs.readFile(path.join(DIR, `${slug}.json`), 'utf8');
    const journal = JSON.parse(raw) as PlayerJournal;
    if (!journal.entries?.length) return null;
    // 表示は常に時系列昇順＝物語として読ませる。データ側の並び順に依存しない。
    journal.entries.sort((a, b) => a.date.localeCompare(b.date));
    return journal;
  } catch {
    return null;
  }
}
