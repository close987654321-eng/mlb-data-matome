#!/usr/bin/env node
/**
 * 動画記事の JSON に「動画の公開日時（media.publishedAt）と原題（media.videoTitle）」を後追いで書き込む。
 *
 * なぜ必要か:
 *   記事の JSON-LD に VideoObject を出したいが、VideoObject は uploadDate が必須。
 *   これが無いと動画リッチリザルト／Google の動画タブに載れない。本サイトは全492記事のうち
 *   460本（93%）が動画記事なので、ここが最大の未回収だった（2026-07-30 の SEO/AEO 監査）。
 *   値は YouTube Data API の実測値だけを書く＝推測・捏造はしない（CLAUDE.md §4.4）。
 *
 * 仕組み:
 *   videos.list は id をカンマ区切りで最大50件まとめて引ける（1リクエスト=1ユニット）。
 *   459本でも約10リクエスト＝無料枠（1日1万ユニット）に対して無視できるコスト。
 *
 * 使い方:
 *   node scripts/backfill-video-meta.mjs            … 未設定の動画記事を全部埋める
 *   node scripts/backfill-video-meta.mjs --dry-run   … 書き込まず対象と取得結果だけ表示
 *   node scripts/backfill-video-meta.mjs --force     … 既に値がある記事も上書きする
 *
 * 環境変数: YOUTUBE_API_KEY（.env.local でよい）
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const THREADS_DIR = join(ROOT, 'data/threads');
const API_BASE = 'https://www.googleapis.com/youtube/v3';

function loadApiKey() {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  try {
    const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
    const m = env.match(/^YOUTUBE_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* 環境変数のみでもよい */
  }
  return null;
}

/** YouTube の視聴 URL から videoId を取り出す（取れなければ null＝対象外）。 */
function youTubeId(url) {
  const m = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/,
  );
  return m ? m[1] : null;
}

/** data/threads 配下の全記事を { path, id, json } で列挙する。 */
function loadThreads() {
  const out = [];
  for (const sport of readdirSync(THREADS_DIR)) {
    const dir = join(THREADS_DIR, sport);
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      continue; // ディレクトリでないものは飛ばす
    }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const p = join(dir, f);
      out.push({ path: p, id: f.replace(/\.json$/, ''), json: JSON.parse(readFileSync(p, 'utf8')) });
    }
  }
  return out;
}

async function fetchVideoMeta(key, ids) {
  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('id', ids.join(','));
  url.searchParams.set('key', key);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(`YouTube API videos ${res.status}: ${body?.error?.message ?? ''}`);
  const map = new Map();
  for (const v of body.items ?? []) {
    map.set(v.id, { publishedAt: v.snippet.publishedAt, videoTitle: v.snippet.title });
  }
  return map;
}

/**
 * media ブロックに publishedAt / videoTitle を差し込む（フォーマットを壊さないテキスト挿入）。
 * JSON.parse→stringify で書き戻すと既存の1行配列（tags 等）が全部展開されて巨大な差分になるため、
 * "credit" or "thumbUrl" or "url" 行の直後にキーを足す最小編集にする。
 */
function insertIntoMedia(src, publishedAt, videoTitle) {
  const mediaStart = src.indexOf('"media"');
  if (mediaStart < 0) return null;
  // media オブジェクトの終わり（最初の閉じ波括弧）まで
  const open = src.indexOf('{', mediaStart);
  const close = src.indexOf('}', open);
  if (open < 0 || close < 0) return null;
  const block = src.slice(open, close);
  if (/"publishedAt"/.test(block) && /"videoTitle"/.test(block)) return null;
  // ブロック内の最終プロパティ行のインデントを踏襲する
  const lines = block.split('\n');
  const lastProp = [...lines].reverse().find((l) => /"\w+"\s*:/.test(l));
  const indent = lastProp ? (lastProp.match(/^(\s*)/)?.[1] ?? '    ') : '    ';
  const esc = (s) => JSON.stringify(s);
  const add =
    `,\n${indent}"publishedAt": ${esc(publishedAt)}` +
    `,\n${indent}"videoTitle": ${esc(videoTitle)}`;
  // 末尾のカンマ・空白を保ったまま、最後のプロパティの直後に足す
  const trimmedEnd = block.replace(/\s*$/, '');
  return src.slice(0, open) + trimmedEnd + add + '\n' + indent.slice(2) + src.slice(close);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const key = loadApiKey();
  if (!key) {
    console.error('YOUTUBE_API_KEY が無い（.env.local か環境変数に入れる）');
    process.exit(1);
  }

  const threads = loadThreads();
  const targets = threads.filter((t) => {
    const m = t.json.media;
    if (!m || m.kind !== 'video') return false;
    if (!youTubeId(m.url)) return false; // YouTube 以外（Streamable 等）は対象外
    if (!force && m.publishedAt && m.videoTitle) return false;
    return true;
  });
  console.log(
    `動画記事: ${threads.filter((t) => t.json.media?.kind === 'video').length}件 / 対象(未設定): ${targets.length}件`,
  );
  if (!targets.length) return;

  // videoId → 記事（同じ動画を複数記事が参照することもあるので配列）
  const byId = new Map();
  for (const t of targets) {
    const id = youTubeId(t.json.media.url);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(t);
  }
  const ids = [...byId.keys()];
  console.log(`ユニーク動画: ${ids.length}件 → API ${Math.ceil(ids.length / 50)} リクエスト`);

  const meta = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const got = await fetchVideoMeta(key, chunk);
    for (const [k, v] of got) meta.set(k, v);
    console.log(`  取得 ${Math.min(i + 50, ids.length)}/${ids.length}（見つかった: ${got.size}/${chunk.length}）`);
  }

  let written = 0;
  let missing = 0;
  for (const [vid, list] of byId) {
    const m = meta.get(vid);
    if (!m) {
      // 削除・非公開になった動画。捏造せず飛ばす（VideoObject もその記事には出ない）。
      missing++;
      for (const t of list) console.log(`  [skip] 動画が取れない ${vid} <- ${t.id}`);
      continue;
    }
    for (const t of list) {
      if (dryRun) {
        console.log(`  [dry] ${t.id} <- ${m.publishedAt} / ${m.videoTitle.slice(0, 50)}`);
        written++;
        continue;
      }
      const src = readFileSync(t.path, 'utf8');
      const next = insertIntoMedia(src, m.publishedAt, m.videoTitle);
      if (!next) {
        console.log(`  [skip] media ブロックに挿せない ${t.id}`);
        continue;
      }
      JSON.parse(next); // 壊れた JSON を書かない安全弁
      writeFileSync(t.path, next);
      written++;
    }
  }
  console.log(`\n${dryRun ? '[dry-run] ' : ''}書き込み: ${written}件 / 取得できず: ${missing}件`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
