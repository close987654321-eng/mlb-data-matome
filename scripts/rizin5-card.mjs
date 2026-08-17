#!/usr/bin/env node
/**
 * 超RIZIN.5 の対戦カード画像を自作して public/media/ に書く。
 *
 *   node scripts/rizin5-card.mjs
 *
 * 出力2枚:
 *   public/media/rizin5-card.jpg     1080×1350 … X にリンク無しで単体投稿する配布用（縦）
 *   public/media/rizin5-card-og.jpg  1200×630  … 記事ヒーロー／OGP 用（16:9）
 *
 * なぜ自作するのか（2026-08-17 の判断）:
 * RIZIN 公式の対戦カードビジュアル・ポスターは公式の著作物で、ダウンロードして public/media に
 * 置く＝転載は絶対にしない（CLAUDE.md §4.5・src/lib/rizin5.ts 冒頭の規律）。引用（著作権法32条）で
 * 逃げる手も、ポスターをページの主役に据えると主従関係が成立しないので採らない。
 * 一方で「リッチな絵が欲しい」という要求自体は、**名前・階級・因縁という自前の事実データを
 * タイポグラフィで組む**ことで満たせる。写真を使わないので、CC画像が18人中9人しか無い
 * （メインの AJ・マッキーが不在）という素材の穴も、この形なら表に出ない。
 *
 * デザイン規律（jp-daily-card.mjs / rizin5-og.mjs と同じ）:
 * モダンミニマル無彩色・赤 #C8102E は題字罫の一点のみ・角シャープ・絵文字なし。
 * フォントは src/assets/fonts/ の Zen Kaku Gothic New / Bebas Neue。
 *
 * データ源は src/lib/rizin5.ts（唯一の正）を読んで組む＝カードが増減しても手で直さない。
 * TS を正規表現で読む作法は scripts/fighter-journal-gaps.mjs と同じ。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INK = '#141414';
const INK_SOFT = '#3d3d3d';
const INK_MUTE = '#6b6b6b';
const LINE = '#dedbd4';
const PAPER = '#fafaf8';
const ACCENT = '#C8102E';

/** src/lib/rizin5.ts から大会メタと全カードを読む（唯一の正を二重管理しないため）。 */
async function readRizin5() {
  const src = await fs.readFile(path.join(ROOT, 'src/lib/rizin5.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const RIZIN5'));
  const pick = (re) => (body.match(re) ?? [])[1] ?? '';

  const meta = {
    nameJa: pick(/nameJa:\s*'([^']+)'/),
    dateLabelJa: pick(/dateLabelJa:\s*'([^']+)'/),
    eventDate: pick(/eventDate:\s*'([^']+)'/),
    venueJa: pick(/venueJa:\s*'([^']+)'/),
  };

  // cards 配列だけを切り出してから order ごとに分割する（road や viewing を巻き込まないため）。
  const cardsStart = body.indexOf('  cards: [');
  const cardsEnd = body.indexOf('] satisfies Rizin5Card[]', cardsStart);
  const cardsBody = body.slice(cardsStart, cardsEnd);
  const hits = [...cardsBody.matchAll(/order:\s*(\d+),/g)];
  const cards = hits.map((hit, i) => {
    const block = cardsBody.slice(hit.index, hits[i + 1]?.index ?? cardsBody.length);
    const names = [...block.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
    return {
      order: Number(hit[1]),
      weightJa: (block.match(/weightJa:\s*'([^']+)'/) ?? [])[1] ?? '',
      titleJa: (block.match(/titleJa:\s*'([^']+)'/) ?? [])[1] ?? '',
      feudJa: (block.match(/feudJa:\s*'([^']+)'/) ?? [])[1] ?? '',
      left: names[0] ?? '',
      right: names[1] ?? '',
    };
  });
  if (cards.length === 0) throw new Error('cards を読めなかった（rizin5.ts の構造が変わった？）');
  if (cards.some((c) => !c.left || !c.right)) throw new Error('対戦者名が欠けたカードがある');
  return { meta, cards };
}

/** 「2026-09-10」→「2026.9.10 THU」（Bebas で出す英字表記）。 */
function dateLabelEn(eventDate) {
  const [y, m, d] = eventDate.split('-').map(Number);
  const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}.${m}.${d} ${dow}`;
}

/** 表示用に名前のニックネーム（“…”）を落とす＝行が長くなるのを防ぐだけで、正はデータ側。 */
const short = (name) => name.replace(/^“[^”]*”/, '');

const flex = (extra = {}) => ({ display: 'flex', ...extra });

/**
 * 「◯◯ vs ◯◯」の1行を基準サイズで組めるか字数で判定して縮める。
 * satori は縮小もはみ出しも面倒を見てくれず、折り返すと右端の階級表記が押し出されて切れるため、
 * レイアウトの安全弁をこちらで持つ（将来もっと長い名前のカードが足されても崩れない）。
 */
function fitFontSize(text, base) {
  const len = [...text].length;
  if (len <= 20) return base;
  if (len <= 24) return Math.round(base * 0.88);
  if (len <= 28) return Math.round(base * 0.78);
  return Math.round(base * 0.7);
}

/** 縦カードの直下の子に付ける＝flex に縮められて要素が重なるのを防ぐ（下の verticalCard のコメント参照）。 */
const row = (extra = {}) => flex({ flexShrink: 0, ...extra });

/**
 * 縦カード（1080×1350・X 配布用）。
 *
 * ⚠️ 高さ固定のカードなので、中身の総高が 1350 を超えた瞬間に flex が各要素を縮め、
 * 行box が字面より小さくなって題字と副題が重なる（2026-08-17 に踏んだ）。直下の子は
 * すべて flexShrink: 0 にして、はみ出すなら重なるのではなく分かるようにしてある。
 * 文字サイズを上げるときは必ず生成物を目で見て確認する。
 */
function verticalCard({ meta, cards }) {
  const [main, ...rest] = cards;
  return h(
    'div',
    {
      style: flex({
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        background: PAPER,
        padding: '56px 60px 48px',
        fontFamily: 'Zen',
      }),
    },
    [
      h('div', { key: 'eyebrow', style: row({ alignItems: 'center', gap: 16 }) }, [
        h('div', { key: 'a', style: flex({ fontFamily: 'Bebas', fontSize: 28, letterSpacing: 7, color: INK_MUTE }) }, 'FIGHT CARD'),
        h('div', { key: 'b', style: flex({ fontWeight: 700, fontSize: 22, letterSpacing: 1, color: INK_MUTE }) }, `全${cards.length}試合`),
      ]),
      h('div', { key: 'title', style: row({ marginTop: 10, fontWeight: 900, fontSize: 112, lineHeight: 1.15, letterSpacing: -4, color: INK }) }, '超RIZIN.5'),
      h('div', { key: 'sub', style: row({ fontWeight: 900, fontSize: 40, lineHeight: 1.3, letterSpacing: 3, color: INK }) }, meta.nameJa.replace('超RIZIN.5 ', '')),
      // 題字罫（サイト唯一の赤をここ一点だけに使う）
      h('div', { key: 'rule', style: row({ marginTop: 16, width: 150, height: 8, background: ACCENT }) }),
      h('div', { key: 'info', style: row({ marginTop: 22, alignItems: 'baseline', gap: 18 }) }, [
        h('div', { key: 'd', style: flex({ fontFamily: 'Bebas', fontSize: 50, letterSpacing: 3, color: INK }) }, dateLabelEn(meta.eventDate)),
        h('div', { key: 'v', style: flex({ fontWeight: 700, fontSize: 30, color: INK }) }, meta.venueJa),
      ]),

      // メインイベントだけ別格に組む（ポスターの代わりに「序列」で見せる）。
      h(
        'div',
        { key: 'main', style: row({ marginTop: 28, flexDirection: 'column', borderTop: `2px solid ${INK}`, paddingTop: 20 }) },
        [
          h('div', { key: 'l', style: flex({ fontWeight: 700, fontSize: 22, letterSpacing: 1, color: ACCENT }) }, main.titleJa || `第${main.order}試合`),
          h('div', { key: 'n1', style: flex({ marginTop: 10, fontWeight: 900, fontSize: fitFontSize(short(main.left), 52), lineHeight: 1.25, letterSpacing: -1, color: INK }) }, short(main.left)),
          h('div', { key: 'vs', style: row({ fontFamily: 'Bebas', fontSize: 30, letterSpacing: 4, color: INK_MUTE }) }, 'VS'),
          h('div', { key: 'n2', style: flex({ fontWeight: 900, fontSize: fitFontSize(short(main.right), 52), lineHeight: 1.25, letterSpacing: -1, color: INK }) }, short(main.right)),
        ],
      ),

      // 残りのカード（1行1試合）。
      h(
        'div',
        { key: 'rest', style: row({ marginTop: 22, flexDirection: 'column' }) },
        rest.map((c) =>
          h(
            'div',
            {
              key: String(c.order),
              style: row({ alignItems: 'baseline', justifyContent: 'space-between', borderTop: `1px solid ${LINE}`, padding: '12px 0' }),
            },
            [
              h('div', { key: 'l', style: flex({ alignItems: 'baseline', gap: 14 }) }, [
                h('div', { key: 'o', style: flex({ fontFamily: 'Bebas', fontSize: 26, letterSpacing: 2, color: INK_MUTE, width: 34 }) }, String(c.order).padStart(2, '0')),
                h('div', { key: 'n', style: flex({ fontWeight: 700, fontSize: fitFontSize(`${short(c.left)} vs ${short(c.right)}`, 31), letterSpacing: -0.5, color: INK }) }, `${short(c.left)} vs ${short(c.right)}`),
              ]),
              h('div', { key: 'w', style: flex({ fontFamily: 'Bebas', fontSize: 24, letterSpacing: 1, color: INK_MUTE, flexShrink: 0 }) }, c.weightJa.replace('kg', 'KG')),
            ],
          ),
        ),
      ),

      h(
        'div',
        { key: 'foot', style: row({ marginTop: 'auto', alignItems: 'flex-end', justifyContent: 'space-between', borderTop: `2px solid ${INK}`, paddingTop: 16 }) },
        [
          h('div', { key: 'l', style: flex({ flexDirection: 'column', gap: 6 }) }, [
            h('div', { key: 'a', style: flex({ fontWeight: 700, fontSize: 23, color: INK_SOFT }) }, '因縁と戦績・PPVの値段・開催までの日誌は観戦ガイドに'),
            h('div', { key: 'b', style: flex({ fontWeight: 700, fontSize: 20, color: INK_MUTE }) }, '保存・転載OK'),
          ]),
          h('div', { key: 'r', style: flex({ fontWeight: 700, fontSize: 22, color: INK_MUTE }) }, 'matome-mlb-kaigai.jp/rizin5'),
        ],
      ),
    ],
  );
}

/** 16:9（1200×630・記事ヒーロー／OGP 用）。左に題字、右にカード一覧を積む2カラム。 */
function wideCard({ meta, cards }) {
  return h(
    'div',
    {
      style: flex({ width: '100%', height: '100%', background: PAPER, padding: '48px 56px', fontFamily: 'Zen' }),
    },
    [
      h('div', { key: 'left', style: flex({ flexDirection: 'column', width: 470, paddingRight: 40 }) }, [
        h('div', { key: 'e', style: flex({ fontFamily: 'Bebas', fontSize: 24, letterSpacing: 6, color: INK_MUTE }) }, 'FIGHT CARD'),
        h('div', { key: 't', style: flex({ marginTop: 10, fontWeight: 900, fontSize: 96, lineHeight: 1.12, letterSpacing: -3, color: INK }) }, '超RIZIN.5'),
        h('div', { key: 's', style: flex({ marginTop: 10, fontWeight: 900, fontSize: 32, letterSpacing: 2, color: INK }) }, meta.nameJa.replace('超RIZIN.5 ', '')),
        h('div', { key: 'r', style: flex({ marginTop: 18, width: 120, height: 7, background: ACCENT }) }),
        h('div', { key: 'd', style: flex({ marginTop: 22, fontFamily: 'Bebas', fontSize: 42, letterSpacing: 2, color: INK }) }, dateLabelEn(meta.eventDate)),
        h('div', { key: 'v', style: flex({ marginTop: 4, fontWeight: 700, fontSize: 26, color: INK }) }, meta.venueJa),
        h('div', { key: 'c', style: flex({ marginTop: 'auto', fontWeight: 700, fontSize: 21, color: INK_MUTE }) }, `全${cards.length}試合の因縁と戦績・視聴方法`),
        h('div', { key: 'u', style: flex({ marginTop: 6, fontWeight: 700, fontSize: 19, color: INK_MUTE }) }, 'matome-mlb-kaigai.jp/rizin5'),
      ]),
      h(
        'div',
        { key: 'right', style: flex({ flex: 1, flexDirection: 'column', borderLeft: `1px solid ${LINE}`, paddingLeft: 40 }) },
        cards.map((c, i) =>
          h(
            'div',
            {
              key: String(c.order),
              style: flex({
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: i === 0 ? '0 0 11px' : '11px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${LINE}`,
              }),
            },
            [
              h('div', { key: 'n', style: flex({ alignItems: 'baseline', gap: 12 }) }, [
                h('div', { key: 'o', style: flex({ fontFamily: 'Bebas', fontSize: 21, letterSpacing: 1, color: INK_MUTE, width: 28 }) }, String(c.order).padStart(2, '0')),
                h(
                  'div',
                  {
                    style: flex({
                      fontWeight: i === 0 ? 900 : 700,
                      fontSize: fitFontSize(`${short(c.left)} vs ${short(c.right)}`, i === 0 ? 26 : 23),
                      letterSpacing: -0.5,
                      color: INK,
                    }),
                    key: 'x',
                  },
                  `${short(c.left)} vs ${short(c.right)}`,
                ),
              ]),
              h('div', { key: 'w', style: flex({ fontFamily: 'Bebas', fontSize: 20, color: INK_MUTE, flexShrink: 0, paddingLeft: 12 }) }, c.weightJa.replace('kg', 'KG')),
            ],
          ),
        ),
      ),
    ],
  );
}

async function render(el, { width, height, fonts, out }) {
  const res = new ImageResponse(el, { width, height, fonts });
  const png = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(out), { recursive: true });
  await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
  const { size } = await fs.stat(out);
  console.log(`wrote ${path.relative(ROOT, out)} ${width}×${height} (${Math.round(size / 1024)}KB)`);
}

async function main() {
  const { meta, cards } = await readRizin5();
  console.log(`${meta.nameJa}／${meta.dateLabelJa}／全${cards.length}試合を読み込んだ`);

  const dir = path.join(ROOT, 'src', 'assets', 'fonts');
  const [zk7, zk9, bebas] = await Promise.all([
    fs.readFile(path.join(dir, 'zenkaku-bold.ttf')),
    fs.readFile(path.join(dir, 'zenkaku-black.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
  ]);
  const fonts = [
    { name: 'Zen', data: zk7, weight: 700, style: 'normal' },
    { name: 'Zen', data: zk9, weight: 900, style: 'normal' },
    { name: 'Bebas', data: bebas, weight: 400, style: 'normal' },
  ];

  const media = path.join(ROOT, 'public', 'media');
  await render(verticalCard({ meta, cards }), { width: 1080, height: 1350, fonts, out: path.join(media, 'rizin5-card.jpg') });
  await render(wideCard({ meta, cards }), { width: 1200, height: 630, fonts, out: path.join(media, 'rizin5-card-og.jpg') });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
