/**
 * X 投稿用「TWO MEN AT 28」対決カード PNG 生成（x-post スキルの弾・案A用）。
 *
 *   node scripts/chicago-28-card.mjs
 *
 * MLB 公式の Player of the Week グラフィックの構図（2枚の縦パネルに"かっこいい瞬間"の実写＋
 * 名前＋成績＋球団ロゴ）を、サイトのハウススタイル（無彩色ミニマル・角シャープ・差し色は赤1点＝
 * tailwind.config.ts の accent #C8102E）で組んだもの。1080×1350＝X のタイムラインが切り抜かない
 * 4:5 ちょうどで出す。
 *
 * ⚠️ 金の箔・メタリックのグラデ文字・二重の飾り枠・多層シャドウは**使わない**（2026-08-17 村山
 * 指摘＝AI が作った既製カードに見える）。効かせるのは実写・余白・級数差・赤の細罫だけ。文字は
 * 原則すべて英語＝放送グラフィックの顔にする（日本語は入れない）。
 *
 * ポストの芯は「今年のシカゴの顔はどっち」の二択なので、**左右は完全対称**にする＝どちらかを
 * 大きく／上に置くと絵の側が勝敗を断定してしまい、読者に持論を出させる〆が閉じる。
 *
 * 写真は MLB 公式のアクション写真（img.mlbstatic.com の action/hero）＝X 配信用の引用。数値は
 * 捏造せず statsapi で当日裏取り済み（2026-08-17: 村上 88試合28本 OPS.911 ／ PCA 125試合28本
 * OPS.907 ／ 翌 JST 8/18 リグレーで両チーム対戦・カブス先発は今永昇太）。_local は非コミット。
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

const PLAYERS = [
  // focus: 3000×1000 の元画像のどこを縦パネルに切り出すか（打者が中心に来る位置を実測で調整）
  { id: 808959, teamId: 145, side: 'SOUTH SIDE', name: 'MURAKAMI', stat: '28 HR · 88 G · .911 OPS', focus: 0.46 },
  { id: 691718, teamId: 112, side: 'NORTH SIDE', name: 'CROW-ARMSTRONG', stat: '28 HR · 125 G · .907 OPS', focus: 0.58 },
];

const fill = { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex' };
const row = (extra) => ({ display: 'flex', alignItems: 'center', ...extra });

/**
 * MLB 公式のアクション写真（3000×1000 の横長）から縦パネルを切り出す。
 * 横長のまま縮めると打者が豆粒になるので、被写体の周りを縦に切って寄る。
 */
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

/** 球団ロゴ（暗い地に置くので on-dark 版のキャップロゴを使う＝黒いソックスのロゴが沈まない）。 */
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

/** パネル1枚（実写＋所属サイドのタグ）。左右で同じ関数＝対称を担保する。 */
function panel(p, photo, x) {
  return h('div', { key: `p${p.id}`, style: { position: 'absolute', top: PANEL_TOP, left: x, width: PANEL_W, height: PANEL_H, display: 'flex' } }, [
    photo && h('img', { key: 'ph', src: photo, width: PANEL_W, height: PANEL_H, style: { position: 'absolute', top: 0, left: 0 } }),
    // 下端をわずかに沈めるだけ（文字はパネルの外に置くので、写真を暗く潰さない）
    h('div', { key: 'sc', style: { position: 'absolute', top: 0, left: 0, width: PANEL_W, height: PANEL_H, display: 'flex', backgroundImage: 'linear-gradient(to top, rgba(11,12,14,0.55) 0%, rgba(11,12,14,0) 22%)' } }),
    // 所属サイドのタグ（角シャープ・塗りは1点だけ）
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

  // 名前＋成績のブロック（パネルの下・左右対称）
  const nameBlock = (p, logo, x) => h('div', { key: `n${p.id}`, style: { position: 'absolute', top: PANEL_TOP + PANEL_H + 26, left: x, width: PANEL_W, display: 'flex', flexDirection: 'column' } }, [
    h('div', { key: 'nm', style: row({ height: 52 }) }, [
      logo && h('img', { key: 'lg', src: logo, width: 44, height: 44, style: { marginRight: 14 } }),
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: p.name.length > 10 ? 41 : 50, letterSpacing: 1, color: INK } }, p.name),
    ].filter(Boolean)),
    h('div', { key: 'st', style: { display: 'flex', marginTop: 12, fontFamily: 'Bebas', fontSize: 31, letterSpacing: 3, color: INK_MUTE } }, p.stat),
  ]);

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    // 地は単色。グラデも光沢も置かない（色は写真のユニフォームだけで足りる）
    h('div', { key: 'bg', style: { ...fill, background: BG } }),

    // ── ヘッダー（左寄せの編集見出し）──
    h('div', { key: 'kick', style: { position: 'absolute', top: 92, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 30, letterSpacing: 9, color: INK_FAINT } }, 'CHICAGO 2026'),
    ]),
    // ⚠️ 見出しで人数を数えない（バルガスも28本＝シカゴには28本が3人いる）。問うのは「顔はどっちか」。
    h('div', { key: 'head', style: { position: 'absolute', top: 130, left: M, display: 'flex', alignItems: 'flex-end' } }, [
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 96, letterSpacing: 0, lineHeight: 1, color: INK } }, 'THE FACE OF CHICAGO'),
      h('div', { key: 'qm', style: { display: 'flex', marginLeft: 10, fontFamily: 'Bebas', fontSize: 118, letterSpacing: 0, lineHeight: 0.82, color: ACCENT } }, '?'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 252, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),

    // ── 実写パネル2枚（角シャープ・左右対称）──
    panel(PLAYERS[0], photoL, LEFT_X),
    panel(PLAYERS[1], photoR, RIGHT_X),

    // ── 名前と成績 ──
    nameBlock(PLAYERS[0], logoL, LEFT_X),
    nameBlock(PLAYERS[1], logoR, RIGHT_X),

    // ── フッター（二択・対戦情報・出典）──
    h('div', { key: 'hr', style: { position: 'absolute', top: 1126, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'q', style: { position: 'absolute', top: 1152, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 62, letterSpacing: 0, lineHeight: 1, color: INK } }, 'ROUND 1 AT WRIGLEY FIELD'),
    ]),
    h('div', { key: 'meta', style: { position: 'absolute', top: 1232, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 29, letterSpacing: 4, color: INK_MUTE } }, 'AUG 18 · IMANAGA ON THE MOUND · SUZUKI IN THE LINEUP'),
    ]),
    h('div', { key: 'cr', style: { position: 'absolute', top: 1282, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 24, letterSpacing: 3, color: INK_FAINT } }, 'PHOTOS: MLB'),
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
  const out = path.join(outDir, 'chicago-28.png');
  await fs.writeFile(out, buf);
  console.log(`✓ TWO MEN AT 28 カード → ${path.relative(process.cwd(), out)}（${W}×${H}・村上 ${photoL ? '◯' : '×'}／PCA ${photoR ? '◯' : '×'}／ロゴ ${logoL && logoR ? '◯' : '×'}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
