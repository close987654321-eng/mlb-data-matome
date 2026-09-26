#!/usr/bin/env node
/**
 * 記事どうしで同じコメントを二重に載せていないかを照合する（2026-09-26 新設）。
 *
 * なぜ要るか: ポストシーズンは全試合を個別記事にする一方、日本人の出た試合は日次記事（jp-daily）にも載る。
 * 公式ハイライトは1試合1本なので、同じ動画を2本の記事で使うことがある。動画の共有は許すが、
 * **引用するコメントまで同じだと2本がほぼ同じ中身になる**（重複コンテンツ＝両方の評価が落ちる）。
 * 後から作る方が、先に作った方で使っていないコメントを選ぶ。その確認をこのスクリプトが機械でやる。
 *
 * 照合キーは「投稿者＋原文（bodyEn の空白を詰めたもの）」。原文だけだと「SOUTHSIDE STAND UP!!!」のような
 * 定番の掛け声が、別の動画の別の人のコメントなのに重複扱いになる。記事 JSON のどこにあっても拾う
 * （comments / daily の hero・shorts・buzz / story のブロック）＝型ごとに探し方を書き分けない。
 *
 * 使い方:
 *   node scripts/check-comment-overlap.mjs <記事id> [<記事id> ...]   # 全記事と照合。重複があれば一覧して終了コード1
 *   node scripts/check-comment-overlap.mjs <記事id> --with <記事id>    # 比べる相手を絞る（同じ試合の日次記事と試合記事）
 *
 * 全記事と照合すると、同じ人が別の動画に同じ掛け声を書いた実例（"SOUTHSIDE STAND UP!!!"）も出る。
 * 運用で見るのは「同じ試合を扱う2本」なので、公開前チェックは --with で相手を指定する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'data', 'threads');

function allArticles() {
  const out = [];
  for (const sport of readdirSync(ROOT)) {
    const dir = path.join(ROOT, sport);
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        out.push(JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
      } catch {
        /* 壊れた JSON はスキップ */
      }
    }
  }
  return out;
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

/** JSON のどこかにある { author, bodyEn } を全部拾う。 */
function bodies(node, acc = []) {
  if (Array.isArray(node)) node.forEach((x) => bodies(x, acc));
  else if (node && typeof node === 'object') {
    // 日本語ソースのコメントは bodyEn が空で bodyJa が原文（matome R7+）＝原文側で照合する。
    // 英語コメントの bodyJa は訳なので使わない（訳の言い回しが偶然重なっても同じコメントではない）。
    const original = typeof node.bodyEn === 'string' && node.bodyEn.trim() ? node.bodyEn : node.author && typeof node.bodyJa === 'string' && node.bodyEn === '' ? node.bodyJa : null;
    if (original && original.trim()) acc.push(`${node.author ?? ''}\u0000${norm(original)}`);
    for (const v of Object.values(node)) if (v && typeof v === 'object') bodies(v, acc);
  }
  return acc;
}


const argv = process.argv.slice(2);
const withIdx = argv.indexOf('--with');
const withIds = withIdx >= 0 ? new Set(argv.slice(withIdx + 1)) : null;
const ids = withIdx >= 0 ? argv.slice(0, withIdx) : argv;
if (!ids.length) {
  console.error('使い方: node scripts/check-comment-overlap.mjs <記事id> [<記事id> ...]');
  process.exit(2);
}

const articles = allArticles();
const byId = new Map(articles.map((a) => [a.id, a]));
let found = 0;
for (const id of ids) {
  const target = byId.get(id);
  if (!target) {
    console.error(`✗ 記事が見つからない: ${id}`);
    process.exit(2);
  }
  const mine = new Set(bodies(target));
  let mineFound = 0;
  for (const other of articles) {
    if (other.id === id) continue;
    if (withIds && !withIds.has(other.id)) continue;
    const dup = [...new Set(bodies(other))].filter((b) => mine.has(b));
    if (!dup.length) continue;
    found += dup.length;
    mineFound += dup.length;
    console.log(`✗ ${id} と ${other.id} で同じコメント ${dup.length}件:`);
    dup.forEach((k) => {
      const [author, b] = k.split('\u0000');
      console.log(`    ${author ? `${author}: ` : ''}${b.slice(0, 90)}${b.length > 90 ? '…' : ''}`);
    });
  }
  if (!mineFound) console.log(`✓ ${id}: 他の記事と重複するコメントなし（${mine.size}件）`);
}
process.exit(found ? 1 : 0);
