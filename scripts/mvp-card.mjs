/**
 * X 投稿用「ナ・リーグ MVP レース TOP5」カード PNG 生成（x-post / x-share スキルの弾）。
 *
 *   node scripts/mvp-card.mjs [pos|raw]
 *     pos（既定）… 野手＋二刀流のみ（純投手は除外＝サイヤング枠と切り分け。大谷の投手WARは計上）
 *     raw       … WAR上位そのまま（純投手も含む）
 *
 * data/war-race.json（サイト自前WAR・MLB公式 sabermetrics 由来・API季節値と一致検証済み）を読み、
 * ナ・リーグの WAR 上位5人を 1080×1350（X 最適の縦 4:5）のカードにして _local/x-images/ に書き出す。
 * デザインは「深いインク紺のフラット地＋オフホワイト＋抑えたシャンパン1色」のエディトリアル調＝
 * 和文 Zen Kaku Gothic New／英字・数字 Bebas Neue（成績カードの旧・青光沢＋真鍮ゴールドを刷新）。
 * 数値は捏造せず war-race.json 由来のみ。_local はコミットしない。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// ── 配色（エディトリアル：フラットなインク紺＋オフホワイト＋抑えたシャンパン1色）──────────
const INK = '#F2F0EA';                         // オフホワイト（主文字）
const INK_MUTE = 'rgba(242,240,234,0.60)';     // 補助
const INK_FAINT = 'rgba(242,240,234,0.40)';    // 微弱
const RULE = 'rgba(255,255,255,0.09)';         // 罫（細く静かに）
const BG0 = '#0D2039', BG1 = '#070F1C';        // 地グラデ（深く沈める）
const ACCENT = '#CDB884';                      // シャンパン（首位・アクセントのみに限定使用）
const ACCENT_SOFT = 'rgba(205,184,132,0.55)';
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };

// 編集者確認の最新値で WAR を当日補正（自前WARの snapshot が試合確定前でラグる時のみ）。
// 現在は snapshot が最新（7/15 refresh）で補正不要＝空。ラグる時だけ mlbId: 値 を足す。
const WAR_OVERRIDE = {};

// war-race.json のキー(mlbId)→ 表示チーム。ロゴ/所属の引きに使う（追跡セット内の NL 選手＋大谷）。
const TEAM = {
  660271: ['ドジャース', 119], 691718: ['カブス', 112], 682998: ['ダイヤモンドバックス', 109],
  695578: ['ナショナルズ', 120], 571970: ['ドジャース', 119], 518692: ['ドジャース', 119],
  681624: ['ドジャース', 119], 621566: ['ブレーブス', 144], 665742: ['メッツ', 121],
  656941: ['フィリーズ', 143], 682928: ['ナショナルズ', 120], 605141: ['ドジャース', 119],
  663656: ['カブス', 112], 606192: ['ドジャース', 119], 669257: ['ドジャース', 119],
  500743: ['ドジャース', 119], 669242: ['ドジャース', 119], 687221: ['ドジャース', 119],
  // 投手（raw モードで登場しうる NL 投手）
  694819: ['ブルワーズ', 158], 650911: ['フィリーズ', 143], 694973: ['パイレーツ', 134],
  519242: ['ブレーブス', 144], 680736: ['ドジャース', 119], 695243: ['アスレチックス', 133],
};

const headshotUrl = (id) => `https://midfield.mlbstatic.com/v1/people/${id}/spots/120`;

async function fetchAvatar(id) {
  try {
    const res = await fetch(headshotUrl(id));
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'image/png';
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

// チームロゴ（公式SVG）を sharp で PNG 化して data URI に（satori は SVG 画像を確実に描けない）。
async function fetchLogo(teamId) {
  if (!teamId) return null;
  try {
    const res = await fetch(`https://www.mlbstatic.com/team-logos/${teamId}.svg`);
    if (!res.ok) return null;
    const svg = Buffer.from(await res.arrayBuffer());
    const png = await sharp(svg, { density: 384 })
      .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return null; }
}

function asOfLabel(asOf) {
  const m = (asOf || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[3])}時点` : '';
}

// 純投手＝warHit が無く warPit だけある行。二刀流(大谷)は warHit を持つので pos モードでも残る。
const isPurePitcher = (p) => p.warHit == null && p.warPit != null;

async function main() {
  const mode = (process.argv[2] || 'pos').toLowerCase();
  const race = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'war-race.json'), 'utf8'));
  const year = race.season || 2026;

  const rows = Object.entries(race.players).map(([id, p]) => {
    const last = p.warHistory.at(-1) || {};
    return { id: Number(id), name: p.nameJa, lg: p.league, war: WAR_OVERRIDE[Number(id)] ?? last.war, warHit: last.warHit, warPit: last.warPit };
  }).filter((r) => r.lg === 'NL' && Number.isFinite(r.war));

  const pool = mode === 'raw' ? rows : rows.filter((r) => !isPurePitcher(r));
  const ranked = pool.sort((a, b) => b.war - a.war).slice(0, 5);
  if (!ranked.length) { console.error('対象0件（war-race.json 未生成？）'); process.exit(1); }

  const [avatars, logos] = await Promise.all([
    Promise.all(ranked.map((r) => fetchAvatar(r.id))),
    Promise.all(ranked.map((r) => fetchLogo((TEAM[r.id] || [])[1]))),
  ]);
  ranked.forEach((r, i) => { r.avatar = avatars[i]; r.logo = logos[i]; r.team = (TEAM[r.id] || ['', null])[0]; });

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [zk7, zk9, bebas] = await Promise.all([
    fs.readFile(path.join(dir, 'zenkaku-bold.ttf')),
    fs.readFile(path.join(dir, 'zenkaku-black.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const W = 1080, H = 1350, PAD = 66;
  const leaderWar = ranked[0].war;
  const subtitle = mode === 'raw' ? '投手込み' : '野手・二刀流';

  // 長い名前は1行に収まるよう段階的に縮める。
  const nameSize = (nm) => (nm.length >= 13 ? 34 : nm.length >= 11 ? 38 : nm.length >= 9 ? 43 : 47);

  const row = (r, i) => {
    const isLeader = i === 0;
    const twoWay = r.warHit != null && r.warPit != null; // 大谷
    const role = twoWay ? '二刀流' : isPurePitcher(r) ? '投手' : '野手';
    const gap = i === 0 ? null : Math.round((leaderWar - r.war) * 10) / 10;
    const rankCol = isLeader ? ACCENT : i < 3 ? INK : INK_FAINT;
    const warCol = isLeader ? ACCENT : INK;
    return h('div', { style: { display: 'flex', flex: 1, minHeight: 0, alignItems: 'center', width: '100%', borderBottom: `1px solid ${RULE}` } }, [
      // 順位（Bebas）
      h('div', { key: 'rk', style: { display: 'flex', width: 76, justifyContent: 'flex-start', fontFamily: 'Bebas', fontSize: 66, color: rankCol, lineHeight: 1 } }, String(i + 1)),
      // 丸アバター
      h('div', { key: 'av', style: { display: 'flex', width: 96, height: 96, borderRadius: 48, marginRight: 24, background: 'rgba(0,0,0,0.30)', border: isLeader ? `2px solid ${ACCENT_SOFT}` : '2px solid rgba(255,255,255,0.16)', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 } },
        r.avatar ? h('img', { src: r.avatar, width: 96, height: 96, style: { objectFit: 'cover' } }) : null),
      // 名前 ＋（ロゴ＋所属＋役割 / 首位バッジ）
      h('div', { key: 'nm', style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 } }, [
        h('div', { key: 'n', style: { display: 'flex', alignItems: 'center' } }, [
          h('div', { key: 'nn', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: nameSize(r.name), color: INK, letterSpacing: -0.5 } }, r.name),
          isLeader ? h('div', { key: 'lead', style: { display: 'flex', marginLeft: 15, alignItems: 'center', border: `1px solid ${ACCENT_SOFT}`, color: ACCENT, borderRadius: 4, padding: '3px 12px', fontFamily: 'Zen', fontWeight: 700, fontSize: 20, letterSpacing: 1 } }, '首位') : null,
        ]),
        h('div', { key: 't', style: { display: 'flex', alignItems: 'center', marginTop: 9 } }, [
          r.logo ? h('img', { key: 'lg', src: r.logo, width: 30, height: 30, style: { objectFit: 'contain', marginRight: 12 } }) : null,
          h('div', { key: 'tt', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 23, color: INK_MUTE, letterSpacing: 0.5 } }, `${r.team}`),
          h('div', { key: 'rl', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 21, color: INK_FAINT, marginLeft: 14 } }, role),
        ]),
      ]),
      // 右＝WAR（Bebas 大判）＋（大谷は二刀流内訳 / 他は首位差）
      h('div', { key: 'vl', style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 14 } }, [
        h('div', { key: 'w', style: { display: 'flex', alignItems: 'baseline' } }, [
          h('div', { key: 'wn', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 96, color: warCol, lineHeight: 0.9, letterSpacing: 1 } }, r.war.toFixed(1)),
          h('div', { key: 'wu', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 28, color: INK_FAINT, marginLeft: 10, letterSpacing: 2 } }, 'WAR'),
        ]),
        twoWay
          ? h('div', { key: 'sub', style: { display: 'flex', marginTop: 6, fontFamily: 'Zen', fontWeight: 700, fontSize: 21, color: INK_FAINT } }, `打 ${r.warHit.toFixed(1)}　投 ${r.warPit.toFixed(1)}`)
          : gap != null ? h('div', { key: 'sub', style: { display: 'flex', marginTop: 6, fontFamily: 'Zen', fontWeight: 700, fontSize: 21, color: INK_FAINT } }, `首位まで ${gap.toFixed(1)}`) : null,
      ]),
    ]);
  };

  const layer = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' };

  const content = h('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: `${PAD}px ${PAD}px`, color: INK } }, [
    // ヘッダー（細アクセント＋ブランド ／ 右：MLB 2026）
    h('div', { key: 'hd', style: { display: 'flex', alignItems: 'center', width: '100%' } }, [
      h('div', { key: 'bar', style: { display: 'flex', width: 5, height: 34, background: ACCENT, marginRight: 18 } }),
      h('div', { key: 'brand', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 29, color: INK, letterSpacing: 3 } }, '海外の反応'),
      h('div', { key: 'mlb', style: { display: 'flex', marginLeft: 'auto', fontFamily: 'Bebas', fontSize: 30, color: INK_MUTE, letterSpacing: 4 } }, `MLB ${year}`),
    ]),
    // タイトル（英字ディスプレイを主役に・JP は支え）
    h('div', { key: 'ttl', style: { display: 'flex', flexDirection: 'column', marginTop: 34 } }, [
      h('div', { key: 'eye', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 34, color: ACCENT, letterSpacing: 6 } }, 'NATIONAL LEAGUE MVP'),
      h('div', { key: 'hero', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 122, color: INK, lineHeight: 0.86, letterSpacing: 2, marginTop: 10 } }, 'WAR TOP 5'),
      h('div', { key: 'sub', style: { display: 'flex', alignItems: 'center', marginTop: 16 } }, [
        h('div', { key: 's1', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 26, color: INK_MUTE, letterSpacing: 1 } }, 'ナ・リーグ 最優秀選手レース'),
        h('div', { key: 'dot', style: { display: 'flex', width: 5, height: 5, borderRadius: 3, background: INK_FAINT, marginLeft: 16, marginRight: 16 } }),
        h('div', { key: 's2', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 26, color: INK_MUTE } }, subtitle),
      ]),
    ]),
    // リーダーボード
    h('div', { key: 'lb', style: { display: 'flex', flex: 1, flexDirection: 'column', width: '100%', marginTop: 22, borderTop: `1px solid ${RULE}` } }, ranked.map((r, i) => row(r, i))),
    // フッター
    h('div', { key: 'ft', style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: 24 } }, [
      h('div', { key: 'dom', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 26, color: INK, letterSpacing: 1 } }, 'matome-mlb-kaigai.jp'),
      h('div', { key: 'ao', style: { display: 'flex', marginLeft: 'auto', fontFamily: 'Zen', fontWeight: 700, fontSize: 22, color: INK_FAINT } }, `WAR ${asOfLabel(race.asOf)}`),
    ]),
  ]);

  // 土台＝深いインク紺のフラット地（斜め光沢は廃止）＋ごく淡い上部グロー＋細い内枠。
  const el = h('div', { style: { position: 'relative', display: 'flex', width: '100%', height: '100%', background: `linear-gradient(165deg, ${BG0} 0%, ${BG1} 78%)` } }, [
    h('div', { key: 'glow', style: { ...layer, background: `linear-gradient(180deg, ${rgba('#1b3a63', 0.35)} 0%, rgba(0,0,0,0) 34%)` } }),
    h('div', { key: 'frame', style: { position: 'absolute', top: 26, left: 26, width: W - 52, height: H - 52, display: 'flex', border: `1px solid rgba(255,255,255,0.10)` } }),
    content,
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
  const outDir = path.join(process.cwd(), '_local', 'x-images');
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `mvp-nl-${mode}.png`);
  await fs.writeFile(out, buf);
  console.log(`✓ ナ・リーグ MVP レース（${mode}）→ ${path.relative(process.cwd(), out)}（${ranked.length}人・${W}×${H}）`);
  console.log(ranked.map((r, i) => `  ${i + 1}. ${r.name} ${r.war.toFixed(1)}${r.warHit != null && r.warPit != null ? ` (打${r.warHit}+投${r.warPit})` : ''}`).join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
