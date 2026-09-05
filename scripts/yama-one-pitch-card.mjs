/**
 * X 投稿用「ONE PITCH」カード PNG 生成（x-post スキルの弾・2026-08-27 山本由伸 案A用）。
 *
 *   node scripts/yama-one-pitch-card.mjs
 *
 * ポストの芯は「初球1球で試合の結果が決まった」なので、カードも**1球に全部を寄せる**＝
 * 題字は ONE PITCH. の一撃だけ、内容（6.1回1失点8奪三振）は写真の下に事務的に置いて、
 * 赤い L で結末を刺す。落差そのものが絵になる構造で、説明は足さない。
 *
 * ハウススタイルは chicago-28-card.mjs と同じ（無彩色ミニマル・角シャープ・差し色は赤1点＝
 * accent #C8102E・文字は全部英語＝放送グラフィックの顔にする）。1080×1350＝X が切り抜かない 4:5。
 * ⚠️ 金の箔・メタリックのグラデ・多層シャドウは使わない（2026-08-17 村山指摘）。
 *
 * 数値は statsapi で当日裏取り済み（2026-08-27 ET・gamePk 824879）:
 *   山本 6.1回 4安打 1自責 8奪三振 1四球 105球 → 負け投手・防御率 2.56・今季 12勝8敗
 *   失点は1回裏 先頭 D.ボールドウィンへの初球（89.2mph スプリット）を被弾した今季22号ソロのみ
 *   同型の敗戦が今季2度目＝5/18 パドレス戦 7.0回 1自責 8奪三振 で 0-1 負け
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

const BAND_W = W - M * 2, BAND_H = 500, BAND_TOP = 430;
const YAMAMOTO = 808967, DODGERS = 119;
// focus: 3000×1000 の元画像の横位置のどこを band に切り出すか（投手が中心に来る位置を実測で調整）
const FOCUS = 0.5;

const row = (extra) => ({ display: 'flex', alignItems: 'center', ...extra });

/** MLB 公式のアクション写真（3000×1000 の横長）から横帯を切り出す。 */
async function actionBand(id, focus) {
  const url = `https://img.mlbstatic.com/mlb-photos/image/upload/w_3000,q_auto:best/v1/people/${id}/action/hero/current`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`写真取得に失敗: ${id} HTTP ${res.status}`); return null; }
  const src = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(src).metadata();
  const cropW = Math.min(Math.round(meta.height * (BAND_W / BAND_H)), meta.width);
  const left = Math.min(Math.max(Math.round(meta.width * focus - cropW / 2), 0), meta.width - cropW);
  const out = await sharp(src)
    .extract({ left, top: 0, width: cropW, height: meta.height })
    .resize(BAND_W, BAND_H)
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
  const [photo, logo] = await Promise.all([actionBand(YAMAMOTO, FOCUS), teamLogo(DODGERS, 96)]);

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [an, be] = await Promise.all([
    fs.readFile(path.join(dir, 'anton.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    // ── ヘッダー ──
    h('div', { key: 'kick', style: { position: 'absolute', top: 88, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 30, letterSpacing: 9, color: INK_FAINT } }, 'ATLANTA · AUG 27, 2026'),
    ]),
    h('div', { key: 'head', style: { position: 'absolute', top: 122, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 152, letterSpacing: 0, lineHeight: 1, color: INK } }, 'ONE PITCH'),
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 152, letterSpacing: 0, lineHeight: 1, color: ACCENT } }, '.'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 300, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),
    // 説明は2行まで。ここで足すと題字の一撃が濁る
    h('div', { key: 'sub', style: { position: 'absolute', top: 334, left: M, width: BAND_W, display: 'flex', flexDirection: 'column' } }, [
      h('div', { key: 's1', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 34, letterSpacing: 3, color: INK_MUTE } }, 'THE FIRST PITCH OF THE NIGHT LEFT THE YARD.'),
      h('div', { key: 's2', style: { display: 'flex', marginTop: 6, fontFamily: 'Bebas', fontSize: 34, letterSpacing: 3, color: INK_MUTE } }, 'IT WAS THE ONLY RUN OF THE GAME.'),
    ]),

    // ── 実写の帯 ──
    h('div', { key: 'band', style: { position: 'absolute', top: BAND_TOP, left: M, width: BAND_W, height: BAND_H, display: 'flex' } }, [
      photo && h('img', { key: 'ph', src: photo, width: BAND_W, height: BAND_H, style: { position: 'absolute', top: 0, left: 0 } }),
      h('div', { key: 'sc', style: { position: 'absolute', top: 0, left: 0, width: BAND_W, height: BAND_H, display: 'flex', backgroundImage: 'linear-gradient(to top, rgba(11,12,14,0.55) 0%, rgba(11,12,14,0) 24%)' } }),
      h('div', { key: 'tg', style: { position: 'absolute', top: 0, left: 0, display: 'flex', background: BG, padding: '9px 14px 8px' } }, [
        h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 26, letterSpacing: 4, color: INK } }, 'LAD 0-1 ATL'),
      ]),
    ].filter(Boolean)),

    // ── 名前と内容（結末は赤の L 一文字で刺す）──
    h('div', { key: 'nm', style: { position: 'absolute', top: 964, left: M, display: 'flex', alignItems: 'center' } }, [
      logo && h('img', { key: 'lg', src: logo, width: 48, height: 48, style: { marginRight: 16 } }),
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 58, letterSpacing: 1, color: INK } }, 'YOSHINOBU YAMAMOTO'),
    ].filter(Boolean)),
    h('div', { key: 'L', style: { position: 'absolute', top: 928, left: M, width: BAND_W, display: 'flex', justifyContent: 'flex-end' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 118, lineHeight: 1, color: ACCENT } }, 'L'),
    ]),
    h('div', { key: 'ln', style: { position: 'absolute', top: 1042, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 33, letterSpacing: 3, color: INK } }, '6.1 IP · 4 H · 1 ER · 8 K · 1 BB · 105 PITCHES'),
    ]),
    h('div', { key: 'ln2', style: { position: 'absolute', top: 1086, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 33, letterSpacing: 3, color: INK_MUTE } }, 'ERA DOWN TO 2.56 · SEASON 12-8'),
    ]),

    // ── フッター（同じ形の敗戦が今季2度目＝これが効く）──
    h('div', { key: 'hr', style: { position: 'absolute', top: 1160, left: M, width: BAND_W, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'ft1', style: { position: 'absolute', top: 1186, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 44, letterSpacing: 0, lineHeight: 1, color: INK } }, 'SECOND TIME THIS SEASON'),
    ]),
    h('div', { key: 'ft2', style: { position: 'absolute', top: 1240, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 3, color: INK_MUTE } }, 'MAY 18 VS SD · 7.0 IP · 1 ER · 8 K · ALSO LOST 0-1'),
    ]),
    h('div', { key: 'cr', style: { position: 'absolute', top: 1292, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 24, letterSpacing: 3, color: INK_FAINT } }, 'PHOTO: MLB'),
    ]),
    h('div', { key: 'site', style: { position: 'absolute', top: 1292, left: M, width: BAND_W, display: 'flex', justifyContent: 'flex-end' } }, [
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
  const out = path.join(outDir, 'yama-one-pitch.png');
  await fs.writeFile(out, Buffer.from(await img.arrayBuffer()));
  console.log(`✓ ONE PITCH カード → ${path.relative(process.cwd(), out)}（${W}×${H}・写真 ${photo ? '◯' : '×'}／ロゴ ${logo ? '◯' : '×'}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
