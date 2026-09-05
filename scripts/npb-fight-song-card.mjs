/**
 * X 投稿用「THEY KNOW THE FIGHT SONGS」カード PNG 生成
 * （x-post・r/NPB＝英語圏が日本野球を英語で実況している回／2026-08-23）。
 *
 *   node scripts/npb-fight-song-card.mjs
 *
 * 様式は never-said-it-card.mjs / chicago-28-card.mjs と同じ（無彩色フラット・角シャープ・
 * 差し色は赤1点＝#C8102E・左寄せの編集レイアウト・1080×1350）。金の箔もメタリックのグラデも
 * 多層シャドウも置かない（2026-08-17 村山指摘＝AI が作った既製カードに見える）。
 *
 * ⚠️ このカードだけは**英語のみの原則から外れる**。主役が「英語のスレッドに日本語の応援歌が
 * そのまま書き込まれている」という事実そのものなので、その1行は**逐語のまま日本語で出す**
 * （英訳したら題材が消える）。周りの活字は従来どおり英語で、日本語は zenkaku-black で組む。
 *
 * ⚠️ 引用4本は**全部 r/NPB に実在する書き込み**（捏造しない・§4.4）。生ログは
 * _local/reddit-scan/npb-0823.txt（公開RSSで取得）。
 *   応援歌 = r/NPB「Tigers Teruaki Sato blasts his 30th homer of the season」2026-08-21 /u/averagejosh
 *   おかわり = 同「43 year old Takeya Nakamura blasts a go ahead grand slam...」/u/mimimikyuuu
 *   満塁23本 = 同スレ /u/Freak_Out_Bazaar
 *   新聞1面 = 同「Front page of the 8/22 final edition feat. Morishita and Teru dinging 30」/u/HanshinFan
 * ⚠️ old.reddit がログイン壁の日だったので**▲スコアは取れていない**＝カードにも票は載せない。
 */
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { createElement as h } from 'react';
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

/** 主役＝英語のスレッドに落ちていた日本語の応援歌。逐語のまま（半角スペースも原文どおり）。 */
const CHEER = ['かっとばせー てーるー!', '振り抜け 輝け 打て 輝明!'];
const CHEER_SRC = 'r/NPB — ON TERUAKI SATO’S 30TH HOMER';

/** 周りに置く実在の書き込み（英語）。長いものは2行に割る。 */
const LINES = [
  { text: ['OKAWARI KUN BACK AT IT AGAIN LETS GO!!'], src: 'ON NAKAMURA’S FIRST HOMER OF THE YEAR, AT 43' },
  { text: ['GRAND SLAM NO. 23. PROBABLY AN UNBREAKABLE', 'RECORD AT THIS POINT. ALL OF THEM FOR THE LIONS TOO'], src: 'ON THE SAME SWING' },
  { text: ['COVER GOES CRAZY HARD LOL'], src: 'ON THE FRONT PAGE OF THE 8/22 SPORTS PAPER' },
];

const fill = { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex' };

async function main() {
  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  const [an, be, jp] = await Promise.all([
    fs.readFile(path.join(dir, 'anton.ttf')),
    fs.readFile(path.join(dir, 'bebas.ttf')),
    fs.readFile(path.join(dir, 'zenkaku-black.ttf')),
  ]);

  const QUOTE_TOP = 372, QUOTE_H = 264;
  const LIST_TOP = QUOTE_TOP + QUOTE_H + 44;

  // 引用ブロック（うっすらした地＋左に赤の縦罫。角はシャープ）
  const quote = h('div', { key: 'q', style: { position: 'absolute', top: QUOTE_TOP, left: M, width: W - M * 2, height: QUOTE_H, display: 'flex' } }, [
    h('div', { key: 'tone', style: { position: 'absolute', top: 0, left: 0, width: W - M * 2, height: QUOTE_H, display: 'flex', background: TONE } }),
    h('div', { key: 'bar', style: { position: 'absolute', top: 0, left: 0, width: 5, height: QUOTE_H, display: 'flex', background: ACCENT } }),
    h('div', { key: 'body', style: { position: 'absolute', top: 46, left: 40, display: 'flex', flexDirection: 'column' } },
      CHEER.map((l, i) => h('div', { key: `c${i}`, style: { display: 'flex', fontFamily: 'Zen', fontSize: 52, lineHeight: 1.42, color: INK } }, l))),
    h('div', { key: 'src', style: { position: 'absolute', top: QUOTE_H - 58, left: 40, display: 'flex', fontFamily: 'Bebas', fontSize: 25, letterSpacing: 3, color: INK_MUTE } }, CHEER_SRC),
  ]);

  // 実在の書き込み3本（ヘアラインで区切る）。行数が違うので送りは実測値で積む＝出典が次の罫に噛まない。
  let cursor = LIST_TOP;
  const list = LINES.map((item, i) => {
    const top = cursor;
    cursor += 18 + item.text.length * 38 + 8 + 22 + 22;
    return h('div', { key: `L${i}`, style: { position: 'absolute', top, left: M, width: W - M * 2, display: 'flex', flexDirection: 'column' } }, [
      h('div', { key: 'hr', style: { display: 'flex', width: W - M * 2, height: 1, background: RULE } }),
      ...item.text.map((t, j) => h('div', { key: `t${j}`, style: { display: 'flex', marginTop: j === 0 ? 18 : 4, fontFamily: 'Bebas', fontSize: 30, letterSpacing: 1, color: INK } }, t)),
      h('div', { key: 's', style: { display: 'flex', marginTop: 8, fontFamily: 'Bebas', fontSize: 22, letterSpacing: 3, color: INK_FAINT } }, item.src),
    ]);
  });

  const el = h('div', { style: { display: 'flex', width: W, height: H, backgroundColor: BG, position: 'relative', fontFamily: 'Bebas' } }, [
    h('div', { key: 'bg', style: { ...fill, background: BG } }),

    // ── ヘッダー（左寄せの編集見出し・句点だけ赤）──
    h('div', { key: 'kick', style: { position: 'absolute', top: 84, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 26, letterSpacing: 7, color: INK_FAINT } }, 'AN ENGLISH SUBREDDIT FOR JAPANESE BASEBALL'),
    ]),
    h('div', { key: 'h1', style: { position: 'absolute', top: 126, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 96, lineHeight: 1, color: INK } }, 'THEY KNOW THE'),
    ]),
    h('div', { key: 'h2', style: { position: 'absolute', top: 224, left: M, display: 'flex', alignItems: 'flex-start' } }, [
      h('div', { key: 't', style: { display: 'flex', fontFamily: 'Anton', fontSize: 96, lineHeight: 1, color: INK } }, 'FIGHT SONGS'),
      h('div', { key: 'd', style: { display: 'flex', fontFamily: 'Anton', fontSize: 96, lineHeight: 1, color: ACCENT } }, '.'),
    ]),
    h('div', { key: 'rule', style: { position: 'absolute', top: 336, left: M, width: 96, height: 5, display: 'flex', background: ACCENT } }),

    quote,
    ...list,

    // ── フッター（〆・出典）──
    h('div', { key: 'fhr', style: { position: 'absolute', top: 1116, left: M, width: W - M * 2, height: 1, display: 'flex', background: RULE } }),
    h('div', { key: 'q2', style: { position: 'absolute', top: 1142, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Anton', fontSize: 52, lineHeight: 1, color: INK } }, 'NOBODY EVEN ASKED FOR A TRANSLATION'),
    ]),
    h('div', { key: 'meta', style: { position: 'absolute', top: 1216, left: M, display: 'flex' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 26, letterSpacing: 4, color: INK_MUTE } }, 'REAL POSTS. r/NPB · AUGUST 2026'),
    ]),
    h('div', { key: 'ft', style: { position: 'absolute', top: 1280, left: M, width: W - M * 2, display: 'flex', justifyContent: 'flex-end' } }, [
      h('div', { style: { display: 'flex', fontFamily: 'Bebas', fontSize: 24, letterSpacing: 3, color: INK_FAINT } }, 'MATOME-MLB-KAIGAI.JP'),
    ]),
  ]);

  const img = new ImageResponse(el, {
    width: W, height: H,
    fonts: [
      { name: 'Anton', data: an, weight: 400, style: 'normal' },
      { name: 'Bebas', data: be, weight: 400, style: 'normal' },
      { name: 'Zen', data: jp, weight: 900, style: 'normal' },
    ],
  });
  const buf = Buffer.from(await img.arrayBuffer());
  const outDir = path.join(process.cwd(), '_local', 'x-images');
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, 'npb-fight-song.png');
  await fs.writeFile(out, buf);
  console.log(`✓ FIGHT SONGS カード → ${path.relative(process.cwd(), out)}（${W}×${H}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
