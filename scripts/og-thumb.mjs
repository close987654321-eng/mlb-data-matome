#!/usr/bin/env node
/**
 * og-thumb.mjs — maxresdefault が無い YouTube 動画記事に、1200px 以上の OG/Discover 画像を自前で用意する。
 *
 * 背景: Google Discover / X summary_large_image は幅1200px以上の画像を要求する。動画記事の OG 画像は
 * src/lib/media.ts の ogCover() が maxresdefault(1280x720) を使うが、MLB公式でも稀に maxres が未生成
 * （HEAD が 404）のことがあり、そのときストック写真（球場）に倒れて「OGだけ球場」になる
 * （ページ本体は hqdefault で実サムネ表示なのに OG/共有プレビューだけ球場、という分かりにくい症状）。
 *
 * このスクリプトは maxres が無い動画について、公式サムネ(sddefault 640x480／無ければ hqdefault)の
 * 中央 16:9 を切り出して 1280x720 に整え、public/media/{id}-og.jpg として置き、media.thumbUrl で明示する。
 * ＝「実際の試合サムネ」かつ「Discover 1200px 基準クリア」を両立させる。
 *
 * YouTube の sddefault/hqdefault は 16:9 動画を 4:3 に letterbox（上下に黒帯）したもの。中央の 16:9 を
 * 切り出す前提なので、対象は 16:9 の公式ハイライト（MLB / RIZIN 等）＝当サイトの動画記事すべてに合う。
 *
 * 依存: macOS の sips（画像の crop/resize）。編集時に手元で走らせる運用（サイト本体/Vercel は叩かない）。
 *
 * 使い方:
 *   node scripts/og-thumb.mjs <thread-id|path>   # 1記事（例: 2026-06-23-dodgers-vs-twins）
 *   node scripts/og-thumb.mjs --all              # 全動画記事を走査して「maxres無し＆未対応」を修正
 *   node scripts/og-thumb.mjs --all --dry        # 変更せず対象だけ報告（おすすめの下見）
 *   node scripts/og-thumb.mjs <id> --force       # thumbUrl 既設でも作り直す
 */
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const THREADS_DIR = join(ROOT, 'data/threads');
const MEDIA_DIR = join(ROOT, 'public/media');

// src/lib/media.ts と同じ正規表現（唯一の正はあちら）。
function youTubeId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

async function headOk(url) {
  try {
    return (await fetch(url, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function sips(file, args) {
  await execFileP('sips', [...args, file]);
}

async function dims(file) {
  const { stdout } = await execFileP('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
  return {
    w: Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0),
    h: Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0),
  };
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// 公式サムネ(4:3 letterbox)の中央 16:9 を切り出して 1280x720 に拡大する。
// 上下の黒帯を除いた「実フレーム」だけを残すのが狙い。
async function makeOg(srcUrl, destPath) {
  await download(srcUrl, destPath);
  const { w } = await dims(destPath);
  const cropH = Math.round((w * 9) / 16); // 16:9 の中央帯（640→360）。元が既に 16:9 なら実質 no-op
  await sips(destPath, ['-c', String(cropH), String(w)]); // 中央クロップ（sips は 高さ→幅 の順）
  await sips(destPath, ['-z', '720', '1280']); //            1280x720 へ拡大（同じく 高さ→幅）
}

async function fixThread(path, { dry, force }) {
  const t = JSON.parse(await readFile(path, 'utf8'));
  const m = t.media;
  if (!m || m.kind !== 'video') return { id: t.id, status: 'skip:not-video' };
  if (m.thumbUrl && !force) return { id: t.id, status: 'skip:has-thumb' };
  const yt = youTubeId(m.url);
  if (!yt) return { id: t.id, status: 'skip:not-youtube' };
  // maxres があるなら ogCover が 1280px をそのまま使う＝ローカル生成は不要。
  if (await headOk(`https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`))
    return { id: t.id, status: 'skip:maxres-ok' };

  // maxres 無し → 公式サムネ(大きい順)から自前 OG を作る。
  let src = null;
  let srcName = null;
  for (const name of ['sddefault', 'hqdefault']) {
    const u = `https://i.ytimg.com/vi/${yt}/${name}.jpg`;
    if (await headOk(u)) {
      src = u;
      srcName = name;
      break;
    }
  }
  if (!src) return { id: t.id, status: 'fail:no-thumb-source' };

  const file = `${t.id}-og.jpg`;
  if (dry) return { id: t.id, status: `would-fix(${srcName})`, file };

  await makeOg(src, join(MEDIA_DIR, file));
  // media.url の直後に thumbUrl を挿入してキー順を保つ（手編集時の体裁に合わせる）。
  const rebuilt = {};
  for (const [k, v] of Object.entries(m)) {
    rebuilt[k] = v;
    if (k === 'url') rebuilt.thumbUrl = `/media/${file}`;
  }
  t.media = rebuilt;
  await writeFile(path, JSON.stringify(t, null, 2) + '\n');
  return { id: t.id, status: 'fixed', file };
}

async function resolveTargets(arg) {
  if (arg === '--all') {
    const out = [];
    for (const sport of await readdir(THREADS_DIR)) {
      let files;
      try {
        files = await readdir(join(THREADS_DIR, sport));
      } catch {
        continue;
      }
      for (const f of files.filter((x) => x.endsWith('.json'))) out.push(join(THREADS_DIR, sport, f));
    }
    return out;
  }
  if (arg.endsWith('.json')) return [arg.startsWith('/') ? arg : join(ROOT, arg)];
  for (const sport of await readdir(THREADS_DIR)) {
    const p = join(THREADS_DIR, sport, `${arg}.json`);
    if (await exists(p)) return [p];
  }
  throw new Error(`thread が見つからない: ${arg}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const force = args.includes('--force');
  const all = args.includes('--all');
  const target = args.find((a) => !a.startsWith('--'));
  if (!target && !all) {
    console.error('使い方: node scripts/og-thumb.mjs <id|path|--all> [--dry] [--force]');
    process.exit(2);
  }
  // sips（画像処理）の存在確認。dry は画像を触らないので不要。
  if (!dry) {
    try {
      await execFileP('which', ['sips']);
    } catch {
      console.error('sips が見つかりません（macOS 専用）。画像の crop/resize に必要です。');
      process.exit(2);
    }
  }

  const paths = await resolveTargets(target ?? '--all');
  const results = [];
  for (const p of paths) results.push(await fixThread(p, { dry, force }));

  const fixed = results.filter((r) => r.status === 'fixed' || r.status.startsWith('would-fix'));
  const failed = results.filter((r) => r.status.startsWith('fail'));
  console.log(`\n対象 ${paths.length} / ${dry ? '修正予定' : '修正'} ${fixed.length} / 失敗 ${failed.length}\n`);
  for (const r of fixed) console.log(`  ${dry ? '◻' : '✅'} ${r.id} ${r.status} → /media/${r.file}`);
  for (const r of failed) console.log(`  ❌ ${r.id} ${r.status}`);
  const by = {};
  for (const r of results) {
    const k = r.status.split(/[ (]/)[0];
    by[k] = (by[k] ?? 0) + 1;
  }
  console.log(`\n内訳: ${Object.entries(by).map(([k, v]) => `${k}=${v}`).join(' / ')}`);
}

main();
