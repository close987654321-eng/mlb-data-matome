/**
 * X 投稿用「マイルストーン記念カード」PNG 生成（x-post / x-share スキルの弾）。
 *
 *   node scripts/milestone-card.mjs
 *
 * 実写のホームラン写真を主役に据えた高級トレカ調の記念カード（1080×1350・X 最適の縦 4:5）を
 * _local/x-images/ に書き出す。デュアルエラ版＝左にエンゼルス時代（赤・バットフリップ・反転で内向き）、
 * 右にドジャース時代（灰・背番号17）の大谷を同スケールで外側へ配置し、中央の空きに 171 / 129 / 300 の
 * 3数字だけを金・赤・青のメタリックで置く（写真の顔・バット・背番号にはテキストを重ねない）。数字は多層
 * シャドウで立体化し、金のダイヤで区切って"箔押し"の質感に。写真は sharp でシネマ・グレーディング＋中央側
 * フェザー。数値は捏造せず MLB公式 Stats API で裏取り済み（大谷=660271：2018〜2026 の年度別HR合計＝
 * エンゼルス171／ドジャース129／通算300 を実測）。⚠️ 実写は中継/報道写真の引用＝X 配信用。_local は非コミット。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// ── 配色（メタリックは 明→影→明 のバンドで箔の光沢）──────────────────────────
const CREAM = '#FBF9F4';
const GOLD = '#EBC873';
const GOLD_SOFT = 'rgba(235,200,115,0.6)';
const GOLD_GRAD = 'linear-gradient(178deg, #FFF7DC 0%, #F4DB8C 17%, #E4B855 39%, #C08E2E 51%, #9C6E1B 59%, #E1BE68 78%, #FCEFC2 100%)';
const RED_GRAD  = 'linear-gradient(178deg, #FFE2D8 0%, #FB8B78 24%, #E23B2C 50%, #A5160F 61%, #D8564A 80%, #FFD2C8 100%)';
const BLUE_GRAD = 'linear-gradient(178deg, #E7F1FF 0%, #90BCFA 24%, #337CE1 50%, #113A82 61%, #5C95EB 80%, #DEEAFF 100%)';

const W = 1080, H = 1350, PAD = 56;

// 数字は実測裏取り済みのみ。左＝エンゼルス赤（顔の見えるバットフリップ）／右＝ドジャース灰（背番号17）。
const PHOTO_ANGELS = path.join('_local', 'x-images', 'スクリーンショット 2026-07-08 16.47.25.png');
const PHOTO_DODGERS = path.join('_local', 'x-images', 'スクリーンショット 2026-07-08 16.44.55.png');

// 写真をシネマ調にグレーディングし、中央側の縁をアルファ・グラデで透過＝土台へ溶かす。flip=左右反転。
async function prepareFig(file, dispW, dispH, fadeSide, mod, lin, flip = false) {
  try {
    let pipe = sharp(file)
      .resize(dispW, dispH, { fit: 'cover', position: 'top' })
      .modulate(mod).linear(lin[0], lin[1]).sharpen();
    if (flip) pipe = pipe.flop();
    const graded = await pipe.ensureAlpha().png().toBuffer();
    const stops = fadeSide === 'right'
      ? '<stop offset="0%" stop-color="#fff" stop-opacity="1"/><stop offset="57%" stop-color="#fff" stop-opacity="1"/><stop offset="80%" stop-color="#fff" stop-opacity="0"/>'
      : '<stop offset="1%" stop-color="#fff" stop-opacity="0"/><stop offset="38%" stop-color="#fff" stop-opacity="1"/><stop offset="100%" stop-color="#fff" stop-opacity="1"/>';
    const feather = Buffer.from(
      `<svg width="${dispW}" height="${dispH}" xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/></svg>`);
    const out = await sharp(graded).composite([{ input: feather, blend: 'dest-in' }]).png().toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch (e) { console.error('写真加工に失敗:', file, e.message); return null; }
}

const clip = (grad, extra) => ({ display: 'flex', backgroundImage: grad, backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', ...extra });

// 多層シャドウ付きメタリック数字（clip文字に textShadow が効かないので、暗いコピーを重ねて立体を作る）。
function numShadow(text, grad, size, mr = 0) {
  const ls = size > 250 ? -6 : -1;
  const base = { fontFamily: 'Anton', fontSize: size, lineHeight: 0.84, letterSpacing: ls };
  const s1 = Math.max(2, Math.round(size * 0.016)), s2 = Math.max(4, Math.round(size * 0.038));
  return h('div', { style: { position: 'relative', display: 'flex', marginRight: mr } }, [
    h('div', { key: 's2', style: { position: 'absolute', left: 0, top: s2, display: 'flex', ...base, color: 'rgba(0,0,0,0.3)' } }, text),
    h('div', { key: 's1', style: { position: 'absolute', left: 0, top: s1, display: 'flex', ...base, color: 'rgba(0,0,0,0.5)' } }, text),
    h('div', { key: 'fg', style: clip(grad, base) }, text),
  ]);
}

async function main() {
  // 2人の person が同スケールに見えるよう、余白の多いエンゼルス側を少しだけ拡大（元比 エ0.677 / ド0.580）。
  const dH = H + 20, aH = Math.round(dH * 1.09);
  const dW = Math.round(dH * 0.580), aW = Math.round(aH * 0.677);
  const [angels, dodgers] = await Promise.all([
    prepareFig(PHOTO_ANGELS, aW, aH, 'right', { brightness: 1.08, saturation: 1.12 }, [1.14, -10], true),
    prepareFig(PHOTO_DODGERS, dW, dH, 'left', { brightness: 1.04, saturation: 0.92 }, [1.12, -12]),
  ]);

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [n7, n9, an] = await Promise.all([
    fs.readFile(path.join(dir, 'noto-jp-700.ttf')),
    fs.readFile(path.join(dir, 'noto-jp-900.ttf')),
    fs.readFile(path.join(dir, 'anton.ttf')),
  ]);

  const fill = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' };
  const tick = (box, border) => h('div', { style: { position: 'absolute', width: 46, height: 46, ...box, ...border } });
  const diamond = (sz, box, bg) => h('div', { style: { position: 'absolute', width: sz, height: sz, background: bg || GOLD, transform: 'rotate(45deg)', ...box } });

  const el = h('div', { style: { position: 'relative', display: 'flex', width: '100%', height: '100%', fontFamily: 'NotoJP', background: 'linear-gradient(180deg, #0a2138 0%, #081a30 55%, #04101f 100%)' } }, [
    // 2人の大谷（同スケール・外側へ・中央側フェザー）。エンゼルスは反転で内向き。
    angels ? h('img', { key: 'ang', src: angels, width: aW, height: aH, style: { position: 'absolute', left: -330, bottom: -8, objectFit: 'cover' } }) : null,
    dodgers ? h('img', { key: 'dod', src: dodgers, width: dW, height: dH, style: { position: 'absolute', right: -210, bottom: 0, objectFit: 'cover' } }) : null,
    // 左右のカラーグロー（赤×青・上下）＋中央の金グロー
    h('div', { key: 'gr', style: { ...fill, backgroundImage: 'radial-gradient(50% 58% at 2% 40%, rgba(232,50,44,0.6), rgba(232,50,44,0) 66%)' } }),
    h('div', { key: 'gb', style: { ...fill, backgroundImage: 'radial-gradient(50% 58% at 98% 40%, rgba(46,126,240,0.6), rgba(46,126,240,0) 66%)' } }),
    h('div', { key: 'gr2', style: { ...fill, backgroundImage: 'radial-gradient(40% 34% at 10% 88%, rgba(232,50,44,0.32), rgba(232,50,44,0) 66%)' } }),
    h('div', { key: 'gb2', style: { ...fill, backgroundImage: 'radial-gradient(40% 34% at 90% 88%, rgba(46,126,240,0.32), rgba(46,126,240,0) 66%)' } }),
    h('div', { key: 'gg', style: { ...fill, backgroundImage: 'radial-gradient(34% 30% at 50% 60%, rgba(235,200,115,0.3), rgba(235,200,115,0) 70%)' } }),
    // 中央のタイプゾーンを立てる縦スクリム（数字を写真から浮かせて"置いた"感を出す・顔には掛からない）
    h('div', { key: 'cz', style: { ...fill, backgroundImage: 'radial-gradient(31% 48% at 50% 52%, rgba(4,12,26,0.78) 0%, rgba(4,12,26,0.42) 52%, rgba(4,12,26,0) 82%)' } }),
    // 下スクリム（フッター透かしの可読性）
    h('div', { key: 'sb', style: { ...fill, backgroundImage: 'linear-gradient(to top, rgba(4,12,26,0.9) 4%, rgba(4,12,26,0) 16%)' } }),
    // ビネット
    h('div', { key: 'vig', style: { ...fill, backgroundImage: 'radial-gradient(130% 104% at 50% 44%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.5) 100%)' } }),
    // 金の二重枠＋四隅の鉤＋上下のダイヤ
    h('div', { key: 'f1', style: { position: 'absolute', top: 22, left: 22, width: W - 44, height: H - 44, display: 'flex', border: `1px solid ${GOLD_SOFT}`, borderRadius: 9 } }),
    h('div', { key: 'f2', style: { position: 'absolute', top: 30, left: 30, width: W - 60, height: H - 60, display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6 } }),
    tick({ top: 34, left: 34 }, { borderTop: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` }),
    tick({ top: 34, right: 34 }, { borderTop: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` }),
    tick({ bottom: 34, left: 34 }, { borderBottom: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` }),
    tick({ bottom: 34, right: 34 }, { borderBottom: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` }),
    diamond(18, { top: 15, left: W / 2 - 9 }),
    diamond(18, { bottom: 15, left: W / 2 - 9 }),

    // ── ネームプレート：SHOHEI OHTANI（金箔ワードマーク・細罫＋ダイヤで挟む）──
    h('div', { key: 'name', style: { position: 'absolute', top: 150, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, [
      h('div', { key: 'l1', style: { display: 'flex', width: 58, height: 2, background: GOLD_SOFT } }),
      diamond(11, { position: 'relative', marginLeft: 16, marginRight: 20 }),
      h('div', { key: 'nm', style: clip(GOLD_GRAD, { fontFamily: 'Anton', fontSize: 46, letterSpacing: 11 }) }, 'SHOHEI OHTANI'),
      diamond(11, { position: 'relative', marginLeft: 20, marginRight: 16 }),
      h('div', { key: 'l2', style: { display: 'flex', width: 58, height: 2, background: GOLD_SOFT } }),
    ]),

    // ── メイン：171（赤）◆ 129（青）を中央上に・多層シャドウで立体 ──
    h('div', { key: 'row', style: { position: 'absolute', top: 322, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, [
      numShadow('171', RED_GRAD, 168, 0),
      h('div', { key: 'sep', style: { position: 'relative', display: 'flex', width: 30, height: 30, marginLeft: 44, marginRight: 44 } }, [
        diamond(30, { top: 0, left: 0 }),
      ]),
      numShadow('129', BLUE_GRAD, 168, 0),
    ]),
    // ── メイン：300（金・中央・最大）多層シャドウ ──
    h('div', { key: 'tot', style: { position: 'absolute', top: 548, left: 0, right: 0, display: 'flex', justifyContent: 'center' } }, [
      numShadow('300', GOLD_GRAD, 410, 0),
    ]),

    // ── フッター（ドメイン透かしのみ・中央）──
    h('div', { key: 'ft', style: { position: 'absolute', left: 0, right: 0, bottom: PAD, display: 'flex', justifyContent: 'center' } }, [
      h('div', { key: 'dom', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 24, color: 'rgba(255,255,255,0.62)', letterSpacing: 2 } }, 'matome-mlb-kaigai.jp'),
    ]),
  ]);

  const img = new ImageResponse(el, {
    width: W, height: H,
    fonts: [
      { name: 'NotoJP', data: n7, weight: 700, style: 'normal' },
      { name: 'NotoJP', data: n9, weight: 900, style: 'normal' },
      { name: 'Anton', data: an, weight: 400, style: 'normal' },
    ],
  });
  const buf = Buffer.from(await img.arrayBuffer());
  const outDir = path.join(process.cwd(), '_local', 'x-images');
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, 'ohtani-300hr.png');
  await fs.writeFile(out, buf);
  console.log(`✓ 記念カード（大谷 171/129/300 デュアルエラ・立体数字）→ ${path.relative(process.cwd(), out)}（${W}×${H}・写真 ${angels ? '赤◯' : '赤×'}/${dodgers ? '灰◯' : '灰×'}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
