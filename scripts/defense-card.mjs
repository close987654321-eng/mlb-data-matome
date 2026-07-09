/**
 * X 投稿用「MLB守備 OAAランキング トップ15」カード PNG 生成（x-share スキルの弾）。
 *
 *   node scripts/defense-card.mjs [season]   // 既定シーズン=2026
 *
 * Baseball Savant（MLB公式・Statcast）の OAA（Outs Above Average＝守備範囲・アウト換算）リーダーボード
 * CSV を読み、全ポジション横断で OAA トップ15を 1080×1810 の縦カードにして _local/x-images/ に書き出す。
 * 数値は捏造せず Savant 由来のみ（公知の指標だけを引用）。ranking-card.mjs（日本人版）と同じ成績カード
 * 家風＝深ネイビー地＋クリーム文字＋Anton数字＋顔写真＋チームロゴ＋ドメイン透かし。_local はコミットしない。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// ── 成績カード家風（ranking-card.mjs と同値）の配色 ──────────────────────────
const CREAM = '#FAF8F4';
const FIELD0 = '#0f376b', FIELD1 = '#081e3a', SWEEP = '#154e98', ACC = '#1f72e0';
const FMUTED = 'rgba(255,255,255,0.72)', FFAINT = 'rgba(255,255,255,0.50)', FRULE = 'rgba(255,255,255,0.14)';
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };

// ── Savant CSV（引用符・カンマ入りの "last_name, first_name" に対応した簡易パーサ） ──
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out;
}
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((x) => x.replace(/^﻿/, '').trim());
  return lines.slice(1).map((l) => {
    const cells = parseCsvLine(l);
    return Object.fromEntries(header.map((k, i) => [k, cells[i]]));
  });
}

// ── チーム英語表記（display_team_name）→ teamId（公式ロゴの直リンク引き。全30マップ） ──
const TEAM_ID = {
  Angels: 108, 'D-backs': 109, Orioles: 110, 'Red Sox': 111, Cubs: 112, Reds: 113,
  Guardians: 114, Rockies: 115, Tigers: 116, Astros: 117, Royals: 118, Dodgers: 119,
  Nationals: 120, Mets: 121, Athletics: 133, Pirates: 134, Padres: 135, Mariners: 136,
  Giants: 137, Cardinals: 138, Rays: 139, Rangers: 140, 'Blue Jays': 141, Twins: 142,
  Phillies: 143, Braves: 144, 'White Sox': 145, Marlins: 146, Yankees: 147, Brewers: 158,
};
// チーム英語表記 → 日本語（サブラインの所属表示用）
const TEAM_JA = {
  Angels: 'エンゼルス', 'D-backs': 'ダイヤモンドバックス', Orioles: 'オリオールズ', 'Red Sox': 'レッドソックス',
  Cubs: 'カブス', Reds: 'レッズ', Guardians: 'ガーディアンズ', Rockies: 'ロッキーズ', Tigers: 'タイガース',
  Astros: 'アストロズ', Royals: 'ロイヤルズ', Dodgers: 'ドジャース', Nationals: 'ナショナルズ', Mets: 'メッツ',
  Athletics: 'アスレチックス', Pirates: 'パイレーツ', Padres: 'パドレス', Mariners: 'マリナーズ', Giants: 'ジャイアンツ',
  Cardinals: 'カージナルス', Rays: 'レイズ', Rangers: 'レンジャーズ', 'Blue Jays': 'ブルージェイズ', Twins: 'ツインズ',
  Phillies: 'フィリーズ', Braves: 'ブレーブス', 'White Sox': 'ホワイトソックス', Marlins: 'マーリンズ',
  Yankees: 'ヤンキース', Brewers: 'ブルワーズ',
};
// 守備位置の日本語（サブライン用）。CSV の primary_pos_formatted は英略号。
const POS_JA = { '1B': '一塁', '2B': '二塁', '3B': '三塁', SS: '遊撃', LF: '左翼', CF: '中堅', RF: '右翼', C: '捕手', P: '投手' };

// player_id → カタカナ表記（日本語サイト向けの主表記。未マップは英語名で描く＝捏造せず素の名を出す）。
const KANA = {
  802139: 'JJ・ウェザーホルト', 677951: 'ボビー・ウィット Jr.', 691718: 'ピート・クロウアームストロング',
  696285: 'ジェイコブ・ヤング', 678882: 'セダン・ラファエラ', 650333: 'ルイス・アラエス',
  671976: 'トリスタン・ピーターズ', 665926: 'アンドレス・ヒメネス', 686681: 'マイケル・マッシー',
  682177: 'ダニエル・シュニーマン', 621020: 'ダンズビー・スワンソン', 682998: 'コービン・キャロル',
  665862: 'ジャズ・チザム Jr.', 663538: 'ニコ・ホーナー', 694497: 'エバン・カーター',
};

const toNum = (v) => { if (v == null || v === '') return null; const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
// "Witt Jr., Bobby" → "Bobby Witt Jr."（英語の姓名を自然順に）
const enName = (raw) => { const [last, first] = (raw || '').split(', '); return first ? `${first} ${last}` : (raw || ''); };
const signed = (n) => (n > 0 ? `+${n}` : String(n));

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
async function fetchLogo(teamEn) {
  const id = TEAM_ID[teamEn];
  if (!id) return null;
  try {
    const res = await fetch(`https://www.mlbstatic.com/team-logos/${id}.svg`);
    if (!res.ok) return null;
    const svg = Buffer.from(await res.arrayBuffer());
    const png = await sharp(svg, { density: 384 }).resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return null; }
}

async function main() {
  const season = Number(process.argv[2]) || 2026;
  const url = `https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&startYear=${season}&endYear=${season}&split=no&team=&range=year&min=1&pos=&roleKey=&csv=true`;
  const res = await fetch(url, { headers: { 'User-Agent': 'matome-mlb-kaigai/editor' } });
  if (!res.ok) { console.error(`Savant ${res.status}: ${url}`); process.exit(1); }
  const rows = parseCsv(await res.text())
    .map((r) => ({
      id: Number(r.player_id),
      raw: r['last_name, first_name'],
      team: r.display_team_name,
      pos: r.primary_pos_formatted,
      oaa: toNum(r.outs_above_average),
      frv: toNum(r.fielding_runs_prevented),
    }))
    .filter((r) => r.id && r.oaa != null && TEAM_ID[r.team]); // トレード直後の "---" 等は除外
  // OAA 降順、同値は守備run(FRV)降順でタイブレーク
  rows.sort((a, b) => b.oaa - a.oaa || (b.frv ?? -99) - (a.frv ?? -99));
  const top = rows.slice(0, 15);
  if (!top.length) { console.error('OAA データが0件（シーズン未開幕？）'); process.exit(1); }

  const [avatars, logos] = await Promise.all([
    Promise.all(top.map((r) => fetchAvatar(r.id))),
    Promise.all(top.map((r) => fetchLogo(r.team))),
  ]);
  top.forEach((r, i) => { r.avatar = avatars[i]; r.logo = logos[i]; });

  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [n7, n9, an] = await Promise.all([
    fs.readFile(path.join(dir, 'noto-jp-700.ttf')),
    fs.readFile(path.join(dir, 'noto-jp-900.ttf')),
    fs.readFile(path.join(dir, 'anton.ttf')),
  ]);

  const W = 1080, H = 1810, PAD = 58;
  const asOf = new Date();
  const asOfLabel = `${season}シーズン・${asOf.getMonth() + 1}/${asOf.getDate()}時点`;

  const row = (r, i) => {
    const top3 = i < 3;
    const kana = KANA[r.id] || enName(r.raw);
    const en = enName(r.raw);
    const teamJa = TEAM_JA[r.team] || r.team;
    const posJa = POS_JA[r.pos] || r.pos;
    return h('div', { style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: 9, paddingBottom: 9, borderBottom: `1px solid ${FRULE}` } }, [
      // 順位
      h('div', { key: 'rk', style: { display: 'flex', width: 50, justifyContent: 'center', fontFamily: 'Anton', fontSize: 38, color: top3 ? CREAM : FFAINT } }, String(i + 1)),
      // 顔写真（丸アバター）
      h('div', { key: 'av', style: { display: 'flex', width: 54, height: 54, borderRadius: 27, marginLeft: 8, marginRight: 16, background: 'rgba(0,0,0,0.28)', border: '2px solid rgba(255,255,255,0.22)', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 } },
        r.avatar ? h('img', { src: r.avatar, width: 54, height: 54, style: { objectFit: 'cover' } }) : null),
      // 名前＋（英名・所属）
      h('div', { key: 'nm', style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 } }, [
        h('div', { key: 'n', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 27, color: CREAM } }, kana),
        h('div', { key: 's', style: { display: 'flex', alignItems: 'center', marginTop: 2, fontFamily: 'NotoJP', fontSize: 16, color: FFAINT } }, `${en}　·　${teamJa}`),
      ]),
      // 守備位置チップ
      h('div', { key: 'pos', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 74, flexShrink: 0 } }, [
        h('div', { key: 'p1', style: { display: 'flex', fontFamily: 'Anton', fontSize: 26, color: FMUTED, letterSpacing: 1 } }, r.pos),
        h('div', { key: 'p2', style: { display: 'flex', fontFamily: 'NotoJP', fontSize: 15, color: FFAINT, marginTop: 1 } }, posJa),
      ]),
      // 数値（OAA を Anton の大判・守備run を faint サブ）
      h('div', { key: 'vl', style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 138, flexShrink: 0 } }, [
        h('div', { key: 'v', style: { display: 'flex', fontFamily: 'Anton', fontSize: 48, color: top3 ? CREAM : FMUTED, lineHeight: 1 } }, signed(r.oaa)),
        r.frv != null ? h('div', { key: 'f', style: { display: 'flex', fontFamily: 'NotoJP', fontSize: 15, color: FFAINT, marginTop: 2 } }, `守備run ${signed(r.frv)}`) : null,
      ]),
    ]);
  };

  const layer = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' };
  const content = h('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: `${PAD}px ${PAD}px`, color: CREAM, fontFamily: 'NotoJP' } }, [
    // ヘッダー
    h('div', { key: 'hd', style: { display: 'flex', alignItems: 'center', width: '100%' } }, [
      h('div', { key: 'bar', style: { display: 'flex', width: 16, height: 46, background: ACC, borderRadius: 3, marginRight: 20 } }),
      h('div', { key: 'brand', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 30, color: CREAM, letterSpacing: 2 } }, '海外の反応'),
      h('div', { key: 'mlb', style: { display: 'flex', fontFamily: 'Anton', fontSize: 26, color: FMUTED, letterSpacing: 3, marginLeft: 20 } }, `MLB ${season}`),
      h('div', { key: 'bd', style: { display: 'flex', marginLeft: 'auto', alignItems: 'center', border: `1px solid rgba(255,255,255,0.28)`, borderRadius: 999, padding: '8px 22px', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 22, color: CREAM, letterSpacing: 1 } }, '守備指標'),
    ]),
    // タイトル
    h('div', { key: 'ttl', style: { display: 'flex', flexDirection: 'column', marginTop: 28, marginBottom: 2 } }, [
      h('div', { key: 't1', style: { display: 'flex', alignItems: 'baseline' } }, [
        h('div', { key: 'a', style: { display: 'flex', fontFamily: 'Anton', fontSize: 66, color: CREAM, lineHeight: 1.02, letterSpacing: 1 } }, 'OAA'),
        h('div', { key: 'b', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 900, fontSize: 60, color: CREAM, lineHeight: 1.02, marginLeft: 18 } }, '守備ランキング'),
      ]),
      h('div', { key: 't2', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 27, color: FMUTED, marginTop: 10 } }, '全ポジション横断 TOP15　·　守備範囲をアウトに換算した最先端の守備指標'),
    ]),
    // カラム見出し
    h('div', { key: 'ch', style: { display: 'flex', alignItems: 'center', width: '100%', marginTop: 20, paddingBottom: 8 } }, [
      h('div', { key: 'c1', style: { display: 'flex', flex: 1, fontFamily: 'NotoJP', fontSize: 19, color: FFAINT, letterSpacing: 1 } }, '選手'),
      h('div', { key: 'c2', style: { display: 'flex', width: 74, justifyContent: 'center', fontFamily: 'NotoJP', fontSize: 18, color: FFAINT } }, '守備位置'),
      h('div', { key: 'c3', style: { display: 'flex', width: 138, justifyContent: 'flex-end', fontFamily: 'NotoJP', fontSize: 18, color: FFAINT, letterSpacing: 1 } }, 'OAA'),
    ]),
    // リーダーボード
    h('div', { key: 'lb', style: { display: 'flex', flexDirection: 'column', width: '100%', borderTop: `1px solid ${FRULE}` } }, top.map((r, i) => row(r, i))),
    // フッター
    h('div', { key: 'ft', style: { display: 'flex', alignItems: 'center', width: '100%', marginTop: 'auto', paddingTop: 20 } }, [
      h('div', { key: 'dom', style: { display: 'flex', fontFamily: 'NotoJP', fontWeight: 700, fontSize: 27, color: CREAM, letterSpacing: 1 } }, 'matome-mlb-kaigai.jp'),
      h('div', { key: 'src', style: { display: 'flex', marginLeft: 'auto', fontFamily: 'NotoJP', fontSize: 20, color: FFAINT } }, `Statcast・${asOfLabel}`),
    ]),
  ]);

  const el = h('div', { style: { position: 'relative', display: 'flex', width: '100%', height: '100%', background: `linear-gradient(150deg, ${FIELD0} 0%, ${FIELD1} 100%)` } }, [
    h('div', { key: 'sweep', style: { ...layer, background: `linear-gradient(115deg, rgba(0,0,0,0) 42%, ${rgba(SWEEP, 0.5)} 60%, rgba(0,0,0,0) 88%)` } }),
    h('div', { key: 'acc', style: { ...layer, background: `linear-gradient(125deg, rgba(0,0,0,0) 55%, ${rgba(ACC, 0.1)} 100%)` } }),
    h('div', { key: 'frame', style: { position: 'absolute', top: 22, left: 22, width: W - 44, height: H - 44, display: 'flex', border: '2px solid rgba(255,255,255,0.14)', borderRadius: 10 } }),
    content,
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
  const out = path.join(outDir, `defense-oaa-${season}.png`);
  await fs.writeFile(out, buf);
  console.log(`✓ MLB守備 OAAランキング → ${path.relative(process.cwd(), out)}（${top.length}人・${W}×${H}）`);
  console.log(top.map((r, i) => `  ${String(i + 1).padStart(2)}. ${(KANA[r.id] || enName(r.raw)).padEnd(20)} ${r.pos.padEnd(3)} OAA ${signed(r.oaa)}  守備run ${signed(r.frv)}`).join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
