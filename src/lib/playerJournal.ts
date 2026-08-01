import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 選手タグLP（/tag/{選手名}）の「シーズン観測日誌」＝海外ファンの評価がシーズンを通じて
 * どう動いたかを、試合ごとの実在コメント引用で時系列に積んでいく成長型セクション。
 * data/player-journal/{slug}.json が唯一の正。
 *
 * v2（2026-08-01）: 引用の羅列に見える問題（村山指摘「並べただけ感」）を、編集の構造で解く:
 *  - chapter（章）: 編集者が評価の転換点で幕を割る。日誌は「章タイトル＋リード」で物語として読む
 *  - peak（山場）: 盛り上がった試合は横幅を使った見せ場レイアウトで強弱をつける
 *  - video 出典: サイト記事がない開幕〜5月は MLB 公式ハイライトのコメント欄を直接出典にする
 *
 * 規律（捏造防止＝CLAUDE.md §4.4）:
 *  - quotes は出典（記事JSON または取得済みコメントJSON）からの逐語コピーのみ。出典リンク必須
 *  - editorJa / chapterLeadJa（編集部の地の文）は記事・gamelog にある事実と実在コメントの範囲で書く
 *  - 地の文はクラウド無人実行では生成しない（編集セッションで人が書く）
 */

export type JournalQuote = {
  author: string;
  score: number;
  bodyEn?: string;
  bodyJa?: string;
};

/** サイト記事がない期間の出典＝MLB公式ハイライト動画（コメント欄から逐語引用）。 */
export type JournalVideoSource = {
  url: string;
  title: string;
  channel: string;
};

export type JournalEntry = {
  /** 試合の日付（YYYY-MM-DD）。 */
  date: string;
  /** 「対レッズ、2打席連発」のような事実見出し（記事・gamelog にある事実だけ）。 */
  headingJa: string;
  /** 出典記事（ある場合）。リンク先 /{sport}/{threadId}。 */
  threadId?: string;
  sport?: string;
  /** 記事がない試合の出典動画（threadId と排他）。 */
  video?: JournalVideoSource;
  /** 出典の format（youtube/reddit/interview）。票数アイコンの出し分けに使う。 */
  format?: string;
  /** 山場の試合だけに書く編集部の観測メモ（2〜3行）。 */
  editorJa?: string;
  /** 山場＝横幅を使った見せ場レイアウトで出す。 */
  peak?: boolean;
  /** このエントリから新しい章が始まる（章タイトル）。時系列上の評価の転換点で割る。 */
  chapterJa?: string;
  /** 章見出しの直下に置く編集リード1行。 */
  chapterLeadJa?: string;
  /** 出典からの逐語引用。 */
  quotes: JournalQuote[];
};

export type PlayerJournal = {
  /** 日誌の序文＝編集者がこの選手の物語を数行で立てる（ja）。 */
  introJa?: string;
  /** 日誌末尾の「次の見どころ」＝次戦・次の節目の予告（編集セッションで人が書く。クラウド禁止）。 */
  nextJa?: string;
  /** nextJa の賞味期限（JSTの試合日）。過ぎたらビルド時に非表示＝終わった試合の予告を出さない。 */
  nextUntil?: string;
  entries: JournalEntry[];
};

const DIR = path.join(process.cwd(), 'data', 'player-journal');

/** slug の選手に日誌があれば時系列昇順で返す（無ければ null＝セクション自体を出さない）。 */
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

/** 章のまとまり（chapterJa を持つエントリが新章の頭）。 */
export type JournalChapter = {
  titleJa?: string;
  leadJa?: string;
  entries: JournalEntry[];
};

/**
 * 「いま」ブロックに掲げる最新のハイライト＝直近の山場（peak）の最多いいね引用。
 * 山場がなければ引用のある最新エントリで代用（LPの顔になる声を常に1本立てる）。
 */
export function journalLatestHighlight(
  journal: PlayerJournal,
): { entry: JournalEntry; quote: JournalQuote } | null {
  const pool = journal.entries.filter((e) => e.quotes.length > 0);
  const entry = [...pool].reverse().find((e) => e.peak) ?? pool.at(-1);
  if (!entry) return null;
  const quote = entry.quotes.reduce((a, b) => (b.score > a.score ? b : a));
  return { entry, quote };
}

/**
 * 期限内の「次の見どころ」。SSG は stats CI で毎日ビルドされるので、nextUntil を過ぎた予告は
 * 次のビルドで自然に消える（古い予告を出し続けてページが死んで見えるのを防ぐ）。
 */
export function journalNext(journal: PlayerJournal): string | null {
  if (!journal.nextJa) return null;
  if (journal.nextUntil) {
    // sv-SE ロケール＝YYYY-MM-DD 固定表記。JSTの暦日で比較する。
    const todayJst = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
    if (todayJst > journal.nextUntil) return null;
  }
  return journal.nextJa;
}

/** 章ごとにまとめる。先頭に章タイトルが無いデータでも落ちない（無題の第1章になる）。 */
export function journalChapters(journal: PlayerJournal): JournalChapter[] {
  const chapters: JournalChapter[] = [];
  for (const entry of journal.entries) {
    if (entry.chapterJa || chapters.length === 0) {
      chapters.push({ titleJa: entry.chapterJa, leadJa: entry.chapterLeadJa, entries: [] });
    }
    chapters[chapters.length - 1].entries.push(entry);
  }
  return chapters;
}
