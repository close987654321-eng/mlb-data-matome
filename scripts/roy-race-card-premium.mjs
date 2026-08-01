/**
 * X 投稿用「新人王レース 村上×岡本」プレミアム対決カード PNG 生成（x-post スキルの弾）。
 *
 *   node scripts/roy-race-card-premium.mjs
 *
 * ohtani-300hr-premium.png のトレカ調デザイン言語（金の飾り枠・金箔ネームプレート・左右の
 * カラーフィールド＋実写・メタリック立体数字・リボン・ドメイン透かし）を踏襲した縦カード
 * （1080×1688）。左＝岡本和真（ジェイズ青・21本）／右＝村上宗隆（ソックス銀・20本）、中央に
 * 金の巨大「1本差」。写真は MLB 公式の透過ヘッドショット（img.mlbstatic.com）＝X 配信用の引用。
 * 数値は捏造せず statsapi で当日裏取り済み（2026-07-10: 岡本 90試合21本 OPS.776 ／
 * 村上 57試合20本 OPS.938・playerPool=Rookies で AL 新人 HR 1・2位を実測）。_local は非コミット。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const W = 1080, H = 1688;
const GOLD = '#EBC873';
const GOLD_SOFT = 'rgba(235,200,115,0.6)';
const GOLD_GRAD = 'linear-gradient(178deg, #FFF7DC 0%, #F4DB8C 17%, #E4B855 39%, #C08E2E 51%, #9C6E1B 59%, #E1BE68 78%, #FCEFC2 100%)';
const BLUE_GRAD = 'linear-gradient(178deg, #E7F1FF 0%, #90BCFA 24%, #337CE1 50%, #113A82 61%, #5C95EB 80%, #DEEAFF 100%)';
const SILVER_GRAD = 'linear-gradient(178deg, #FFFFFF 0%, #E4E9EF 22%, #B7BFC9 42%, #7E8793 54%, #59616C 61%, #AEB6C0 80%, #F4F7FA 100%)';

const PHOTO_OKAMOTO = path.join('_local', 'x-images', '_okamoto-headshot.png');
const PHOTO_MURAKAMI = path.join('_local', 'x-images', '_murakami-headshot.png');

const clip = (grad, extra) => ({ display: 'flex', backgroundImage: grad, backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent', ...extra });
const fill = { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex' };

// 多層シャドウ付きメタリック文字（milestone-card.mjs と同手法＝clip 文字に textShadow が効かないため）。
function numShadow(text, grad, size, font = 'Anton', ls = -4) {
  const base = { fontFamily: font, fontSize: size, lineHeight: 0.86, letterSpacing: ls, fontWeight: font === 'NotoJP' ? 900 : 400 };
  const s1 = Math.max(2, Math.round(size * 0.014)), s2 = Math.max(4, Math.round(size * 0.034));
  return h('div', { style: { position: 'relative', display: 'flex' } }, [
    h('div', { key: 's2', style: { position: 'absolute', left: 0, top: s2, display: 'flex', ...base, color: 'rgba(0,0,0,0.34)' } }, text),
    h('div', { key: 's1', style: { position: 'absolute', left: 0, top: s1, display: 'flex', ...base, color: 'rgba(0,0,0,0.55)' } }, text),
    h('div', { key: 'fg', style: clip(grad, base) }, text),
  ]);
}

const diamond = (size, pos) => h('div', { style: { position: 'absolute', width: size, height: size, transform: 'rotate(45deg)', backgroundImage: GOLD_GRAD, ...pos } });
const tick = (pos, borders) => h('div', { style: { position: 'absolute', width: 34, height: 34, display: 'flex', ...pos, ...borders } });

// 透過ヘッドショットをシネマ調に整え、内側の縁をフェザーで土台に溶かす。
async function prepareFace(file, disp, fadeSide, brightness = 1.04) {
  try {
    const graded = await sharp(file)
      .resize(disp, disp, { fit: 'cover', position: 'top' })
      .modulate({ brightness, saturation: 1.06 })
      .linear(1.1, -8)
      .sharpen()
      .ensureAlpha().png().toBuffer();
    const stops = fadeSide === 'right'
      ? '<stop offset="0%" stop-color="#fff" stop-opacity="1"/><stop offset="66%" stop-color="#fff" stop-opacity="1"/><stop offset="97%" stop-color="#fff" stop-opacity="0"/>'
      : '<stop offset="3%" stop-color="#fff" stop-opacity="0"/><stop offset="34%" stop-color="#fff" stop-opacity="1"/><stop offset="100%" stop-color="#fff" stop-opacity="1"/>';
    const feather = Buffer.from(
      `<svg width="${disp}" height="${disp}" xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/></svg>`);
    const out = await sharp(graded).composite([{ input: feather, blend: 'dest-in' }]).png().toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch (e) { console.error('写真加工に失敗:', file, e.message); return null; }
}

// チームロゴをゴースト透かし用に PNG 化（rsvg 非対応環境ではロゴ無しで続行）。
async function ghostLogo(teamId, size) {
  try {
    const res = await fetch(`https://www.mlbstatic.com/team-logos/${teamId}.svg`);
    if (!res.ok) return null;
    const svg = Buffer.from(await res.arrayBuffer());
    const png = await sharp(svg, { density: 150 }).resize(size, size, { fit: 'inside' }).grayscale().png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (e) { console.error('ロゴ取得に失敗:', teamId, e.message); return null; }
}

async function main() {
  const FACE = 480;
  const [okamoto, murakami, jaysLogo, soxLogo] = await Promise.all([
    prepareFace(PHOTO_OKAMOTO, FACE, 'right', 1.14),
    prepareFace(PHOTO_MURAKAMI, FACE, 'left', 1.02),
    ghostLogo(141, 300),
    ghostLogo(145, 300),
  ]);

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [n7, n9, an] = await Promise.all([
    fs.readFile(path.join(dir, 'noto-jp-700.ttf')),
    fs.readFile(path.join(dir, 'noto-jp-900.ttf')),
    fs.readFile(path.join(dir, 'anton.ttf')),
  ]);

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: '#07080C', position: 'relative', fontFamily: 'NotoJP' } }, [
    // 地のムラ（中央をわずかに持ち上げ、外周を沈める）
    h('div', { key: 'bg1', style: { ...fill, backgroundImage: 'radial-gradient(90% 60% at 50% 34%, rgba(30,34,46,0.9) 0%, rgba(7,8,12,0) 70%)' } }),
    // 左＝ジェイズ青のフィールド／右＝ソックス銀のフィールド
    h('div', { key: 'blu', style: { ...fill, backgroundImage: 'radial-gradient(58% 48% at 6% 90%, rgba(29,86,184,0.62) 0%, rgba(29,86,184,0.22) 46%, rgba(7,8,12,0) 74%)' } }),
    h('div', { key: 'sil', style: { ...fill, backgroundImage: 'radial-gradient(58% 48% at 94% 90%, rgba(196,206,222,0.42) 0%, rgba(196,206,222,0.13) 46%, rgba(7,8,12,0) 74%)' } }),
    h('div', { key: 'blu2', style: { ...fill, backgroundImage: 'radial-gradient(36% 26% at 12% 40%, rgba(29,86,184,0.20) 0%, rgba(7,8,12,0) 70%)' } }),
    h('div', { key: 'sil2', style: { ...fill, backgroundImage: 'radial-gradient(36% 26% at 88% 40%, rgba(196,206,222,0.13) 0%, rgba(7,8,12,0) 70%)' } }),

    // ゴーストのチームロゴ（上両隅）
    jaysLogo && h('img', { key: 'jl', src: jaysLogo, width: 280, height: 280, style: { position: 'absolute', top: 84, left: 50, opacity: 0.07 } }),
    soxLogo && h('img', { key: 'sl', src: soxLogo, width: 280, height: 280, style: { position: 'absolute', top: 84, right: 50, opacity: 0.09 } }),

    // 実写（下両隅・内側の縁は土台へフェザー）
    okamoto && h('img', { key: 'ok', src: okamoto, width: FACE, height: FACE, style: { position: 'absolute', bottom: -50, left: -36 } }),
    murakami && h('img', { key: 'mu', src: murakami, width: FACE, height: FACE, style: { position: 'absolute', bottom: -50, right: -36 } }),

    // 下スクリム（フッター可読性）とビネット
    h('div', { key: 'sb', style: { ...fill, backgroundImage: 'linear-gradient(to top, rgba(4,5,9,0.88) 3%, rgba(4,5,9,0) 14%)' } }),
    h('div', { key: 'vig', style: { ...fill, backgroundImage: 'radial-gradient(130% 104% at 50% 44%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.52) 100%)' } }),

    // 金の二重枠＋四隅の鉤＋上下のダイヤ
    h('div', { key: 'f1', style: { position: 'absolute', top: 22, left: 22, width: W - 44, height: H - 44, display: 'flex', border: `1px solid ${GOLD_SOFT}`, borderRadius: 9 } }),
    h('div', { key: 'f2', style: { position: 'absolute', top: 30, left: 30, width: W - 60, height: H - 60, display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6 } }),
    tick({ top: 34, left: 34 }, { borderTop: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` }),
    tick({ top: 34, right: 34 }, { borderTop: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` }),
    tick({ bottom: 34, left: 34 }, { borderBottom: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` }),
    tick({ bottom: 34, right: 34 }, { borderBottom: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` }),
    diamond(18, { top: 15, left: W / 2 - 9 }),
    diamond(18, { bottom: 15, left: W / 2 - 9 }),

    // ── ネームプレート：新人王レース（金箔・細罫＋ダイヤで挟む）──
    h('div', { key: 'name', style: { position: 'absolute', top: 128, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, [
      h('div', { key: 'l1', style: { display: 'flex', width: 64, height: 2, background: GOLD_SOFT } }),
      diamond(11, { position: 'relative', marginLeft: 16, marginRight: 22 }),
      h('div', { key: 'nm', style: clip(GOLD_GRAD, { fontFamily: 'NotoJP', fontWeight: 900, fontSize: 56, letterSpacing: 14 }) }, '新人王レース'),
      diamond(11, { position: 'relative', marginLeft: 22, marginRight: 16 }),
      h('div', { key: 'l2', style: { display: 'flex', width: 64, height: 2, background: GOLD_SOFT } }),
    ]),
    h('div', { key: 'sub', style: { position: 'absolute', top: 214, left: 0, right: 0, display: 'flex', justifyContent: 'center' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 27, letterSpacing: 9, color: 'rgba(235,200,115,0.72)' } }, '2026 AL ROOKIE HR LEADERS'),
    ]),

    // ── 数字対決：21（青・岡本）◆ 20（銀・村上）──
    h('div', { key: 'row', style: { position: 'absolute', top: 330, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, [
      numShadow('21', BLUE_GRAD, 218),
      h('div', { key: 'sep', style: { position: 'relative', display: 'flex', width: 26, height: 26, marginLeft: 54, marginRight: 54 } }, [
        diamond(26, { top: 0, left: 0 }),
      ]),
      numShadow('20', SILVER_GRAD, 218),
    ]),
    h('div', { key: 'lbl', style: { position: 'absolute', top: 552, left: 0, right: 0, display: 'flex', justifyContent: 'center' } }, [
      h('div', { key: 'lo', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 350 } }, [
        h('div', { key: 'a', style: { display: 'flex', fontFamily: 'Anton', fontSize: 34, letterSpacing: 7, color: GOLD } }, 'OKAMOTO'),
        h('div', { key: 'b', style: { display: 'flex', fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginTop: 10 } }, '90試合・OPS.776'),
      ]),
      h('div', { key: 'sp', style: { display: 'flex', width: 134 } }),
      h('div', { key: 'lm', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 350 } }, [
        h('div', { key: 'a', style: { display: 'flex', fontFamily: 'Anton', fontSize: 34, letterSpacing: 7, color: GOLD } }, 'MURAKAMI'),
        h('div', { key: 'b', style: { display: 'flex', fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginTop: 10 } }, '57試合・OPS.938'),
      ]),
    ]),

    // ── 中央：金の巨大「1本差」＋背後の金グロー ──
    h('div', { key: 'glow', style: { ...fill, backgroundImage: 'radial-gradient(46% 24% at 50% 56%, rgba(235,200,115,0.20) 0%, rgba(235,200,115,0) 72%)' } }),
    h('div', { key: 'big', style: { position: 'absolute', top: 700, left: 0, right: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } }, [
      numShadow('1', GOLD_GRAD, 470, 'Anton', 0),
      h('div', { key: 'hd', style: { display: 'flex', marginLeft: 26, paddingBottom: 26 } }, [
        numShadow('本差', GOLD_GRAD, 220, 'NotoJP', -6),
      ]),
    ]),

    // ── リボン：村上宗隆、明日復帰（金・細罫＋ダイヤ）──
    h('div', { key: 'rib', style: { position: 'absolute', top: 1150, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, [
      h('div', { key: 'l1', style: { display: 'flex', width: 84, height: 2, background: GOLD_SOFT } }),
      diamond(9, { position: 'relative', marginLeft: 14, marginRight: 20 }),
      h('div', { key: 'tx', style: clip(GOLD_GRAD, { fontFamily: 'NotoJP', fontWeight: 900, fontSize: 47, letterSpacing: 6 }) }, '村上宗隆、明日復帰'),
      diamond(9, { position: 'relative', marginLeft: 20, marginRight: 14 }),
      h('div', { key: 'l2', style: { display: 'flex', width: 84, height: 2, background: GOLD_SOFT } }),
    ]),
    h('div', { key: 'date', style: { position: 'absolute', top: 1226, left: 0, right: 0, display: 'flex', justifyContent: 'center' } }, [
      h('div', { style: { display: 'flex', fontSize: 23, fontWeight: 700, color: 'rgba(255,255,255,0.42)', letterSpacing: 3 } }, '2026年7月10日時点・MLB公式データ'),
    ]),

    // ── フッター（ドメイン透かし・中央）──
    h('div', { key: 'ft', style: { position: 'absolute', left: 0, right: 0, bottom: 52, display: 'flex', justifyContent: 'center' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 25, color: 'rgba(235,200,115,0.78)', letterSpacing: 4 } }, 'matome-mlb-kaigai.jp'),
    ]),
  ].filter(Boolean));

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
  const out = path.join(outDir, 'roy-race-premium.png');
  await fs.writeFile(out, buf);
  console.log(`✓ 新人王レース プレミアム対決カード → ${path.relative(process.cwd(), out)}（${W}×${H}・岡本 ${okamoto ? '◯' : '×'}／村上 ${murakami ? '◯' : '×'}／ロゴ ${jaysLogo && soxLogo ? '◯' : '×'}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
