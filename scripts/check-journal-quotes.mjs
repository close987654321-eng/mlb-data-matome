// 観測日誌（data/player-journal + data/fighter-journal）の引用が、出典記事のコメントと
// 逐語一致しているかの機械照合。日誌の規律「quotes は出典からの逐語コピーのみ」（matome 手順5c・
// CLAUDE.md §4.4 捏造禁止）の最後の砦＝手写しでの改変・創作をビルド前に機械的に検出する。
//   node scripts/check-journal-quotes.mjs
// threadId を持つエントリだけ照合する（video 出典＝生の取得JSONはコミットしない規約のため照合不能。
// その場合も url/title/channel の存在だけは確認する）。不一致が1件でもあれば exit 1。
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const JOURNAL_DIRS = ['data/player-journal', 'data/fighter-journal'];
const SPORTS = ['mlb', 'boxing', 'mma', 'npb'];

/**
 * 記事の全コメントを再帰で収集する。コメントは comments 列のほか story ブロック
 * （quote/chips）や jp-daily の daily コーナー（hero.blocks / shorts.quotes / buzz.blocks）にも
 * 埋まるため、構造を列挙せず「author + bodyJa/bodyEn を持つオブジェクト」を深掘りで拾う
 * ＝コーナー構造が増えても照合が漏れない。
 */
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

const threadCache = new Map();
async function loadThread(sport, threadId) {
  const key = `${sport}/${threadId}`;
  if (!threadCache.has(key)) {
    const raw = await readFile(path.join(ROOT, 'data', 'threads', sport, `${threadId}.json`), 'utf8');
    threadCache.set(key, JSON.parse(raw));
  }
  return threadCache.get(key);
}

const errors = [];
let checkedQuotes = 0;

for (const dir of JOURNAL_DIRS) {
  let files;
  try {
    files = (await readdir(path.join(ROOT, dir))).filter((f) => f.endsWith('.json'));
  } catch {
    continue; // ディレクトリ未作成は正常（fighter-journal はファイターが増えるまで無いことがある）
  }
  for (const file of files) {
    const journal = JSON.parse(await readFile(path.join(ROOT, dir, file), 'utf8'));
    for (const entry of journal.entries ?? []) {
      const where = `${dir}/${file} ${entry.date}「${entry.headingJa}」`;
      if (!entry.threadId) {
        if (entry.video && !(entry.video.url && entry.video.title && entry.video.channel)) {
          errors.push(`${where}: video 出典に url/title/channel が揃っていない`);
        }
        if (!entry.video && (entry.quotes ?? []).length > 0) {
          errors.push(`${where}: 出典（threadId/video）が無いのに引用がある`);
        }
        continue;
      }
      if (!SPORTS.includes(entry.sport)) {
        errors.push(`${where}: sport が不正（${entry.sport}）`);
        continue;
      }
      let thread;
      try {
        thread = await loadThread(entry.sport, entry.threadId);
      } catch {
        errors.push(`${where}: 出典記事 ${entry.sport}/${entry.threadId} が存在しない`);
        continue;
      }
      const pool = allComments(thread);
      for (const q of entry.quotes ?? []) {
        checkedQuotes += 1;
        const hit = pool.find(
          (c) =>
            c.author === q.author &&
            c.score === q.score &&
            (q.bodyEn == null || c.bodyEn === q.bodyEn) &&
            (q.bodyJa == null || c.bodyJa === q.bodyJa),
        );
        if (!hit) {
          errors.push(`${where}: 引用が出典と逐語一致しない（${q.author}）`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`✖ 観測日誌の照合エラー ${errors.length}件`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ 観測日誌の引用照合 OK（${checkedQuotes}件の引用を逐語一致で確認）`);
