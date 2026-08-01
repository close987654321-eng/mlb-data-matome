/**
 * X 投稿用「ア・リーグ新人王レース 村上×岡本」対決カード PNG 生成（x-post スキルの弾）。
 *
 *   node scripts/roy-race-card.mjs
 *
 * 主役とライバルが競り合う型（26万/30万インプの伸び型）の画像版。黒地＋赤アクセントの
 * ハウススタイル（whitesox-worst-to-first カードと同系）で 1080×1350（X 最適の縦 4:5）を
 * _local/x-images/ に書き出す。数値は捏造せず MLB公式 Stats API で当日裏取り済み
 * （2026-07-10 時点: 岡本 90試合21本 OPS.776 ／ 村上 57試合20本 OPS.938・playerPool=Rookies で
 * AL 新人 HR 1・2位を実測）。_local は非コミット。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const W = 1080, H = 1350, PAD = 84;
const RED = '#E5322B';
const MUTED = 'rgba(255,255,255,0.62)';
const FAINT = 'rgba(255,255,255,0.42)';
const RULE = 'rgba(255,255,255,0.14)';

// 対決データ（2026-07-10 statsapi 実測）。有利な側だけ赤で点灯＝量の岡本・率の村上。
const ROWS = [
  { label: '本塁打', left: '21', right: '20', hot: 'left' },
  { label: 'OPS', left: '.776', right: '.938', hot: 'right' },
  { label: '試合', left: '90', right: '57', hot: null },
];

function statRow({ label, left, right, hot }) {
  const numStyle = (side) => ({
    display: 'flex', fontFamily: 'Anton', fontSize: 96, lineHeight: 1,
    color: hot === side ? RED : '#FFFFFF', letterSpacing: 1,
  });
  return h('div', { key: label, style: { display: 'flex', alignItems: 'center', padding: '30px 0', borderBottom: `1px solid ${RULE}` } }, [
    h('div', { key: 'l', style: { display: 'flex', flex: 1, justifyContent: 'center' } }, h('div', { style: numStyle('left') }, left)),
    h('div', { key: 'c', style: { display: 'flex', width: 190, justifyContent: 'center', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 30, color: FAINT } }, label),
    h('div', { key: 'r', style: { display: 'flex', flex: 1, justifyContent: 'center' } }, h('div', { style: numStyle('right') }, right)),
  ]);
}

async function main() {
  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [n7, n9, an] = await Promise.all([
    fs.readFile(path.join(dir, 'noto-jp-700.ttf')),
    fs.readFile(path.join(dir, 'noto-jp-900.ttf')),
    fs.readFile(path.join(dir, 'anton.ttf')),
  ]);

  const el = h('div', { style: { display: 'flex', flexDirection: 'column', width: W, height: H, backgroundColor: '#0B0B0C', padding: PAD, fontFamily: 'NotoJP', color: '#FFFFFF' } }, [
    // 見出しラベル
    h('div', { key: 'lab', style: { display: 'flex', fontSize: 30, fontWeight: 700, color: MUTED, letterSpacing: 6 } }, 'ア・リーグ 新人王レース'),

    // ヘッドライン（赤は2点運用のうち1点目）
    h('div', { key: 'h1', style: { display: 'flex', flexDirection: 'column', marginTop: 34 } }, [
      h('div', { key: 'a', style: { display: 'flex', fontSize: 94, fontWeight: 900, lineHeight: 1.18 } }, [
        h('div', { key: 'w', style: { display: 'flex' } }, '本塁打の1位と2位、'),
      ]),
      h('div', { key: 'b', style: { display: 'flex', fontSize: 94, fontWeight: 900, lineHeight: 1.18 } }, [
        h('div', { key: 'r', style: { display: 'flex', color: RED } }, 'どっちも日本人'),
        h('div', { key: 'w', style: { display: 'flex' } }, '。'),
      ]),
    ]),

    // 名前ヘッダー（左＝岡本／右＝村上）
    h('div', { key: 'names', style: { display: 'flex', alignItems: 'flex-end', marginTop: 66 } }, [
      h('div', { key: 'l', style: { display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center' } }, [
        h('div', { key: 'n', style: { display: 'flex', fontSize: 52, fontWeight: 900 } }, '岡本和真'),
        h('div', { key: 't', style: { display: 'flex', fontSize: 27, fontWeight: 700, color: FAINT, marginTop: 8, letterSpacing: 2 } }, 'ブルージェイズ'),
      ]),
      h('div', { key: 'c', style: { display: 'flex', width: 190, justifyContent: 'center', fontSize: 34, fontWeight: 900, color: FAINT, paddingBottom: 14 } }, '対'),
      h('div', { key: 'r', style: { display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center' } }, [
        h('div', { key: 'n', style: { display: 'flex', fontSize: 52, fontWeight: 900 } }, '村上宗隆'),
        h('div', { key: 't', style: { display: 'flex', fontSize: 27, fontWeight: 700, color: FAINT, marginTop: 8, letterSpacing: 2 } }, 'ホワイトソックス'),
      ]),
    ]),
    h('div', { key: 'rl', style: { display: 'flex', height: 1, backgroundColor: RULE, marginTop: 26 } }),

    // 対決 3 行
    ...ROWS.map(statRow),

    // 赤バーの締め（赤の2点目）
    h('div', { key: 'kicker', style: { display: 'flex', flexDirection: 'column', marginTop: 'auto', borderLeft: `10px solid ${RED}`, paddingLeft: 30 } }, [
      h('div', { key: 'k1', style: { display: 'flex', fontSize: 44, fontWeight: 900, lineHeight: 1.3 } }, '村上宗隆、明日復帰。'),
      h('div', { key: 'k2', style: { display: 'flex', fontSize: 31, fontWeight: 700, color: MUTED, marginTop: 12, lineHeight: 1.5 } }, '離脱中に岡本が逆転。33試合少ない村上が1本差で追う。'),
    ]),

    // フッター
    h('div', { key: 'ft', style: { display: 'flex', justifyContent: 'space-between', marginTop: 44 } }, [
      h('div', { key: 'src', style: { display: 'flex', fontSize: 24, fontWeight: 700, color: FAINT } }, '記録は2026年7月10日時点 ／ MLB公式データ'),
      h('div', { key: 'id', style: { display: 'flex', fontSize: 26, fontWeight: 700, color: MUTED, letterSpacing: 1 } }, '@gogogo123ka'),
    ]),
  ]);

  const img = new ImageResponse(el, {
    width: W, height: H,
    fonts: [
      { name: 'NotoJP', data: n7, weight: 700, style: 'normal' },
      { name: 'NotoJP', data: n9, weight: 900, style: 'normal' },
      { name: 'Anton', data: an, weight: 400, style: 'normal' },
    ],
  });
  const buf = Buffer.from(await img.arrayBuffer());
  const outDir = path.join(process.cwd(), '_local', 'x-images');
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, 'roy-race-murakami-okamoto.png');
  await fs.writeFile(out, buf);
  console.log(`✓ 新人王レース対決カード → ${path.relative(process.cwd(), out)}（${W}×${H}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
