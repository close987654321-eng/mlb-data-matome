import { bdAuditionVideos, bdAuditionsFetchedAt, bdEventSummaries, type BdVoice } from './bdAuditions';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * BreakingDown オーディションの「縦スワイプで次々見る」リール（マラソン）の素材づくり。
 *
 * 4号店（affiliate-factory）のサンプルマラソンで実証済みの機構をこのサイトへ移植したもの。
 * 向こうの設計判断（site/DESIGN.md §3）のうち、ここでも効くものを持ち込んでいる:
 * - **1コマ＝動画＋タイトル＋数字＋現地コメント＋CTAの全部**。まるごと一緒に動く（動画だけ動かすと繋ぎが見える）
 * - **次のコマを先読みして下に置く**＝払った瞬間に絵が出る
 * - **差し込みカード**を数コマごとに入れて、列の操縦（並び替え）と数字の言語化をする
 * - **差し込みにサイト内リンクを置かない**＝同じタブで開くとマラソンがそこで終わる（実測）。出口は終端カードだけ
 * - **数字は実測値だけを埋める**。値が取れない差し込みは出さない（穴の空いた文を出さない）
 *
 * 向こうと違う点＝**プレーヤーの上に受け皿を敷かない**。こちらは lite-youtube のファサード
 * （タップで初めて iframe を読む）なので、再生前のコマは全面が指を拾える。再生後は動画の面だけ
 * YouTube に譲り、残りの面（タイトル・コメント・CTA）で送る＝4号店が踏んだ「シークを潰す」事故を
 * 構造的に避ける。
 *
 * データは既存の静的JSON（data/bd-auditions.json / bd-audition-voices.json）だけを読む。
 * サイト本体は API を叩かない posture は他と同じ。
 */

/** リールの1コマ（動画）。キーは短くする＝94本ぶんが RSC ペイロードに乗るため。 */
export type BdReelVideo = {
  /** videoId */
  i: string;
  /** 動画タイトル（原文のまま） */
  t: string;
  /** 大会番号 */
  e: number;
  /** 公開日（YYYY-MM-DD） */
  d: string;
  /** 再生数 */
  v: number;
  /** コメント数 */
  c: number;
  /** 人気コメント（逐語・機械コピー。author / text / likes） */
  q: { a: string; t: string; l: number }[];
};

/** 差し込みカード（読み物）。本文の数字はすべてビルド時に実測値で埋める。 */
export type BdReelNote = { id: string; textJa: string };

/**
 * ページに埋める軽い側（入口タイルと差し込みカードの文面）。
 * ⚠️ 94本ぶんの動画・コメントはここに入れない＝開かない人に運ばせない（下の BdReelStock）。
 */
export type BdReelSummary = {
  /** この大会の番号（先頭に置くオーディション。無ければ null＝歴代だけの列になる） */
  event: number | null;
  /** この大会のオーディション本数（入口タイルの文言に使う） */
  eventVideos: number;
  /** 数値スナップショットの取得日（JST・「◯◯時点」の表示に使う） */
  asOf: string;
  /** 在庫JSONのキャッシュ破り（スナップショットの取得時刻） */
  ver: string;
  /** 全体の実数（入口タイルの在庫表示） */
  totals: { videos: number; views: number; events: number };
  notes: BdReelNote[];
};

/** 開いたときに初めて読む側＝列の在庫（/bd-reel.json）。 */
export type BdReelStock = { videos: BdReelVideo[] };

const VOICES_FILE = path.join(process.cwd(), 'data', 'bd-audition-voices.json');

async function voicesByVideo(): Promise<Map<string, BdVoice[]>> {
  const raw = JSON.parse(await fs.readFile(VOICES_FILE, 'utf8')) as { voices: BdVoice[] };
  const map = new Map<string, BdVoice[]>();
  for (const v of raw.voices) {
    const list = map.get(v.videoId) ?? [];
    list.push(v);
    map.set(v.videoId, list);
  }
  for (const list of map.values()) list.sort((a, b) => b.likeCount - a.likeCount);
  return map;
}

function manJa(n: number): string {
  // /breakingdown-audition と同じ桁の丸め方（億／万）。ページ間で数字の見え方を揃える。
  if (n >= 100_000_000) return `${(Math.round(n / 10_000_000) / 10).toLocaleString('ja-JP')}億`;
  return n >= 10000 ? `${Math.round(n / 10000).toLocaleString('ja-JP')}万` : n.toLocaleString('ja-JP');
}

/**
 * 差し込みカードの文面。
 * ⚠️ 体験談・感想は書かない（「すげーよ」は書かない）＝データから直接言えることだけ。
 * ⚠️ 値が取れないカードは配列から落とす＝「—回」のような穴を出さない（4号店のトークン規律）。
 */
function buildNotes(
  videos: { event: number; viewCount: number; commentCount: number }[],
  summaries: { event: number; views: number; comments: number; density: number }[],
  topVoice: BdVoice | null,
  eventNo: number | null,
): BdReelNote[] {
  const notes: BdReelNote[] = [];
  const totalViews = videos.reduce((s, v) => s + v.viewCount, 0);
  const totalComments = videos.reduce((s, v) => s + v.commentCount, 0);

  if (totalViews > 0 && summaries.length > 0) {
    notes.push({
      id: 'total',
      textJa: `ここまでのオーディション${videos.length}本で、通算${manJa(totalViews)}回再生されている。本戦の試合ではなく、出場をかけた面接だけでこの数字。`,
    });
  }

  const peak = [...summaries].sort((a, b) => b.views - a.views)[0];
  if (peak) {
    notes.push({
      id: 'peak',
      textJa: `1大会あたりの再生がいちばん多いのはBD${peak.event}で${manJa(peak.views)}回。いまはそこまでは伸びない。では何が増えているか、次のカードで。`,
    });
  }

  // コメント密度＝「観る祭り」から「語る祭り」へ、というこのデータ最大の発見（/breakingdown-audition 由来）。
  const withDensity = summaries.filter((s) => s.density > 0);
  const early = withDensity.slice(0, 5);
  const late = withDensity.slice(-2);
  if (early.length > 0 && late.length > 0) {
    const avg = (list: typeof withDensity) => list.reduce((s, x) => s + x.density, 0) / list.length;
    const earlyPct = (avg(early) * 100).toFixed(2);
    const latePct = (avg(late) * 100).toFixed(2);
    if (Number(latePct) > Number(earlyPct)) {
      notes.push({
        id: 'density',
        textJa: `コメント密度（コメント数÷再生数）は初期のBD${early[0].event}〜BD${early[early.length - 1].event}が平均${earlyPct}%、直近のBD${late[0].event}・BD${late[1].event}が平均${latePct}%。再生は落ちてもコメントは減っていない＝観る祭りから語る祭りへ変わっている。`,
      });
    }
  }

  if (topVoice && topVoice.likeCount > 0) {
    notes.push({
      id: 'toplike',
      textJa: `いちばんいいねが付いたコメントは${topVoice.likeCount.toLocaleString('ja-JP')}いいね（BD${topVoice.event}の回）。この列にも入っている。`,
    });
  }

  if (totalComments > 0) {
    notes.push({
      id: 'comments',
      textJa: `オーディション動画に付いたコメントは通算${manJa(totalComments)}件。1本あたり平均${Math.round(totalComments / videos.length).toLocaleString('ja-JP')}件が書き込まれている。`,
    });
  }

  if (eventNo) {
    const cur = summaries.find((s) => s.event === eventNo);
    const prev = summaries.find((s) => s.event === eventNo - 1);
    if (cur && prev && cur.views > 0 && prev.views > 0) {
      notes.push({
        id: 'now',
        textJa: `今大会（BD${eventNo}）のオーディションはここまで${manJa(cur.views)}回。前回BD${prev.event}の同じ枠は最終的に${manJa(prev.views)}回だった。`,
      });
    }
  }

  return notes;
}

/** 列の在庫（/bd-reel.json が返す本体）。動画とその動画に付いたコメントだけ。 */
export async function bdReelStock(): Promise<BdReelStock> {
  const [videos, voices] = await Promise.all([bdAuditionVideos(), voicesByVideo()]);
  const items: BdReelVideo[] = videos.map((v) => ({
    i: v.videoId,
    t: v.title,
    e: v.event,
    d: v.publishedAt.slice(0, 10),
    v: v.viewCount,
    c: v.commentCount,
    // 引用は逐語のみ（機械コピー）。その動画に付いたコメントだけを乗せる＝
    // 同じ大会の別動画のコメントを流用しない（出所がズレると引用でなくなる）。
    q: (voices.get(v.videoId) ?? []).slice(0, 2).map((q) => ({ a: q.author, t: q.text, l: q.likeCount })),
  }));
  return { videos: items };
}

/**
 * 入口タイル・差し込みカードの素材（ページに埋める軽い側）。
 * @param eventNo この大会の番号（BD21 なら 21）。先頭に置くオーディションの選定と、
 *                「今大会はここまで◯回」の差し込みに使う。
 */
export async function bdReelSummary(eventNo: number | null): Promise<BdReelSummary> {
  const [videos, summaries, voices, asOf, raw] = await Promise.all([
    bdAuditionVideos(),
    bdEventSummaries(),
    voicesByVideo(),
    bdAuditionsFetchedAt(),
    fs.readFile(path.join(process.cwd(), 'data', 'bd-auditions.json'), 'utf8'),
  ]);
  const allVoices = [...voices.values()].flat();
  const topVoice = allVoices.length > 0 ? allVoices.reduce((a, b) => (b.likeCount > a.likeCount ? b : a)) : null;
  return {
    event: eventNo,
    eventVideos: eventNo ? videos.filter((v) => v.event === eventNo).length : 0,
    asOf,
    ver: (JSON.parse(raw) as { fetchedAt: string }).fetchedAt,
    totals: {
      videos: videos.length,
      views: videos.reduce((s, v) => s + v.viewCount, 0),
      events: new Set(videos.map((v) => v.event)).size,
    },
    notes: buildNotes(videos, summaries, topVoice, eventNo),
  };
}

/** イベントの slug から大会番号を読む（'breakingdown21' → 21）。数字が無ければ null。 */
export function bdEventNoFromSlug(slug: string): number | null {
  const m = /(\d+)$/.exec(slug);
  return m ? Number(m[1]) : null;
}
