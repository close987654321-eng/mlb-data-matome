/**
 * X 投稿用「日本人ランキングカード」PNG 生成スクリプト（x-share スキルの弾）。
 *
 *   node scripts/ranking-card.mjs [war|bat|pit|hr]
 *
 * data/jp-players-stats.json（編集時スナップショット）を読み、指標別の日本人ランキングを
 * 1080×1350（X 最適の縦 4:5）のカード画像にして _local/x-images/ に書き出す。ドメイン透かし入り＝
 * 本文無リンクのまま毎回ブランドを刷り込むための画像（[[traffic-max-ranking-hub]] の配信設計）。
 *
 * 描画は OG カードと同じ next/og（satori＋resvg・同梱フォント）を使う＝日本語が確実に出る。
 * 数値は捏造せずスナップショット由来のみ。_local はコミットしない（画像は貯めるだけ）。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// 日本人選手 mlbId→表記（scripts/fetch-mlb-stats.mjs の JP_NAMES と一致させる。rival は出さない）。
const JP_NAMES = {
  660271: '大谷翔平', 808967: '山本由伸', 808963: '佐々木朗希', 684007: '今永昇太',
  673540: '千賀滉大', 673548: '鈴木誠也', 807799: '吉田正尚', 579328: '菊池雄星',
  673513: '松井裕樹', 608372: '菅野智之', 672960: '岡本和真', 808959: '村上宗隆',
  837227: '今井達也', 807747: '西田陸羽', 663457: 'ヌートバー',
};

// ブランド配色（src/lib/ogCard.tsx と揃える）。
const BG = '#16130F', CREAM = '#FAF8F4', MUTED = '#9b958c', FAINT = '#6f6a62', RULE = '#2b2620', ACCENT = '#C8102E';

const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
const isRealPitcher = (s) => !!s.pitching && (num(s.pitching.gamesStarted) >= 1 || num(s.pitching.inningsPitched) >= 10);
const bestWar = (s) => Math.max(s.saber?.hit ?? -Infinity, s.saber?.pit ?? -Infinity);

// 指標定義（/ranking のボードと対応）。
const BOARDS = {
  war: {
    label: '前半戦WAR', unit: '',
    rows: (players) => players
      .filter((x) => Number.isFinite(bestWar(x.s)))
      .map((x) => ({ ...x, val: bestWar(x.s), role: roleOf(x.s) }))
      .sort((a, b) => b.val - a.val),
    fmt: (v) => v.toFixed(1),
  },
  bat: {
    label: '打者WAR', unit: '',
    rows: (players) => players
      .filter((x) => x.s.hitting && x.s.saber?.hit != null)
      .map((x) => ({ ...x, val: x.s.saber.hit, role: '打' }))
      .sort((a, b) => b.val - a.val),
    fmt: (v) => v.toFixed(1),
  },
  pit: {
    label: '投手WAR', unit: '',
    rows: (players) => players
      .filter((x) => isRealPitcher(x.s) && x.s.saber?.pit != null)
      .map((x) => ({ ...x, val: x.s.saber.pit, role: '投' }))
      .sort((a, b) => b.val - a.val),
    fmt: (v) => v.toFixed(1),
  },
  hr: {
    label: '本塁打', unit: '',
    rows: (players) => players
      .filter((x) => x.s.hitting && num(x.s.hitting.homeRuns) != null)
      .map((x) => ({ ...x, val: num(x.s.hitting.homeRuns), role: '打' }))
      .sort((a, b) => b.val - a.val),
    fmt: (v) => String(Math.round(v)),
  },
};

function roleOf(s) {
  const hasBat = s.saber?.hit != null && s.hitting;
  const pit = isRealPitcher(s);
  if (hasBat && pit) return '二刀流';
  if (pit) return '投';
  if (hasBat) return '打';
  return '';
}

function asOfLabel(asOf) {
  const m = (asOf || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[3])}時点` : '';
}

async function main() {
  const boardKey = (process.argv[2] || 'war').toLowerCase();
  const board = BOARDS[boardKey];
  if (!board) {
    console.error(`未知の指標: ${boardKey}（war|bat|pit|hr）`);
    process.exit(1);
  }

  const snap = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'jp-players-stats.json'), 'utf8'));
  const year = snap.season || 2026;
  const players = Object.entries(JP_NAMES)
    .map(([id, name]) => ({ id: Number(id), name, s: snap.players[id] }))
    .filter((x) => x.s && x.s.league); // MLB今季成績がある日本人のみ（AAA等は league=null で除外）
  const ranked = board.rows(players).slice(0, 7);
  if (ranked.length === 0) {
    console.error('対象選手が0件（スナップショット未生成？）');
    process.exit(1);
  }

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [n7, n9, an] = await Promise.all([
    fs.readFile(path.join(dir, 'noto-jp-700.ttf')),
    fs.readFile(path.join(dir, 'noto-jp-900.ttf')),
    fs.readFile(path.join(dir, 'anton.ttf')),
  ]);

  const W = 1080, H = 1350;
  const row = (r, i) => {
    const top3 = i < 3;
    return h('div', { style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: 17, paddingBottom: 17, borderBottom: `1px solid ${RULE}` } }, [
      h('div', { key: 'rk', style: { display: 'flex', width: 80, justifyContent: 'center', fontFamily: 'Anton', fontSize: 52, color: top3 ? CREAM : FAINT } }, String(i + 1)),
      h('div', { key: 'nm', style: { display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 8 } }, [
        h('div', { key: 'n', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 42, color: CREAM } }, r.name),
        h('div', { key: 't', style: { display: 'flex', fontFamily: 'NotoJP', fontSize: 23, color: MUTED, marginTop: 3 } }, `${r.s.team || ''}${r.role ? `　${r.role}` : ''}`),
      ]),
      h('div', { key: 'vl', style: { display: 'flex', fontFamily: 'Anton', fontSize: 66, color: top3 ? CREAM : MUTED, lineHeight: 1 } }, board.fmt(r.val)),
    ]);
  };

  const el = h('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: BG, color: CREAM, padding: '64px 68px', fontFamily: 'NotoJP' } }, [
    // ヘッダー
    h('div', { key: 'hd', style: { display: 'flex', alignItems: 'center', width: '100%' } }, [
      h('div', { key: 'bar', style: { display: 'flex', width: 16, height: 46, background: ACCENT, borderRadius: 3, marginRight: 20 } }),
      h('div', { key: 'brand', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 30, color: CREAM, letterSpacing: 2 } }, '海外の反応'),
      h('div', { key: 'mlb', style: { display: 'flex', fontFamily: 'Anton', fontSize: 26, color: MUTED, letterSpacing: 3, marginLeft: 20 } }, `MLB ${year}`),
    ]),
    // タイトル
    h('div', { key: 'ttl', style: { display: 'flex', flexDirection: 'column', marginTop: 34, marginBottom: 8 } }, [
      h('div', { key: 't1', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 900, fontSize: 68, color: CREAM, lineHeight: 1.1 } }, '日本人MLB選手'),
      h('div', { key: 't2', style: { display: 'flex', alignItems: 'baseline', marginTop: 6 } }, [
        h('div', { key: 'a', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 900, fontSize: 68, color: CREAM, lineHeight: 1.1 } }, board.label),
        h('div', { key: 'b', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 40, color: MUTED, marginLeft: 16 } }, 'ランキング'),
      ]),
    ]),
    // リーダーボード
    h('div', { key: 'lb', style: { display: 'flex', flexDirection: 'column', width: '100%', marginTop: 8, borderTop: `1px solid ${RULE}` } }, ranked.map((r, i) => row(r, i))),
    // フッター（ドメイン透かし）
    h('div', { key: 'ft', style: { display: 'flex', alignItems: 'center', width: '100%', marginTop: 'auto', paddingTop: 24 } }, [
      h('div', { key: 'dom', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 28, color: CREAM, letterSpacing: 1 } }, 'matome-mlb-kaigai.jp'),
      h('div', { key: 'ao', style: { display: 'flex', marginLeft: 'auto', fontFamily: 'NotoJP', fontSize: 24, color: FAINT } }, asOfLabel(snap.asOf)),
    ]),
  ]);

  const res = new ImageResponse(el, {
    width: W, height: H,
    fonts: [
      { name: 'NotoJP', data: n7, weight: 700, style: 'normal' },
      { name: 'NotoJP', data: n9, weight: 900, style: 'normal' },
      { name: 'Anton', data: an, weight: 400, style: 'normal' },
    ],
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const outDir = path.join(process.cwd(), '_local', 'x-images');
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `ranking-${boardKey}.png`);
  await fs.writeFile(out, buf);
  console.log(`✓ ${board.label}ランキング → ${path.relative(process.cwd(), out)}（${ranked.length}人・${W}×${H}）`);
  console.log(ranked.map((r, i) => `  ${i + 1}. ${r.name} ${board.fmt(r.val)}`).join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
