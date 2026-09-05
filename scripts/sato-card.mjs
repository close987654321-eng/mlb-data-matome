/**
 * X 投稿用「佐藤輝明（阪神）争奪戦」カード PNG 生成（x-post 案A用）。
 *
 *   node scripts/sato-card.mjs
 *
 * 様式は chicago-28-card.mjs と同じ（無彩色フラット・角シャープ・差し色は赤1点・英語・左寄せ・1080×1350）。
 * NPB 選手なので MLB 公式の action/hero が無い（statsapi の WBC id 831664 は写真404）。写真は Wikimedia Commons の
 * CC BY 4.0（とらとうはんしん・2024-03-10 甲子園）＝ _local/x-images/sato-koshien-src.jpg を使い、クレジットに
 * 作者とライセンスを明記する。数値は NPB 公式（npb.jp/bis/2026/stats/bat_c.html）8/19 時点＝
 * .316（セ1位）・29本（森下と並び1位）・80打点（1位）・OBP.400/SLG.628＝OPS1.028。MLBTR の興味球団は
 * r/baseball ▲178 スレのタイトル（メッツ・ヤンキース・ドジャース・フィリーズ）。
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
// 元画像（4024×6154）から胸像＋甲子園の観客席を横長に切る。環境変数で微調整可。
const CROP = { left: Number(process.env.CL ?? 420), top: Number(process.env.CT ?? 780), width: Number(process.env.CW ?? 3300) };

async function photoPanel() {
  const src = await fs.readFile(path.join(process.cwd(), '_local', 'x-images', 'sato-koshien-src.jpg'));
  const meta = await sharp(src).metadata();
  const width = Math.min(CROP.width, meta.width - CROP.left);
  const height = Math.round(width * (PANEL_H / PANEL_W));
  const out = await sharp(src)
    .extract({ left: CROP.left, top: CROP.top, width, height: Math.min(height, meta.height - CROP.top) })
    .resize(PANEL_W, PANEL_H)
    .modulate({ brightness: 1.0, saturation: 0.96 })
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
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 30, letterSpacing: 9, color: INK_FAINT } }, 'HANSHIN TIGERS · NPB 2026'),
    ]),
    h('div', { key: 'head', style: { position: 'absolute', top: 130, left: M, display: 'flex', alignItems: 'flex-end' } }, [
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 96, lineHeight: 1, color: INK } }, 'THE NEXT ONE OVER'),
      h('div', { key: 'qm', style: { display: 'flex', marginLeft: 10, fontFamily: 'Bebas', fontSize: 118, lineHeight: 0.82, color: ACCENT } }, '?'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 252, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),

    // 実写パネル（角シャープ・下端だけ沈める）
    h('div', { key: 'panel', style: { position: 'absolute', top: PANEL_TOP, left: M, width: PANEL_W, height: PANEL_H, display: 'flex' } }, [
      h('img', { key: 'ph', src: photo, width: PANEL_W, height: PANEL_H, style: { position: 'absolute', top: 0, left: 0 } }),
      h('div', { key: 'sc', style: { position: 'absolute', top: 0, left: 0, width: PANEL_W, height: PANEL_H, display: 'flex', backgroundImage: 'linear-gradient(to top, rgba(11,12,14,0.6) 0%, rgba(11,12,14,0) 24%)' } }),
      h('div', { key: 'tg', style: { position: 'absolute', top: 0, left: 0, display: 'flex', background: BG, padding: '9px 14px 8px' } }, [
        h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 26, letterSpacing: 4, color: INK } }, 'KOSHIEN STADIUM · 3B / OF · BATS LEFT'),
      ]),
    ]),

    // 名前＋成績
    h('div', { key: 'name', style: { position: 'absolute', top: PANEL_TOP + PANEL_H + 30, left: M, display: 'flex', flexDirection: 'column' } }, [
      h('div', { key: 'nm', style: { display: 'flex', fontFamily: 'Anton', fontSize: 72, letterSpacing: 1, lineHeight: 1, color: INK } }, 'TERUAKI SATO'),
      h('div', { key: 'st', style: { display: 'flex', marginTop: 18, fontFamily: 'Bebas', fontSize: 38, letterSpacing: 3, color: INK_MUTE } }, '.316 AVG · 29 HR · 80 RBI · 1.028 OPS'),
      h('div', { key: 'sb', style: { display: 'flex', marginTop: 10, fontFamily: 'Bebas', fontSize: 25, letterSpacing: 2, color: INK_FAINT } }, 'LEADS THE CENTRAL LEAGUE IN AVG AND RBI · TIED FOR THE HR LEAD · AGE 27'),
    ]),

    // フッター
    h('div', { key: 'hr', style: { position: 'absolute', top: 1126, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'q', style: { position: 'absolute', top: 1150, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 50, lineHeight: 1, color: INK } }, 'METS · YANKEES · DODGERS · PHILLIES'),
    ]),
    h('div', { key: 'meta', style: { position: 'absolute', top: 1216, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 27, letterSpacing: 3, color: INK_MUTE } }, 'REPORTED INTEREST (MLBTR) · POSTING EXPECTED AFTER THE SEASON'),
    ]),
    h('div', { key: 'cr', style: { position: 'absolute', top: 1282, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 22, letterSpacing: 2, color: INK_FAINT } }, 'PHOTO: TORATOUHANSHIN VIA WIKIMEDIA COMMONS (CC BY 4.0) · STATS: NPB, AUG 19'),
    ]),
    h('div', { key: 'ft', style: { position: 'absolute', top: 1282, left: M, width: W - M * 2, display: 'flex', justifyContent: 'flex-end' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 22, letterSpacing: 2, color: INK_FAINT } }, 'MATOME-MLB-KAIGAI.JP'),
    ]),
  ]);

  const img = new ImageResponse(el, { width: W, height: H, fonts: [
    { name: 'Anton', data: an, weight: 400, style: 'normal' },
    { name: 'Bebas', data: be, weight: 400, style: 'normal' },
  ] });
  const out = path.join(process.cwd(), '_local', 'x-images', 'sato-next.png');
  await fs.writeFile(out, Buffer.from(await img.arrayBuffer()));
  console.log(`✓ SATO カード → ${path.relative(process.cwd(), out)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
