/**
 * X 投稿用「FOUR ARMS, ONE AFTERNOON」カード PNG 生成（x-post 案A・日本人投手4人が同じ日に沈んだ回）。
 *
 *   node scripts/four-arms-card.mjs
 *
 * ネタは ET 2026-08-23。日本人投手が4人投げて4人とも打たれた日に、r/whitesox の試合後スレへ
 * 板の常連の日本人が as a Japanese person, it makes me sad と書き込み、現地のファンが
 * We all know Japanese people can play ball! と慰めた（生ログ = _local/reddit-scan/jp-pitchers-0824.md）。
 * カードは**上で日本人の書き込みを張り、下で現地の返しを回収する**構造にする＝本文と同じ框。
 * 題字・オチはどちらも板の実在の書き込みで、編集部の造語ではない（捏造しない・§4.4）。
 *
 * ハウススタイルは chicago-28-card.mjs / yoshida-eulogy-card.mjs と同じ＝無彩色フラット・角シャープ・
 * 差し色は赤1点（#C8102E）・文字は全部英語・左寄せ編集レイアウト・1080×1350。⚠️ 金の箔・メタリックの
 * グラデ・多層シャドウは置かない（2026-08-17 村山指摘＝AI が作った既製カードに見える）。
 * 効かせるのは実写・余白・級数差・赤の細罫だけ。
 *
 * ⚠️ この回は「沈んだ日」が主題なので**顔は grayscale に落とす**＝勝った日のカードと同じ彩度で並べると
 * 祝いの絵に見える。エモさは彩度を上げるのではなく抜いて作る。
 *
 * ⚠️ 写真は action/hero でなく headshot/silo（切り抜きの顔）。理由は2つ＝①4人を横一列の点呼として
 * 並べるので背景のある絵は使えない ②菅野・菊池・千賀は action/hero の絵柄が球団も年代もバラバラで、
 * 4枚並べると釣り合わない。**ローカルキャッシュ（public/media/card-art/）を CDN より先に読む**
 * ＝クラウド無人実行が img.mlbstatic.com を 403 で弾かれても絵が出る（CLAUDE.md §4.1）。
 *
 * 数値は statsapi で当日裏取り済み（2026-08-24 取得）:
 *   菅野 3.0回 9安打 5自責 / 菊池 5.0回 7安打 5自責 / 今永 先頭アロザレーナに被弾・2.0回 1自責 /
 *   千賀 0.1回 サヨナラ被弾で9敗目。今季MLBのマウンドに立った日本人投手は9人
 *   （大谷・山本・佐々木・今永・千賀・菊池・松井裕・菅野・今井＝全員 2026 の登板あり）。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const W = 1080, H = 1350, M = 64;
const INK = '#F2F0EA';
const INK_MUTE = 'rgba(242,240,234,0.60)';
const INK_FAINT = 'rgba(242,240,234,0.34)';
const RULE = 'rgba(242,240,234,0.14)';
const ACCENT = '#C8102E';
const BG = '#0B0C0E';

const GUTTER = 14;
const COL_W = Math.round((W - M * 2 - GUTTER * 3) / 4);
const PORTRAIT_TOP = 352, PORTRAIT = COL_W;

// 並びは登板の順ではなく「打たれ方の重さ」順（KO → KO → 先頭被弾 → サヨナラ）＝最後に一番痛いのを置く。
const ARMS = [
  { id: 608372, name: 'SUGANO',  npb: 'YOMIURI ACE',        line: '3.0 IP · 5 ER' },
  { id: 579328, name: 'KIKUCHI', npb: 'SEIBU ACE',          line: '5.0 IP · 5 ER' },
  { id: 684007, name: 'IMANAGA', npb: 'YOKOHAMA ACE',       line: 'LEADOFF HR' },
  { id: 673540, name: 'SENGA',   npb: 'SOFTBANK DEV. PICK',  line: 'WALK-OFF LOSS' },
];

/** 切り抜きの顔写真。ローカルキャッシュ → CDN の順に読み、沈んだ日なので彩度を抜く。 */
async function silo(id, size) {
  const cached = path.join(process.cwd(), 'public', 'media', 'card-art', `headshot-${id}.png`);
  let src = null;
  try { src = await fs.readFile(cached); } catch { /* CDN へ */ }
  if (!src) {
    const url = `https://img.mlbstatic.com/mlb-photos/image/upload/w_900,q_auto:best/v1/people/${id}/headshot/silo/current`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`写真取得に失敗: ${id} HTTP ${res.status}`); return null; }
    src = Buffer.from(await res.arrayBuffer());
  }
  const out = await sharp(src)
    .resize(size, size, { fit: 'inside' })
    .grayscale()
    .modulate({ brightness: 1.04 })
    .png().toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

async function main() {
  const photos = await Promise.all(ARMS.map((a) => silo(a.id, PORTRAIT)));
  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [an, be] = await Promise.all([
    fs.readFile(path.join(dir, 'anton.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const text = (font, size, color, extra = {}) => ({
    display: 'flex', fontFamily: font, fontSize: size, lineHeight: 1, color, ...extra,
  });

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    h('div', { key: 'bg', style: { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', background: BG } }),

    // ── ヘッダー＝日本人ファンの書き込みをそのまま題字にする ──
    h('div', { key: 'kick', style: { position: 'absolute', top: 84, left: M, display: 'flex' } }, [
      h('div', { style: text('Bebas', 28, INK_FAINT, { letterSpacing: 7 }) }, 'AUG 23 · R/WHITESOX POSTGAME THREAD'),
    ]),
    h('div', { key: 'h1', style: { position: 'absolute', top: 124, left: M, display: 'flex' } }, [
      h('div', { style: text('Anton', 82, INK) }, 'AS A JAPANESE PERSON,'),
    ]),
    h('div', { key: 'h2', style: { position: 'absolute', top: 210, left: M, display: 'flex' } }, [
      h('div', { style: text('Anton', 82, INK) }, 'IT MAKES ME SAD.'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 314, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),

    // ── 4人の点呼（顔は彩度を抜いてある）──
    ...ARMS.flatMap((a, i) => {
      const x = M + i * (COL_W + GUTTER);
      return [
        photos[i] && h('img', {
          key: `p${i}`, src: photos[i], width: PORTRAIT, height: PORTRAIT,
          style: { position: 'absolute', top: PORTRAIT_TOP, left: x },
        }),
        // silo は肩でスパッと切れているので、下端を地の色に溶かす（4枚並べたときの証明写真感を消す）
        h('div', {
          key: `f${i}`,
          style: {
            position: 'absolute', top: PORTRAIT_TOP + PORTRAIT - 96, left: x, width: PORTRAIT, height: 96,
            display: 'flex', backgroundImage: `linear-gradient(to top, ${BG} 12%, rgba(11,12,14,0) 100%)`,
          },
        }),
        h('div', { key: `n${i}`, style: { position: 'absolute', top: PORTRAIT_TOP + PORTRAIT + 18, left: x, display: 'flex' } }, [
          h('div', { style: text('Anton', 36, INK) }, a.name),
        ]),
        h('div', { key: `s${i}`, style: { position: 'absolute', top: PORTRAIT_TOP + PORTRAIT + 66, left: x, display: 'flex' } }, [
          h('div', { style: text('Bebas', 25, INK_MUTE, { letterSpacing: 2 }) }, a.line),
        ]),
        h('div', { key: `j${i}`, style: { position: 'absolute', top: PORTRAIT_TOP + PORTRAIT + 100, left: x, display: 'flex' } }, [
          h('div', { style: text('Bebas', 22, INK_FAINT, { letterSpacing: 2 }) }, a.npb),
        ]),
      ].filter(Boolean);
    }),

    // ── 事実の段（級数差だけで落差を出す）──
    h('div', { key: 'r2', style: { position: 'absolute', top: 730, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'c1', style: { position: 'absolute', top: 762, left: M, display: 'flex' } }, [
      h('div', { style: text('Bebas', 31, INK_MUTE, { letterSpacing: 3 }) }, 'NINE JAPANESE PITCHERS HAVE THROWN IN THE MAJORS THIS YEAR.'),
    ]),
    h('div', { key: 'c2', style: { position: 'absolute', top: 802, left: M, display: 'flex' } }, [
      h('div', { style: text('Bebas', 31, INK_MUTE, { letterSpacing: 3 }) }, 'FOUR OF THEM TOOK THE MOUND ON THE SAME AFTERNOON.'),
    ]),
    h('div', { key: 'c3', style: { position: 'absolute', top: 862, left: M, display: 'flex' } }, [
      h('div', { style: text('Anton', 62, INK) }, 'ALL FOUR GOT HIT.'),
    ]),

    // ── フッター＝現地の返しで回収する ──
    h('div', { key: 'r3', style: { position: 'absolute', top: 986, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'kick2', style: { position: 'absolute', top: 1014, left: M, display: 'flex' } }, [
      h('div', { style: text('Bebas', 26, INK_FAINT, { letterSpacing: 6 }) }, 'AND CHICAGO REPLIED'),
    ]),
    h('div', { key: 'p1', style: { position: 'absolute', top: 1056, left: M, display: 'flex' } }, [
      h('div', { style: text('Anton', 60, INK) }, 'WE ALL KNOW JAPANESE'),
    ]),
    h('div', { key: 'p2', style: { position: 'absolute', top: 1122, left: M, display: 'flex' } }, [
      h('div', { style: text('Anton', 60, ACCENT) }, 'PEOPLE CAN PLAY BALL.'),
    ]),

    h('div', { key: 'cr', style: { position: 'absolute', top: 1284, left: M, display: 'flex' } }, [
      h('div', { style: text('Bebas', 24, INK_FAINT, { letterSpacing: 3 }) }, 'PHOTO: MLB'),
    ]),
    h('div', { key: 'ft', style: { position: 'absolute', top: 1284, left: M, width: W - M * 2, display: 'flex', justifyContent: 'flex-end' } }, [
      h('div', { style: text('Bebas', 24, INK_FAINT, { letterSpacing: 3 }) }, 'MATOME-MLB-KAIGAI.JP'),
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
  const out = path.join(outDir, 'four-arms.png');
  await fs.writeFile(out, Buffer.from(await img.arrayBuffer()));
  console.log(`✓ FOUR ARMS カード → ${path.relative(process.cwd(), out)}（${W}×${H}・写真 ${photos.filter(Boolean).length}/4）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
