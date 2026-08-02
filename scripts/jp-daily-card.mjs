/**
 * X 投稿用「きょうの日本人」カード PNG 生成（x-post / x-share スキルの弾）。
 *
 *   node scripts/jp-daily-card.mjs [YYYY-MM-DD(ET)] [--out <path>]
 *
 * その日(ET)に出場した日本人選手だけを 1 枚に載せる定番カード。データは
 * `fetch-mlb-stats.mjs jpday`（MLB公式 Stats API・公知の数値のみ）が唯一の源。
 *
 * 設計の芯は 3 つ。
 *  1. 主役を 1 人だけ立てる … 全員フラットに並べると毎日同じ絵になり 3 日で飽きる。その日いちばん
 *     働いた選手をスコアで選び、顔を大きく出す＝毎日ちがう絵になる。
 *  2. 成績を文字列でなく数字チップで見せる … 「4打数1安打 1本塁打 1打点」は情報としては正しいが、
 *     タイムラインのスクロールでは読まれない。大きな数字＋小さなラベルに分解して視認性を取る。
 *  3. 全員載せる（無安打も） … 「これ1枚で日本人の全部がわかる」が価値なので、都合の悪い日も隠さない。
 *
 * デザイントークンは mvp-card.mjs / deadline-map-card.mjs と同一（インク紺＋オフホワイト＋
 * シャンパン1色・和文 Zen Kaku Gothic New／英数字 Bebas Neue）。出力は _local/x-images/（非コミット）。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);

// ── 配色（ハウススタイル：フラットなインク紺＋オフホワイト＋抑えたシャンパン1色）──────────
const INK = '#F2F0EA';
const INK_MUTE = 'rgba(242,240,234,0.62)';
const INK_FAINT = 'rgba(242,240,234,0.40)';
const INK_GHOST = 'rgba(242,240,234,0.22)';
const RULE = 'rgba(255,255,255,0.09)';
const BG0 = '#0D2039', BG1 = '#070F1C';
const ACCENT = '#CDB884';
const ACCENT_SOFT = 'rgba(205,184,132,0.55)';
const PANEL = 'rgba(255,255,255,0.045)';

const W = 1080, H = 1350, PAD = 62;

/**
 * 球団カラー（src/lib/teams.ts が唯一の正）を日本語チーム名で引く。カードの地の色を主役の球団色に
 * 振るために使う＝毎日ちがう色になり、並べたときにコレクションとして見える。
 * teams.ts をパースするのは、色の定義を2箇所に持たないため（ズレるとサイトとXで別の色になる）。
 */
async function loadTeamColors() {
  const src = await fs.readFile(path.join(process.cwd(), 'src', 'lib', 'teams.ts'), 'utf8');
  const map = new Map();
  for (const m of src.matchAll(/^\s{2}([^\s:]+):\s*\{\s*id:\s*(\d+),\s*color:\s*'(#[0-9A-Fa-f]{6})'/gm)) {
    map.set(m[1], { id: Number(m[2]), color: m[3] });
  }
  return map;
}

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (hex, other, t) => toHex(rgbOf(hex).map((v, i) => v * (1 - t) + rgbOf(other)[i] * t));
const rgba = (hex, a) => `rgba(${rgbOf(hex).join(',')},${a})`;
/** 彩度。黒・紺・茶の球団（ホワイトソックス等）は地に敷いても色が立たないので、金に逃がす判定に使う。 */
const sat = (hex) => { const [r, g, b] = rgbOf(hex); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
/** 相対輝度。黒すぎる球団色（ホワイトソックス等）は持ち上げないと地が真っ黒に沈む。 */
const lum = (hex) => { const [r, g, b] = rgbOf(hex).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** 地に敷ける明度に整えた球団色＝暗すぎる色は明るく、明るすぎる色は落として、常に同じ重さで見せる。 */
function teamTone(hex) {
  if (!hex) return '#1B3358';
  let c = hex;
  let n = 0;
  while (lum(c) < 0.09 && n++ < 6) c = mix(c, '#FFFFFF', 0.22);
  while (lum(c) > 0.42 && n++ < 12) c = mix(c, '#0A121C', 0.18);
  return c;
}

/**
 * 顔写真は MLB公式の silo（背景透過の切り抜き）を使う。円形の座布団つき spots を丸マスクで抜くと
 * どうしても「丸枠」になり、アバター然として安っぽく見える（2026-07-30 村山指摘）。切り抜きなら
 * 枠なしで地に置けて、背後の光だけで浮かせられる。
 */
const headshotUrl = (id) => `https://img.mlbstatic.com/mlb-photos/image/upload/w_500,q_auto:best/v1/people/${id}/headshot/silo/current`;

/**
 * 顔写真・ロゴの取得は「落ちたら null で続行」だが、黙って落ちると顔もロゴも無い抜け殻のカードが
 * そのまま公開される（2026-07-31 No.128 で実際に発生＝クラウド無人実行から MLB の CDN に届かず
 * 全滅、誰も気づかないまま記事に載った）。そこで ①数回リトライ ②取れなかったものを記録して
 * 最後にまとめて警告、の2段で「静かに劣化する」のを防ぐ。記録先が MISSING_ART。
 */
const MISSING_ART = [];

/**
 * 素材のローカルキャッシュ。クラウド無人実行の環境は egress ポリシーで MLB の CDN
 * （img.mlbstatic.com / www.mlbstatic.com）を 403 で弾くことがあり、2026-08-01 と 08-02 は
 * それで2日連続カードが作れず日次シリーズが止まった。CDN に届かなくても同じ絵が出るように、
 * 一度取れた素材は repo に置いて次回からそれを使う（＝キャッシュ優先・取れたら書き足す）。
 * 事前の一括取得は `node scripts/warm-card-art.mjs`。
 */
const ART_CACHE_DIR = path.join('public', 'media', 'card-art');
const artCachePath = (name) => path.join(process.cwd(), ART_CACHE_DIR, name);

async function readArtCache(name) {
  if (!name) return null;
  try {
    const buf = await fs.readFile(artCachePath(name));
    return buf.length ? buf : null;
  } catch { return null; }
}

async function writeArtCache(name, buf) {
  if (!name || !buf?.length) return;
  try {
    await fs.mkdir(path.dirname(artCachePath(name)), { recursive: true });
    await fs.writeFile(artCachePath(name), buf);
  } catch { /* 書けなくても描画には影響しないので黙って続行 */ }
}

async function fetchArt(url, label, cacheName) {
  const cached = await readArtCache(cacheName);
  if (cached) return cached;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        await writeArtCache(cacheName, buf);
        return buf;
      }
      // 404 は「その素材が無い」＝リトライしても変わらないので即あきらめる。
      if (res.status === 404) break;
    } catch { /* ネットワーク断・タイムアウト＝間をおいて再挑戦する */ }
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 700));
  }
  MISSING_ART.push(label);
  return null;
}

async function fetchAvatar(id, label = `顔写真 ${id}`) {
  try {
    const raw = await fetchArt(headshotUrl(id), label, `headshot-${id}.png`);
    if (!raw) return null;
    const S = 500;
    // silo は胸のあたりで水平にカットされている。枠が無いぶんその直線がそのまま見えてしまうので、
    // 下端のアルファをグラデーションで抜いて地に溶かす（切り抜きを枠なしで置くための下ごしらえ）。
    const fade = Buffer.from(
      `<svg width="${S}" height="${S}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0.84" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
      `</linearGradient></defs><rect width="${S}" height="${S}" fill="url(#g)"/></svg>`,
    );
    const out = await sharp(raw)
      .resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .composite([{ input: fade, blend: 'dest-in' }])
      .png()
      .toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch { MISSING_ART.push(label); return null; }
}

/**
 * 背景の球場写真。src/lib/sports.ts の MLB キービジュアルと同じ Unsplash の空撮（夜）＝
 * ライセンスは商用可・帰属不要で、サイトが既に使っている素材。MLB公式CDNの写真は使わない
 * （ロゴ・顔写真は直リンクの引用に留める posture を、背景画像にまで広げないため）。
 * 落として彩度を抜き、上に球団色を重ねる前提の「土台」として使う。
 */
const BALLPARK_URL = 'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=1600&q=80&auto=format&fit=crop';
/**
 * 手持ちの球場素材（村山さん指定）。クラウドの無人実行でも同じ絵にするため public/ に置く
 * （_local はコミットされないので CI からは見えない）。見つからなければ Unsplash に退避する。
 */
const BALLPARK_LOCAL = path.join('public', 'media', 'card-ballpark.jpg');

async function fetchBallpark(custom) {
  const local = custom ?? BALLPARK_LOCAL;
  let raw = null;
  try {
    raw = await fs.readFile(path.isAbsolute(local) ? local : path.join(process.cwd(), local));
  } catch {
    try {
      const res = await fetch(BALLPARK_URL);
      if (res.ok) raw = Buffer.from(await res.arrayBuffer());
    } catch { /* 背景なしで続行＝単色地に自然縮退 */ }
  }
  if (!raw) return null;
  try {
    // 16:9 の素材を 4:5 のカードに敷くので、上（照明・スタンド）を残して切る。文字が乗る前提で
    // 暗く落とし、わずかにぼかす＝写真のディテールと文字が喧嘩しない。
    const out = await sharp(raw)
      .resize(W, H, { fit: 'cover', position: 'top' })
      .modulate({ brightness: 0.92, saturation: 0.86 })
      .blur(0.7)
      .jpeg({ quality: 84 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch { return null; }
}

/**
 * 透かし用の明るくしたロゴ。濃紺（ドジャース）や黒のロゴは暗い地に置くとほとんど見えないので
 * 明度を持ち上げる（2026-07-30 村山指摘）。
 * ⚠️ 白のシルエットに置き換える手は使えない … カブスのような「塗りの円＋抜き文字」のロゴは
 * アルファを取ると中の文字が消えてただの円盤になる（実際に描いて発覚）。色は保ったまま起こす。
 */
async function fetchLogoWatermark(teamId, label = `主役の透かしロゴ ${teamId}`) {
  if (!teamId) return null;
  try {
    const raw = await fetchArt(`https://www.mlbstatic.com/team-logos/${teamId}.svg`, label, `team-${teamId}.svg`);
    if (!raw) return null;
    const png = await sharp(raw, { density: 384 })
      .resize(420, 420, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .modulate({ brightness: 1.55, saturation: 1.1 })
      .png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { MISSING_ART.push(label); return null; }
}

/**
 * ブランドアイコン＝X（@gogogo123ka）のプロフィール画像。テキストの「海外の反応」より、この絵の方が
 * 覚えてもらえる＝認知の芯（2026-07-30 村山指定）。原本は JPG で円の外が白いので、円でマスクして
 * 白い角を落とす（色はいじらない）。
 */
const BRAND_ICON = path.join('public', 'media', 'card-brand.jpg');

async function loadBrandLogo() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), BRAND_ICON));
    const S = 420;
    const circle = Buffer.from(`<svg width="${S}" height="${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="#fff"/></svg>`);
    const out = await sharp(raw)
      .resize(S, S, { fit: 'cover' })
      .composite([{ input: circle, blend: 'dest-in' }])
      .png().toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch { return null; }
}

// チームロゴ（公式SVG）を sharp で PNG 化（satori は SVG 画像を確実に描けない）。
async function fetchLogo(teamId, label = `ロゴ ${teamId}`) {
  if (!teamId) return null;
  try {
    const raw = await fetchArt(`https://www.mlbstatic.com/team-logos/${teamId}.svg`, label, `team-${teamId}.svg`);
    if (!raw) return null;
    const png = await sharp(raw, { density: 384 })
      .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { MISSING_ART.push(label); return null; }
}

/**
 * その日の主役スコア。数字だけで決める（恣意的な「人気」補正は入れない）。
 * 打者は本塁打を重く＝日本のファンが待っているのはそこ。投手は勝ち星と支配（奪三振・無失点）。
 */
function heroScore(p) {
  let s = 0;
  if (p.hit) {
    const b = p.hit;
    // 本塁打を重くするのは日本のファンの関心の実態に合わせたもの＝「1本打った日はその人の日」。
    s += b.hr * 6 + b.h * 1.5 + b.rbi * 1 + b.sb * 0.8 + (b.d + b.t) * 0.5 + b.bb * 0.2;
    if (b.h >= 3) s += 1.5;            // 猛打賞も主役になりうるが、本塁打1本には届かせない
    if (b.ab >= 3 && b.h === 0) s -= 1; // 無安打は主役にしない（それでも全員カードには載る）
  }
  if (p.pit) {
    const q = p.pit;
    const ip = Number(q.ip) || 0;
    s += q.w * 5 + q.sv * 3 + q.hld * 1.5 + q.so * 0.6 + ip * 0.8 - q.er * 1.5;
    if (q.er === 0 && ip >= 5) s += 3; // 無失点の先発は文句なしの主役
  }
  return s;
}

/** 一覧の右端に置く「その日を一言で表す数字」。打者は安打、本塁打を打った日は本塁打が主役。 */
function keyStat(p) {
  if (p.pit && (!p.hit || (Number(p.pit.ip) || 0) > 0)) {
    return { value: String(p.pit.so), unit: 'K', hot: p.pit.so >= 7 };
  }
  const b = p.hit;
  if (!b) return { value: '-', unit: '', hot: false };
  // 金を使うのは本塁打だけ。猛打賞まで光らせると主役（ヒーロー枠）が食われて視線の順番が壊れる。
  if (b.hr) return { value: String(b.hr), unit: 'HR', hot: true };
  return { value: String(b.h), unit: 'H', hot: false, cold: b.h === 0 };
}

// 勝敗の色。スコアボードの緑／赤を彩度だけ落として使う（無彩色のハウス規律は SNS 素材では外す）。
const WIN = '#5FCB8A', LOSS = '#E0736B';

/**
 * 所属チームのその日の結果を「6-3 W」の形に。ダブルヘッダーは2試合ぶん並べる（合算すると
 * 「12-8」のような実在しないスコアになってしまう）。
 */
function gameLines(p) {
  return (p.games ?? []).map((g) => ({ text: `${g.for}-${g.against}`, tag: g.win ? 'W' : 'L', win: g.win }));
}

/** 一覧の1行に載せる短い成績文。ヒーローで細かく見せるぶん、ここは削って読ませる。 */
function shortLine(p, terse) {
  if (p.pit && (Number(p.pit.ip) || 0) > 0) {
    const q = p.pit;
    // 混み合う日は勝敗タグを落とす＝右のバッジがチームの勝敗を出しているので情報は失われない。
    const tail = terse ? null : q.w ? '勝利投手' : q.sv ? 'セーブ' : q.hld ? 'ホールド' : null;
    return [`${q.ip}回 ${q.er}自責 ${q.so}奪三振`, tail].filter(Boolean).join(' / ');
  }
  const b = p.hit;
  if (!b) return '';
  const parts = [`${b.ab}打数${b.h}安打`];
  // 節目バッジ（今季N号）が出る行では本塁打を書かない＝同じことを二度言ううえ、行が1行に収まらなくなる。
  if (b.hr && !p.note) parts.push(`${b.hr}本塁打`);
  if (b.rbi) parts.push(`${b.rbi}打点`);
  if (!b.hr && !b.rbi && b.bb) parts.push(`${b.bb}四球`);
  return parts.join(' ');
}

/**
 * ヒーローの補足テキスト。特大数字で言い切った項目は繰り返さない＝「HOME RUN 23号」の隣に
 * 「1本塁打」と書くと同じことを二度言うことになる。
 */
function heroDetail(p, hl) {
  if (p.pit && (Number(p.pit.ip) || 0) > 0) {
    const q = p.pit;
    const parts = [];
    if (hl.unit !== '回') parts.push(`${q.ip}回`);
    parts.push(`${q.h}安打`, `${q.er}自責`);
    if (hl.unit !== 'K') parts.push(`${q.so}奪三振`);
    if (q.bb) parts.push(`${q.bb}四球`);
    return parts.join(' ');
  }
  const b = p.hit;
  if (!b) return '';
  const parts = [`${b.ab}打数${b.h}安打`];
  if (b.hr && !hl.eyebrow.includes('HOME RUN')) parts.push(`${b.hr}本塁打`);
  if (b.rbi) parts.push(`${b.rbi}打点`);
  if (b.sb) parts.push(`${b.sb}盗塁`);
  if (b.bb && parts.length < 3) parts.push(`${b.bb}四球`);
  return parts.join(' ');
}

/**
 * ヒーローの「特大ひと数字」。同じ大きさの数字を3つ並べると（1・1・1 のような日に）何も伝わらない
 * ので、その日いちばん価値のある1つだけを大きく出し、残りは細部テキストに落とす。
 * 本塁打の日は本数でなく通算号数を出す＝「今季23号」の方が意味も記念性も強い。
 */
function heroHighlight(p) {
  if (p.pit && (Number(p.pit.ip) || 0) > 0) {
    const q = p.pit;
    // 二桁に迫る奪三振は勝ち星より絵になる（勝敗は味方打線の産物でもある）ので先に見る。
    if (q.so >= 8) return { eyebrow: 'STRIKEOUTS', v: String(q.so), unit: 'K', hot: true };
    if (q.w) return { eyebrow: 'WINNING PITCHER', v: String(q.ip), unit: '回', hot: true };
    if (q.sv) return { eyebrow: 'SAVE', v: String(q.sv), unit: 'S', hot: true };
    if (q.so >= 6) return { eyebrow: 'STRIKEOUTS', v: String(q.so), unit: 'K', hot: true };
    return { eyebrow: 'ON THE MOUND', v: String(q.ip), unit: '回', hot: q.er === 0 };
  }
  const b = p.hit ?? { ab: 0, h: 0, hr: 0 };
  if (b.hr && p.seasonHr) return { eyebrow: b.hr >= 2 ? `${b.hr} HOME RUNS` : 'HOME RUN', v: String(p.seasonHr), unit: '号', hot: true };
  if (b.hr) return { eyebrow: 'HOME RUN', v: String(b.hr), unit: '本', hot: true };
  if (b.h >= 3) return { eyebrow: 'MULTI HIT', v: String(b.h), unit: '安打', hot: true };
  return { eyebrow: 'AT THE PLATE', v: String(b.h), unit: '安打', hot: b.h >= 2, cold: b.h === 0 };
}

/** ET の試合日 → 日本時間の見出し（サイト表記は常に JST。ET はフッターに小さく残す）。 */
function jstLabel(etDate) {
  const d = new Date(`${etDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1); // ET のナイター＝日本の翌日
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()];
  return { text: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${wd}）`, short: `${d.getUTCMonth() + 1}/${d.getUTCDate()}` };
}

const nameSize = (nm) => (nm.length >= 8 ? 44 : nm.length >= 6 ? 52 : 58);
const rowNameSize = (nm) => (nm.length >= 8 ? 30 : nm.length >= 6 ? 34 : 37);

function heroBlock(p, avatar, logo, compact, th, mark) {
  const hl = heroHighlight(p);
  // 出場が多い日は一覧に高さを譲る＝主役は小さくしても顔と特大数字が残れば主役に見える。
  const av = compact ? 190 : 236;
  const big = compact ? 124 : 148;
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', marginTop: 18, background: `linear-gradient(100deg, ${rgba(th.team, 0.42)} 0%, rgba(255,255,255,0.05) 62%)`, border: `1px solid ${rgba(th.bright, 0.28)}`, borderLeft: `8px solid ${th.bright}` } }, [
    h('div', { key: 'top', style: { position: 'relative', display: 'flex', width: '100%', padding: '22px 28px 20px 24px', overflow: 'hidden' } }, [
      // 顔＝カードの引き。球団色のリングで囲って主役であることを一目でわからせる。
      // 枠なし。背後にだけ球団色の光を置いて、切り抜きの人物を地から浮かせる。
      h('div', { key: 'av', style: { position: 'relative', display: 'flex', width: av, height: av, marginRight: 20, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 } }, [
        h('div', { key: 'glow', style: { position: 'absolute', left: 0, top: 0, width: av, height: av, display: 'flex', borderRadius: av / 2, background: `radial-gradient(circle at 50% 46%, ${rgba(th.bright, 0.40)} 0%, ${rgba(th.team, 0.20)} 48%, rgba(0,0,0,0) 70%)` } }),
        avatar ? h('img', { key: 'im', src: avatar, width: av, height: av, style: { objectFit: 'contain' } }) : null,
      ]),
      // 遊び：主役の球団ロゴを大きく沈める。空いていた右側が「その球団のカードだ」と一目でわかる面になる。
    mark ? h('div', { key: 'wm', style: { position: 'absolute', right: -16, top: -12, display: 'flex', width: 300, height: 300, alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0) 66%)', opacity: 0.72 } },
      h('img', { src: mark, width: 232, height: 232, style: { objectFit: 'contain' } })) : null,
    h('div', { key: 'body', style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 } }, [
        // 名前＋所属
        h('div', { key: 'nm', style: { display: 'flex', alignItems: 'center' } }, [
          h('div', { key: 'n', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 900, fontSize: nameSize(p.name), color: INK, letterSpacing: -1, lineHeight: 1 } }, p.name),
        ]),
        h('div', { key: 'tm', style: { display: 'flex', alignItems: 'center', marginTop: 10 } }, [
          logo ? h('img', { key: 'lg', src: logo, width: 30, height: 30, style: { objectFit: 'contain', marginRight: 10 } }) : null,
          h('div', { key: 't', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 26, color: INK_MUTE, letterSpacing: 0.5 } }, p.team),
          // 主役の試合結果は勝敗の語まで出す（一覧は W/L の略号で足りるが、ここは一拍おいて読ませる）
          ...gameLines(p).map((g, i) => h('div', { key: `g${i}`, style: { display: 'flex', alignItems: 'center', marginLeft: 15, background: rgba(g.win ? WIN : LOSS, 0.18), border: `1px solid ${rgba(g.win ? WIN : LOSS, 0.5)}`, padding: '3px 12px 2px' } }, [
            h('div', { key: 's', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 31, letterSpacing: 1, color: g.win ? WIN : LOSS } }, g.text),
            h('div', { key: 't', style: { display: 'flex', marginLeft: 8, fontFamily: 'Bebas', fontSize: 24, letterSpacing: 2, color: rgba(g.win ? WIN : LOSS, 0.88) } }, g.win ? 'WIN' : 'LOSS'),
          ])),
        ]),
        // 特大のひと数字＋その日の細部（数字ひとつに視線を寄せる）。見出しは球団色の塗りバッジ＝
        // タイムラインで最初に目に入る一撃を作る。
        h('div', { key: 'hl', style: { display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: 12, width: '100%' } }, [
          h('div', { key: 'eb', style: { display: 'flex' } }, [
            h('div', { key: 'p', style: { display: 'flex', background: hl.hot ? th.bright : 'rgba(255,255,255,0.14)', color: hl.hot ? th.onBright : INK, padding: '6px 16px 5px', fontFamily: 'Bebas', fontSize: 29, letterSpacing: 5, transform: 'rotate(-2deg)' } }, hl.eyebrow),
          ]),
          h('div', { key: 'v', style: { display: 'flex', alignItems: 'baseline', marginTop: 8 } }, [
            h('div', { key: 'n', style: { display: 'flex', fontFamily: 'Bebas', fontSize: big, lineHeight: 0.74, letterSpacing: 2, color: INK } }, hl.v),
            h('div', { key: 'u', style: { display: 'flex', marginLeft: 10, fontFamily: 'Zen', fontWeight: 900, fontSize: 38, color: th.bright } }, hl.unit),
            // 折り返すと「1四球 2/三振」のように数字の途中で切れて品位が落ちるので、1行に収まる短縮版を出す。
            h('div', { key: 'd', style: { display: 'flex', marginLeft: 'auto', paddingBottom: 10, fontFamily: 'Zen', fontWeight: 700, fontSize: 29, color: INK_MUTE, letterSpacing: 0.2 } }, heroDetail(p, hl)),
          ]),
        ]),
      ]),
    ]),
    // 今季の到達点＝カード1枚で完結させるための帯。文字列の羅列でなく指標チップにして、
    // 打者は OPS と WAR、投手は防御率・WHIP・WAR という「見る人が見る数字」を必ず立てる。
    seasonChips(p).length
      ? h('div', { key: 'ss', style: { display: 'flex', alignItems: 'center', width: '100%', padding: '14px 28px', background: 'rgba(0,0,0,0.34)', borderTop: `1px solid ${rgba(th.bright, 0.3)}` } }, [
          h('div', { key: 'k', style: { display: 'flex', flexDirection: 'column', marginRight: 26 } }, [
            h('div', { key: 'a', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 23, color: th.bright, letterSpacing: 4, lineHeight: 1 } }, 'SEASON'),
            h('div', { key: 'b', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 23, color: rgba(th.bright, 0.5), letterSpacing: 4, lineHeight: 1.15 } }, '2026'),
          ]),
          h('div', { key: 'c', style: { display: 'flex', flex: 1, justifyContent: 'space-between' } },
            seasonChips(p).map((c, i) =>
              h('div', { key: `s${i}`, style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } }, [
                h('div', { key: 'l', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 22, color: INK_MUTE, letterSpacing: 3, lineHeight: 1 } }, c.l),
                h('div', { key: 'v', style: { display: 'flex', marginTop: 6, fontFamily: 'Bebas', fontSize: 50, lineHeight: 0.9, letterSpacing: 1, color: c.hot ? th.bright : INK } }, c.v),
              ]))),
        ])
      : null,
  ]);
}

/**
 * 今季の指標チップ。打者は OPS と WAR、投手は防御率・WHIP・WAR を必ず含める（2026-07-30 村山指定）。
 * 二刀流は打者の並びに投手の要点を足す＝大谷のカードだけ別物にならないよう並びの型は保つ。
 */
function seasonChips(p) {
  const chips = [];
  const sh = p.seasonHit;
  const sp = p.seasonPit;
  const warHit = typeof p.warHit === 'number' ? p.warHit : null;
  const warPit = typeof p.warPit === 'number' ? p.warPit : null;
  const twoWay = sh && sp && sh.g >= 20 && (Number(sp.ip) || 0) >= 20;
  if (sp && (!sh || twoWay || sh.g < 20)) {
    chips.push({ l: 'W-L', v: `${sp.w}-${sp.l}` }, { l: 'ERA', v: sp.era, hot: true }, { l: 'WHIP', v: sp.whip, hot: true });
    if (!twoWay) chips.push({ l: 'SO', v: String(sp.so) });
  }
  if (sh && (!sp || twoWay || sh.g >= 20)) {
    chips.push({ l: 'AVG', v: sh.avg }, { l: 'HR', v: String(sh.hr) });
    if (!twoWay) chips.push({ l: 'RBI', v: String(sh.rbi) });
    chips.push({ l: 'OPS', v: sh.ops, hot: true });
  }
  const war = (warHit ?? 0) + (warPit ?? 0);
  if (warHit != null || warPit != null) chips.push({ l: 'WAR', v: war.toFixed(1), hot: true });
  return chips;
}

/**
 * 一覧の寸法は出場人数で決める。10人出た日に 5人の日の寸法で描くと、顔が行の高さを超えて上下の行に
 * 食い込む（実際に 9人の日で起きた）ので、人数が増えたら縮める。
 * レイアウトは人数によらず常に 1行＝名前の下に成績を折る2段組は、行が詰まって窮屈に見える
 * （2026-07-30 村山指摘）。そのぶん成績文は短く保つ（投手の「勝利投手」は混む日だけ落とす）。
 */
function rowMetrics(n) {
  if (n >= 8) return { av: 58, name: 30, nameW: 186, line: 24, num: 50, unit: 20, terse: true, verbose: false };
  if (n >= 6) return { av: 68, name: 34, nameW: 202, line: 26, num: 58, unit: 23, terse: true, verbose: true };
  return { av: 78, name: 38, nameW: 220, line: 28, num: 66, unit: 26, terse: false, verbose: true };
}

function playerRow(p, avatar, logo, isLast, m, teamColor) {
  const k = keyStat(p);
  const bar = mix(teamColor ?? '#1B3358', '#FFFFFF', 0.3);
  const numColor = k.hot ? ACCENT : k.cold ? INK_GHOST : INK;
  const nameEl = h('div', { key: 'n', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: Math.min(m.name, rowNameSize(p.name)), color: INK, letterSpacing: -0.5, lineHeight: 1.1 } }, p.name);
  const lineEl = h('div', { key: 'll', style: { display: 'flex', flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'Zen', fontWeight: 700, fontSize: m.line, color: INK_MUTE, letterSpacing: 0.3 } }, shortLine(p, m.terse));
  const logoEl = logo ? h('img', { key: 'lg', src: logo, width: 26, height: 26, style: { objectFit: 'contain', marginRight: 11 } }) : null;
  const noteEl = p.note
    ? h('div', { key: 'bd', style: { display: 'flex', flexShrink: 0, whiteSpace: 'nowrap', marginLeft: 12, alignItems: 'center', border: `1px solid ${ACCENT_SOFT}`, color: ACCENT, padding: '2px 10px', fontFamily: 'Zen', fontWeight: 700, fontSize: m.verbose ? 19 : 17 } }, p.note)
    : null;
  // チームの勝敗＝「その日、勝ったのか負けたのか」は成績と同じくらい知りたい情報（村山さん指定）。
  const resultEl = h('div', { key: 'gm', style: { display: 'flex', flexShrink: 0, alignItems: 'center', marginLeft: 14 } },
    gameLines(p).map((g, i) => h('div', { key: `g${i}`, style: { display: 'flex', alignItems: 'center', marginLeft: i ? 7 : 0, background: rgba(g.win ? WIN : LOSS, 0.16), border: `1px solid ${rgba(g.win ? WIN : LOSS, 0.45)}`, padding: '2px 10px 1px' } }, [
      h('div', { key: 's', style: { display: 'flex', fontFamily: 'Bebas', fontSize: m.verbose ? 28 : 25, letterSpacing: 1, color: g.win ? WIN : LOSS } }, g.text),
      h('div', { key: 't', style: { display: 'flex', marginLeft: 7, fontFamily: 'Bebas', fontSize: m.verbose ? 22 : 20, letterSpacing: 1.5, color: rgba(g.win ? WIN : LOSS, 0.85) } }, m.verbose ? (g.win ? 'WIN' : 'LOSS') : g.tag),
    ])));

  return h('div', { key: `r${p.id}`, style: { display: 'flex', flex: 1, minHeight: 0, width: '100%', alignItems: 'center', background: 'rgba(3,8,14,0.62)', marginBottom: isLast ? 0 : 6, paddingLeft: 14, borderLeft: `5px solid ${bar}` } }, [
    h('div', { key: 'av', style: { position: 'relative', display: 'flex', width: m.av, height: m.av, marginRight: 14, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 } }, [
      h('div', { key: 'g', style: { position: 'absolute', left: 0, top: 0, width: m.av, height: m.av, display: 'flex', borderRadius: m.av / 2, background: `radial-gradient(circle at 50% 46%, ${rgba(bar, 0.32)} 0%, rgba(0,0,0,0) 68%)` } }),
      avatar ? h('img', { key: 'i', src: avatar, width: m.av, height: m.av, style: { objectFit: 'contain' } }) : null,
    ]),
    // 常に1行（名前 → ロゴ → 成績 → 節目 → 勝敗）。所属はロゴだけで足りる（チーム名はヒーローに出している）。
    h('div', { key: 'nm', style: { display: 'flex', flex: 1, minWidth: 0, alignItems: 'center' } }, [
      h('div', { key: 'nw', style: { display: 'flex', width: m.nameW, flexShrink: 0 } }, nameEl),
      logoEl, lineEl, noteEl, resultEl,
    ]),
    h('div', { key: 'kv', style: { display: 'flex', alignItems: 'baseline', marginLeft: 16, flexShrink: 0 } }, [
      h('div', { key: 'v', style: { display: 'flex', fontFamily: 'Bebas', fontSize: m.num, lineHeight: 0.9, letterSpacing: 1, color: numColor } }, k.value),
      h('div', { key: 'u', style: { display: 'flex', marginLeft: 7, width: 40, fontFamily: 'Bebas', fontSize: m.unit, letterSpacing: 2, color: k.hot ? ACCENT_SOFT : INK_FAINT } }, k.unit),
    ]),
  ]);
}

async function main() {
  const argv = process.argv.slice(2);
  const outFlag = argv.indexOf('--out');
  const outPath = outFlag >= 0 ? argv[outFlag + 1] : null;
  const date = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

  const { stdout } = await run('node', ['scripts/fetch-mlb-stats.mjs', 'jpday', ...(date ? [date] : [])], {
    cwd: process.cwd(), maxBuffer: 20 * 1024 * 1024,
  });
  const data = JSON.parse(stdout);
  const players = data.players ?? [];
  if (!players.length) {
    console.error(`${data.date}(ET) に出場した日本人選手は0人＝カードは作らない`);
    process.exit(2);
  }

  // 主役1人＋残りは活躍順。同点なら本塁打→安打の多い順（毎日決まった順で並ぶと表が固まって見える）。
  const ranked = [...players].sort((a, b) => {
    const d = heroScore(b) - heroScore(a);
    if (d) return d;
    return (b.hit?.hr ?? 0) - (a.hit?.hr ?? 0) || (b.hit?.h ?? 0) - (a.hit?.h ?? 0);
  });
  const [hero, ...rest] = ranked;

  const bgFlag = argv.indexOf('--bg');
  const [avatars, logos, colors, ballpark, heroMark, brand] = await Promise.all([
    Promise.all(ranked.map((p) => fetchAvatar(p.id, `${p.name} の顔写真`))),
    Promise.all(ranked.map((p) => fetchLogo(p.teamId, `${p.team} のロゴ`))),
    loadTeamColors(),
    fetchBallpark(bgFlag >= 0 ? argv[bgFlag + 1] : null),
    fetchLogoWatermark(hero.teamId, `${hero.team} の透かしロゴ`),
    loadBrandLogo(),
  ]);
  const art = new Map(ranked.map((p, i) => [p.id, { avatar: avatars[i], logo: logos[i] }]));

  // カードの色は主役の球団色で決まる＝毎日ちがう色になり、並べたときコレクションに見える。
  // ただし黒・濃紺のチームをそのまま敷くとカード全体が灰色に沈むので、その日はハウスの金に逃がす
  // （ホワイトソックスの日に実測。色を捨てるのではなく「締まる方の色」を選ぶ）。
  const rawTeam = colors.get(hero.team)?.color ?? null;
  const vivid = rawTeam ? sat(rawTeam) >= 0.38 : false;
  const base = vivid ? teamTone(rawTeam) : '#102039';
  const bright = vivid ? mix(base, '#FFFFFF', 0.40) : ACCENT;
  const th = { team: base, bright, onBright: lum(bright) > 0.45 ? '#0A121C' : '#FFFFFF' };

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [zk7, zk9, bebas] = await Promise.all([
    fs.readFile(path.join(dir, 'zenkaku-bold.ttf')),
    fs.readFile(path.join(dir, 'zenkaku-black.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const jst = jstLabel(data.date);
  const layer = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' };
  const hl = heroHighlight(hero);

  const content = h('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '30px 34px 26px', color: INK } }, [
    // 見出し＝[アイコン][TODAY'S / JAPANESE PLAYERS] … [シリアル / 日付]。ヘッダー行を別に持たず
    // ここに畳んで、空いた縦を一覧に回す。
    h('div', { key: 'ttl', style: { display: 'flex', alignItems: 'center', width: '100%' } }, [
      brand ? h('img', { key: 'brand', src: brand, width: 108, height: 108, style: { objectFit: 'contain', marginRight: 18 } }) : null,
      h('div', { key: 'l', style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 } }, [
        // 見出しは1行（2行に折ると塊が重くなる・2026-07-30 村山指摘）。24文字が収まる寸法に合わせている。
        h('div', { key: 't1', style: { display: 'flex', alignItems: 'baseline' } }, [
          h('div', { key: 'a', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 60, color: INK, letterSpacing: 2, lineHeight: 1 } }, "TODAY'S "),
          h('div', { key: 'b', style: { display: 'flex', marginLeft: 14, fontFamily: 'Bebas', fontSize: 60, color: th.bright, letterSpacing: 2, lineHeight: 1 } }, 'JAPANESE PLAYERS'),
        ]),
        h('div', { key: 'd', style: { display: 'flex', marginTop: 9, fontFamily: 'Zen', fontWeight: 900, fontSize: 27, color: INK_MUTE, letterSpacing: 0.5 } }, jst.text),
      ]),
      // シリアル番号＝カードを「集める」動機の芯。
      h('div', { key: 'r', style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 18, flexShrink: 0 } }, [
        h('div', { key: 'a', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 24, color: INK_FAINT, letterSpacing: 4 } }, `MLB ${data.season}`),
        h('div', { key: 'b', style: { display: 'flex', marginTop: 7, fontFamily: 'Bebas', fontSize: 34, color: th.bright, letterSpacing: 3, lineHeight: 1 } }, `NO.${String(data.day ?? 0).padStart(3, '0')}`),
      ]),
    ]),
    heroBlock(hero, art.get(hero.id)?.avatar, art.get(hero.id)?.logo, rest.length >= 8, th, heroMark),
    // 残り全員（無安打も載せる＝「これ1枚で全部わかる」の担保）。1人しか出ていない日は一覧そのものを
    // 出さず、空の枠が縦を占めて間延びするのを防ぐ。
    rest.length
      ? h('div', { key: 'list', style: { display: 'flex', flex: 1, flexDirection: 'column', width: '100%', marginTop: 14 } },
          rest.map((p, i) => playerRow(p, art.get(p.id)?.avatar, art.get(p.id)?.logo, i === rest.length - 1, rowMetrics(rest.length), teamTone(colors.get(p.team)?.color))))
      : h('div', { key: 'list', style: { display: 'flex', flex: 1 } }),
    // フッター
    h('div', { key: 'ft', style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: 16, borderTop: `1px solid ${rgba(th.bright, 0.35)}` } }, [
      h('div', { key: 'dom', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 900, fontSize: 27, color: INK, letterSpacing: 1 } }, 'matome-mlb-kaigai.jp'),
      h('div', { key: 'day', style: { display: 'flex', marginLeft: 'auto', fontFamily: 'Bebas', fontSize: 24, color: INK_FAINT, letterSpacing: 3 } },
        `ET ${data.date.slice(5).replace('-', '/')}`),
    ]),
  ]);

  // 土台＝球場の夜景に球団色を重ねる。下へ行くほど暗く沈めて一覧の文字を読ませる。
  const inner = h('div', { style: { position: 'relative', display: 'flex', width: '100%', height: '100%', background: `linear-gradient(160deg, ${mix(th.team, '#050B14', 0.45)} 0%, #060C15 75%)`, ...(ballpark ? { backgroundImage: `url(${ballpark})`, backgroundSize: `${W}px ${H}px` } : {}) } }, [
    // 遊び：Topps Chrome の「リフラクター」を思わせる斜めの光沢。実物のカードを傾けたときの
    // 反射に見立てた飾りで、平面的だった面に厚みが出る。薄く入れるのが肝（濃いと安っぽくなる）。
    h('div', { key: 'refract', style: { ...layer, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 2px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 22px)' } }),
    h('div', { key: 'sheen', style: { ...layer, background: 'linear-gradient(115deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.10) 46%, rgba(255,255,255,0) 56%)' } }),
    // 上は球場を見せ、下へ行くほど球団色→黒に沈める（一覧の文字を読ませるため）。
    h('div', { key: 'tint', style: { ...layer, background: `linear-gradient(180deg, rgba(4,9,16,0.34) 0%, rgba(4,9,16,0.16) 15%, ${rgba(th.team, 0.34)} 30%, rgba(5,10,18,0.72) 54%, rgba(4,8,15,0.86) 100%)` } }),
    content,
  ]);

  // Topps 的な白フチ＝1枚のカードとして自立させる（保存したくなる「モノ」感はここで出る）。
  const el = h('div', { style: { display: 'flex', width: '100%', height: '100%', background: '#F7F5EF', padding: 18 } }, [
    h('div', { style: { display: 'flex', width: W - 36, height: H - 36, position: 'relative', overflow: 'hidden', border: `2px solid ${rgba(th.bright, 0.55)}` } }, inner),
  ]);

  const res = new ImageResponse(el, {
    width: W, height: H,
    fonts: [
      { name: 'Zen', data: zk7, weight: 700, style: 'normal' },
      { name: 'Zen', data: zk9, weight: 900, style: 'normal' },
      { name: 'Bebas', data: bebas, weight: 400, style: 'normal' },
    ],
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const out = outPath ?? path.join(process.cwd(), '_local', 'x-images', `jp-daily-${data.date}.png`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  // 出力先が .jpg なら JPEG に変換して書く。無人運用ではカードを public/media/ にコミットして
  // 配る（_local はクラウドで永続化されない）ので、リポジトリを太らせない形式を選べるようにする。
  const jpeg = /\.jpe?g$/i.test(out);
  await fs.writeFile(out, jpeg ? await sharp(buf).jpeg({ quality: 84, chromaSubsampling: "4:4:4" }).toBuffer() : buf);
  console.log(`✓ きょうの日本人（${data.date} ET・${players.length}人）→ ${path.relative(process.cwd(), out)}（${W}×${H}）`);

  // 記事の hero / OGP 用に 16:9 版も書く。縦カード(4:5)をそのまま OG に使うと X・Discover・
  // 記事ヒーロー（object-cover）で中央だけが切り抜かれ、題字も主役も消える。カードの上半分
  // ＝「TODAY'S JAPANESE PLAYERS ＋ 日付 ＋ 主役」は単体で「何の記事か」を名乗れるので、
  // そこを切り出して 1200×675 に伸ばす（別デザインを起こさない＝カードと絵が一致する）。
  // 切る高さ 520px は「主役ブロックの中・SEASON帯の上」＝どの日でも文字列が途中で切れない線
  // （16:9=608px だと SEASON の数字が腰から切れる）。横 1200px は Discover の足切り条件。
  const OG_CROP_H = 520;
  const og = out.replace(/\.(png|jpe?g)$/i, '-og.jpg');
  const ogH = Math.round((1200 * OG_CROP_H) / W);
  await sharp(buf)
    .extract({ left: 0, top: 0, width: W, height: OG_CROP_H })
    .resize(1200, ogH)
    .jpeg({ quality: 86, chromaSubsampling: '4:4:4' })
    .toFile(og);
  console.log(`  OG(記事ヒーロー/OGP): ${path.relative(process.cwd(), og)}（1200×${ogH}）`);
  console.log(`  主役: ${hero.name} ${hero.today}${hero.note ? ` ★${hero.note}` : ''}`);
  ranked.slice(1).forEach((p) => console.log(`   ・${p.name} ${shortLine(p)}`));

  // 素材が欠けたカードは「作れたつもり」でいちばん危ない。ここで必ず声を上げ、既定では
  // 非ゼロ終了して公開の手前で止める（顔もロゴも無いカードを配るくらいなら作り直す）。
  // どうしても素材抜きで出す日だけ --allow-no-art を明示する。
  if (MISSING_ART.length) {
    console.error(`\n⚠️ 素材が ${MISSING_ART.length} 点取れなかった（3回リトライ後）:`);
    MISSING_ART.forEach((m) => console.error(`   × ${m}`));
    console.error('   → MLB の CDN（img.mlbstatic.com / www.mlbstatic.com）に届かず、');
    console.error(`     ${ART_CACHE_DIR}/ のキャッシュにも無い素材（新加入・初登場の選手など）。`);
    console.error('     顔写真・ロゴ抜きのカードは公開しない。通常ネットワークの端末で');
    console.error('     `node scripts/warm-card-art.mjs` を走らせてキャッシュを足しコミットするか、');
    console.error('     素材なしで押し切る場合だけ --allow-no-art を付ける。');
    if (!argv.includes('--allow-no-art')) process.exit(3);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
