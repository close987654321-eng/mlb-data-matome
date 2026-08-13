#!/usr/bin/env node
/**
 * 公開済み記事が参照する YouTube 動画の「死活検査」。
 *
 * なぜ要るか: 記事は公開時点では検証済みでも、元動画は後から投稿者削除・アカウントBAN・
 * 権利者削除で消える（反応切り抜き系チャンネルは特に消えやすい）。消えると
 *   - media.url が死ぬ → 記事のヒーロー動画が再生できない＝ページの主役が欠ける
 *   - sourceUrl が死ぬ → 引用の出典（送客先）が消える＝「出典の無いコメント転載」に見える
 * どちらも AdSense の「有用性の低いコンテンツ」判定に直結するので、定期的に掃除する。
 * build-gate.sh の各チェックは新規・既存を問わず「データの整合」を見るが、外部で起きる動画の消失は
 * 見ようがない（API を叩かないと分からない）。既存ストックの経年劣化はこのスクリプトが担当する
 * （2026-08-13 の初回検査で 2号店が 594本中 13本＝約2%、当店が 526本中 2本）。
 *
 * 使い方:
 *   node scripts/check-dead-videos.mjs            # 検査してレポート（終了コード 0）
 *   node scripts/check-dead-videos.mjs --strict   # 死んだ動画があれば終了コード 1
 *   node scripts/check-dead-videos.mjs --json     # 機械可読（レポートを JSON で）
 *
 * 検出後の手当て（2026-08-13 に確立した運用）:
 *   A. media.url も死んだ（＝埋め込みも出典も無い）→ 記事ごと撤去し、data/deleted-ids.json に
 *      積んで next.config.mjs が選手ページへ 301（404 で被リンク・索引を捨てない）。
 *      観測日誌（data/player-journal・data/fighter-journal）が threadId でその記事を指していたら
 *      threadId/sport を外して sourceRemovedNote に理由を書く＝日誌の記述は残し導線だけ切る
 *      （check-journal-quotes.mjs は threadId を持つエントリだけ照合するので、これで整合する）。
 *      **デプロイ後に転送先が両ロケールで 200 か必ず実測する**＝エンティティ面はそのロケールに記事が
 *      1本以上ある対象しか生成されないことがあり、撤去した記事がその面で最後の1本だと転送先が 404 に
 *      なる（2号店で実際に踏んだ）。その場合は deleted-ids の player を {"ja":"..."} のように
 *      ロケール別にしてカテゴリ一覧へ逃がす。
 *   B. sourceUrl だけ死んだ（media は生きた別動画を指している）→ 記事は残し、記事JSONに
 *      "sourceRemoved": true を立てる（記事末の送客リンクが注記に変わる＝読者を404へ送らない）。
 *
 * YOUTUBE_API_KEY は .env.local か環境変数（クラウドはシークレット）。無ければ何もせず終了する
 * ＝キー欠如を「全部生きている」と誤読させない。
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREADS_DIR = path.join(ROOT, 'data', 'threads');
const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const AS_JSON = argv.includes('--json');

function apiKey() {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  try {
    const m = readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^YOUTUBE_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* .env.local が無ければ環境変数のみ */
  }
  return null;
}

/** YouTube の各種 URL 形から動画IDを取り出す（YouTube 以外の media は null＝検査対象外） */
function videoId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

/** data/threads 配下の全記事を読む */
function loadThreads() {
  const out = [];
  for (const sport of readdirSync(THREADS_DIR)) {
    const dir = path.join(THREADS_DIR, sport);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const file = path.join(dir, f);
      out.push({ file: path.relative(ROOT, file), thread: JSON.parse(readFileSync(file, 'utf8')) });
    }
  }
  return out;
}

async function main() {
  const key = apiKey();
  if (!key) {
    console.error('YOUTUBE_API_KEY が無いので検査できない（.env.local か環境変数に設定する）');
    process.exit(2);
  }

  const threads = loadThreads();
  /** @type {Map<string, {file:string, field:string, id:string, direction:string}[]>} */
  const refs = new Map();
  for (const { file, thread } of threads) {
    // media（hero 埋め込み）／gallery／sourceUrl（出典＝送客先）を全部見る。
    // sourceRemoved を立てて手当て済みの記事は sourceUrl の死亡を再報告しない（既知として扱う）。
    const targets = [
      ['media.url', thread.media?.url],
      ...(thread.gallery ?? []).map((g, i) => [`gallery[${i}].url`, g?.url]),
      ...(thread.sourceRemoved ? [] : [['sourceUrl', thread.sourceUrl]]),
    ];
    for (const [field, url] of targets) {
      const vid = videoId(url);
      if (!vid) continue;
      if (!refs.has(vid)) refs.set(vid, []);
      refs.get(vid).push({ file, field, id: thread.id, direction: thread.direction ?? 'outbound' });
    }
  }

  const ids = [...refs.keys()];
  const alive = new Set();
  // videos.list は id を最大50件まとめて引ける（1リクエスト=1クォータ）。返ってこない id は
  // 削除・非公開・権利者削除のいずれか＝読者から見れば等しく「観られない」。
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=status&id=${chunk.join(',')}&key=${key}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (json.error) {
      console.error(`YouTube API エラー: ${json.error.message ?? res.status}`);
      process.exit(2);
    }
    for (const it of json.items ?? []) alive.add(it.id);
  }

  const dead = ids
    .filter((v) => !alive.has(v))
    .map((v) => ({ videoId: v, url: `https://www.youtube.com/watch?v=${v}`, refs: refs.get(v) }));

  if (AS_JSON) {
    console.log(JSON.stringify({ checked: ids.length, articles: threads.length, dead }, null, 2));
  } else {
    console.log(`記事 ${threads.length}本 / ユニーク動画 ${ids.length}本 を検査`);
    if (!dead.length) {
      console.log('死んでいる動画は無し');
    } else {
      console.log(`\n死亡: ${dead.length}本`);
      for (const d of dead) {
        // media.url が死んだものは記事ごと撤去（手当てA）、sourceUrl だけなら sourceRemoved（手当てB）。
        const embedDead = d.refs.some((r) => r.field.startsWith('media') || r.field.startsWith('gallery'));
        console.log(`\n${d.url}  → 手当て ${embedDead ? 'A（記事を撤去）' : 'B（sourceRemoved を立てる）'}`);
        for (const r of d.refs) console.log(`  - ${r.file} [${r.field}] (${r.direction})`);
      }
      console.log('\n手当ての手順はこのファイル冒頭のコメントを参照。');
    }
  }

  if (STRICT && dead.length) process.exit(1);
}

await main();
