import { bdAuditionVideos } from './bdAuditions';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * BreakingDown イベントページの読み物「オーディション実況」＝ data/bd-story/{event}.json が正。
 *
 * なぜ要るか（2026-09-06 村山さん合意）:
 * BD のイベントページ /breakingdown21 は公開10日で サイト5番目に稼ぐ面（28日で56クリック・
 * 1,163表示・平均8.4位）になったが、来ているクエリは「対戦カード／チケット／会場」の3つだけで、
 * ページの中身は事実の箇条書きしか無かった。一方でリール（BdReel）が持つコメントは
 * /bd-reel.json に逃がしてあり **HTML に1件も載っていない**＝検索資産としてゼロ。
 * そこで「動画1本＝1章」の読み物を本文に置き、止まって読ませる面を作る。
 *
 * ⚠️ **取得と掲載を分ける**（CLAUDE.md §4.1 / §4.4 の規律）:
 * - 取得は全件（`node scripts/fetch-bd-auditions.mjs --comments-full 21`）だが、生の取得結果は
 *   `_local/bd-auditions/full/` に置き **コミットしない**（YouTube API のデータ保存制限）。
 * - `data/bd-story/{event}.json` に入るのは、その母数から人が選び抜いた **抜粋だけ**。
 *   BD21 は 17,416 件から 40 件前後＝0.2%。全文転載にしない。
 * - コメント本文（text）は**一字も変えない機械コピー**。訳や要約はしない＝捏造が構造的に起きない
 *   （game-voices / bd-audition-voices と同じ規律）。
 * - 地の文（ledeJa / noteJa）は**人が書く**＝クラウド無人ルーティンでは書かない（matome 手順5c）。
 *
 * 数値（再生数・コメント数）と動画タイトルは **ここに持たない**。videoId で
 * data/bd-auditions.json（CI が自動更新）を引く＝古い数字が焼き付かないため。
 * 動画が消えて bd-auditions.json から落ちた章は、そのまま出さない（§4.5 の経年劣化対策）。
 */

/** コメントの見せ方。単発（top）と、返信つきのやり取り（thread）の2種類だけ。 */
export type BdBeatKind = 'top' | 'thread';

export type BdReply = {
  author: string;
  likeCount: number;
  /** 返信の原文（一字も変えない） */
  text: string;
};

export type BdBeat = {
  kind: BdBeatKind;
  author: string;
  likeCount: number;
  /** コメント原文（一字も変えない） */
  text: string;
  /** その動画で本人が実際に付けた返信の総数（YouTube の実測値） */
  replyCount?: number;
  replies?: BdReply[];
  /**
   * 発言者の立場（「選手本人」など）。コメント欄に当事者が降りてきた回だけ付ける＝
   * 「ここでしか読めない」の核。裏取りできる場合（本人チャンネル名義）のみ。
   */
  roleJa?: string;
};

export type BdChapter = {
  /** data/bd-auditions.json と突き合わせるキー */
  videoId: string;
  /** 第何回のオーディションか（vol.1〜） */
  vol: number;
  /** 中の人の見立て（3行程度・人が書く） */
  noteJa: string;
  /** この回で動いた対戦（動画タイトルが報じている範囲＝一次情報のみ。推測で書かない） */
  matchJa?: string;
  beats: BdBeat[];
};

export type BdStoryFile = {
  event: number;
  /** コメントを抜き出した日（JST） */
  asOf: string;
  /** 中の人の導入（300字程度・人が書く） */
  ledeJa: string;
  chapters: BdChapter[];
};

/** ページに渡す形（章に実測値と動画タイトルを合流させたもの）。 */
export type BdStoryChapter = BdChapter & {
  title: string;
  publishedAt: string;
  viewCount: number;
  commentCount: number;
};

export type BdStory = {
  event: number;
  asOf: string;
  ledeJa: string;
  chapters: BdStoryChapter[];
  /** この大会のオーディション合計（章の実測値の和＝表示用） */
  totals: { videos: number; views: number; comments: number };
  /** 実際に載せている抜粋の件数（返信を含む）＝「17,416件から◯件」の分子 */
  quoted: number;
};

/**
 * 大会番号から読み物を組み立てる。ファイルが無ければ null（＝セクションごと出さない）。
 * BD22 以降は data/bd-story/22.json を足すだけで同じ型が立つ。
 */
export async function bdStory(eventNo: number | null): Promise<BdStory | null> {
  if (!eventNo) return null;
  const file = path.join(process.cwd(), 'data', 'bd-story', `${eventNo}.json`);
  let raw: BdStoryFile;
  try {
    raw = JSON.parse(await fs.readFile(file, 'utf8')) as BdStoryFile;
  } catch {
    return null; // まだ書いていない大会＝読み物は出さない
  }

  const videos = new Map((await bdAuditionVideos()).map((v) => [v.videoId, v]));
  const chapters: BdStoryChapter[] = [];
  for (const ch of raw.chapters) {
    const v = videos.get(ch.videoId);
    // 動画が消えた（＝スナップショットから落ちた）章は出さない。引用だけが残ると
    // 「出典の無いコメント転載」になるため（§4.5）。
    if (!v) continue;
    chapters.push({
      ...ch,
      title: v.title,
      publishedAt: v.publishedAt.slice(0, 10),
      viewCount: v.viewCount,
      commentCount: v.commentCount,
    });
  }
  if (chapters.length === 0) return null;

  return {
    event: raw.event,
    asOf: raw.asOf,
    ledeJa: raw.ledeJa,
    chapters,
    totals: {
      videos: chapters.length,
      views: chapters.reduce((s, c) => s + c.viewCount, 0),
      comments: chapters.reduce((s, c) => s + c.commentCount, 0),
    },
    quoted: chapters.reduce(
      (s, c) => s + c.beats.reduce((n, b) => n + 1 + (b.replies?.length ?? 0), 0),
      0,
    ),
  };
}
