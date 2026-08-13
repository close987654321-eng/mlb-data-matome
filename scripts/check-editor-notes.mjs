// 編集部ノート（data/editor-notes.json）の**引用の逐語照合**。
//   node scripts/check-editor-notes.mjs
//
// ノートは「実在するコメント群の要約のみ」という規律で書く（src/lib/editorNotes.ts・CLAUDE.md §4.4）。
// 地の文は編集部の言葉だが、「」で括った部分は現地の声の引用＝ここが創作だと
// 「海外ではこう言われている」という記事の芯が崩れる。観測日誌の check-journal-quotes.mjs と
// 同じ考え方で、括弧の中身が出典記事のコメントに逐語で存在するかを機械照合する。
//
// 照合先は**全記事のコメント**（主題のタグが付いた記事に限定しない）。ノートの根拠になる声は、
// その主題のタグが付いていない記事にも載るため（例: 菅野の評判はロッキーズ対ブルワーズ戦の
// コメント欄にある／日次記事のタグはその日出場した選手だけ）。ここで担保したいのは
// 「その一文が実在するコメントか」＝捏造検出であって、関連度の判定ではない。
//
// ⚠️ ノートの「」は**引用専用**。編集部の言い回しを強調したいときは括弧を使わない
// ＝読者から見ても地の文と現地の声の区別がつかなくなるため（この照合はその規律も兼ねる）。
// 引用の中に「」を入れ子にすると照合できないので、入れ子も使わない。
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SPORTS = ['mlb', 'boxing', 'mma', 'npb'];

/** ノートの主題として認めている slug（綴り違いのノートが黙って表示されないようにする）。 */
const subjects = new Set();
for (const m of (await readFile(path.join(ROOT, 'src/lib/teams.ts'), 'utf8')).matchAll(
  /slug:\s*'([^']+)'/g,
)) {
  subjects.add(m[1]);
}
for (const file of ['src/lib/players.ts', 'src/lib/fighters.ts']) {
  for (const m of (await readFile(path.join(ROOT, file), 'utf8')).matchAll(/slug:\s*'([^']+)'/g)) {
    subjects.add(m[1]);
  }
}

function allComments(node, acc = []) {
  if (Array.isArray(node)) {
    for (const v of node) allComments(v, acc);
  } else if (node && typeof node === 'object') {
    if (typeof node.author === 'string' && (typeof node.bodyJa === 'string' || typeof node.bodyEn === 'string')) {
      acc.push(node);
    }
    for (const v of Object.values(node)) allComments(v, acc);
  }
  return acc;
}

const pool = [];
for (const sport of SPORTS) {
  let files = [];
  try {
    files = await readdir(path.join(ROOT, 'data', 'threads', sport));
  } catch {
    continue;
  }
  for (const f of files.filter((f) => f.endsWith('.json'))) {
    const thread = JSON.parse(await readFile(path.join(ROOT, 'data', 'threads', sport, f), 'utf8'));
    for (const c of allComments(thread)) {
      if (c.bodyJa) pool.push(c.bodyJa);
      if (c.bodyEn) pool.push(c.bodyEn);
    }
  }
}

const notes = JSON.parse(await readFile(path.join(ROOT, 'data', 'editor-notes.json'), 'utf8'));
const errors = [];
let checked = 0;

for (const [slug, note] of Object.entries(notes)) {
  if (!subjects.has(slug)) {
    errors.push(`${slug}: 主題が teams.ts / players.ts / fighters.ts に無い（slug の綴り違い？）`);
  }
  // 「…」の中身。入れ子は想定しない＝閉じ括弧までを1つの引用として取る。
  for (const m of note.noteJa.matchAll(/「([^「」]+)」/g)) {
    checked += 1;
    const quote = m[1];
    if (!pool.some((body) => body.includes(quote))) {
      errors.push(`${slug}: 引用が出典コメントに見つからない →「${quote.slice(0, 40)}…」`);
    }
  }
}

if (errors.length > 0) {
  console.error(`✖ 編集部ノートの照合エラー ${errors.length}件`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ 編集部ノートの引用照合 OK（${Object.keys(notes).length}件のノート／${checked}件の引用を逐語一致で確認）`);
