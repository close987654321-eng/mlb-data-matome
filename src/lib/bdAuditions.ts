import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * /breakingdown-audition「オーディション全史」のデータ読み込みと集計。
 *
 * データ源は scripts/fetch-bd-auditions.mjs が YouTube Data API から機械的に書き出す2ファイル:
 * - data/bd-auditions.json … 朝倉未来チャンネルの全オーディション動画の数値スナップショット
 * - data/bd-audition-voices.json … 各大会の代表動画の人気コメント（逐語・機械抽出）
 *
 * posture は他の静的データと同じ: **サイト本体は API を叩かない**（読むのはコミット済み JSON だけ）。
 * コメント本文は人も AI も触らない機械コピー＝捏造が構造的に起きない（game-voices と同じ規律）。
 */

export type BdAuditionVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  /** 大会番号（タイトルからの機械割当＋初期の無番号回はスクリプトの OVERRIDES で人力確定） */
  event: number;
  viewCount: number;
  commentCount: number;
  likeCount: number;
};

export type BdVoice = {
  event: number;
  videoId: string;
  videoTitle: string;
  author: string;
  likeCount: number;
  publishedAt: string;
  /** コメント原文（一字も変えない） */
  text: string;
};

/** 大会ごとの集計行（グラフ・表の単位）。 */
export type BdEventSummary = {
  event: number;
  videoCount: number;
  views: number;
  comments: number;
  likes: number;
  /** コメント密度（コメント数÷再生数）。「語りたくなる度」の指標 */
  density: number;
  /** オーディション動画の投稿期間（大会開催日ではない） */
  firstAt: string;
  lastAt: string;
};

type StatsFile = { fetchedAt: string; channelId: string; videos: BdAuditionVideo[] };
type VoicesFile = { fetchedAt: string; voices: BdVoice[] };

const STATS_FILE = path.join(process.cwd(), 'data', 'bd-auditions.json');
const VOICES_FILE = path.join(process.cwd(), 'data', 'bd-audition-voices.json');

let statsCache: StatsFile | null = null;
let voicesCache: VoicesFile | null = null;

async function readStats(): Promise<StatsFile> {
  if (!statsCache) statsCache = JSON.parse(await fs.readFile(STATS_FILE, 'utf8')) as StatsFile;
  return statsCache;
}

async function readVoices(): Promise<VoicesFile> {
  if (!voicesCache) voicesCache = JSON.parse(await fs.readFile(VOICES_FILE, 'utf8')) as VoicesFile;
  return voicesCache;
}

/** 数値スナップショットの取得日（JST・ページに「◯◯時点」として必ず出す）。 */
export async function bdAuditionsFetchedAt(): Promise<string> {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(
    new Date((await readStats()).fetchedAt),
  );
}

export async function bdAuditionVideos(): Promise<BdAuditionVideo[]> {
  return (await readStats()).videos;
}

/** 大会別の集計（大会番号昇順）。 */
export async function bdEventSummaries(): Promise<BdEventSummary[]> {
  const byEvent = new Map<number, BdEventSummary>();
  for (const v of await bdAuditionVideos()) {
    const cur = byEvent.get(v.event) ?? {
      event: v.event,
      videoCount: 0,
      views: 0,
      comments: 0,
      likes: 0,
      density: 0,
      firstAt: v.publishedAt,
      lastAt: v.publishedAt,
    };
    cur.videoCount += 1;
    cur.views += v.viewCount;
    cur.comments += v.commentCount;
    cur.likes += v.likeCount;
    if (v.publishedAt < cur.firstAt) cur.firstAt = v.publishedAt;
    if (v.publishedAt > cur.lastAt) cur.lastAt = v.publishedAt;
    byEvent.set(v.event, cur);
  }
  return [...byEvent.values()]
    .map((s) => ({ ...s, density: s.views > 0 ? s.comments / s.views : 0 }))
    .sort((a, b) => a.event - b.event);
}

/** 大会ごとの人気コメント（大会番号昇順・同一大会内はいいね数降順）。 */
export async function bdVoicesByEvent(): Promise<Map<number, BdVoice[]>> {
  const map = new Map<number, BdVoice[]>();
  for (const v of (await readVoices()).voices) {
    const list = map.get(v.event) ?? [];
    list.push(v);
    map.set(v.event, list);
  }
  for (const list of map.values()) list.sort((a, b) => b.likeCount - a.likeCount);
  return map;
}

/** 全体サマリ（メタ description・導入文用の実数）。 */
export async function bdTotals(): Promise<{ videos: number; views: number; comments: number; events: number }> {
  const videos = await bdAuditionVideos();
  return {
    videos: videos.length,
    views: videos.reduce((sum, v) => sum + v.viewCount, 0),
    comments: videos.reduce((sum, v) => sum + v.commentCount, 0),
    events: new Set(videos.map((v) => v.event)).size,
  };
}
