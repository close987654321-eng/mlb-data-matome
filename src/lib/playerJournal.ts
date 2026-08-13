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
  /**
   * 出典記事を撤去したときに threadId から移し替える（＝もう存在しない記事の id）。表示には出さない。
   * 元動画が消えると記事は撤去するが（check-dead-videos.mjs の手当てA）、日誌の記述まで消すのは
   * 過剰＝引用は掲載時に check-journal-quotes.mjs で逐語照合を通っており、記事は git 履歴に残る。
   * ただし「出典の無い引用」を野放しにすると捏造の穴になるので、check-journal-quotes.mjs は
   * **この id が data/deleted-ids.json に載っていること**を確認して初めて照合を免除する
   * ＝自由記述の言い訳では免除されない（撤去台帳＋git 履歴で必ず追える引用だけが残る）。
   */
  retiredThreadId?: string;
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
  /** 山場（peak）に添えるサムネ（出典動画のYouTube公式サムネ等・恒久URLのみ）。 */
  thumbUrl?: string;
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
const FIGHTER_DIR = path.join(process.cwd(), 'data', 'fighter-journal');

async function readJournal(dir: string, slug: string): Promise<PlayerJournal | null> {
  try {
    const raw = await fs.readFile(path.join(dir, `${slug}.json`), 'utf8');
    const journal = JSON.parse(raw) as PlayerJournal;
    if (!journal.entries?.length) return null;
    // 表示は常に時系列昇順＝物語として読ませる。データ側の並び順に依存しない。
    journal.entries.sort((a, b) => a.date.localeCompare(b.date));
    return journal;
  } catch {
    return null;
  }
}

/** slug の選手に日誌があれば時系列昇順で返す（無ければ null＝セクション自体を出さない）。 */
export async function getPlayerJournal(slug: string): Promise<PlayerJournal | null> {
  return readJournal(DIR, slug);
}

/**
 * 格闘技版＝キャリア観測日誌（data/fighter-journal/{slug}.json・slug は fighters.ts）。
 * 試合が年数回しかないので「シーズン」でなくキャリア全体を1冊で積む。型・引用の規律
 * （逐語コピーのみ・地の文は編集セッションで人が書く）は選手日誌と完全に同一。
 * date は fights タイムラインと同じ試合日（現地）、試合間の話題はスレの立った日。
 */
export async function getFighterJournal(slug: string): Promise<PlayerJournal | null> {
  return readJournal(FIGHTER_DIR, slug);
}

/** 章のまとまり（chapterJa を持つエントリが新章の頭）。 */
export type JournalChapter = {
  titleJa?: string;
  leadJa?: string;
  entries: JournalEntry[];
};

/** 「いま」ブロックの顔になる声（LP上部に大きく出す1本）。 */
export type JournalHighlight = { entry: JournalEntry; quote: JournalQuote };

/**
 * ローテーションの設計値。
 * 旧実装は「直近の山場（peak）の最多いいね」固定で、peak が手打ちのフラグなので
 * 新しい山場を立てるまで同じ声が何週間も居座った（千賀は6/29、佐々木は7/18で固着・2026-08-08 村山指摘）。
 * 日誌のエントリ自体は記事を書くたびに積まれている＝そこから候補プールを作って日替わりで回す。
 */
const NOW_SCAN_ENTRIES = 12; // 候補を読むエントリ数の上限（これ以上は遡らない）
const NOW_WINDOW_DAYS = 45; // 鮮度の窓＝日誌の最新エントリから何日ぶんを「いま」と見なすか
const NOW_MIN_POOL = 4; // 窓の中が薄い選手（登板間隔が長い投手・年数回のファイター）はここまで窓を広げる
const NOW_PER_ENTRY = 2; // 1試合から採る上限（1試合の話題でローテを埋めない）
const NOW_POOL = 8; // ローテーションの周期（この本数を日替わりで回す）
const NOW_MIN_LEN = 24; // 一言レス（「うおおお」）を大見出しに掲げない
const NOW_MAX_LEN = 160; // 大きな字でファーストビューに収まる長さ
const NOW_MAX_EMOJI = 4; // 絵文字だらけの応援コメント（「🇯🇵🎉ナイスピッチング👏🎊」）は顔にしない

/** 表示に使う本文（ja 優先・無ければ en）＝ PlayerNow / FighterNow の描き方と同じ。 */
function quoteText(quote: JournalQuote): string {
  return (quote.bodyJa ?? '').trim() || (quote.bodyEn ?? '').trim();
}

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{So}\p{Sk}]/gu;

/** 絵文字・空白を除いた実質の文字数（声ピックアップ＝tagHub と同じものさし）。 */
function textLength(s: string): number {
  return s.replace(EMOJI, '').replace(/\s/g, '').length;
}

/** 大きな字で1本だけ掲げるに足る引用か（短すぎ・絵文字だらけを弾く）。 */
function heroWorthy(quote: JournalQuote): boolean {
  const body = quoteText(quote);
  return textLength(body) >= NOW_MIN_LEN && (body.match(EMOJI)?.length ?? 0) <= NOW_MAX_EMOJI;
}

/** 日誌の最新エントリから NOW_WINDOW_DAYS 日ぶんが「いま」の窓（絶対日付でなく日誌内の相対で見る）。 */
function windowStart(latest: string): string {
  return new Date(Date.parse(`${latest}T00:00:00Z`) - NOW_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * JST の暦日を通日（1970-01-01 起点）に。日替わりローテーションの種。
 * SSG なので値が決まるのはビルド時＝stats CI が毎日ビルドを回している前提
 * （期限つき予告 journalNext と同じ前提・同じ壊れ方をする）。
 */
function jstDayIndex(today?: string): number {
  const ymd =
    today ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);
}

/**
 * 「いま」に掲げる候補プール＝直近エントリの“読ませる”引用を質順に NOW_POOL 本。
 * 新しいエントリほど強く加点する＝プールの中身は試合が積まれるたびに勝手に入れ替わる。
 * 山場（peak）は加点するが独占はさせない（固着の原因を断ちつつ、大きな試合の声は上に来る）。
 * isAbout（その選手に言及しているか）を渡すと、その人が主語の声を優先する
 * ＝「{選手名} 海外の反応」で着地した読者が求める声をLPの顔にする。
 */
function nowPool(journal: PlayerJournal, isAbout?: (text: string) => boolean): JournalHighlight[] {
  const withQuotes = journal.entries.filter((e) => e.quotes.length > 0);
  const from = windowStart(withQuotes.at(-1)?.date ?? '');
  const recent = withQuotes.slice(-NOW_SCAN_ENTRIES).reverse(); // 新しい順
  const cands: { hl: JournalHighlight; q: number }[] = [];
  for (const [age, entry] of recent.entries()) {
    // 窓の外まで来ていて、かつ回すのに足りる本数が溜まっていれば打ち切る（古い声を「いま」に出さない）。
    if (entry.date < from && cands.length >= NOW_MIN_POOL) break;
    [...entry.quotes]
      .filter(heroWorthy)
      .sort((a, b) => b.score - a.score)
      .slice(0, NOW_PER_ENTRY)
      .forEach((quote, rank) => {
        const body = quoteText(quote);
        let q = 1 - age / NOW_SCAN_ENTRIES; // 新しいエントリほど上
        if (entry.peak) q += 0.5;
        q -= rank * 0.2; // 同じ試合なら票数の上位から
        if (quote.score <= 0) q -= 0.5; // 票が付いていない声＝ファンの総意とは言えないので顔にしにくくする
        if (textLength(body) <= NOW_MAX_LEN) q += 0.4;
        if (isAbout?.(body)) q += 0.6; // 本人の話をしている声
        cands.push({ hl: { entry, quote }, q });
      });
  }
  return cands
    .sort((a, b) => b.q - a.q)
    .slice(0, NOW_POOL)
    .map((c) => c.hl);
}

/**
 * 「いま」ブロックに掲げるハイライト＝候補プールを **JSTの日付で日替わりに回した1本**。
 * 同じ日は必ず同じ声（ビルドが何度走っても揺れない）、翌日は別の声、新しい試合が積まれれば
 * プールごと新しくなる。候補が作れない日誌（短い引用しかない等）だけ従来の「直近の山場」に退避する。
 */
export function journalNowHighlight(
  journal: PlayerJournal,
  opts?: { isAbout?: (text: string) => boolean; today?: string },
): JournalHighlight | null {
  const pool = nowPool(journal, opts?.isAbout);
  if (pool.length > 0) return pool[jstDayIndex(opts?.today) % pool.length];
  const withQuotes = journal.entries.filter((e) => e.quotes.length > 0);
  const entry = [...withQuotes].reverse().find((e) => e.peak) ?? withQuotes.at(-1);
  if (!entry) return null;
  return { entry, quote: entry.quotes.reduce((a, b) => (b.score > a.score ? b : a)) };
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
