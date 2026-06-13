#!/usr/bin/env node
/**
 * YouTube Data API v3 でコメント・動画情報を取得する（matome 記事の主ソース）。
 *
 * 認証: 環境変数 YOUTUBE_API_KEY（Google Cloud Console で無料発行・承認制なし）。
 *       .env.local に YOUTUBE_API_KEY=... を書けば自動で読む。
 *
 * 使い方:
 *   node scripts/fetch-youtube.mjs comments <動画URLまたはID> [件数=60]
 *     → 動画情報＋人気順コメントを JSON で標準出力（matome スキルがこれを読む）
 *   node scripts/fetch-youtube.mjs latest <チャンネルID> [本数=10]
 *     → チャンネルの新着動画一覧（ネタ探し用。コメント数つき）
 *
 * 注意:
 *   - 取得したコメントは記事に「抜粋＋翻訳＋元動画への送客」で使う（全文転載しない）。
 *   - API データの長期キャッシュは YouTube API 利用規約の制限あり。生 JSON はコミットせず
 *     _local/queue/ に置く（gitignore 済み）。記事 JSON に残すのは抜粋のみ。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

/** .env.local から YOUTUBE_API_KEY を拾う（dotenv 依存を増やさない簡易版） */
function loadApiKey() {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  try {
    const env = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const m = env.match(/^YOUTUBE_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* .env.local が無ければ環境変数のみ */
  }
  return null;
}

/** 動画 URL（youtu.be / watch?v= / shorts/）または生 ID から videoId を取り出す */
function parseVideoId(input) {
  if (/^[\w-]{11}$/.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0];
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/);
    if (m) return m[1];
  } catch {
    /* URL でなければ下の throw へ */
  }
  throw new Error(`動画 URL/ID を解釈できない: ${input}`);
}

async function api(key, endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('key', key);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message ?? res.statusText;
    throw new Error(`YouTube API ${endpoint} ${res.status}: ${msg}`);
  }
  return body;
}

/** 動画のタイトル・チャンネル・統計を 1 本分 */
async function fetchVideo(key, videoId) {
  const data = await api(key, 'videos', { part: 'snippet,statistics', id: videoId });
  const v = data.items?.[0];
  if (!v) throw new Error(`動画が見つからない: ${videoId}`);
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    viewCount: Number(v.statistics.viewCount ?? 0),
    likeCount: Number(v.statistics.likeCount ?? 0),
    commentCount: Number(v.statistics.commentCount ?? 0),
  };
}

/** 人気順コメント（トップレベル＋返信少々）。max 件まで複数ページたどる */
async function fetchComments(key, videoId, max) {
  const comments = [];
  let pageToken;
  while (comments.length < max) {
    const data = await api(key, 'commentThreads', {
      part: 'snippet,replies',
      videoId,
      order: 'relevance', // 人気順（likeCount と返信を加味した YouTube 側の並び）
      maxResults: Math.min(100, max - comments.length),
      textFormat: 'plainText',
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of data.items ?? []) {
      const top = item.snippet.topLevelComment.snippet;
      comments.push({
        author: top.authorDisplayName,
        likeCount: top.likeCount,
        text: top.textDisplay,
        publishedAt: top.publishedAt,
        replyCount: item.snippet.totalReplyCount,
      });
      // 返信は会話の流れ（matome R1）作りに使えるので、likes がある先頭数件だけ添える
      for (const r of (item.replies?.comments ?? []).slice(0, 3)) {
        const s = r.snippet;
        if (s.likeCount > 0) {
          comments.push({
            author: s.authorDisplayName,
            likeCount: s.likeCount,
            text: s.textDisplay,
            publishedAt: s.publishedAt,
            replyTo: top.authorDisplayName,
          });
        }
      }
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return comments.slice(0, max);
}

/** チャンネルの新着動画（ネタ探し用） */
async function fetchLatest(key, channelId, count) {
  const ch = await api(key, 'channels', { part: 'contentDetails', id: channelId });
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`チャンネルが見つからない: ${channelId}`);
  const pl = await api(key, 'playlistItems', {
    part: 'contentDetails',
    playlistId: uploads,
    maxResults: Math.min(50, count),
  });
  const ids = (pl.items ?? []).map((i) => i.contentDetails.videoId).join(',');
  const vids = await api(key, 'videos', { part: 'snippet,statistics', id: ids });
  return (vids.items ?? []).map((v) => ({
    videoId: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: v.snippet.title,
    publishedAt: v.snippet.publishedAt,
    viewCount: Number(v.statistics.viewCount ?? 0),
    commentCount: Number(v.statistics.commentCount ?? 0),
  }));
}

async function main() {
  const [cmd, target, n] = process.argv.slice(2);
  const key = loadApiKey();
  if (!key) {
    console.error('YOUTUBE_API_KEY が未設定。 .env.local に YOUTUBE_API_KEY=... を書く。');
    process.exit(1);
  }
  if (cmd === 'comments' && target) {
    const videoId = parseVideoId(target);
    const video = await fetchVideo(key, videoId);
    const comments = await fetchComments(key, videoId, Number(n ?? 60));
    console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), video, comments }, null, 2));
  } else if (cmd === 'latest' && target) {
    const videos = await fetchLatest(key, target, Number(n ?? 10));
    console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), videos }, null, 2));
  } else {
    console.error(
      '使い方:\n  node scripts/fetch-youtube.mjs comments <動画URL|ID> [件数=60]\n  node scripts/fetch-youtube.mjs latest <チャンネルID> [本数=10]',
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
