#!/usr/bin/env node
/**
 * Discover カード画像の実寸監査。
 *
 * Google Discover / X summary_large_image は「幅 1200px 以上」の画像を要求する。
 * src/lib/media.ts の ogCover() が記事ごとに選ぶ OGP/Discover 画像を再現し、
 * その実ピクセル幅を測って 1200 未満／不明をあぶり出す。
 *
 * 判定の元ロジック（唯一の正は src/lib/media.ts）:
 *   - media なし          → 競技ストック(?w=1600)        … OK
 *   - kind:"video" + maxres あり → 1280x720               … OK
 *   - kind:"video" + maxres なし → hqdefault 480x360       … ❌（要・別画像/ static og）
 *   - kind:"video" + thumbUrl    → その画像を実測
 *   - kind:"image"               → その画像を実測（ローカル/リモート）
 *
 * 依存ゼロ（PNG/JPEG/GIF/WebP のヘッダを自前で読む）。
 *   使い方: node scripts/check-discover-images.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 日本語を含むパスでも壊れないよう file URL を実パスへデコードする
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const THREADS_DIR = join(ROOT, 'data/threads');
const PUBLIC_DIR = join(ROOT, 'public');
const MIN_WIDTH = 1200;

/** バッファの先頭から画像の実寸を読む（対応形式のみ。未対応は null）。 */
function imageSize(buf) {
  // PNG: 8B シグネチャ + "IHDR" の直後に幅・高さ（BE 32bit）
  if (buf.length >= 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF: オフセット6〜 幅・高さ（LE 16bit）
  if (buf.length >= 10 && (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP: RIFF....WEBP
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fmt = buf.toString('ascii', 12, 16);
    if (fmt === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (fmt === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (fmt === 'VP8X') return { width: ((buf[24] | (buf[25] << 8) | (buf[26] << 16)) & 0xffffff) + 1, height: ((buf[27] | (buf[28] << 8) | (buf[29] << 16)) & 0xffffff) + 1 };
  }
  // JPEG: SOF マーカ（0xC0〜0xCF, ただし C4/C8/CC 除く）を走査
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7) };
      }
      o += 2 + buf.readUInt16BE(o + 2); // 次のセグメントへ
    }
  }
  return null;
}

function youTubeId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

async function fetchBuf(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/** ogCover を再現し、{ url, width, source } を返す。width 不明は null。 */
async function resolveCover(t) {
  const m = t.media;
  if (!m) return { url: '(stock w=1600)', width: 1600, source: 'stock' };

  if (m.kind === 'video') {
    if (!m.thumbUrl) {
      const yt = youTubeId(m.url);
      if (yt) {
        const maxres = `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`;
        if (await headOk(maxres)) return { url: maxres, width: 1280, source: 'yt-maxres' };
        // maxres 不在 → ogCover はストック(1600px)に倒す（hqdefault 480px は使わない）。
        return { url: '(stock w=1600)', width: 1600, source: 'yt-fallback-stock' };
      }
      return { url: '(stock w=1600)', width: 1600, source: 'stock' }; // streamable 等は ogCover でストックに倒れる
    }
  }

  // image 種別、または video+thumbUrl: 実測
  const url = m.kind === 'image' ? m.url : m.thumbUrl;
  try {
    const buf = url.startsWith('/')
      ? await readFile(join(PUBLIC_DIR, url))
      : await fetchBuf(url);
    const dim = imageSize(buf);
    return { url, width: dim?.width ?? null, height: dim?.height, source: url.startsWith('/') ? 'local' : 'remote' };
  } catch (e) {
    return { url, width: null, source: `error:${e.message}` };
  }
}

async function main() {
  const sports = await readdir(THREADS_DIR);
  const rows = [];
  for (const sport of sports) {
    let files;
    try { files = await readdir(join(THREADS_DIR, sport)); } catch { continue; }
    for (const f of files.filter((x) => x.endsWith('.json'))) {
      const t = JSON.parse(await readFile(join(THREADS_DIR, sport, f), 'utf8'));
      const cover = await resolveCover(t);
      const ok = cover.width != null && cover.width >= MIN_WIDTH;
      rows.push({ sport, id: t.id, kind: t.media?.kind ?? 'none', ...cover, ok });
    }
  }

  const bad = rows.filter((r) => !r.ok);
  console.log(`\n監査: ${rows.length} 記事 / Discover基準 幅${MIN_WIDTH}px以上\n`);
  if (bad.length === 0) {
    console.log('✅ 全記事が基準を満たしています。');
  } else {
    console.log(`⚠️  基準未満・不明: ${bad.length} 件\n`);
    for (const r of bad) {
      const w = r.width == null ? '不明' : `${r.width}px`;
      console.log(`  ❌ [${r.sport}] ${r.id}\n     kind=${r.kind} source=${r.source} width=${w}\n     ${r.url}`);
    }
  }
  // 種別ごとの内訳
  const by = {};
  for (const r of rows) by[r.source] = (by[r.source] ?? 0) + 1;
  console.log(`\n内訳: ${Object.entries(by).map(([k, v]) => `${k}=${v}`).join(' / ')}`);
  process.exitCode = bad.length ? 1 : 0;
}

main();
