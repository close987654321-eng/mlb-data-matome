// 週刊総括コラムのサムネ生成（手描き線画プレート・1280×720）
// 使い方: node scripts/column-thumb.mjs <columnId> [--vol 1] [--date 2026.7.22] [--kanji 今週の総括]
// 出力: public/media/{columnId}-og.jpg（Column.thumbUrl に "/media/{columnId}-og.jpg" を書く）
//
// テイストの出自: 3号店(store3-travel)のプレート図版（線画モチーフ｜縦罫｜縦組み和文＋eyebrow）を
// 1号店の無彩色パレット（紙白×ニアブラック×赤一点=tailwind.config と一致）に移植したもの。
// 手描き感 = Catmull-Romで揺らいだ点を滑らかに結ぶ(ペンの一周)＋薄い重ね線。赤は縫い目の一点だけ
// ＝デザイン規律（メモリ design-system-monochrome）を画像側でも守る。
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 縦組み和文は同梱の クレー One SemiBold（手書き教科書風・OFL＝scripts/assets/KleeOne-OFL.txt）。
// fontconfig をこの設定に向けることで、実行マシンにフォントが無くても同じサムネが出る。
process.env.FONTCONFIG_FILE ??= join(dirname(fileURLToPath(import.meta.url)), 'assets/fonts.conf');

const W = 1280, H = 720;
const C = {
  paper: '#FAFAF9',
  ink: '#191A1C',
  inkSoft: '#565659',
  inkMute: '#97979B',
  line: '#E7E6E3',
  accent: '#C8102E',
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 閉じた点列を Catmull-Rom → cubic bezier で滑らかに結ぶ（手描きの一筆）
function smoothClosed(pts) {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
}

// 揺らぎ円: 半径ジッタ入りの点列(24点)を滑らかに閉じる
function wobblyCircle(cx, cy, r, jitter, seed, n = 24) {
  const rnd = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + (rnd() - 0.5) * 2 * jitter;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return smoothClosed(pts);
}

function qPoint(p0, p1, p2, t) {
  const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0];
  const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1];
  const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
  const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  const len = Math.hypot(dx, dy);
  return { x, y, nx: -dy / len, ny: dx / len };
}

// 縫い目1本（二次ベジェ弧＋軽いV字ステッチ）。V字は弧の両側に短く
function seam(p0, p1, p2, seed) {
  const rnd = mulberry32(seed);
  const path = `M ${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`;
  let ticks = '';
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = 0.12 + (0.72 * i) / (n - 1) + (rnd() - 0.5) * 0.03;
    const { x, y, nx, ny } = qPoint(p0, p1, p2, t);
    const tx = ny, ty = -nx;
    const s = 12 + (rnd() - 0.5) * 2;
    // seamを斜めに跨ぐ短いステッチ1本(角度に微ジッタ)＝野球ボールの縫い目の定番の見え方
    const ang = 0.62 + (rnd() - 0.5) * 0.18;
    const dxs = nx * Math.cos(ang) + tx * Math.sin(ang);
    const dys = ny * Math.cos(ang) + ty * Math.sin(ang);
    ticks += `<path d="M ${(x - dxs * s).toFixed(1)} ${(y - dys * s).toFixed(1)} L ${(x + dxs * s).toFixed(1)} ${(y + dys * s).toFixed(1)}"/>`;
  }
  return { path, ticks };
}

// 手描きの星（頂点に微ジッタ）
function star(cx, cy, s, seed, rot = -10) {
  const rnd = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = ((i * 36 + rot) * Math.PI) / 180;
    const rr = (i % 2 === 0 ? s : s * 0.46) * (1 + (rnd() - 0.5) * 0.12);
    pts.push([cx + rr * Math.sin(a), cy - rr * Math.cos(a)]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < 10; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d + ' Z';
}

// 手描きの直線の点列（両端の間を数点に割り、法線方向に微ジッタ＝定規を使わず引いた線）
function wobblyPoints(p0, p1, jitter, seed, n = 5) {
  const rnd = mulberry32(seed);
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = i === 0 || i === n ? 0 : (rnd() - 0.5) * 2 * jitter;
    pts.push([p0[0] + dx * t + nx * j, p0[1] + dy * t + ny * j]);
  }
  return pts;
}

const polyD = (pts) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

const wobblyLine = (p0, p1, jitter, seed, n = 5) => polyD(wobblyPoints(p0, p1, jitter, seed, n));

/**
 * リング（格闘技コラム用モチーフ）。ボールと同じ規律で描く＝墨の一筆＋薄い重ね線、
 * 赤は一点だけ（ボールの縫い目にあたるのがロープ）。
 * MLB以外の競技のコラムで `--motif ring` を指定する。
 */
function ringMotif(cx, cy) {
  const mat = [[cx - 132, cy - 52], [cx + 132, cy - 52], [cx + 190, cy + 86], [cx - 190, cy + 86]];
  const postH = [118, 118, 150, 150]; // 手前の2本を高く＝奥行き
  // マットは角を丸めない（smoothClosed だと四角が団子になる）＝辺ごとに手描きの直線を繋ぐ
  const canvas =
    polyD(mat.flatMap((p, i) => wobblyPoints(p, mat[(i + 1) % 4], 2, 90 + i).slice(0, -1))) + ' Z';
  const posts = mat.map((p, i) => wobblyLine(p, [p[0], p[1] - postH[i]], 2, 40 + i));
  // ロープ3段。各辺の同じ高さ比の点どうしを結ぶ
  const at = (i, r) => [mat[i][0], mat[i][1] - postH[i] * r];
  const ropes = [];
  for (const [k, r] of [0.3, 0.58, 0.86].entries()) {
    for (const [a, b] of [[0, 1], [1, 2], [3, 0], [3, 2]]) {
      ropes.push(wobblyLine(at(a, r), at(b, r), 2.5, 60 + k * 10 + a));
    }
  }
  return { canvas, posts, ropes };
}

// ── レイアウト（全体をひとかたまりで中央へ）─────────────
const BX = 512, BY = 396, R = 170;
const circle1 = wobblyCircle(BX, BY, R, 4.5, 7);
const circle2 = wobblyCircle(BX, BY, R, 6, 23);
const sA = seam([BX - 66, BY - R + 16], [BX + 44, BY], [BX - 66, BY + R - 16], 11);
const sB = seam([BX + 94, BY - R + 44], [BX - 2, BY], [BX + 94, BY + R - 44], 31);

const args = process.argv.slice(2);
const columnId = args.find((a) => !a.startsWith('--'));
if (!columnId) {
  console.error('usage: node scripts/column-thumb.mjs <columnId> [--vol N|none] [--date YYYY.M.D] [--kanji 今週の総括]');
  process.exit(1);
}
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
// 号数。定期枠（週刊総括・データ定点分析）は連番を振るが、単発の論争深掘り等は連番ではないので
// `--vol none` で省略できる（連番でない記事に VOL.01 と入れると第1号だと誤読される）。
const VOL_RAW = String(opt('vol', '1'));
const VOL = /^(none|no|0|-)$/i.test(VOL_RAW) ? null : VOL_RAW.padStart(2, '0');
const DATE = opt('date', new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replaceAll('/', '.'));
const KANJI = Array.from(opt('kanji', '今週の総括'));
// 上部の英字キッカー。週刊総括の既定は THIS WEEK IN MLB、データ定点分析(型④)等は
// --kicker で差し替える（例: RACE BOARD CHECK）。同程度の文字数だとレイアウトが揃う。
const KICKER = opt('kicker', 'THIS WEEK IN MLB');
// 図版のモチーフ。既定は野球ボール。格闘技（ボクシング/MMA）のコラムは ring を指定する
// ＝MLB以外の記事に野球ボールが載るのを避ける。赤は一点だけの規律はどちらも同じ。
const MOTIF = /^ring$/i.test(String(opt('motif', 'ball'))) ? 'ring' : 'ball';
const RING = MOTIF === 'ring' ? ringMotif(BX, BY) : null;
const GLYPH = 84;
const TX = 806;
const colH = KANJI.length * (GLYPH + 9) - 9;
const textYs = KANJI.map((_, i) => (720 - 90 - colH) / 2 + 40 + i * (GLYPH + 9));
const vtext = KANJI.map(
  (ch, i) =>
    `<text x="${TX + 48}" y="${textYs[i] + GLYPH * 0.82}" font-family="Klee One" font-weight="600" font-size="${GLYPH}" fill="${C.ink}" text-anchor="middle">${ch}</text>`,
).join('\n');

// eyebrow は図版＋縦組みの重心(約640)にセンタリング
const EYC = 655, EY = 92;
const eyebrow = `
  <rect x="${EYC - 205}" y="${EY - 21}" width="7" height="27" fill="${C.accent}"/>
  <text x="${EYC - 182}" y="${EY}" font-family="Avenir Next Condensed, Futura, Helvetica Neue, sans-serif" font-weight="600" font-size="27" letter-spacing="7" fill="${C.inkSoft}">${KICKER}</text>
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.paper}"/>

  ${eyebrow}

  ${
    RING
      ? `
  <!-- リング: マット＋コーナーポスト（墨）、ロープが赤の一点 -->
  <path d="${RING.canvas}" fill="#FFFFFF" stroke="${C.ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="none" stroke="${C.ink}" stroke-width="7" stroke-linecap="round">
    ${RING.posts.map((d) => `<path d="${d}"/>`).join('\n    ')}
  </g>
  <g fill="none" stroke="${C.accent}" stroke-width="5" stroke-linecap="round">
    ${RING.ropes.map((d) => `<path d="${d}"/>`).join('\n    ')}
  </g>`
      : `
  <!-- ボール本体: ペンの一周＋薄い重ね線（鉛筆の下書きが残る感じ） -->
  <path d="${circle2}" fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round" opacity="0.30"/>
  <path d="${circle1}" fill="#FFFFFF" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>

  <!-- 縫い目（赤の一点） -->
  <g fill="none" stroke="${C.accent}" stroke-width="5.5" stroke-linecap="round">
    <path d="${sA.path}"/>
    <path d="${sB.path}"/>
  </g>
  <g fill="none" stroke="${C.accent}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
    ${sA.ticks}
    ${sB.ticks}
  </g>`
  }

  <!-- 星（墨・手描き） -->
  <path d="${star(BX + R + 44, BY - R - 2, 25, 5)}" fill="none" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>

  <!-- 縦罫｜縦組み -->
  <line x1="${TX}" y1="${textYs[0] - 4}" x2="${TX}" y2="${textYs[KANJI.length - 1] + GLYPH + 4}" stroke="${C.line}" stroke-width="2"/>
  ${vtext}

  <!-- 地の短い墨罫と号数 -->
  <rect x="${EYC - 32}" y="${H - 76}" width="64" height="3" fill="${C.ink}"/>
  <text x="${EYC}" y="${H - 40}" font-family="Avenir Next Condensed, Futura, Helvetica Neue, sans-serif" font-size="20" letter-spacing="4" fill="${C.inkMute}" text-anchor="middle">${VOL ? `VOL.${VOL} — ${DATE}` : DATE}</text>
</svg>`;

const out = join(process.cwd(), 'public/media', `${columnId}-og.jpg`);
await sharp(Buffer.from(svg), { density: 96 }).flatten({ background: '#FAFAF9' }).jpeg({ quality: 90 }).toFile(out);
console.log('written', out, '→ Column.thumbUrl に "/media/' + columnId + '-og.jpg"');
