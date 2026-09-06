#!/usr/bin/env node
/**
 * BreakingDown オーディション動画の全量データ取得（/breakingdown-audition「オーディション全史」の燃料）。
 *
 * やること:
 *  1. 朝倉未来チャンネルの全アップロードを走査し、タイトルが「BreakingDown × オーディション」の動画を抽出
 *  2. 大会番号をタイトルから機械割当（無番号の初期動画は OVERRIDES で人が確定＝推測で埋めない）
 *  3. 再生数・コメント数・高評価数を videos API で取得 → data/bd-auditions.json（数値スナップショット）
 *  4. --voices: 大会ごとに最多コメント動画の人気コメント上位を機械コピーで抽出
 *     → data/bd-audition-voices.json（逐語・著者・実測いいね数。人もAIも本文を触らない＝捏造が構造的に起きない）
 *     生の取得結果は _local/bd-auditions/ に置く（コミットしない＝YouTube API 規約のデータ保存制限）。
 *
 * posture は MLB stats と同じ: サイト本体は API を叩かない（読むのは静的JSONだけ）。
 * 記事・ページに残すのは数値と抜粋引用のみ。動画は公式埋め込みで送客する。
 *
 * 使い方:
 *   node scripts/fetch-bd-auditions.mjs           … 動画一覧＋統計を更新
 *   node scripts/fetch-bd-auditions.mjs --voices  … 上に加えて大会代表動画の人気コメントも更新
 *   node scripts/fetch-bd-auditions.mjs --voices-all … 全動画から2件ずつ（縦スワイプのリールの燃料）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_STATS = join(ROOT, 'data/bd-auditions.json');
const OUT_VOICES = join(ROOT, 'data/bd-audition-voices.json');
const RAW_DIR = join(ROOT, '_local/bd-auditions');

/** 朝倉未来チャンネル（本編オーディションの掲載元）。公式BreakingDown chの未公開/二次面接は対象外＝跳ねる本編だけを測る。 */
const CHANNEL_ID = 'UCJZVj2iBrdvbNc416i0V-UA';

/**
 * タイトルに大会番号が無い初期動画の人力確定表（videoId → 大会番号）。
 * 機械で推測しない＝ここに無い無番号動画は unassigned として出力し、人が確認してから足す。
 */
const OVERRIDES = {
  // 「BreakingDownのオーディションで喧嘩勃発した」前中後編（2022-03-11〜16投稿）＝BD4。
  // 裏取り: BD4 開催は 2022-03-21（efight・ゴング格闘技のイベントページ）で、この3本は直前の
  // オーディション配信。チャンネル上で「オーディション」を冠する最初期の回。
  'vdz-IniNeKE': 4, // 前編
  htw6jm2yxhM: 4, // 中編
  qRVYKGDEpwI: 4, // 後編
};

/** オーディション企画ではない誤ヒットの除外表（videoId）。理由をコメントで残す。 */
const EXCLUDE = new Set([]);

function loadApiKey() {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  try {
    const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
    const m = env.match(/^YOUTUBE_API_KEY=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

async function api(key, endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${await res.text()}`);
  return res.json();
}

/** チャンネルの全アップロードを列挙（playlistItems のページング。1ページ=1ユニットで最安）。 */
async function listAllUploads(key) {
  const ch = await api(key, 'channels', { part: 'contentDetails', id: CHANNEL_ID });
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`チャンネルが見つからない: ${CHANNEL_ID}`);
  const all = [];
  let pageToken;
  do {
    const page = await api(key, 'playlistItems', {
      part: 'snippet',
      playlistId: uploads,
      maxResults: 50,
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of page.items ?? []) {
      all.push({
        videoId: item.snippet.resourceId?.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return all;
}

/** 「BreakingDown × オーディション」動画か（表記ゆれ: BreakingDown / Breaking Down / ブレイキングダウン）。 */
function isAuditionTitle(title) {
  return /オーディション/.test(title) && /break\s*ing\s*down|ブレイキングダウン/i.test(title);
}

/** タイトルから大会番号を機械割当。無番号は OVERRIDES → 無ければ null（推測しない）。 */
function eventOf(video) {
  // 全角数字の表記ゆれ（「Breaking Down１６」実在）を半角に正規化してから拾う。
  const title = video.title.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  const m = title.match(/break\s*ing\s*down\s*(\d+)/i) ?? title.match(/ブレイキングダウン\s*(\d+)/);
  if (m) return Number(m[1]);
  return OVERRIDES[video.videoId] ?? null;
}

/** 統計をまとめて取得（videos API・50本/コール）。 */
async function fetchStats(key, videoIds) {
  const out = new Map();
  for (let i = 0; i < videoIds.length; i += 50) {
    const data = await api(key, 'videos', {
      part: 'statistics,snippet',
      id: videoIds.slice(i, i + 50).join(','),
    });
    for (const v of data.items ?? []) {
      out.set(v.id, {
        viewCount: Number(v.statistics.viewCount ?? 0),
        commentCount: Number(v.statistics.commentCount ?? 0),
        likeCount: Number(v.statistics.likeCount ?? 0),
      });
    }
  }
  return out;
}

/**
 * 大会代表動画（最多コメント）の人気コメント上位を機械抽出。
 * 除外は機械条件のみ: URLつき（公式のチケット宣伝固定コメ等）・チャンネル主・8文字未満。
 * 本文は textOriginal を一字も変えずに写す。
 */
async function fetchVoices(key, video, take = 2) {
  const data = await api(key, 'commentThreads', {
    part: 'snippet',
    videoId: video.videoId,
    maxResults: 50,
    order: 'relevance',
    textFormat: 'plainText',
  });
  const comments = (data.items ?? []).map((it) => {
    const c = it.snippet.topLevelComment.snippet;
    return {
      author: c.authorDisplayName,
      authorChannelId: c.authorChannelId?.value ?? null,
      likeCount: Number(c.likeCount ?? 0),
      publishedAt: c.publishedAt,
      text: c.textOriginal,
    };
  });
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(
    join(RAW_DIR, `${video.videoId}.json`),
    JSON.stringify({ fetchedAt: new Date().toISOString(), video, comments }, null, 2),
  );
  return comments
    .filter((c) => !/https?:\/\//.test(c.text))
    .filter((c) => c.authorChannelId !== CHANNEL_ID)
    .filter((c) => [...c.text].length >= 8)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, take)
    .map(({ authorChannelId, ...rest }) => rest);
}

async function main() {
  const key = loadApiKey();
  if (!key) {
    console.error('YOUTUBE_API_KEY が未設定。 .env.local に YOUTUBE_API_KEY=... を書く。');
    process.exit(1);
  }
  // --voices     … 大会代表動画（最多コメント）だけ＝全史ページの引用に必要な最小限
  // --voices-all … 全オーディション動画から2件ずつ＝縦スワイプのリール（BDイベントページ）の燃料。
  //                1動画あたりの上限（2件）は変えない＝コメントDBにしない posture は据え置き。
  const wantVoicesAll = process.argv.includes('--voices-all');
  const wantVoices = wantVoicesAll || process.argv.includes('--voices');

  const uploads = await listAllUploads(key);
  const auditions = uploads.filter((v) => isAuditionTitle(v.title) && !EXCLUDE.has(v.videoId));
  console.error(`アップロード ${uploads.length} 本 → オーディション該当 ${auditions.length} 本`);

  const stats = await fetchStats(key, auditions.map((v) => v.videoId));
  const videos = auditions
    .map((v) => ({ ...v, event: eventOf(v), ...(stats.get(v.videoId) ?? {}) }))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const unassigned = videos.filter((v) => v.event === null);

  const payload = {
    fetchedAt: new Date().toISOString(),
    channelId: CHANNEL_ID,
    videos: videos.filter((v) => v.event !== null),
    // 番号を機械で確定できなかった動画。ページには出ない＝人が OVERRIDES で確定してから再実行する。
    unassigned,
  };
  writeFileSync(OUT_STATS, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(`書き出し: ${OUT_STATS}（割当 ${payload.videos.length} 本 / 未割当 ${unassigned.length} 本）`);
  for (const v of unassigned) console.error(`  未割当: ${v.publishedAt.slice(0, 10)} ${v.title}`);

  if (wantVoices) {
    let targets;
    if (wantVoicesAll) {
      // 全動画。リールは1動画1コマなので、代表動画だけだと89コマ中17コマにしか声が乗らない。
      targets = [...payload.videos].sort(
        (a, b) => a.event - b.event || a.publishedAt.localeCompare(b.publishedAt),
      );
    } else {
      const byEvent = new Map();
      for (const v of payload.videos) {
        if (!byEvent.has(v.event) || v.commentCount > byEvent.get(v.event).commentCount) byEvent.set(v.event, v);
      }
      targets = [...byEvent.values()].sort((a, b) => a.event - b.event);
    }
    const voices = [];
    for (const video of targets) {
      const event = video.event;
      // コメント欄が閉じている動画は commentThreads が 403 を返す＝そこだけ飛ばして続ける
      // （1本のために全体を落とさない。取れなかった動画には声が乗らないだけ）。
      let picks = [];
      try {
        picks = await fetchVoices(key, video);
      } catch (err) {
        console.error(`  voices skip ${video.videoId}: ${err.message ?? err}`);
        continue;
      }
      for (const p of picks) {
        voices.push({ event, videoId: video.videoId, videoTitle: video.title, ...p });
      }
      console.error(`voices BD${event}: ${picks.length} 件（${video.title.slice(0, 40)}）`);
    }
    writeFileSync(OUT_VOICES, `${JSON.stringify({ fetchedAt: new Date().toISOString(), voices }, null, 2)}\n`);
    console.error(`書き出し: ${OUT_VOICES}（${voices.length} 件）`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
