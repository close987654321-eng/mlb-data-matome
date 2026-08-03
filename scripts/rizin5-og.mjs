#!/usr/bin/env node
/**
 * 超RIZIN.5 特設ハブ（/rizin5）の OG 画像を生成して public/media/rizin5-og.jpg に書く。
 *
 *   node scripts/rizin5-og.mjs
 *
 * デザインはサイトの規律（モダンミニマル無彩色・赤 #C8102E は題字罫の一点のみ・角シャープ・
 * 絵文字なし）に合わせたテキストベース。RIZIN のロゴ・選手写真は使わない（転載禁止＝CLAUDE.md §4.5）。
 * フォントは jp-daily-card.mjs と同じ src/assets/fonts/ の Zen Kaku Gothic New / Bebas Neue。
 * 1200×630 固定（Discover の 1200px 基準と X summary_large_image の両対応）。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const W = 1200;
const H = 630;
const INK = '#141414';
const INK_MUTE = '#6b6b6b';
const PAPER = '#fafaf8';
const ACCENT = '#C8102E';

async function main() {
  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [zk7, zk9, bebas] = await Promise.all([
    fs.readFile(path.join(dir, 'zenkaku-bold.ttf')),
    fs.readFile(path.join(dir, 'zenkaku-black.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const el = h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: PAPER,
        padding: '64px 72px',
        fontFamily: 'Zen',
      },
    },
    [
      h(
        'div',
        { key: 'eyebrow', style: { display: 'flex', alignItems: 'center', gap: 18 } },
        [
          h('div', { key: 'sp', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 30, letterSpacing: 8, color: INK_MUTE } }, 'SPECIAL'),
          h('div', { key: 'lb', style: { display: 'flex', fontWeight: 700, fontSize: 24, letterSpacing: 2, color: INK_MUTE } }, '観戦ガイド＆観測日誌'),
        ],
      ),
      h('div', { key: 'title', style: { display: 'flex', marginTop: 44, fontWeight: 900, fontSize: 150, lineHeight: 1, letterSpacing: -4, color: INK } }, '超RIZIN.5'),
      h('div', { key: 'sub', style: { display: 'flex', marginTop: 22, fontWeight: 900, fontSize: 52, letterSpacing: 4, color: INK } }, '浪速の超復活祭り'),
      // 題字罫（サイト唯一の赤をここ一点だけに使う）
      h('div', { key: 'rule', style: { display: 'flex', marginTop: 30, width: 168, height: 8, background: ACCENT } }),
      h(
        'div',
        { key: 'info', style: { display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 34 } },
        [
          h('div', { key: 'd', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 56, letterSpacing: 3, color: INK } }, '2026.9.10 THU'),
          h('div', { key: 'v', style: { display: 'flex', fontWeight: 700, fontSize: 34, color: INK } }, '京セラドーム大阪'),
        ],
      ),
      h(
        'div',
        { key: 'foot', style: { display: 'flex', marginTop: 'auto', alignItems: 'flex-end', justifyContent: 'space-between' } },
        [
          h('div', { key: 'l', style: { display: 'flex', fontWeight: 700, fontSize: 25, color: INK_MUTE, letterSpacing: 1 } }, '全8カードの因縁と戦績・視聴方法・開催までの日誌'),
          h('div', { key: 'r', style: { display: 'flex', fontWeight: 700, fontSize: 22, color: INK_MUTE } }, 'matome-mlb-kaigai.jp'),
        ],
      ),
    ],
  );

  const res = new ImageResponse(el, {
    width: W,
    height: H,
    fonts: [
      { name: 'Zen', data: zk7, weight: 700, style: 'normal' },
      { name: 'Zen', data: zk9, weight: 900, style: 'normal' },
      { name: 'Bebas', data: bebas, weight: 400, style: 'normal' },
    ],
  });
  const png = Buffer.from(await res.arrayBuffer());
  const out = path.join(process.cwd(), 'public', 'media', 'rizin5-og.jpg');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
  const { size } = await fs.stat(out);
  console.log(`wrote ${path.relative(process.cwd(), out)} (${Math.round(size / 1024)}KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
