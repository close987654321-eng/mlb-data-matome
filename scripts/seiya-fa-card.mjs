/**
 * X 投稿用「RE-SIGN SEIYA」カード PNG 生成（x-post スキルの弾・誠也FA回）。
 *
 *   node scripts/seiya-fa-card.mjs
 *
 * ハウススタイルは chicago-28-card.mjs と同じ＝無彩色ミニマル・角シャープ・差し色は赤1点
 * （accent #C8102E）・左寄せの編集レイアウト・文字はすべて英語。1080×1350＝X が切り抜かない 4:5。
 *
 * ⚠️ 金の箔・メタリックのグラデ文字・二重の飾り枠・多層シャドウは使わない（2026-08-17 村山指摘＝
 * AI が作った既製カードに見える）。効かせるのは実写・余白・級数差・赤の細罫だけ。
 *
 * ポストの芯は「評価を変えたのは打撃でなく守備」なので、**打撃と守備を同じ級数で並べる**＝
 * どちらかを大きくすると絵の側が結論を出してしまい、読者に持論を出させる〆が閉じる。
 *
 * 数値の出どころ（捏造しない）:
 *   打撃 = statsapi 2026シーズン（8/17 ET の試合終了時点）… .273 / 22 HR / .854 OPS
 *   wRC+ = data/jp-players-stats.json の saber.wrcplus（Savant 由来・asOf 2026-08-17 18:02）
 *   守備 = 同スナップショットの fielding … OAA +4 / runsPrevented +4 / arm 94.5 mph
 *   契約 = 2022年に結んだ5年8500万ドルの最終年。誕生日 1994-08-18（statsapi）＝2026-08-18 で32歳
 *   引用 = r/CHICubs「The Suzuki Situation」スレのコメント（▲16）の逐語
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

const PLAYER_ID = 673548, TEAM_ID = 112;
const PANEL_W = W - M * 2, PANEL_H = 424, PANEL_TOP = 292;
const FOCUS = 0.45; // 3000×1000 の元画像のどこを横帯に切り出すか

// 打撃と守備は同じ級数・同じ行数で並べる（芯＝どっちが彼の価値かを断定しない）
const COLS = [
  { label: 'AT THE PLATE', rows: ['.273 AVG', '22 HR', '.854 OPS', '134 WRC+'] },
  { label: 'IN RIGHT FIELD', rows: ['+4 OAA', '+4 RUNS SAVED', '94.5 MPH ARM', '2 ERRORS'] },
];

async function actionBand() {
  const url = `https://img.mlbstatic.com/mlb-photos/image/upload/w_3000,q_auto:best/v1/people/${PLAYER_ID}/action/hero/current`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`写真取得に失敗: HTTP ${res.status}`); return null; }
  const src = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(src).metadata();
  const cropW = Math.min(Math.round(meta.height * (PANEL_W / PANEL_H)), meta.width);
  const left = Math.min(Math.max(Math.round(meta.width * FOCUS - cropW / 2), 0), meta.width - cropW);
  const out = await sharp(src)
    .extract({ left, top: 0, width: cropW, height: meta.height })
    .resize(PANEL_W, PANEL_H)
    .modulate({ brightness: 1.02, saturation: 1.02 })
    .sharpen()
    .png().toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

async function teamLogo(size) {
  for (const url of [
    `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${TEAM_ID}.svg`,
    `https://www.mlbstatic.com/team-logos/${TEAM_ID}.svg`,
  ]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const png = await sharp(Buffer.from(await res.arrayBuffer()), { density: 240 })
        .resize(size, size, { fit: 'inside' }).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch { /* 次の候補へ */ }
  }
  console.error('ロゴ取得に失敗');
  return null;
}

async function main() {
  const [photo, logo] = await Promise.all([actionBand(), teamLogo(52)]);
  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [an, be] = await Promise.all([
    fs.readFile(path.join(dir, 'anton.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const COL_TOP = PANEL_TOP + PANEL_H + 44;
  const col = (c, x) => h('div', { key: c.label, style: { position: 'absolute', top: COL_TOP, left: x, width: 420, display: 'flex', flexDirection: 'column' } }, [
    h('div', { key: 'l', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 27, letterSpacing: 6, color: INK_FAINT } }, c.label),
    h('div', { key: 'r', style: { display: 'flex', marginTop: 4, width: 52, height: 3, background: ACCENT } }),
    ...c.rows.map((r, i) => h('div', { key: `r${i}`, style: { display: 'flex', marginTop: i === 0 ? 18 : 16, fontFamily: 'Anton', fontSize: 40, letterSpacing: 0, lineHeight: 1.12, color: INK } }, r)),
  ]);

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    h('div', { key: 'bg', style: { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', background: BG } }),

    // ── ヘッダー ──
    h('div', { key: 'kick', style: { position: 'absolute', top: 88, left: M, display: 'flex', alignItems: 'center' } }, [
      logo && h('img', { key: 'lg', src: logo, width: 38, height: 38, style: { marginRight: 14 } }),
      h('div', { key: 'k', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 8, color: INK_FAINT } }, 'FREE AGENT THIS WINTER'),
    ].filter(Boolean)),
    h('div', { key: 'head', style: { position: 'absolute', top: 136, left: M, display: 'flex', alignItems: 'flex-end' } }, [
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 104, letterSpacing: 0, lineHeight: 1, color: INK } }, 'RE-SIGN SEIYA'),
      h('div', { key: 'd', style: { display: 'flex', marginLeft: 8, marginBottom: 6, width: 18, height: 18, background: ACCENT } }),
    ]),
    h('div', { key: 'sub', style: { position: 'absolute', top: 250, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 30, letterSpacing: 4, color: INK_MUTE } }, '32 TODAY · LAST YEAR OF 5 YRS / $85M'),
    ]),

    // ── 実写の横帯（角シャープ・下端だけわずかに沈める）──
    photo && h('img', { key: 'ph', src: photo, width: PANEL_W, height: PANEL_H, style: { position: 'absolute', top: PANEL_TOP, left: M } }),
    h('div', { key: 'sc', style: { position: 'absolute', top: PANEL_TOP, left: M, width: PANEL_W, height: PANEL_H, display: 'flex', backgroundImage: 'linear-gradient(to top, rgba(11,12,14,0.5) 0%, rgba(11,12,14,0) 26%)' } }),
    h('div', { key: 'nm', style: { position: 'absolute', top: PANEL_TOP + PANEL_H - 66, left: M + 24, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 46, letterSpacing: 1, color: INK } }, 'SEIYA SUZUKI'),
    ]),

    // ── 打撃と守備（同じ級数で並置）──
    col(COLS[0], M),
    col(COLS[1], M + 470),

    // ── フッター（現地の一行・出典）──
    h('div', { key: 'hr', style: { position: 'absolute', top: 1116, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'q', style: { position: 'absolute', top: 1146, left: M, display: 'flex' } }, [
      h('div', { key: 'b', style: { display: 'flex', width: 5, height: 84, background: ACCENT, marginRight: 18 } }),
      h('div', { key: 't', style: { display: 'flex', flexDirection: 'column' } }, [
        h('div', { key: 'l1', style: { display: 'flex', fontFamily: 'Anton', fontSize: 42, lineHeight: 1.08, color: INK } }, 'HE IS THE HIDEKI MATSUI'),
        h('div', { key: 'l2', style: { display: 'flex', fontFamily: 'Anton', fontSize: 42, lineHeight: 1.08, color: INK } }, 'OF OUR TEAM.'),
      ]),
    ]),
    h('div', { key: 'cr', style: { position: 'absolute', top: 1286, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 24, letterSpacing: 3, color: INK_FAINT } }, 'CUBS FAN ON REDDIT · PHOTO: MLB'),
    ]),
    h('div', { key: 'ft', style: { position: 'absolute', top: 1286, left: M, width: W - M * 2, display: 'flex', justifyContent: 'flex-end' } }, [
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
  const out = path.join(outDir, 'seiya-fa.png');
  await fs.writeFile(out, Buffer.from(await img.arrayBuffer()));
  console.log(`✓ RE-SIGN SEIYA カード → ${path.relative(process.cwd(), out)}（${W}×${H}・写真 ${photo ? '◯' : '×'}／ロゴ ${logo ? '◯' : '×'}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
