/**
 * X 投稿用「NEVER SAID IT / NEVER DID IT」カード PNG 生成（x-post 案A・山本の言ってない名言集×イチロー伝説）。
 *
 *   node scripts/never-said-it-card.mjs
 *
 * 様式は chicago-28-card.mjs / yama-miz-card.mjs と同じ（無彩色フラット・角シャープ・差し色は赤1点＝
 * #C8102E・英語のみ・左寄せ編集レイアウト・1080×1350）。金の箔もメタリックのグラデも多層シャドウも
 * 置かない（2026-08-17 村山指摘＝AI が作った既製カードに見える）。
 *
 * ポストの〆は「MLBも日本も野球ファンの愛情表現って一緒だな」なので**左右は完全対称**にする＝
 * 片方を大きく／上に置くと「どっちが本家か」の話に見えて、同じことをやっているという芯が消える。
 *
 * ⚠️ 写真は action/hero でなく **headshot/silo（切り抜きの顔写真）** を使う。理由は2つ＝
 *   ①このカードの中身は発言と言い分なので、顔に台詞を貼る作りの方が形に合う（放送の引用グラフィック）
 *   ②イチロー（400085）の action/hero はセーフコの引きの絵で**後ろ姿・顔が写らない**。寄っても背中の
 *     ままで、山本の寄りと釣り合わない（縦横の切り出しを4パターン試して不採用）。
 *
 * ⚠️ 6行のセリフは**全部 Reddit に実在する書き込み**（捏造しない・§4.4）。生ログは
 * _local/reddit-scan/yama-quotes.txt と ichiro-2.txt に保存済み。
 *   左（言ってない）= r/Dodgers「Yoshinobu Yamamoto's "Quotes"」2025-10-26 の英語版名言リスト。
 *     投稿主自身が末尾で he didn't actually say most of these と断っている。
 *   右（やってない）= r/mlb「52-year-old Ichiro rakes at the old-timer's home run derby」2026-08-09 と
 *     r/baseball「Ichiro was swinging it at the Mariners Alumni Home Run Derby!」2026-08-10 のコメント。
 *     I bet he could DH for a team right now and still hit at least .270 ／ He'd still hit better than
 *     most of the Mariners offense ／ Ichiro at 52 would be a .325+ hitter with more pop and speed。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const W = 1080, H = 1350, M = 64;
const INK = '#F2F0EA';
const INK_MUTE = 'rgba(242,240,234,0.62)';
const INK_FAINT = 'rgba(242,240,234,0.34)';
const RULE = 'rgba(242,240,234,0.14)';
const TONE = 'rgba(242,240,234,0.06)';
const ACCENT = '#C8102E';
const BG = '#0B0C0E';

const GUTTER = 16;
const COL_W = Math.round((W - M * 2 - GUTTER) / 2);
const COL_H = 496, COL_TOP = 332;
const LEFT_X = M, RIGHT_X = M + COL_W + GUTTER;
const PORTRAIT = 452;

const SIDES = [
  {
    id: 808967, teamId: 119, tag: 'NEVER SAID IT', name: 'YAMAMOTO',
    lines: ['COLE, YOU’D BETTER TAKE NOTES.', 'LOCK THE BULLPEN DOOR.', 'LOSING IS NOT AN OPTION.'],
  },
  {
    id: 400085, teamId: 136, tag: 'NEVER DID IT', name: 'ICHIRO',
    lines: ['HE’D DH AND STILL HIT .270.', 'BETTER THAN HALF THIS LINEUP.', 'AT 52 HE’D HIT .325 WITH POWER.'],
  },
];

const fill = { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex' };
const row = (extra) => ({ display: 'flex', alignItems: 'center', ...extra });

/** MLB 公式の切り抜き顔写真（透過 PNG）。地に載せるので背景は合成せずそのまま使う。 */
async function silo(id, size) {
  const url = `https://img.mlbstatic.com/mlb-photos/image/upload/w_900,q_auto:best/v1/people/${id}/headshot/silo/current`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`写真取得に失敗: ${id} HTTP ${res.status}`); return null; }
  const src = Buffer.from(await res.arrayBuffer());
  const out = await sharp(src).resize(size, size, { fit: 'inside' }).png().toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

/** 球団ロゴ（暗い地に置くので on-dark 版のキャップロゴを使う）。 */
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

/** 顔写真1枚（うっすらした地の四角に、肩が下辺で切れる形で置く）。左右で同じ関数＝対称を担保する。 */
function portrait(p, img, x) {
  return h('div', { key: `p${p.id}`, style: { position: 'absolute', top: COL_TOP, left: x, width: COL_W, height: COL_H, display: 'flex' } }, [
    h('div', { key: 'tone', style: { position: 'absolute', top: 0, left: 0, width: COL_W, height: COL_H, display: 'flex', background: TONE } }),
    img && h('img', {
      key: 'im', src: img, width: PORTRAIT, height: PORTRAIT,
      style: { position: 'absolute', top: COL_H - PORTRAIT + 6, left: Math.round((COL_W - PORTRAIT) / 2) },
    }),
  ].filter(Boolean));
}

/** 見出しタグ（顔の外・写真の上）。 */
function tag(p, x) {
  return h('div', { key: `t${p.id}`, style: { position: 'absolute', top: COL_TOP - 42, left: x, display: 'flex' } }, [
    h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 5, color: INK } }, p.tag),
  ]);
}

async function main() {
  const [imgL, imgR, logoL, logoR] = await Promise.all([
    silo(SIDES[0].id, PORTRAIT),
    silo(SIDES[1].id, PORTRAIT),
    teamLogo(SIDES[0].teamId, 96),
    teamLogo(SIDES[1].teamId, 96),
  ]);

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [an, be] = await Promise.all([
    fs.readFile(path.join(dir, 'anton.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  // 名前＋実在する書き込み3行（顔の下・左右対称）
  const block = (p, logo, x) => h('div', { key: `n${p.id}`, style: { position: 'absolute', top: COL_TOP + COL_H + 24, left: x, width: COL_W, display: 'flex', flexDirection: 'column' } }, [
    h('div', { key: 'nm', style: row({ height: 50 }) }, [
      logo && h('img', { key: 'lg', src: logo, width: 42, height: 42, style: { marginRight: 14 } }),
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 48, letterSpacing: 1, color: INK } }, p.name),
    ].filter(Boolean)),
    h('div', { key: 'hr', style: { display: 'flex', marginTop: 16, width: COL_W, height: 1, background: RULE } }),
    ...p.lines.map((line, i) => h('div', { key: `l${i}`, style: { display: 'flex', marginTop: i === 0 ? 16 : 9, fontFamily: 'Bebas', fontSize: 27, letterSpacing: 1, color: INK_MUTE } }, line)),
  ]);

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    h('div', { key: 'bg', style: { ...fill, background: BG } }),

    // ── ヘッダー（左寄せの編集見出し・句点だけ赤）──
    h('div', { key: 'kick', style: { position: 'absolute', top: 84, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 29, letterSpacing: 9, color: INK_FAINT } }, 'BASEBALL FAN FICTION'),
    ]),
    h('div', { key: 'head', style: { position: 'absolute', top: 120, left: M, display: 'flex', alignItems: 'flex-start' } }, [
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 98, lineHeight: 1, color: INK } }, 'WE MADE IT ALL UP'),
      h('div', { key: 'd', style: { display: 'flex', fontFamily: 'Anton', fontSize: 98, lineHeight: 1, color: ACCENT } }, '.'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 244, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),

    // ── 顔写真2枚（角シャープ・左右対称）──
    tag(SIDES[0], LEFT_X),
    tag(SIDES[1], RIGHT_X),
    portrait(SIDES[0], imgL, LEFT_X),
    portrait(SIDES[1], imgR, RIGHT_X),

    // ── 名前と、現地で実際に出回っている言い分 ──
    block(SIDES[0], logoL, LEFT_X),
    block(SIDES[1], logoR, RIGHT_X),

    // ── フッター（〆・出典）──
    h('div', { key: 'fhr', style: { position: 'absolute', top: 1116, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'q', style: { position: 'absolute', top: 1142, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 54, lineHeight: 1, color: INK } }, 'SAME LOVE, EITHER SIDE OF THE PACIFIC'),
    ]),
    h('div', { key: 'meta', style: { position: 'absolute', top: 1220, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 27, letterSpacing: 4, color: INK_MUTE } }, 'REAL POSTS. r/DODGERS · r/MLB · r/BASEBALL'),
    ]),
    h('div', { key: 'cr', style: { position: 'absolute', top: 1280, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 24, letterSpacing: 3, color: INK_FAINT } }, 'PHOTOS: MLB'),
    ]),
    h('div', { key: 'ft', style: { position: 'absolute', top: 1280, left: M, width: W - M * 2, display: 'flex', justifyContent: 'flex-end' } }, [
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
  const out = path.join(outDir, 'never-said-it.png');
  await fs.writeFile(out, buf);
  console.log(`✓ NEVER SAID IT カード → ${path.relative(process.cwd(), out)}（${W}×${H}・山本 ${imgL ? '○' : '×'}／イチロー ${imgR ? '○' : '×'}／ロゴ ${logoL && logoR ? '○' : '×'}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
