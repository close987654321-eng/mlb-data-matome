/**
 * X 投稿用「前田健太 NPB通算100勝」カード PNG 生成（x-post 案A用）。
 *
 *   node scripts/maeda-100-card.mjs
 *
 * 様式は sato-card.mjs / chicago-28-card.mjs と同じ（無彩色フラット・角シャープ・差し色は赤1点・英語・左寄せ・1080×1350）。
 * 写真: MLB公式の action/hero は 628317 で generic（球場の引き）に落ちる＝MLBを離れた選手には実写が無い。
 * なので Wikimedia Commons の広島時代（2011-04-19 横浜スタジアム・ぽこ太郎・CC BY-SA 3.0）を使い、
 * パネルのタグに撮影年を明記する＝100勝当日の写真ではないことを見た人が誤解しないため。
 * 数字の裏取り: 広島 2007-2015 で 97勝67敗（ja.wikipedia／NPB）・MLB 226試合 68勝56敗（statsapi 628317）・
 * 楽天2026 は 10登板3勝3敗 防御率2.87、8/12 オリックス戦で NPB通算100勝＝プロ野球145人目（楽天公式）。
 * 日米通算は 100+68=168。⚠️「広島94勝」は楽天公式ページの表を読み違えた値なので使わない。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const W = 1080, H = 1350, M = 64;
const INK = '#F2F0EA';
const INK_MUTE = 'rgba(242,240,234,0.56)';
const INK_FAINT = 'rgba(242,240,234,0.34)';
const RULE = 'rgba(242,240,234,0.14)';
const ACCENT = '#C8102E';
const BG = '#0B0C0E';

const PANEL_W = W - M * 2, PANEL_H = 600, PANEL_TOP = 300;
// 元画像（1951×2051）から帽子〜膝までを横長に切る。環境変数で微調整可。
const CROP = { left: Number(process.env.CL ?? 40), top: Number(process.env.CT ?? 20), width: Number(process.env.CW ?? 1720) };

async function photoPanel() {
  const src = await fs.readFile(path.join(process.cwd(), '_local', 'x-images', 'maeda-carp2011.jpg'));
  const meta = await sharp(src).metadata();
  const width = Math.min(CROP.width, meta.width - CROP.left);
  const height = Math.round(width * (PANEL_H / PANEL_W));
  const out = await sharp(src)
    .extract({ left: CROP.left, top: CROP.top, width, height: Math.min(height, meta.height - CROP.top) })
    .resize(PANEL_W, PANEL_H)
    // カープの赤が差し色（#C8102E）と喧嘩するので少し落とす。archive 感も出る。
    .modulate({ brightness: 1.02, saturation: 0.82 })
    .sharpen()
    .png().toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

async function main() {
  const photo = await photoPanel();
  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [an, be] = await Promise.all([fs.readFile(path.join(dir, 'anton.ttf')), fs.readFile(path.join(dir, 'bebas.ttf'))]);

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    h('div', { key: 'kick', style: { position: 'absolute', top: 92, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 30, letterSpacing: 9, color: INK_FAINT } }, 'RAKUTEN EAGLES · NPB 2026 · AGE 38'),
    ]),
    h('div', { key: 'head', style: { position: 'absolute', top: 130, left: M, display: 'flex', alignItems: 'flex-end' } }, [
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 90, lineHeight: 1, color: INK } }, 'THE LONG WAY TO 100'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 252, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),

    // 実写パネル（角シャープ・下端だけ沈める）
    h('div', { key: 'panel', style: { position: 'absolute', top: PANEL_TOP, left: M, width: PANEL_W, height: PANEL_H, display: 'flex' } }, [
      h('img', { key: 'ph', src: photo, width: PANEL_W, height: PANEL_H, style: { position: 'absolute', top: 0, left: 0 } }),
      h('div', { key: 'sc', style: { position: 'absolute', top: 0, left: 0, width: PANEL_W, height: PANEL_H, display: 'flex', backgroundImage: 'linear-gradient(to top, rgba(11,12,14,0.62) 0%, rgba(11,12,14,0) 26%)' } }),
      h('div', { key: 'tg', style: { position: 'absolute', top: 0, left: 0, display: 'flex', background: BG, padding: '9px 14px 8px' } }, [
        h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 26, letterSpacing: 4, color: INK } }, 'HIROSHIMA CARP, NO.18 · YOKOHAMA, 2011'),
      ]),
    ]),

    // 名前＋内訳
    h('div', { key: 'name', style: { position: 'absolute', top: PANEL_TOP + PANEL_H + 30, left: M, display: 'flex', flexDirection: 'column' } }, [
      h('div', { key: 'nm', style: { display: 'flex', fontFamily: 'Anton', fontSize: 72, letterSpacing: 1, lineHeight: 1, color: INK } }, 'KENTA MAEDA'),
      h('div', { key: 'st', style: { display: 'flex', marginTop: 18, fontFamily: 'Bebas', fontSize: 38, letterSpacing: 3, color: INK_MUTE } }, '97 IN HIROSHIMA · 68 IN THE MAJORS · 3 IN SENDAI'),
      h('div', { key: 'sb', style: { display: 'flex', marginTop: 10, fontFamily: 'Bebas', fontSize: 25, letterSpacing: 2, color: INK_FAINT } }, 'NPB CAREER WIN No.100 ON AUG 12, 2026 · 145th PITCHER IN LEAGUE HISTORY'),
    ]),

    // フッター
    h('div', { key: 'hr', style: { position: 'absolute', top: 1126, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'q', style: { position: 'absolute', top: 1150, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 50, lineHeight: 1, color: INK } }, '168 AND COUNTING'),
    ]),
    h('div', { key: 'meta', style: { position: 'absolute', top: 1216, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 27, letterSpacing: 3, color: INK_MUTE } }, 'NPB + MLB WINS · HE SAYS THE GOAL IS 200 · LAST MLB YEAR: 7 GAMES, 7.88'),
    ]),
    h('div', { key: 'cr', style: { position: 'absolute', top: 1282, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 22, letterSpacing: 2, color: INK_FAINT } }, 'PHOTO: POKOTARO VIA WIKIMEDIA COMMONS (CC BY-SA 3.0) · STATS: NPB, MLB'),
    ]),
    h('div', { key: 'ft', style: { position: 'absolute', top: 1282, left: M, width: W - M * 2, display: 'flex', justifyContent: 'flex-end' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 22, letterSpacing: 2, color: INK_FAINT } }, 'MATOME-MLB-KAIGAI.JP'),
    ]),
  ]);

  const img = new ImageResponse(el, { width: W, height: H, fonts: [
    { name: 'Anton', data: an, weight: 400, style: 'normal' },
    { name: 'Bebas', data: be, weight: 400, style: 'normal' },
  ] });
  const out = path.join(process.cwd(), '_local', 'x-images', 'maeda-100.png');
  await fs.writeFile(out, Buffer.from(await img.arrayBuffer()));
  console.log(`✓ MAEDA カード → ${path.relative(process.cwd(), out)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
