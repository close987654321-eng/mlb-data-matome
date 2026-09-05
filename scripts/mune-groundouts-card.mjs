/**
 * X 投稿用「FIVE GROUNDOUTS」カード PNG 生成（x-post スキルの弾・案B v2 用）。
 *
 *   node scripts/mune-groundouts-card.mjs
 *
 * ポストの芯は「三振か四球か本塁打しかしない男が、ゴロだけの日をやった」＝
 * 〆の ゴロを打っただけでニュースになる男 をカードの一撃に写したもの。
 * だから絵の主役は成績ではなく **同じ言葉が5回続く反復**（1回・3回・5回・8回・9回すべてゴロ）。
 * 級数差と余白だけで落とす＝x-card-visual-style の様式（無彩色フラット・角シャープ・差し色は
 * 赤1点 #C8102E・文字は英語・左寄せの編集レイアウト）。金箔やメタリックのグラデは使わない。
 *
 * ⚠️ 数字の土俵は本文と揃える（本文の框を変えたらカードの一撃も同時に変える＝2026-08-24 の学び）。
 * 下段はアダム・ダンとの比較1点だけに絞り、**棒グラフは置かない**＝58.0 と 56.7 を軸を切って
 * 描くと差を誇張することになるため、級数差（大きさ・明度）で優劣を示す。
 *
 * 数値は statsapi で当日裏取り済み（2026-08-30 実測）:
 *   村上 2026 = 438打席 148三振 77四球 29本 → TTO 58.0%（300打席以上236人でMLB1位）
 *   アダム・ダン 2012 CWS = 649打席 222三振 105四球 41本 → TTO 56.7%（在籍4年の最高）
 *   2026-08-19 @リグレー = ホワイトソックス3-0カブス。村上は5打席すべてゴロ（1/3/5/8/9回）
 * 写真は MLB 公式のアクション写真（配信用の引用）。出力先 _local は非コミット。
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

const MURAKAMI_ID = 808959, SOX_ID = 145;

// 実写パネル（左）と、反復リスト（右）
const BODY_TOP = 344;
const PANEL_W = 420, PANEL_H = 470;
const COL_X = M + PANEL_W + 34;
const COL_W = W - M - COL_X;

// その日の5打席＝全部ゴロ（statsapi の play-by-play 実測）
const OUTS = [
  { inn: '1ST', kind: 'GROUNDOUT' },
  { inn: '3RD', kind: 'GROUNDOUT' },
  { inn: '5TH', kind: 'GROUNDOUT' },
  { inn: '8TH', kind: 'GROUNDOUT' },
  { inn: '9TH', kind: 'GROUNDOUT' },
];

const row = (extra) => ({ display: 'flex', alignItems: 'center', ...extra });

/** MLB 公式のアクション写真（3000×1000 の横長）から縦パネルを切り出す。 */
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

/** 球団ロゴ（暗い地に置くので on-dark 版＝黒いソックスのロゴが沈まない）。 */
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

async function main() {
  const [photo, logo] = await Promise.all([
    actionPanel(MURAKAMI_ID, 0.46),
    teamLogo(SOX_ID, 96),
  ]);

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [an, be] = await Promise.all([
    fs.readFile(path.join(dir, 'anton.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  // 反復リスト1行（同じ語が5回続くこと自体が絵のオチなので、装飾を足さない）
  const outRow = (o, i) => h('div', {
    key: `o${i}`,
    style: {
      position: 'absolute', top: 52 + i * 78, left: 0, width: COL_W, height: 78,
      display: 'flex', alignItems: 'center', borderTop: `1px solid ${RULE}`,
    },
  }, [
    h('div', { key: 'i', style: { display: 'flex', width: 96, fontFamily: 'Bebas', fontSize: 32, letterSpacing: 4, color: INK_FAINT } }, o.inn),
    h('div', { key: 'k', style: { display: 'flex', fontFamily: 'Anton', fontSize: 40, letterSpacing: 1, color: INK } }, o.kind),
  ]);

  // 下段の比較1行（棒は置かず、級数と明度だけで上下を出す）
  const cmpRow = (label, pct, opts) => h('div', {
    key: label,
    style: {
      position: 'absolute', top: opts.top, left: M, width: W - M * 2, height: opts.h,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderTop: `1px solid ${RULE}`,
    },
  }, [
    h('div', { key: 'l', style: { display: 'flex', fontFamily: 'Anton', fontSize: opts.nameSize, letterSpacing: 1, color: opts.color } }, label),
    h('div', { key: 'p', style: { display: 'flex', fontFamily: 'Anton', fontSize: opts.pctSize, letterSpacing: 0, color: opts.pctColor } }, pct),
  ]);

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    h('div', { key: 'bg', style: { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', background: BG } }),

    // ── ヘッダー ──
    h('div', { key: 'kick', style: { position: 'absolute', top: 80, left: M, display: 'flex', alignItems: 'center' } }, [
      logo && h('img', { key: 'lg', src: logo, width: 34, height: 34, style: { marginRight: 14 } }),
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 8, color: INK_FAINT } }, 'CHICAGO WHITE SOX · GAME 91'),
    ].filter(Boolean)),

    h('div', { key: 'head', style: { position: 'absolute', top: 122, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 112, letterSpacing: 0, lineHeight: 1, color: INK } }, 'FIVE GROUNDOUTS'),
    ]),
    h('div', { key: 'sub', style: { position: 'absolute', top: 240, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 50, letterSpacing: 1, lineHeight: 1, color: ACCENT } }, 'AND THAT WAS THE NEWS'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 312, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),

    // ── 実写パネル（角シャープ）──
    h('div', { key: 'panel', style: { position: 'absolute', top: BODY_TOP, left: M, width: PANEL_W, height: PANEL_H, display: 'flex' } }, [
      photo && h('img', { key: 'ph', src: photo, width: PANEL_W, height: PANEL_H, style: { position: 'absolute', top: 0, left: 0 } }),
      h('div', { key: 'sc', style: { position: 'absolute', top: 0, left: 0, width: PANEL_W, height: PANEL_H, display: 'flex', backgroundImage: 'linear-gradient(to top, rgba(11,12,14,0.55) 0%, rgba(11,12,14,0) 24%)' } }),
      h('div', { key: 'nm', style: { position: 'absolute', left: 0, bottom: 0, display: 'flex', background: BG, padding: '9px 16px 7px' } }, [
        h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 38, letterSpacing: 1, color: INK } }, 'MURAKAMI'),
      ]),
    ].filter(Boolean)),

    // ── 反復リスト（右）──
    h('div', { key: 'col', style: { position: 'absolute', top: BODY_TOP, left: COL_X, width: COL_W, height: PANEL_H, display: 'flex' } }, [
      h('div', { key: 'lb', style: { position: 'absolute', top: 0, left: 0, display: 'flex', fontFamily: 'Bebas', fontSize: 26, letterSpacing: 5, color: INK_MUTE } }, 'AUG 19 · AT WRIGLEY FIELD'),
      ...OUTS.map(outRow),
    ]),

    // ── 下段: 三振か四球か本塁打の割合（アダム・ダンとの1点比較）──
    h('div', { key: 'tl', style: { position: 'absolute', top: 872, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 27, letterSpacing: 6, color: INK_MUTE } }, 'WALK, STRIKEOUT OR HOME RUN · SHARE OF PLATE APPEARANCES'),
    ]),
    cmpRow('MURAKAMI · 2026', '58.0%', { top: 916, h: 104, nameSize: 44, pctSize: 76, color: INK, pctColor: INK }),
    cmpRow('ADAM DUNN · WHITE SOX 2012', '56.7%', { top: 1020, h: 92, nameSize: 34, pctSize: 54, color: INK_MUTE, pctColor: INK_MUTE }),
    h('div', { key: 'note', style: { position: 'absolute', top: 1122, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 25, letterSpacing: 4, color: INK_FAINT } }, 'MURAKAMI LEADS MLB THIS SEASON · MIN. 300 PA'),
    ]),

    // ── フッター ──
    h('div', { key: 'hr', style: { position: 'absolute', top: 1188, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'res', style: { position: 'absolute', top: 1212, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 46, letterSpacing: 0, lineHeight: 1, color: INK } }, 'WHITE SOX 3, CUBS 0'),
    ]),
    h('div', { key: 'cr', style: { position: 'absolute', top: 1284, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 24, letterSpacing: 3, color: INK_FAINT } }, 'PHOTO: MLB'),
    ]),
    h('div', { key: 'ft', style: { position: 'absolute', top: 1284, left: M, width: W - M * 2, display: 'flex', justifyContent: 'flex-end' } }, [
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
  const out = path.join(outDir, 'mune-groundouts.png');
  await fs.writeFile(out, buf);
  console.log(`✓ FIVE GROUNDOUTS カード → ${path.relative(process.cwd(), out)}（${W}×${H}・写真 ${photo ? '◯' : '×'}／ロゴ ${logo ? '◯' : '×'}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
