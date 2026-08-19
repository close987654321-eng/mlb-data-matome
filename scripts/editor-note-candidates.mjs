// チーム編集部ノート（data/editor-notes.json）の **鮮度検出＋素材抽出**。
//   node scripts/editor-note-candidates.mjs                 # 30球団の鮮度ギャップ表（書き直し優先順）
//   node scripts/editor-note-candidates.mjs --team whitesox # そのチームの素材（記事＋現地コメント）
//   node scripts/editor-note-candidates.mjs --stale 6 --material  # 上位6球団の素材をまとめて印字
//
// なぜ要るか: ノートは「いま海外はこう見ている」と名乗る現在形のテキストなのに、書き直しは
// 「思い出したときだけ」だった（2026-08-19 時点で 14球団ぶんが 08-11〜13 で静止・16球団は不在）。
// 観測日誌（journal-gaps.mjs）・中の人メモ（team-note-candidates.mjs）と同じで、
// **機械が候補を印字してはじめて日課になる**。判定は「ノートの updatedAt 以降に、そのチームタグの
// 記事が何本増えたか」＝反応の材料がどれだけ入れ替わったか。
//
// 素材は**記事JSONの実在コメントだけ**を機械コピーで並べる（人も AI も文言を触らない）。
// ノートに「」で引くときはこの出力から逐語でコピーし、保存後に必ず
// node scripts/check-editor-notes.mjs で照合する（CLAUDE.md §4.7）。
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const THREAD_DIR = path.join(ROOT, 'data', 'threads', 'mlb');
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const asJson = argv.includes('--json');
const wantMaterial = argv.includes('--material') || argv.includes('--team');
const teamArg = flag('team', '');
const days = Number(flag('days', 30));
const perArticle = Number(flag('per-article', 6));
const maxArticles = Number(flag('articles', 14));
const staleTop = Number(flag('stale', 0));
// 日次記事（きょうの日本人選手）は「その日出場した全選手」のタグが付く＝コメント欄は他球団の話が
// 大半で、チームの評判の素材にならない（2026-08-19 実測: ナショナルズの上位がレイズ評で埋まった）。
// 素材からは既定で外す（鮮度ギャップの本数カウントには残す＝LPのフィードには載るため）。
const includeDaily = argv.includes('--include-daily');

// teams.ts が唯一の正（日本語短縮名＝タグ文字列 ↔ slug）。TS を import せず必要な2値だけ拾う。
const teams = [
  ...(await readFile(path.join(ROOT, 'src/lib/teams.ts'), 'utf8')).matchAll(
    /^ {2}([^\s:]+): \{ id: \d+,[^}]*?slug: '([^']+)'/gm,
  ),
].map((m) => ({ nameJa: m[1], slug: m[2] }));
// 言及検索用の別表記（実況・ファンが使う略称）。teams.ts の aliasJa は SEO 用なのでここは検索専用。
const ALT = { dbacks: 'Dバックス', athletics: "A's", whitesox: 'ソックス', bluejays: 'ジェイズ', redsox: 'レッドソックス', cardinals: 'カージナルス', nationals: 'ナッツ', pirates: 'バックス' };
// 別表記が他球団を巻き込む場合の除外（ソックス→レッドソックス／バックス→Dバックス）。
const ALT_NOT = { whitesox: 'レッドソックス', pirates: 'Dバックス' };
for (const t of teams) {
  t.alt = ALT[t.slug];
  t.altNot = ALT_NOT[t.slug];
}

const notes = JSON.parse(await readFile(path.join(ROOT, 'data', 'editor-notes.json'), 'utf8'));

/** ネストした構造（story の証言・セクション）も拾う＝check-editor-notes.mjs と同じ歩き方。 */
function allComments(node, acc = []) {
  if (Array.isArray(node)) {
    for (const v of node) allComments(v, acc);
  } else if (node && typeof node === 'object') {
    if (typeof node.author === 'string' && (node.bodyJa || node.bodyEn)) acc.push(node);
    for (const v of Object.values(node)) allComments(v, acc);
  }
  return acc;
}

const articles = [];
for (const f of (await readdir(THREAD_DIR)).filter((f) => f.endsWith('.json'))) {
  const t = JSON.parse(await readFile(path.join(THREAD_DIR, f), 'utf8'));
  articles.push({
    id: t.id,
    date: (t.fetchedAt || '').slice(0, 10),
    title: t.title?.ja || '',
    tags: t.tags || [],
    comments: allComments(t).filter((c) => c.bodyJa),
  });
}
articles.sort((a, b) => (a.date < b.date ? 1 : -1));

const todayJst = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const rows = teams
  .map((t) => {
    const mine = articles.filter((a) => a.tags.includes(t.nameJa));
    const note = notes[t.slug];
    const since = note ? mine.filter((a) => a.date > note.updatedAt).length : mine.length;
    return {
      ...t,
      articles: mine.length,
      latest: mine[0]?.date || '-',
      noteUpdatedAt: note?.updatedAt || null,
      ageDays: note ? daysBetween(note.updatedAt, todayJst) : null,
      newArticles: since,
      // 優先度: ノート不在 > ノート以降の新記事本数 > 経過日数。反応の材料が入れ替わった順に書き直す。
      priority: (note ? 0 : 1000) + since * 10 + (note ? Math.min(daysBetween(note.updatedAt, todayJst), 60) : 0),
    };
  })
  .sort((a, b) => b.priority - a.priority);

const targets = teamArg
  ? teamArg.split(',').map((s) => rows.find((r) => r.slug === s.trim() || r.nameJa === s.trim())).filter(Boolean)
  : staleTop
    ? rows.slice(0, staleTop)
    : [];

if (asJson) {
  console.log(JSON.stringify({ todayJst, rows, targets: targets.map((t) => t.slug) }, null, 2));
} else if (!wantMaterial) {
  console.log(`# 編集部ノートの鮮度（${todayJst} JST・書き直し優先順）\n`);
  console.log('slug        記事  最新       ノート      経過  ノート以降の新記事');
  for (const r of rows) {
    console.log(
      [
        r.slug.padEnd(11),
        String(r.articles).padStart(3),
        r.latest.padStart(10),
        (r.noteUpdatedAt || 'なし').padStart(10),
        (r.ageDays == null ? '-' : `${r.ageDays}日`).padStart(5),
        String(r.newArticles).padStart(4) + '本',
      ].join(' '),
    );
  }
  console.log('\n素材を見る: node scripts/editor-note-candidates.mjs --team <slug>[,<slug>...]');
  console.log('上位だけ  : node scripts/editor-note-candidates.mjs --stale 6 --material');
}

if (wantMaterial && !asJson) {
  const cutoff = new Date(Date.parse(todayJst) - days * 86400000).toISOString().slice(0, 10);
  for (const t of targets) {
    const mine = articles
      .filter((a) => a.tags.includes(t.nameJa) && a.date >= cutoff)
      .filter((a) => includeDaily || !/-jp-daily$/.test(a.id))
      .slice(0, maxArticles);
    const seen = new Set();
    console.log(`\n${'='.repeat(78)}\n## ${t.nameJa}（${t.slug}）記事${t.articles}本 / ノート${t.noteUpdatedAt || 'なし'} / 直近${days}日 ${mine.length}本`);
    if (t.noteUpdatedAt) console.log(`--- 現ノート ---\n${notes[t.slug].noteJa}`);
    for (const a of mine) {
      const picks = [...a.comments]
        .sort((x, y) => (y.isHighlight ? 1 : 0) - (x.isHighlight ? 1 : 0) || (y.score || 0) - (x.score || 0))
        .slice(0, perArticle);
      if (!picks.length) continue;
      console.log(`\n[${a.date}] ${a.title}  (${a.id})`);
      for (const c of picks) {
        console.log(`  ・(${c.score ?? '-'}) ${c.bodyJa.replace(/\s+/g, ' ').slice(0, 220)}`);
        seen.add(c.bodyJa);
      }
    }
    // チームタグの付いた記事だけだと、日次記事や他カードのコメント欄にある言及を取りこぼす
    // （レイズのように専用記事が途切れている期間があるため）。チーム名を含む発言を拾って補う。
    const mentions = articles
      .filter((a) => a.date >= cutoff)
      .flatMap((a) => a.comments.map((c) => ({ ...c, date: a.date, from: a.id })))
      .filter((c) => !seen.has(c.bodyJa) && (c.bodyJa.includes(t.nameJa) || (t.alt && c.bodyJa.includes(t.alt))))
      .filter((c) => !(t.altNot && !c.bodyJa.includes(t.nameJa) && c.bodyJa.includes(t.altNot)))
      .sort((x, y) => (y.score || 0) - (x.score || 0))
      .slice(0, 15);
    if (mentions.length) {
      console.log(`\n--- 他記事での言及（直近${days}日・${t.nameJa}を含む発言） ---`);
      for (const c of mentions) {
        console.log(`  ・(${c.score ?? '-'}) [${c.date}] ${c.bodyJa.replace(/\s+/g, ' ').slice(0, 220)}`);
      }
    }
  }
}
