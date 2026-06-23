/**
 * 選手OG画像（src/app/[locale]/player/[slug]/opengraph-image.tsx）が同梱する
 * 日本語フォントを「使う字だけ」にサブセットして src/assets/fonts/ に書き出すワンショット生成器。
 *
 * なぜ必要か:
 *  - next/og(Satori) はビルド時にフォントの実バイトを要求する。組み込みフォントは CJK を持たず
 *    日本語が豆腐(□)になるので、和文を出すには JP フォントの同梱が要る。
 *  - だが Noto Sans JP 全部は数MBで重い。OGに出る和字は「選手名＋固定ラベル＋チーム名」だけで有限。
 *    そこを Google Fonts の text= サブセットAPI（必要コードポイントだけの極小フォントを返す）で取り、
 *    数十KBに収める。生成物(ttf)はコミットし、本番ビルドは“読むだけ”＝ネット不要でビルドが落ちない。
 *
 * 使い方:  node scripts/build-og-fonts.mjs
 *  - 選手を増やした／ラベルを変えた／チームが増えたら再実行する（でないと新しい字が□になる）。
 *  - 生成後は必ず opengraph-image を1回レンダリングして□が無いか確認（scripts の og レンダ確認）。
 *
 * Satori は woff2 を読めないので必ず truetype を取る（古い/簡素な User-Agent だと Google が ttf を返す）。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'fonts');

// ── 1. サブセットに必ず含める和字（固定）。component が出しうる日本語を漏れなく列挙する ──
// ラベル/UI語は変更頻度が低いので明示。選手名・チーム名は機械抽出（下）で足す。
const FIXED_JP = [
  '海外の反応', // ブランド
  '二刀流打者投手', // 役割バッジ
  'ナ・リーグ', 'ア・リーグ', // リーグ表示（・含む）
  '位時点', // 順位リテラル「MLB 8位」「6/23時点」
  // 成績ラベル（ヒーロー/フッター/将来の差し替え分も含め全部入れておく）
  '本塁打打率防御率総合打力奪三振走力守備被打率与四球四球三振盗塁打点得点',
  '二塁打三塁打安打試合先発勝敗勝率投球回失点自責被安打被本塁打出塁率長打率',
  'セーブホールド相当本投打', // 「17本」「投2.5＋打2.9」等
].join('');

// ── 2. 機械抽出: 選手名（players.ts の nameJa）＋ チーム名（teamColors.ts のキー）──
async function extractFromFile(rel, regex) {
  const text = await fs.readFile(path.join(ROOT, rel), 'utf8');
  const out = [];
  let m;
  while ((m = regex.exec(text)) != null) out.push(m[1]);
  return out;
}

// ── 3. ラテン/記号（和文混在文＝Noto側にも、巨大数字＝Anton側にも要る）──
const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)).join('');
const SYMBOLS = '−／＋・「」（）'; // U+2212 マイナス, 全角スラッシュ/プラス, 中黒, 括弧
const ACCENTED = 'ÁÉÍÓÚÜÑáéíóúüñ'; // nameEn フォールバック（Sánchez 等）
const DIGITS_SYM = '0123456789.+-−/: '; // Anton（巨大数字＋順位記号）の最小集合
const LATIN_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function uniq(str) {
  return Array.from(new Set(Array.from(str))).join('');
}

// Google Fonts text= サブセットから truetype を1ウェイトぶん取得して Buffer で返す。
async function fetchSubset(family, weight, text) {
  const fam = family.replace(/ /g, '+');
  const wq = weight ? `:wght@${weight}` : '';
  const url = `https://fonts.googleapis.com/css2?family=${fam}${wq}&text=${encodeURIComponent(text)}`;
  // 古い UA で truetype を強制（モダン UA だと woff2 を返し Satori が読めない）
  const css = await fetch(url, { headers: { 'User-Agent': 'Mozilla/4.0' } }).then((r) => {
    if (!r.ok) throw new Error(`CSS ${r.status} for ${family} ${weight}`);
    return r.text();
  });
  // text= サブセットは拡張子なしの動的URL（/l/font?kit=...）を返すので format('truetype') で拾う
  const m = css.match(/url\((https:[^)]+)\)\s*format\('truetype'\)/);
  if (!m) throw new Error(`no truetype url in CSS for ${family} ${weight}:\n${css.slice(0, 300)}`);
  const buf = Buffer.from(await fetch(m[1]).then((r) => r.arrayBuffer()));
  return buf;
}

async function main() {
  const names = await extractFromFile('src/lib/players.ts', /nameJa:\s*'([^']+)'/g);
  const teams = await extractFromFile('src/lib/teamColors.ts', /^\s{2}([ァ-ヶー]+):/gm);

  const jpChars = uniq(FIXED_JP + names.join('') + teams.join('') + ASCII + SYMBOLS + ACCENTED);
  const antonChars = uniq(DIGITS_SYM + LATIN_UPPER + ACCENTED);

  console.log(`JP subset chars: ${Array.from(jpChars).length}（選手${names.length}名・チーム${teams.length}）`);
  console.log(`Anton subset chars: ${Array.from(antonChars).length}`);

  await fs.mkdir(OUT_DIR, { recursive: true });

  const jobs = [
    ['Noto Sans JP', 700, jpChars, 'noto-jp-700.ttf'],
    ['Noto Sans JP', 900, jpChars, 'noto-jp-900.ttf'],
    ['Anton', 400, antonChars, 'anton.ttf'],
  ];
  for (const [family, weight, text, file] of jobs) {
    const buf = await fetchSubset(family, weight, text);
    // truetype マジック（0x00010000 か 'true'/'ttcf'）を軽く確認
    const sig = buf.readUInt32BE(0);
    if (sig !== 0x00010000 && sig !== 0x74727565 && sig !== 0x74746366) {
      throw new Error(`${file} is not truetype (sig=0x${sig.toString(16)})`);
    }
    await fs.writeFile(path.join(OUT_DIR, file), buf);
    console.log(`  → ${file}  ${(buf.length / 1024).toFixed(1)}KB`);
  }
  console.log('done. src/assets/fonts/ を更新しました（コミット対象）。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
