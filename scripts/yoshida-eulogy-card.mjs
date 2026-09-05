/**
 * X 投稿用「KNOWN CANNOLI KNOCKER」カード PNG 生成（x-post スキルの弾・吉田正尚回）。
 *
 *   node scripts/yoshida-eulogy-card.mjs
 *
 * ネタは r/redsox に立った吉田正尚のトリビュートスレ（2026-08-19）。板が本人に付けた
 * 呼び名 KNOWN CANNOLI KNOCKER を題字に据え、フッターは本文のオチ（弔辞なのに誰も過去形で話していない）に合わせた一撃にする。
 * 題字は板の実在の書き込みが出どころ＝編集部の造語ではない。
 *
 * ハウススタイルは chicago-28-card.mjs と同じ＝無彩色ミニマル・角シャープ・差し色は赤1点
 * （#C8102E）・文字は全部英語。⚠️ 金の箔・メタリックのグラデ・多層シャドウは使わない
 * （2026-08-17 村山指摘＝AI が作った既製カードに見える）。効かせるのは実写・余白・級数差・赤の細罫だけ。
 *
 * 数値は statsapi で当日裏取り済み（2026-08-24 時点: 今季87試合 .274/.347/.399 OPS.746・
 * 最終出場 8/15・8/16 に IL 入り）。⚠️ 板が言う「ハムを痛めたまま34試合・.324」は statsapi と
 * 合わない（6/29 以降は32試合・.308）ので**カードにも本文にも載せない**。
 * 写真は MLB 公式のアクション写真（img.mlbstatic.com の action/hero）＝X 配信用の引用。
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

const PLAYER_ID = 807799, TEAM_ID = 111;
const PANEL_W = W - M * 2, PANEL_H = 580, PANEL_TOP = 404;
// focus: 3000×1000 の元画像の横位置。打者が縦パネルの中心に来るところを実測で決める。
const FOCUS = 0.5;

/** MLB 公式のアクション写真（3000×1000 の横長）からパネル比に切り出す。 */
async function actionPanel(id, focus) {
  const url = `https://img.mlbstatic.com/mlb-photos/image/upload/w_3000,q_auto:best/v1/people/${id}/action/hero/current`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`写真取得に失敗: ${id} HTTP ${res.status}`); return null; }
  const src = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(src).metadata();
  const cropW = Math.min(Math.round(meta.height * (PANEL_W / PANEL_H)), meta.width);
  const left = Math.min(Math.max(Math.round(meta.width * focus - cropW / 2), 0), meta.width - cropW);
  const out = await sharp(src)
    .extract({ left, top: 0, width: cropW, height: meta.height })
    .resize(PANEL_W, PANEL_H)
    .modulate({ brightness: 1.02, saturation: 1.02 })
    .sharpen()
    .png().toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

/** 球団ロゴ（暗い地に置くので on-dark 版のキャップロゴ）。 */
async function teamLogo(teamId, size) {
  for (const url of [
    `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`,
    `https://www.mlbstatic.com/team-logos/${teamId}.svg`,
  ]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const png = await sharp(Buffer.from(await res.arrayBuffer()), { density: 240 })
        .resize(size, size, { fit: 'inside' }).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch { /* 次の候補へ */ }
  }
  console.error('ロゴ取得に失敗:', teamId);
  return null;
}

async function main() {
  const [photo, logo] = await Promise.all([actionPanel(PLAYER_ID, FOCUS), teamLogo(TEAM_ID, 96)]);
  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [an, be] = await Promise.all([
    fs.readFile(path.join(dir, 'anton.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    h('div', { key: 'bg', style: { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', background: BG } }),

    // ── ヘッダー（左寄せの編集見出し）──
    h('div', { key: 'kick', style: { position: 'absolute', top: 88, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 29, letterSpacing: 8, color: INK_FAINT } }, 'R/REDSOX WROTE HIM A EULOGY'),
    ]),
    h('div', { key: 'h1', style: { position: 'absolute', top: 124, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 104, lineHeight: 1, color: INK } }, 'KNOWN CANNOLI'),
    ]),
    h('div', { key: 'h2', style: { position: 'absolute', top: 226, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 104, lineHeight: 1, color: INK } }, 'KNOCKER'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 356, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),

    // ── 実写パネル（角シャープ・下端だけわずかに沈める）──
    h('div', { key: 'pan', style: { position: 'absolute', top: PANEL_TOP, left: M, width: PANEL_W, height: PANEL_H, display: 'flex' } }, [
      photo && h('img', { key: 'ph', src: photo, width: PANEL_W, height: PANEL_H, style: { position: 'absolute', top: 0, left: 0 } }),
      h('div', { key: 'sc', style: { position: 'absolute', top: 0, left: 0, width: PANEL_W, height: PANEL_H, display: 'flex', backgroundImage: 'linear-gradient(to top, rgba(11,12,14,0.55) 0%, rgba(11,12,14,0) 22%)' } }),
    ].filter(Boolean)),

    // ── 名前と成績 ──
    h('div', { key: 'nm', style: { position: 'absolute', top: PANEL_TOP + PANEL_H + 30, left: M, display: 'flex', alignItems: 'center', height: 60 } }, [
      logo && h('img', { key: 'lg', src: logo, width: 50, height: 50, style: { marginRight: 16 } }),
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 58, letterSpacing: 1, color: INK } }, 'MASATAKA YOSHIDA'),
    ].filter(Boolean)),
    h('div', { key: 'st', style: { position: 'absolute', top: PANEL_TOP + PANEL_H + 104, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 31, letterSpacing: 3, color: INK_MUTE } }, '87 G · .274 · .746 OPS · ON THE IL SINCE AUG 16'),
    ]),

    // ── フッター（弔辞の前提をひっくり返す一撃）──
    h('div', { key: 'hr', style: { position: 'absolute', top: 1152, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'punch', style: { position: 'absolute', top: 1180, left: M, display: 'flex', alignItems: 'baseline' } }, [
      h('div', { key: 'a', style: { display: 'flex', fontFamily: 'Anton', fontSize: 56, lineHeight: 1, color: INK } }, 'HE IS, IN FACT,'),
      h('div', { key: 'b', style: { display: 'flex', marginLeft: 16, fontFamily: 'Anton', fontSize: 56, lineHeight: 1, color: ACCENT } }, 'STILL ALIVE.'),
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
  const outDir = path.join(process.cwd(), '_local', 'x-images');
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, 'yoshida-eulogy.png');
  await fs.writeFile(out, Buffer.from(await img.arrayBuffer()));
  console.log(`✓ CANNOLI KNOCKER カード → ${path.relative(process.cwd(), out)}（${W}×${H}・写真 ${photo ? '◯' : '×'}／ロゴ ${logo ? '◯' : '×'}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
