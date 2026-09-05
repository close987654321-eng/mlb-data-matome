/**
 * X 投稿用「WHO GETS THE BALL?」投げ合いカード PNG 生成（x-post 案A・山本×ミジオロウスキー用）。
 *
 *   node scripts/yama-miz-card.mjs
 *
 * 様式は chicago-28-card.mjs と同じ（無彩色フラット・角シャープ・差し色は赤1点・英語・左寄せ編集レイアウト・
 * 1080×1350）。ポストの〆は「数字で決めるか、無理な試合を任せられる方か」の二択なので**左右は完全対称**＝
 * 絵が勝敗を断定しない。パネルのタグは r/Dodgers の ▲119「きつい試合はミズ、無理な試合は山本」から。
 * 数値は statsapi で 2026-08-19 裏取り（ミズ 1.75 ERA・210K・0.75 WHIP＝MLB1位／山本 2.60・0.89 WHIP MLB2位・
 * 2025 PS 5-1 1.45・WS MVP）。写真は MLB 公式 action/hero（投手は左右反転しない＝利き腕が変わるため）。
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

const GUTTER = 16;
const PANEL_W = Math.round((W - M * 2 - GUTTER) / 2);
const PANEL_H = 620, PANEL_TOP = 300;
const LEFT_X = M, RIGHT_X = M + PANEL_W + GUTTER;

const FOCUS = { yama: Number(process.env.FOCUS_L ?? 0.5), miz: Number(process.env.FOCUS_R ?? 0.5) };
const PLAYERS = [
  { id: 808967, teamId: 119, side: 'THE IMPOSSIBLE GAME', name: 'YAMAMOTO', stat: '2.60 ERA · 0.89 WHIP · 12-7', sub: '2025 WORLD SERIES MVP · 5-1, 1.45 IN OCTOBER', focus: FOCUS.yama },
  { id: 694819, teamId: 158, side: 'THE TOUGH GAME', name: 'MISIOROWSKI', stat: '1.75 ERA · 0.75 WHIP · 12-5', sub: 'MLB ERA LEADER · 210 STRIKEOUTS', focus: FOCUS.miz },
];

const fill = { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex' };
const row = (extra) => ({ display: 'flex', alignItems: 'center', ...extra });

async function actionPanel(id, focus) {
  const url = `https://img.mlbstatic.com/mlb-photos/image/upload/w_3000,q_auto:best/v1/people/${id}/action/hero/current`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`写真取得に失敗: ${id} HTTP ${res.status}`); return null; }
  const src = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(src).metadata();
  const cropW = Math.round(meta.height * (PANEL_W / PANEL_H));
  const left = Math.min(Math.max(Math.round(meta.width * focus - cropW / 2), 0), meta.width - cropW);
  const out = await sharp(src)
    .extract({ left, top: 0, width: cropW, height: meta.height })
    .resize(PANEL_W, PANEL_H)
    .modulate({ brightness: 1.02, saturation: 1.02 })
    .sharpen()
    .png().toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

async function teamLogo(teamId, size) {
  for (const url of [
    `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`,
    `https://www.mlbstatic.com/team-logos/${teamId}.svg`,
  ]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const svg = Buffer.from(await res.arrayBuffer());
      const png = await sharp(svg, { density: 240 }).resize(size, size, { fit: 'inside' }).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch { /* 次の候補へ */ }
  }
  console.error('ロゴ取得に失敗:', teamId);
  return null;
}

function panel(p, photo, x) {
  return h('div', { key: `p${p.id}`, style: { position: 'absolute', top: PANEL_TOP, left: x, width: PANEL_W, height: PANEL_H, display: 'flex' } }, [
    photo && h('img', { key: 'ph', src: photo, width: PANEL_W, height: PANEL_H, style: { position: 'absolute', top: 0, left: 0 } }),
    h('div', { key: 'sc', style: { position: 'absolute', top: 0, left: 0, width: PANEL_W, height: PANEL_H, display: 'flex', backgroundImage: 'linear-gradient(to top, rgba(11,12,14,0.55) 0%, rgba(11,12,14,0) 22%)' } }),
    h('div', { key: 'tg', style: { position: 'absolute', top: 0, left: 0, display: 'flex', background: BG, padding: '9px 14px 8px' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 26, letterSpacing: 4, color: INK } }, p.side),
    ]),
  ].filter(Boolean));
}

async function main() {
  const [photoL, photoR, logoL, logoR] = await Promise.all([
    actionPanel(PLAYERS[0].id, PLAYERS[0].focus),
    actionPanel(PLAYERS[1].id, PLAYERS[1].focus),
    teamLogo(PLAYERS[0].teamId, 96),
    teamLogo(PLAYERS[1].teamId, 96),
  ]);

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [an, be] = await Promise.all([
    fs.readFile(path.join(dir, 'anton.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const nameBlock = (p, logo, x) => h('div', { key: `n${p.id}`, style: { position: 'absolute', top: PANEL_TOP + PANEL_H + 26, left: x, width: PANEL_W, display: 'flex', flexDirection: 'column' } }, [
    h('div', { key: 'nm', style: row({ height: 52 }) }, [
      logo && h('img', { key: 'lg', src: logo, width: 44, height: 44, style: { marginRight: 14 } }),
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: p.name.length > 10 ? 41 : 50, letterSpacing: 1, color: INK } }, p.name),
    ].filter(Boolean)),
    h('div', { key: 'st', style: { display: 'flex', marginTop: 12, fontFamily: 'Bebas', fontSize: 31, letterSpacing: 3, color: INK_MUTE } }, p.stat),
    h('div', { key: 'sb', style: { display: 'flex', marginTop: 6, fontFamily: 'Bebas', fontSize: 22, letterSpacing: 2, color: INK_FAINT } }, p.sub),
  ]);

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    h('div', { key: 'bg', style: { ...fill, background: BG } }),
    h('div', { key: 'kick', style: { position: 'absolute', top: 92, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 30, letterSpacing: 9, color: INK_FAINT } }, 'NL PITCHING DUEL 2026'),
    ]),
    h('div', { key: 'head', style: { position: 'absolute', top: 130, left: M, display: 'flex', alignItems: 'flex-end' } }, [
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 96, letterSpacing: 0, lineHeight: 1, color: INK } }, 'WHO GETS THE BALL'),
      h('div', { key: 'qm', style: { display: 'flex', marginLeft: 10, fontFamily: 'Bebas', fontSize: 118, letterSpacing: 0, lineHeight: 0.82, color: ACCENT } }, '?'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 252, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),

    panel(PLAYERS[0], photoL, LEFT_X),
    panel(PLAYERS[1], photoR, RIGHT_X),
    nameBlock(PLAYERS[0], logoL, LEFT_X),
    nameBlock(PLAYERS[1], logoR, RIGHT_X),

    h('div', { key: 'hr', style: { position: 'absolute', top: 1126, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'q', style: { position: 'absolute', top: 1152, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 58, letterSpacing: 0, lineHeight: 1, color: INK } }, 'THE NUMBERS, OR THE MOMENT?'),
    ]),
    h('div', { key: 'meta', style: { position: 'absolute', top: 1228, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 27, letterSpacing: 3, color: INK_MUTE } }, 'r/DODGERS: GIVE MIZ THE TOUGH GAME. GIVE YAMAMOTO THE IMPOSSIBLE ONE.'),
    ]),
    h('div', { key: 'cr', style: { position: 'absolute', top: 1282, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 24, letterSpacing: 3, color: INK_FAINT } }, 'PHOTOS: MLB · STATS THROUGH AUG 18'),
    ]),
    h('div', { key: 'ft', style: { position: 'absolute', top: 1282, left: M, width: W - M * 2, display: 'flex', justifyContent: 'flex-end' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 24, letterSpacing: 3, color: INK_FAINT } }, 'MATOME-MLB-KAIGAI.JP'),
    ]),
  ].filter(Boolean));

  const img = new ImageResponse(el, {
    width: W, height: H,
    fonts: [
      { name: 'Anton', data: an, weight: 400, style: 'normal' },
      { name: 'Bebas', data: be, weight: 400, style: 'normal' },
    ],
  });
  const buf = Buffer.from(await img.arrayBuffer());
  const outDir = path.join(process.cwd(), '_local', 'x-images');
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, 'yama-miz.png');
  await fs.writeFile(out, buf);
  console.log(`✓ WHO GETS THE BALL カード → ${path.relative(process.cwd(), out)}（山本 ${photoL ? '◯' : '×'}／ミズ ${photoR ? '◯' : '×'}／ロゴ ${logoL && logoR ? '◯' : '×'}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
