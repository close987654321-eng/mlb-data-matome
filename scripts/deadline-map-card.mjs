/**
 * X 投稿用「日本人選手のいる球団 デッドライン勢力図」カード PNG 生成（x-post スキルの弾）。
 *
 *   node scripts/deadline-map-card.mjs
 *
 * data/standings.json（MLB公式 standings・CI毎時更新）を読み、日本人選手の所属11球団を
 * 貯金組／借金組の2ゾーンに分けて 1080×1350 のカードにして _local/x-images/ に書き出す。
 * ゾーン分けは勝率5割の上下という機械的な事実だけ（買い手/売り手の断定はしない＝編集は本文の仕事）。
 * デザイントークンは mvp-card.mjs と同一（インク紺フラット＋オフホワイト＋シャンパン1色・
 * Zen Kaku ＋ Bebas）＝成績カード群と同じ棚に見えるようにする。数値は standings.json 由来のみ。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const INK = '#F2F0EA';
const INK_MUTE = 'rgba(242,240,234,0.60)';
const INK_FAINT = 'rgba(242,240,234,0.40)';
const RULE = 'rgba(255,255,255,0.09)';
const BG0 = '#0D2039', BG1 = '#070F1C';
const ACCENT = '#CDB884';
const ACCENT_SOFT = 'rgba(205,184,132,0.55)';
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };

// 日本人選手 → 所属（表示名はチームの並びで使う）。移籍したらここを直す。
const JP = [
  { team: 'ドジャース', id: 119, players: '大谷翔平・山本由伸・佐々木朗希' },
  { team: 'カブス', id: 112, players: '鈴木誠也・今永昇太' },
  { team: 'ホワイトソックス', id: 145, players: '村上宗隆' },
  { team: 'レッドソックス', id: 111, players: '吉田正尚' },
  { team: 'カージナルス', id: 138, players: 'ヌートバー' },
  { team: 'パドレス', id: 135, players: '松井裕樹' },
  { team: 'アストロズ', id: 117, players: '今井達也' },
  { team: 'ブルージェイズ', id: 141, players: '岡本和真' },
  { team: 'メッツ', id: 121, players: '千賀滉大' },
  { team: 'エンゼルス', id: 108, players: '菊池雄星' },
  { team: 'ロッキーズ', id: 115, players: '菅野智之' },
];

async function fetchLogo(teamId) {
  try {
    const res = await fetch(`https://www.mlbstatic.com/team-logos/${teamId}.svg`);
    if (!res.ok) return null;
    const svg = Buffer.from(await res.arrayBuffer());
    const png = await sharp(svg, { density: 384 })
      .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return null; }
}

function asOfLabel(asOf) {
  const m = (asOf || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[3])}時点` : '';
}

async function main() {
  const st = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'standings.json'), 'utf8'));
  const year = st.season || 2026;

  // standings から日本人所属チームの行を引く（地区・順位・成績・直近10）。
  const rows = [];
  for (const div of st.divisions) {
    for (const t of div.teams) {
      const jp = JP.find((x) => x.team === t.nameJa);
      if (!jp) continue;
      rows.push({
        ...jp,
        w: t.w, l: t.l, pct: Number(t.pct),
        rank: t.rank, gb: t.gb, last10: t.last10,
        diff: t.w - t.l,
        divName: `${div.league === 'AL' ? 'ア' : 'ナ'}・${{ East: '東', Central: '中', West: '西' }[div.division.replace(/^[A-Z]+ /, '')] ?? div.division}地区`,
      });
    }
  }
  rows.sort((a, b) => b.pct - a.pct);
  const buyers = rows.filter((r) => r.diff > 0);
  const sellers = rows.filter((r) => r.diff <= 0);

  const logos = await Promise.all(rows.map((r) => fetchLogo(r.id)));
  rows.forEach((r, i) => { r.logo = logos[i]; });

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [zk7, zk9, bebas] = await Promise.all([
    fs.readFile(path.join(dir, 'zenkaku-bold.ttf')),
    fs.readFile(path.join(dir, 'zenkaku-black.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);

  const W = 1080, H = 1350, PAD = 66;

  const badge = (text, accent) => h('div', {
    style: {
      display: 'flex', alignItems: 'center', marginLeft: 14, flexShrink: 0,
      border: `1px solid ${accent ? ACCENT_SOFT : 'rgba(255,255,255,0.22)'}`,
      color: accent ? ACCENT : INK_MUTE, borderRadius: 4, padding: '2px 10px',
      fontFamily: 'Zen', fontWeight: 700, fontSize: 17, letterSpacing: 1,
    },
  }, text);

  const row = (r) => {
    const isLeader = r.gb === '-';
    const hot = r.last10 === '9-1' || r.last10 === '10-0';
    return h('div', { style: { display: 'flex', flex: 1, minHeight: 0, alignItems: 'center', width: '100%', borderBottom: `1px solid ${RULE}` } }, [
      h('div', { key: 'lg', style: { display: 'flex', width: 56, height: 56, marginRight: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
        r.logo ? h('img', { src: r.logo, width: 52, height: 52, style: { objectFit: 'contain' } }) : null),
      h('div', { key: 'mid', style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 } }, [
        h('div', { key: 'p', style: { display: 'flex', alignItems: 'center' } }, [
          h('div', { key: 'pn', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: r.players.length >= 12 ? 27 : 31, color: INK, letterSpacing: -0.5 } }, r.players),
          isLeader ? badge('地区首位', true) : null,
          hot ? badge(`直近${r.last10}`, false) : null,
        ]),
        h('div', { key: 't', style: { display: 'flex', alignItems: 'center', marginTop: 6 } }, [
          h('div', { key: 'tt', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 20, color: INK_MUTE } }, r.team),
          h('div', { key: 'dv', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 18, color: INK_FAINT, marginLeft: 12 } }, `${r.divName}${r.rank}位`),
        ]),
      ]),
      h('div', { key: 'num', style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 12, flexShrink: 0 } }, [
        h('div', { key: 'wl', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 46, color: isLeader ? ACCENT : INK, lineHeight: 1, letterSpacing: 1 } }, `${r.w}-${r.l}`),
        h('div', { key: 'df', style: { display: 'flex', marginTop: 3, fontFamily: 'Zen', fontWeight: 700, fontSize: 18, color: INK_FAINT } },
          r.diff > 0 ? `貯金${r.diff}` : r.diff < 0 ? `借金${-r.diff}` : '5割'),
      ]),
    ]);
  };

  const zoneHead = (jp, en, accent) => h('div', { style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: 18, paddingBottom: 8 } }, [
    h('div', { key: 'b', style: { display: 'flex', width: 4, height: 22, background: accent ? ACCENT : INK_FAINT, marginRight: 12 } }),
    h('div', { key: 'j', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 25, color: accent ? ACCENT : INK_MUTE, letterSpacing: 2 } }, jp),
    h('div', { key: 'e', style: { display: 'flex', marginLeft: 14, fontFamily: 'Bebas', fontSize: 23, color: INK_FAINT, letterSpacing: 3 } }, en),
  ]);

  const layer = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' };

  const content = h('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: `${PAD}px ${PAD}px 54px`, color: INK } }, [
    h('div', { key: 'hd', style: { display: 'flex', alignItems: 'center', width: '100%' } }, [
      h('div', { key: 'bar', style: { display: 'flex', width: 5, height: 34, background: ACCENT, marginRight: 18 } }),
      h('div', { key: 'brand', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 29, color: INK, letterSpacing: 3 } }, '海外の反応'),
      h('div', { key: 'mlb', style: { display: 'flex', marginLeft: 'auto', fontFamily: 'Bebas', fontSize: 30, color: INK_MUTE, letterSpacing: 4 } }, `MLB ${year}`),
    ]),
    h('div', { key: 'ttl', style: { display: 'flex', flexDirection: 'column', marginTop: 26 } }, [
      h('div', { key: 'eye', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 32, color: ACCENT, letterSpacing: 6 } }, 'TRADE DEADLINE WEEK'),
      h('div', { key: 'hero', style: { display: 'flex', fontFamily: 'Bebas', fontSize: 100, color: INK, lineHeight: 0.88, letterSpacing: 2, marginTop: 8 } }, 'BUYERS OR SELLERS'),
      h('div', { key: 'sub', style: { display: 'flex', marginTop: 12, fontFamily: 'Zen', fontWeight: 700, fontSize: 25, color: INK_MUTE, letterSpacing: 1 } }, '日本人選手のいる球団、月末へ向けた現在地'),
    ]),
    zoneHead('貯金組', 'ABOVE .500', true),
    h('div', { key: 'z1', style: { display: 'flex', flexDirection: 'column', width: '100%', flex: buyers.length, borderTop: `1px solid ${RULE}` } }, buyers.map((r) => row(r))),
    zoneHead('借金組', 'BELOW .500', false),
    h('div', { key: 'z2', style: { display: 'flex', flexDirection: 'column', width: '100%', flex: sellers.length, borderTop: `1px solid ${RULE}` } }, sellers.map((r) => row(r))),
    h('div', { key: 'ft', style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: 20 } }, [
      h('div', { key: 'dom', style: { display: 'flex', fontFamily: 'Zen', fontWeight: 700, fontSize: 26, color: INK, letterSpacing: 1 } }, 'matome-mlb-kaigai.jp'),
      h('div', { key: 'ao', style: { display: 'flex', marginLeft: 'auto', fontFamily: 'Zen', fontWeight: 700, fontSize: 22, color: INK_FAINT } }, `順位表 ${asOfLabel(st.asOf)}`),
    ]),
  ]);

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
  const out = path.join(outDir, 'deadline-map.png');
  await fs.writeFile(out, buf);
  console.log(`✓ デッドライン勢力図 → ${path.relative(process.cwd(), out)}（${rows.length}球団・${W}×${H}）`);
  console.log(rows.map((r) => `  ${r.team}(${r.players}) ${r.w}-${r.l} ${r.diff > 0 ? `貯金${r.diff}` : r.diff < 0 ? `借金${-r.diff}` : '5割'}`).join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
