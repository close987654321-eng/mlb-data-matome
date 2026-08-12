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
 *   2. 明るさとコントラスト … 平均輝度・分散を目標値へ線形変換（素材ごとの露出差を消す）
 *   3. 出力サイズ        … 512×512 固定
 *
 * カラーで出す（2026-08-12 村山指示・既定）:
 * 当初はグレースケールで出していた（サイトの無彩色規律に合う＋素材の出自差がいちばん目立たない）。
 * ただし興行ハブは「対戦カードとして見せる」面＝顔が売り物なので、彩度を捨てる代償のほうが大きい
 * と判断して既定をカラーへ変更した。出自差は次の2点で抑える:
 *   - 輝度の正規化はグレースケール時代と同じ式のまま（露出差＝いちばん目立つ差はここで消える）
 *   - 彩度を目標値へ寄せる（TARGET_SAT）＝色被りした素材と極彩色の素材を同じ濃さに揃える
 * `--mono` で従来のグレースケール出力に戻せる（記事サムネ等、無彩色で使いたい場面のため）。
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
/** 揃える平均輝度と標準偏差（0-255）。 */
const TARGET_MEAN = 116;
const TARGET_SD = 54;
/**
 * 揃える平均彩度（0-255・HSV の S）。カラー出力のときだけ使う。
 * 低めに置くのは、素材の色被り（青いリング照明・赤い国旗）を落ち着かせて
 * 9枚を「同じ組写真」に見せるため。上げすぎると1枚だけ極彩色になって行が壊れる。
 */
const TARGET_SAT = 74;
/** 彩度補正の効かせすぎ防止（modulate の倍率レンジ）。 */
const SAT_RANGE = [0.65, 1.5];

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

/**
 * 平均彩度（HSV の S・0-255）を実測する。sharp の stats() は S を返さないので、
 * 小さく潰した生ピクセルから直接測る（64×64 で十分＝彩度は面の平均値なので解像度が要らない）。
 */
async function meanSaturation(buf) {
  const { data, info } = await sharp(buf)
    .resize(64, 64, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  const px = info.width * info.height;
  for (let i = 0; i < px; i++) {
    const o = i * info.channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // HSV の S。真っ黒（max=0）は色が無いので 0 扱い。
    sum += max === 0 ? 0 : ((max - min) / max) * 255;
  }
  return sum / px;
}

async function render(src, box, { mono }) {
  let flat = sharp(src)
    .extract({ left: box.left, top: box.top, width: box.size, height: box.size })
    .resize(OUT, OUT);
  if (mono) flat = flat.grayscale();
  const cropped = await flat.toBuffer();

  // 明るさ・コントラストを目標値へ寄せる（out = a*in + b）。素材ごとの露出差がここで消える。
  // カラーのときは輝度（ITU-R BT.601 の重み）で測って RGB 全チャンネルに同じ係数を掛ける＝
  // 色相を動かさずに露出だけ揃える。
  const { channels } = await sharp(cropped).stats();
  const w = mono ? [1, 0, 0] : [0.299, 0.587, 0.114];
  const mean = channels.reduce((s, c, i) => s + (w[i] ?? 0) * c.mean, 0);
  const stdev = channels.reduce((s, c, i) => s + (w[i] ?? 0) * c.stdev, 0);
  const a = Math.min(1.8, Math.max(0.7, TARGET_SD / Math.max(1, stdev)));
  const b = TARGET_MEAN - a * mean;

  let img = sharp(cropped).linear(a, b);

  if (!mono) {
    // 彩度を揃える。露出補正後に測る（linear で彩度も動くため、補正前の値だと外す）。
    const sat = await meanSaturation(await img.toBuffer());
    const ratio = Math.min(SAT_RANGE[1], Math.max(SAT_RANGE[0], TARGET_SAT / Math.max(1, sat)));
    img = sharp(await img.toBuffer()).modulate({ saturation: ratio });
  }

  // シャープは「拡大した素材ほど弱く」。500px 原版から 200px を切って 512 へ引き伸ばす選手
  // （平本・ケラモフ・斎藤）に固定値 0.6 を掛けると、輪郭が段になって色が塗り絵のように割れる
  // ＝グレースケール時代は目立たなかったがカラーで一気に露呈した（2026-08-12 実測）。
  const upscale = OUT / box.size;
  const sigma = upscale > 1 ? Math.max(0.2, 0.6 / upscale) : 0.6;

  return img
    .sharpen({ sigma })
    .jpeg({ quality: 86, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function main() {
  const argv = process.argv.slice(2);
  const mono = argv.includes('--mono');
  const only = argv.filter((a) => !a.startsWith('-'));
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
    const out = await render(src, box, { mono });
    await fs.writeFile(path.join(outDir, `${s.slug}.jpg`), out);
    const ratio = ((s.face.h * meta.height) / box.size).toFixed(2);
    console.log(
      `${s.slug.padEnd(16)} ${meta.width}x${meta.height} → 切り出し ${box.size}px（顔比 ${ratio}）  ${(out.length / 1024).toFixed(0)}KB${mono ? '  mono' : ''}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
