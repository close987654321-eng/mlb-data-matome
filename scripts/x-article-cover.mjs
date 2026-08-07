/**
 * X アーティクル用カバー画像 PNG 生成（5:2 バナー・1600×640）。
 *
 *   node scripts/x-article-cover.mjs
 *
 * 2026-08-01 jp-daily（大谷24号・村上24号・菅野11勝目）の X アーティクル
 * （_local/x-article-2026-08-01-jp-daily.md）専用カバー。jp-daily-card.mjs と同じ配色トークン・
 * 顔写真（MLB公式 silo）取得ロジックを踏襲するが、縦カード（全員載せる・成績チップ）とは別物＝
 * この記事がいちばん強い2本の縦筋（大谷24号／村上24号で並んだ）だけを見せる横長カバー。
 * 数値・選手IDは src/lib/players.ts・src/lib/teams.ts と同じ実測ソース（捏造なし）。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const INK = '#F2F0EA';
const INK_MUTE = 'rgba(242,240,234,0.66)';
const INK_FAINT = 'rgba(242,240,234,0.42)';
const ACCENT = '#CDB884';

const W = 1600, H = 640;

// 大谷（ドジャース）・村上（ホワイトソックス）= src/lib/players.ts・src/lib/teams.ts と同じID。
const OHTANI = { id: 660271, teamColor: '#005A9C' };
const MURAKAMI = { id: 808959, teamColor: '#27251F' }; // ほぼ無彩色＝地に敷かずハウスの金へ逃がす

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (hex, other, t) => toHex(rgbOf(hex).map((v, i) => v * (1 - t) + rgbOf(other)[i] * t));
const rgba = (hex, a) => `rgba(${rgbOf(hex).join(',')},${a})`;
const lum = (hex) => { const [r, g, b] = rgbOf(hex).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function teamTone(hex) {
  let c = hex, n = 0;
  while (lum(c) < 0.09 && n++ < 6) c = mix(c, '#FFFFFF', 0.22);
  while (lum(c) > 0.42 && n++ < 12) c = mix(c, '#0A121C', 0.18);
  return c;
}

const MISSING_ART = [];

async function fetchArt(url, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (res.status === 404) break;
    } catch { /* タイムアウト・断線＝間を置いて再挑戦 */ }
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 700));
  }
  MISSING_ART.push(label);
  return null;
}

/** MLB公式 silo（背景透過）。下端をグラデで抜いて枠なしで地に溶かす（jp-daily-card.mjsと同じ処理）。 */
async function fetchAvatar(id, label) {
  const raw = await fetchArt(`https://img.mlbstatic.com/mlb-photos/image/upload/w_800,q_auto:best/v1/people/${id}/headshot/silo/current`, label);
  if (!raw) return null;
  try {
    const S = 800;
    const fade = Buffer.from(
      `<svg width="${S}" height="${S}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0.86" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
      `</linearGradient></defs><rect width="${S}" height="${S}" fill="url(#g)"/></svg>`,
    );
    const out = await sharp(raw)
      .resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .composite([{ input: fade, blend: 'dest-in' }])
      .png().toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch { MISSING_ART.push(label); return null; }
}

/** 背景の球場写真（サイト共通の手持ち素材）。5:2の横長に合わせて右寄りでカバー。 */
async function fetchBallpark() {
  let raw = null;
  try {
    raw = await fs.readFile(path.join(process.cwd(), 'public', 'media', 'card-ballpark.jpg'));
  } catch { return null; }
  try {
    const out = await sharp(raw)
      .resize(W, H, { fit: 'cover', position: 'right' })
      .modulate({ brightness: 0.85, saturation: 0.82 })
      .blur(0.6)
      .jpeg({ quality: 86 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch { return null; }
}

async function loadBrandLogo() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'public', 'media', 'card-brand.jpg'));
    const S = 240;
    const circle = Buffer.from(`<svg width="${S}" height="${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="#fff"/></svg>`);
    const out = await sharp(raw).resize(S, S, { fit: 'cover' }).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch { return null; }
}

async function main() {
  const [ohtaniAvatar, murakamiAvatar, ballpark, brand] = await Promise.all([
    fetchAvatar(OHTANI.id, '大谷翔平 の顔写真'),
    fetchAvatar(MURAKAMI.id, '村上宗隆 の顔写真'),
    fetchBallpark(),
    loadBrandLogo(),
  ]);

  const dodgersBase = teamTone(OHTANI.teamColor);
  const dodgersBright = mix(dodgersBase, '#FFFFFF', 0.42);

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [zk7, zk9, bebas] = await Promise.all([
    fs.readFile(path.join(dir, 'zenkaku-bold.ttf')),
    fs.readFile(path.join(dir, 'zenkaku-black.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const seg = (text, color) => h('div', { key: text, style: { display: 'flex', fontFamily: 'Zen', fontWeight: 900, color, letterSpacing: -1 } }, text);

  // 主役ゾーン（右）：村上を背後・大谷を手前に重ねる。奥＝村上=金の光、手前＝大谷=ドジャース青の光。
  const playerZone = h('div', { key: 'players', style: { position: 'relative', display: 'flex', width: 760, height: H, flexShrink: 0 } }, [
    h('div', { key: 'mu', style: { position: 'absolute', left: 20, bottom: 0, display: 'flex', width: 430, height: 500, alignItems: 'flex-end', justifyContent: 'center' } }, [
      h('div', { key: 'glow', style: { position: 'absolute', left: 0, top: 0, width: 430, height: 430, display: 'flex', borderRadius: 215, background: `radial-gradient(circle at 50% 46%, ${rgba(ACCENT, 0.38)} 0%, rgba(205,184,132,0.12) 48%, rgba(0,0,0,0) 70%)` } }),
      murakamiAvatar ? h('img', { key: 'im', src: murakamiAvatar, width: 430, height: 500, style: { objectFit: 'contain' } }) : null,
    ]),
    h('div', { key: 'oh', style: { position: 'absolute', left: 290, bottom: 0, display: 'flex', width: 470, height: 580, alignItems: 'flex-end', justifyContent: 'center' } }, [
      h('div', { key: 'glow', style: { position: 'absolute', left: 0, top: 0, width: 470, height: 470, display: 'flex', borderRadius: 235, background: `radial-gradient(circle at 50% 46%, ${rgba(dodgersBright, 0.42)} 0%, ${rgba(dodgersBase, 0.20)} 48%, rgba(0,0,0,0) 70%)` } }),
      ohtaniAvatar ? h('img', { key: 'im', src: ohtaniAvatar, width: 470, height: 580, style: { objectFit: 'contain' } }) : null,
    ]),
  ]);

  const textZone = h('div', { key: 'text', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, minWidth: 0, height: H, padding: '0 8px 0 0' } }, [
    h('div', { key: 'brand', style: { display: 'flex', alignItems: 'center' } }, [
      brand ? h('img', { key: 'b', src: brand, width: 52, height: 52, style: { objectFit: 'contain', marginRight: 14 } }) : null,
      h('div', { key: 'd', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 900, fontSize: 23, color: INK, letterSpacing: 0.5 } }, 'matome-mlb-kaigai.jp'),
      h('div', { key: 's', style: { display: 'flex', margin: '0 14px', fontFamily: 'Zen', fontSize: 22, color: INK_FAINT } }, '｜'),
      h('div', { key: 'e', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 21, color: INK_FAINT, letterSpacing: 4 } }, "TODAY'S JAPANESE PLAYERS"),
    ]),
    h('div', { key: 'h1', style: { display: 'flex', alignItems: 'baseline', marginTop: 30, fontSize: 72, lineHeight: 1 } }, [
      seg('大谷', INK), seg('24', ACCENT), seg('号、村上', INK), seg('24', ACCENT), seg('号。', INK),
    ]),
    h('div', { key: 'h2', style: { display: 'flex', width: 700, marginTop: 22, fontFamily: 'Zen', fontWeight: 700, fontSize: 32, lineHeight: 1.4, color: INK_MUTE } },
      '岡本はもう24本、本塁打ランキングに日本人が3人並んだ夜'),
    h('div', { key: 'meta', style: { display: 'flex', alignItems: 'center', marginTop: 34, fontFamily: 'Bebas', fontSize: 22, letterSpacing: 3, color: INK_FAINT } }, [
      h('div', { key: 'a', style: { display: 'flex' } }, '8/1'),
      h('div', { key: 'r1', style: { display: 'flex', width: 4, height: 4, margin: '0 14px', borderRadius: 2, background: INK_FAINT } }),
      h('div', { key: 'b', style: { display: 'flex', color: ACCENT } }, 'NO.129'),
      h('div', { key: 'r2', style: { display: 'flex', width: 4, height: 4, margin: '0 14px', borderRadius: 2, background: INK_FAINT } }),
      h('div', { key: 'c', style: { display: 'flex' } }, '菅野は涼しい顔で11勝目'),
    ]),
  ]);

  const layer = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' };
  const el = h('div', { style: { position: 'relative', display: 'flex', width: '100%', height: '100%', background: `linear-gradient(160deg, ${mix(dodgersBase, '#050B14', 0.55)} 0%, #070C15 70%)`, ...(ballpark ? { backgroundImage: `url(${ballpark})`, backgroundSize: `${W}px ${H}px` } : {}) } }, [
    h('div', { key: 'sheen', style: { ...layer, background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0) 60%)' } }),
    // 左を暗く落として字を読ませ、右は写真と主役を見せる（縦カードの上→下グラデを横向きに転用）。
    h('div', { key: 'tint', style: { ...layer, background: 'linear-gradient(90deg, rgba(5,10,18,0.97) 0%, rgba(5,10,18,0.93) 44%, rgba(5,10,18,0.55) 65%, rgba(5,10,18,0.12) 100%)' } }),
    h('div', { key: 'row', style: { position: 'relative', display: 'flex', width: '100%', height: '100%', alignItems: 'center', padding: '0 56px' } }, [textZone, playerZone]),
    h('div', { key: 'rule', style: { position: 'absolute', left: 0, bottom: 0, width: '100%', height: 4, display: 'flex', background: ACCENT, opacity: 0.55 } }),
  ]);

  const res = new ImageResponse(el, {
    width: W, height: H,
    fonts: [
      { name: 'Zen', data: zk7, weight: 700, style: 'normal' },
      { name: 'Zen', data: zk9, weight: 900, style: 'normal' },
      { name: 'Bebas', data: bebas, weight: 400, style: 'normal' },
    ],
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const out = path.join(process.cwd(), '_local', 'x-images', 'x-article-2026-08-01-cover.png');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, buf);
  console.log(`✓ Xアーティクル カバー(5:2) → ${path.relative(process.cwd(), out)}（${W}×${H}）`);
  if (MISSING_ART.length) {
    console.error(`⚠️ 素材が ${MISSING_ART.length} 点取れなかった: ${MISSING_ART.join(', ')}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
