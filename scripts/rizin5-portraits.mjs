#!/usr/bin/env node
/**
 * 超RIZIN.5 ハブ（/rizin5）の選手ポートレートを「1枚の組写真」に見えるまで揃えて
 * public/media/rizin5/{slug}.jpg に書き出す。
 *
 *   node scripts/rizin5-portraits.mjs            # 全員ぶん生成
 *   node scripts/rizin5-portraits.mjs keramov    # slug 指定で1枚だけ
 *
 * ⚠️ なぜ加工が要るか（2026-08-04）:
 * 素材はすべて Wikimedia Commons の CC 画像で、撮影者も年も場所もバラバラ＝入場シーン・
 * 遠景のTV画面・喫茶店の動画キャプチャが1行に並んで「統一感がない」状態だった。
 * 写真を差し替えるだけでは解決しない（そもそも代わりの CC 画像が存在しない選手が多い）ので、
 * ここで3点を機械的に揃える:
 *   1. 顔の位置と大きさ  … macOS Vision で実測した顔ボックス（下の face）を基準に正方形を切る
 *   2. 明るさとコントラスト … グレースケール化して平均輝度・分散を目標値へ線形変換
 *   3. 出力サイズ        … 512×512 固定
 * グレースケールはサイトの規律（モダンミニマル無彩色）にも合う＝赤い国旗も青いリングも
 * 同じトーンに落ちるので、素材の出自の差がいちばん目立たなくなる。
 *
 * 顔ボックスの測り方（素材を差し替えたら必ず測り直す）:
 *   swift scripts/face-box.swift <画像パス...>
 *
 * 素材の追加ルールは CLAUDE.md §4.5 と rizin5.ts の冒頭コメントのとおり＝
 * Commons の CC 画像だけ。放送画面・公式サイトからの転載は絶対にしない。
 * クレジット（creditJa / href）は src/lib/rizin5.ts 側が正で、この表とセットで更新する。
 */
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** 出力の一辺（px）。表示は max-w-[220px] なので 2倍強あれば足りる。 */
const OUT = 512;
/** 顔ボックスの高さが出力の何割を占めるか＝「寄り」の目標値。 */
const FACE_RATIO = 0.4;
/** 顔の中心を上から何割の位置に置くか＝バストアップの定番位置。 */
const FACE_Y = 0.42;
/**
 * 元画像から切り出す最小の一辺（px）。これ以上寄ると解像度が破綻するので、
 * 顔が小さく写っている素材（500px の入場写真など）は寄りを諦めて引きのまま使う。
 */
const MIN_CROP = 200;
/** グレースケール後に揃える平均輝度と標準偏差（0-255）。 */
const TARGET_MEAN = 116;
const TARGET_SD = 54;

/**
 * face = macOS Vision（scripts/face-box.swift）で実測した顔ボックス。
 * cx / cy は画像全体を 1 とした顔の中心、h は顔の高さの割合。
 */
const SOURCES = [
  {
    slug: 'shaydullaev',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Razhabali_Shaidulloev.png',
    face: { cx: 0.54, cy: 0.214, h: 0.16 },
  },
  {
    slug: 'mikuru-asakura',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/%E6%9C%9D%E5%80%89%E6%9C%AA%E6%9D%A5_%E5%85%A5%E5%A0%B4.png',
    face: { cx: 0.534, cy: 0.161, h: 0.14 },
  },
  {
    // 2011年のジム写真（私服・眼鏡）から2013年 ONE FC の試合前カットへ差し替え。
    // 他の8枚が全部リング上の写真なので、1枚だけ日常スナップだと並べたとき浮く。
    slug: 'shinya-aoki',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/ONE_Fighting_Championship_2013_Singapore_03.IMG_6775_%288623910640%29.jpg',
    face: { cx: 0.51, cy: 0.38, h: 0.124 },
  },
  {
    slug: 'satoshi-souza',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/36/%E3%83%9B%E3%83%99%E3%83%AB%E3%83%88%E3%83%BB%E3%82%B5%E3%83%88%E3%82%B7%E3%83%BB%E3%82%BD%E3%82%A6%E3%82%B6.jpg',
    face: { cx: 0.588, cy: 0.308, h: 0.177 },
  },
  {
    slug: 'dautbek',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Karshyga_Dautbek.png',
    face: { cx: 0.406, cy: 0.567, h: 0.507 },
  },
  {
    // 従来は 294×420 の (cropped) 版を使っていて拡大でぼけていた。同じ写真の 500×500 原版に差し替え。
    slug: 'ren-hiramoto',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/%E5%B9%B3%E6%9C%AC%E8%93%AE_%E8%B6%85RIZIN3.png',
    face: { cx: 0.443, cy: 0.203, h: 0.158 },
  },
  {
    slug: 'keramov',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/9f/Vugar_Karamov.png',
    face: { cx: 0.543, cy: 0.171, h: 0.112 },
  },
  {
    slug: 'yutaka-saito',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/53/%E6%96%8E%E8%97%A4%E8%A3%95.jpg',
    face: { cx: 0.444, cy: 0.246, h: 0.122 },
  },
  {
    slug: 'donmai-kawabata',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/80/Nomura-Dojo-10th--Judo--2024-09-07_002.jpg',
    face: { cx: 0.518, cy: 0.422, h: 0.2 },
  },
];

const UA = 'matome-mlb-kaigai/1.0 (https://matome-mlb-kaigai.jp) portrait-normalizer';

async function download(url, cacheDir) {
  const file = path.join(cacheDir, path.basename(decodeURIComponent(url)));
  try {
    return await fs.readFile(file);
  } catch {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(file, buf);
    return buf;
  }
}

/**
 * 顔ボックスから正方形の切り出し範囲を決める。
 *
 * 元画像からはみ出す範囲は切らない（＝はみ出しぶんを合成で埋めない）。ぼかし背景で
 * パディングする案も試したが、シャープな被写体との境目が直線の継ぎ目として見えてしまい、
 * 揃えるどころか一枚だけ不自然になった（2026-08-04・ダウトベックで実測）。
 * すでに顔で埋まっている素材は寄りを揃えきれないが、継ぎ目が出るよりはるかにマシ。
 */
function cropBox(width, height, face) {
  const faceH = face.h * height;
  const ideal = faceH / FACE_RATIO;
  // 寄りすぎ（解像度破綻）と引きすぎ（元画像より大きい正方形）の両方を止める。
  const size = Math.round(Math.min(width, height, Math.max(MIN_CROP, ideal)));
  const clamp = (v, max) => Math.min(Math.max(0, Math.round(v)), max - size);
  return {
    size,
    left: clamp(face.cx * width - size / 2, width),
    top: clamp(face.cy * height - size * FACE_Y, height),
  };
}

async function render(src, box) {
  const flat = await sharp(src)
    .extract({ left: box.left, top: box.top, width: box.size, height: box.size })
    .resize(OUT, OUT)
    .grayscale()
    .toBuffer();

  // 明るさ・コントラストを目標値へ寄せる（out = a*in + b）。素材ごとの露出差がここで消える。
  const { channels } = await sharp(flat).stats();
  const { mean, stdev } = channels[0];
  const a = Math.min(1.8, Math.max(0.7, TARGET_SD / Math.max(1, stdev)));
  const b = TARGET_MEAN - a * mean;

  return sharp(flat)
    .linear(a, b)
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 84, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targets = only.length ? SOURCES.filter((s) => only.includes(s.slug)) : SOURCES;
  if (!targets.length) {
    console.error(`slug が見つからない: ${only.join(', ')}`);
    console.error(`使えるのは: ${SOURCES.map((s) => s.slug).join(', ')}`);
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'public', 'media', 'rizin5');
  const cacheDir = path.join(process.cwd(), 'node_modules', '.cache', 'rizin5-portraits');
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(cacheDir, { recursive: true });

  for (const s of targets) {
    const src = await download(s.url, cacheDir);
    const meta = await sharp(src).metadata();
    const box = cropBox(meta.width, meta.height, s.face);
    const out = await render(src, box);
    await fs.writeFile(path.join(outDir, `${s.slug}.jpg`), out);
    const ratio = ((s.face.h * meta.height) / box.size).toFixed(2);
    console.log(
      `${s.slug.padEnd(16)} ${meta.width}x${meta.height} → 切り出し ${box.size}px（顔比 ${ratio}）  ${(out.length / 1024).toFixed(0)}KB`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
