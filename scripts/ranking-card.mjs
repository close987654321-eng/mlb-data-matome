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
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// 日本人選手 mlbId→表記（scripts/fetch-mlb-stats.mjs の JP_NAMES と一致させる。rival は出さない）。
const JP_NAMES = {
  660271: '大谷翔平', 808967: '山本由伸', 808963: '佐々木朗希', 684007: '今永昇太',
  673540: '千賀滉大', 673548: '鈴木誠也', 807799: '吉田正尚', 579328: '菊池雄星',
  673513: '松井裕樹', 608372: '菅野智之', 672960: '岡本和真', 808959: '村上宗隆',
  837227: '今井達也', 807747: '西田陸羽', 663457: 'ヌートバー',
};

// 成績カード家風（src/lib/ogCard.tsx の teamOgFrame）の配色。多チームのランキングはチーム非依存の
// 深いネイビーを地にする（白文字の視認性を優先。赤地は視認性が落ちるため 2026-07-01 に青系へ変更）。
// 値は深ネイビー #0C2C56 を teamField で暗く正規化したもの。
const CREAM = '#FAF8F4';
const FIELD0 = '#0f376b', FIELD1 = '#081e3a', SWEEP = '#154e98', ACC = '#1f72e0';
const FMUTED = 'rgba(255,255,255,0.72)', FFAINT = 'rgba(255,255,255,0.50)', FRULE = 'rgba(255,255,255,0.16)';
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };

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

// MLB公式CDNの顔写真（src/lib/teams.ts の headshotUrl 'spot' と同じ＝丸アバター向けの頭部カットアウト）。
const headshotUrl = (id) => `https://midfield.mlbstatic.com/v1/people/${id}/spots/120`;

// 顔写真を取得して data URI 化（satori は data URI が最も確実＝レンダ時のネットワーク依存を無くす）。
// 失敗しても null を返してカードは壊さない（アバターだけ欠けて続行）。
async function fetchAvatar(id) {
  try {
    const res = await fetch(headshotUrl(id));
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'image/png';
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// チーム日本語名→teamId（src/lib/teams.ts の TEAMS と一致させる）。ロゴ直リンクの id 引き。
const TEAM_ID = {
  エンゼルス: 108, ダイヤモンドバックス: 109, オリオールズ: 110, レッドソックス: 111, カブス: 112,
  レッズ: 113, ガーディアンズ: 114, ロッキーズ: 115, タイガース: 116, アストロズ: 117, ロイヤルズ: 118,
  ドジャース: 119, ナショナルズ: 120, メッツ: 121, アスレチックス: 133, パイレーツ: 134, パドレス: 135,
  マリナーズ: 136, ジャイアンツ: 137, カージナルス: 138, レイズ: 139, レンジャーズ: 140, ブルージェイズ: 141,
  ツインズ: 142, フィリーズ: 143, ブレーブス: 144, ホワイトソックス: 145, マーリンズ: 146, ヤンキース: 147, ブルワーズ: 158,
};

// チームロゴ（公式は SVG）を sharp で PNG にラスタライズして data URI 化。satori は SVG 画像を確実に
// 描けないため PNG に倒す。density を上げて小サイズでも輪郭を保つ。失敗は null（ロゴだけ欠けて続行）。
async function fetchLogo(teamJa) {
  const id = TEAM_ID[teamJa];
  if (!id) return null;
  try {
    const res = await fetch(`https://www.mlbstatic.com/team-logos/${id}.svg`);
    if (!res.ok) return null;
    const svg = Buffer.from(await res.arrayBuffer());
    const png = await sharp(svg, { density: 384 })
      .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
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

  // 顔写真・チームロゴを並列取得して data URI 化し、各行に埋める（失敗した分だけ欠けて続行）。
  const [avatars, logos] = await Promise.all([
    Promise.all(ranked.map((r) => fetchAvatar(r.id))),
    Promise.all(ranked.map((r) => fetchLogo(r.s.team))),
  ]);
  ranked.forEach((r, i) => {
    r.avatar = avatars[i];
    r.logo = logos[i];
  });

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [n7, n9, an] = await Promise.all([
    fs.readFile(path.join(dir, 'noto-jp-700.ttf')),
    fs.readFile(path.join(dir, 'noto-jp-900.ttf')),
    fs.readFile(path.join(dir, 'anton.ttf')),
  ]);

  const W = 1080, H = 1350, PAD = 66;

  const row = (r, i) => {
    const top3 = i < 3;
    return h('div', { style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: 16, paddingBottom: 16, borderBottom: `1px solid ${FRULE}` } }, [
      // 順位
      h('div', { key: 'rk', style: { display: 'flex', width: 66, justifyContent: 'center', fontFamily: 'Anton', fontSize: 50, color: top3 ? CREAM : FFAINT } }, String(i + 1)),
      // 顔写真（丸アバター＝暗いディスク＋白リングに公式ヘッドショットのカットアウト）
      h('div', { key: 'av', style: { display: 'flex', width: 88, height: 88, borderRadius: 44, marginRight: 20, background: 'rgba(0,0,0,0.28)', border: '2px solid rgba(255,255,255,0.22)', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 } },
        r.avatar ? h('img', { src: r.avatar, width: 88, height: 88, style: { objectFit: 'cover' } }) : null),
      // 名前＋（チームロゴ＋所属＋役割）
      h('div', { key: 'nm', style: { display: 'flex', flexDirection: 'column', flex: 1 } }, [
        h('div', { key: 'n', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 42, color: CREAM } }, r.name),
        h('div', { key: 't', style: { display: 'flex', alignItems: 'center', marginTop: 5 } }, [
          r.logo ? h('img', { key: 'lg', src: r.logo, width: 30, height: 30, style: { objectFit: 'contain', marginRight: 10 } }) : null,
          h('div', { key: 'tt', style: { display: 'flex', fontFamily: 'NotoJP', fontSize: 23, color: FMUTED } }, `${r.s.team || ''}${r.role ? `　${r.role}` : ''}`),
        ]),
      ]),
      // 数値（Anton の大判）
      h('div', { key: 'vl', style: { display: 'flex', fontFamily: 'Anton', fontSize: 68, color: top3 ? CREAM : FMUTED, lineHeight: 1 } }, board.fmt(r.val)),
    ]);
  };

  const layer = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' };

  // コンテンツ（フレームの内側）。
  const content = h('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: `${PAD}px ${PAD}px`, color: CREAM, fontFamily: 'NotoJP' } }, [
    // ヘッダー（アクセントバー＋媒体名＋年＋右バッジ）
    h('div', { key: 'hd', style: { display: 'flex', alignItems: 'center', width: '100%' } }, [
      h('div', { key: 'bar', style: { display: 'flex', width: 16, height: 46, background: ACC, borderRadius: 3, marginRight: 20 } }),
      h('div', { key: 'brand', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 30, color: CREAM, letterSpacing: 2 } }, '海外の反応'),
      h('div', { key: 'mlb', style: { display: 'flex', fontFamily: 'Anton', fontSize: 26, color: FMUTED, letterSpacing: 3, marginLeft: 20 } }, `MLB ${year}`),
      h('div', { key: 'bd', style: { display: 'flex', marginLeft: 'auto', alignItems: 'center', border: `1px solid rgba(255,255,255,0.28)`, borderRadius: 999, padding: '8px 22px', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 22, color: CREAM, letterSpacing: 1 } }, '成績ランキング'),
    ]),
    // タイトル
    h('div', { key: 'ttl', style: { display: 'flex', flexDirection: 'column', marginTop: 30, marginBottom: 4 } }, [
      h('div', { key: 't1', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 900, fontSize: 66, color: CREAM, lineHeight: 1.08 } }, '日本人MLB選手'),
      h('div', { key: 't2', style: { display: 'flex', alignItems: 'baseline', marginTop: 4 } }, [
        h('div', { key: 'a', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 900, fontSize: 66, color: CREAM, lineHeight: 1.08 } }, board.label),
        h('div', { key: 'b', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 38, color: FMUTED, marginLeft: 16 } }, 'ランキング'),
      ]),
    ]),
    // リーダーボード
    h('div', { key: 'lb', style: { display: 'flex', flexDirection: 'column', width: '100%', marginTop: 6, borderTop: `1px solid ${FRULE}` } }, ranked.map((r, i) => row(r, i))),
    // フッター（ドメイン透かし＋時点）
    h('div', { key: 'ft', style: { display: 'flex', alignItems: 'center', width: '100%', marginTop: 'auto', paddingTop: 22 } }, [
      h('div', { key: 'dom', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 27, color: CREAM, letterSpacing: 1 } }, 'matome-mlb-kaigai.jp'),
      h('div', { key: 'ao', style: { display: 'flex', marginLeft: 'auto', fontFamily: 'NotoJP', fontSize: 23, color: FFAINT } }, asOfLabel(snap.asOf)),
    ]),
  ]);

  // 土台＝成績カード家風のフレーム（地グラデ＋斜めスイープ＋アクセント斜線＋内側の白ヘアライン枠）。
  const el = h('div', { style: { position: 'relative', display: 'flex', width: '100%', height: '100%', background: `linear-gradient(150deg, ${FIELD0} 0%, ${FIELD1} 100%)` } }, [
    h('div', { key: 'sweep', style: { ...layer, background: `linear-gradient(115deg, rgba(0,0,0,0) 42%, ${rgba(SWEEP, 0.5)} 60%, rgba(0,0,0,0) 88%)` } }),
    h('div', { key: 'acc', style: { ...layer, background: `linear-gradient(125deg, rgba(0,0,0,0) 55%, ${rgba(ACC, 0.1)} 100%)` } }),
    h('div', { key: 'frame', style: { position: 'absolute', top: 22, left: 22, width: W - 44, height: H - 44, display: 'flex', border: '2px solid rgba(255,255,255,0.14)', borderRadius: 10 } }),
    content,
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
