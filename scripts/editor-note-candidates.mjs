// 編集部ノート（data/editor-notes.json）の **鮮度検出＋素材抽出**。
// 主題は3種類＝**チーム（teams.ts）・選手（players.ts）・ファイター（fighters.ts）**。
//   node scripts/editor-note-candidates.mjs                    # 全主題の鮮度ギャップ表（書き直し優先順）
//   node scripts/editor-note-candidates.mjs --kind player      # 種類を絞る（team / player / fighter）
//   node scripts/editor-note-candidates.mjs --subject whitesox # その主題の素材（記事＋現地コメント）
//   node scripts/editor-note-candidates.mjs --stale 6 --material  # 上位6主題の素材をまとめて印字
//   （--team は --subject の旧名。既存の呼び出しのため残してある）
//
// なぜ要るか: ノートは「いま海外はこう見ている」と名乗る現在形のテキストなのに、書き直しは
// 「思い出したときだけ」だった（2026-08-19 時点で 14球団ぶんが 08-11〜13 で静止・16球団は不在）。
// 観測日誌（journal-gaps.mjs）・中の人メモ（team-note-candidates.mjs）と同じで、
// **機械が候補を印字してはじめて日課になる**。判定は「ノートの updatedAt 以降に、その主題タグの
// 記事が何本増えたか」＝反応の材料がどれだけ入れ替わったか。
//
// ⚠️ 2026-08-26 追加: 元は**チーム専用**だったため、週2回の無人ルーティンが30球団しか回さず、
// 選手・ファイターの14本が 2026-08-08 のまま18日間静止していた（村山指摘）。検出器が見ていない
// 主題は日課からも落ちる＝カタログ3本ぜんぶをここで一覧するのが再発防止の本体。
//
// 素材は**記事JSONの実在コメントだけ**を機械コピーで並べる（人も AI も文言を触らない）。
// ノートに「」で引くときはこの出力から逐語でコピーし、保存後に必ず
// node scripts/check-editor-notes.mjs で照合する（CLAUDE.md §4.7）。
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
// ファイターの素材は mma / boxing にある＝主題を広げた以上、記事も全競技から読む。
const SPORT_DIRS = ['mlb', 'boxing', 'mma', 'npb'];
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const asJson = argv.includes('--json');
const wantMaterial = argv.includes('--material') || argv.includes('--team') || argv.includes('--subject');
const teamArg = flag('subject', flag('team', ''));
const kindArg = flag('kind', '');
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
].map((m) => ({ kind: 'team', nameJa: m[1], slug: m[2] }));
// 言及検索用の別表記（実況・ファンが使う略称）。teams.ts の aliasJa は SEO 用なのでここは検索専用。
const ALT = { dbacks: 'Dバックス', athletics: "A's", whitesox: 'ソックス', bluejays: 'ジェイズ', redsox: 'レッドソックス', cardinals: 'カージナルス', nationals: 'ナッツ', pirates: 'バックス' };
// 別表記が他球団を巻き込む場合の除外（ソックス→レッドソックス／バックス→Dバックス）。
const ALT_NOT = { whitesox: 'レッドソックス', pirates: 'Dバックス' };
for (const t of teams) {
  t.alt = ALT[t.slug];
  t.altNot = ALT_NOT[t.slug];
}

/** players.ts / fighters.ts から slug・nameJa・別表記（aliases / shortJa）を拾う。 */
async function readCatalog(file, kind) {
  const src = await readFile(path.join(ROOT, file), 'utf8');
  const out = [];
  for (const m of src.matchAll(/slug:\s*'([^']+)',\s*\n?\s*nameJa:\s*'([^']+)'/g)) {
    out.push({ kind, slug: m[1], nameJa: m[2], index: m.index });
  }
  // 別表記はカタログ項目の直後（次の slug まで）に現れるものだけを拾う＝取り違えない。
  for (let i = 0; i < out.length; i++) {
    const chunk = src.slice(out[i].index, out[i + 1]?.index ?? src.length);
    const alts = [
      ...[...chunk.matchAll(/(?:aliases|shortJa):\s*\[([^\]]*)\]/g)].flatMap((a) =>
        [...a[1].matchAll(/'([^']+)'/g)].map((x) => x[1]),
      ),
    ];
    // 1文字の別表記は他人を巻き込むので使わない（「海」「蓮」など）。
    out[i].alts = [...new Set(alts)].filter((a) => a.length >= 2);
    // players.ts の rival（比較用に載せている非日本人）はノートの必須対象ではない＝既定で外す。
    // 全部入れると「ノート不在」の優先度1000で20人以上が上位を埋め、日本人・ファイターが沈む。
    out[i].rival = /\brival:\s*true/.test(chunk);
    delete out[i].index;
  }
  return out;
}
const notes = JSON.parse(await readFile(path.join(ROOT, 'data', 'editor-notes.json'), 'utf8'));
const players = await readCatalog('src/lib/players.ts', 'player');
const fighters = await readCatalog('src/lib/fighters.ts', 'fighter');
// ノートを持つ主題は「カタログにある3種類ぜんぶ」。ここに載らない主題は日課から落ちる。
const withRivals = argv.includes('--rivals');
const subjects = [...teams, ...players, ...fighters]
  .filter((s) => !kindArg || s.kind === kindArg)
  // rival はノートがあれば鮮度を見る（一度書いたら腐らせない）が、無いものを催促はしない。
  .filter((s) => withRivals || !s.rival || notes[s.slug]);

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
for (const sport of SPORT_DIRS) {
  const dir = path.join(ROOT, 'data', 'threads', sport);
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    continue; // 競技ディレクトリが無くても落とさない
  }
  for (const f of files) {
    const t = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
    articles.push({
      id: t.id,
      sport,
      date: (t.fetchedAt || '').slice(0, 10),
      title: t.title?.ja || '',
      tags: t.tags || [],
      comments: allComments(t).filter((c) => c.bodyJa),
      // 日次記事「きょうの主役」＝その選手の試合のハイライト動画のコメント欄そのもの。
      // 2026-07-30 に日本人絡みを日次1本へ集約して以降、選手の材料はほぼここに集まるのに、
      // 日次はコメント欄が他球団の話で埋まるため素材から外していた＝選手の材料がゼロに見えていた。
      // 主役ブロックだけは「その選手の試合の声」だと構造で分かるので、選手主題に限って拾う。
      heroPlayer: t.daily?.hero?.player || null,
      heroComments: t.daily?.hero ? allComments(t.daily.hero).filter((c) => c.bodyJa) : [],
    });
  }
}
articles.sort((a, b) => (a.date < b.date ? 1 : -1));

const todayJst = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** その主題のタグが付いた記事か（選手・ファイターは表記ゆれの別名タグも拾う）。 */
const tagged = (a, t) => a.tags.includes(t.nameJa) || (t.alts ?? []).some((x) => a.tags.includes(x));

const rows = subjects
  .map((t) => {
    const mine = articles.filter((a) => tagged(a, t));
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

/**
 * --stale N の抽出は **種別ごとのラウンドロビン**（team → player → fighter → team …）。
 * 素の優先度順だと「ノート不在」の 1000 点が効きすぎて、不在の多い種別（2026-08-26 時点の
 * ファイター24本）が枠を全部さらい、他の種別が何週間も順番待ちで腐る。日課の目的は
 * 「どの主題も放置されない」ことなので、種別を跨いで必ず配る。
 */
function roundRobin(sorted, n) {
  const byKind = new Map();
  // ノートが無く記事も3本未満＝要約できる材料がまだ無い主題は候補にしない（書くと薄い一般論になる）。
  for (const r of sorted.filter((r) => r.noteUpdatedAt || r.articles >= 3)) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, []);
    byKind.get(r.kind).push(r);
  }
  const queues = [...byKind.values()];
  const out = [];
  for (let i = 0; out.length < n && queues.some((q) => q.length); i++) {
    const q = queues[i % queues.length];
    if (q.length) out.push(q.shift());
  }
  return out;
}

const targets = teamArg
  ? teamArg.split(',').map((s) => rows.find((r) => r.slug === s.trim() || r.nameJa === s.trim())).filter(Boolean)
  : staleTop
    ? roundRobin(rows, staleTop)
    : [];

if (asJson) {
  console.log(JSON.stringify({ todayJst, rows, targets: targets.map((t) => t.slug) }, null, 2));
} else if (!wantMaterial) {
  console.log(`# 編集部ノートの鮮度（${todayJst} JST・書き直し優先順）\n`);
  console.log('種別     slug                  記事  最新       ノート      経過  ノート以降の新記事');
  for (const r of rows) {
    console.log(
      [
        r.kind.padEnd(7),
        r.slug.padEnd(21),
        String(r.articles).padStart(3),
        r.latest.padStart(10),
        (r.noteUpdatedAt || 'なし').padStart(10),
        (r.ageDays == null ? '-' : `${r.ageDays}日`).padStart(5),
        String(r.newArticles).padStart(4) + '本',
      ].join(' '),
    );
  }
  console.log('\n素材を見る: node scripts/editor-note-candidates.mjs --subject <slug>[,<slug>...]');
  console.log('種類で絞る: node scripts/editor-note-candidates.mjs --kind player|fighter|team（--rivals でライバル枠も）');
  console.log('上位だけ  : node scripts/editor-note-candidates.mjs --stale 6 --material');
}

if (wantMaterial && !asJson) {
  const cutoff = new Date(Date.parse(todayJst) - days * 86400000).toISOString().slice(0, 10);
  for (const t of targets) {
    const mine = articles
      .filter((a) => tagged(a, t) && a.date >= cutoff)
      .filter((a) => includeDaily || !/-jp-daily$/.test(a.id))
      .slice(0, maxArticles);
    const seen = new Set();
    console.log(`\n${'='.repeat(78)}\n## ${t.nameJa}（${t.kind}/${t.slug}）記事${t.articles}本 / ノート${t.noteUpdatedAt || 'なし'} / 直近${days}日 ${mine.length}本`);
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
    // 選手主題は日次記事の「きょうの主役」回が主材料（上の heroComments のコメント参照）。
    if (t.kind === 'player') {
      const heroDays = articles
        .filter((a) => a.date >= cutoff && a.heroPlayer && (a.heroPlayer === t.nameJa || (t.alts ?? []).includes(a.heroPlayer)))
        .slice(0, maxArticles);
      if (heroDays.length) {
        console.log(`\n--- 日次記事で「きょうの主役」だった日（試合ハイライトのコメント欄） ---`);
        for (const a of heroDays) {
          const picks = [...a.heroComments].sort((x, y) => (y.score || 0) - (x.score || 0)).slice(0, perArticle);
          if (!picks.length) continue;
          console.log(`\n[${a.date}] ${a.title}  (${a.id})`);
          for (const c of picks) {
            console.log(`  ・(${c.score ?? '-'}) ${c.bodyJa.replace(/\s+/g, ' ').slice(0, 220)}`);
            seen.add(c.bodyJa);
          }
        }
      }
    }

    // チームタグの付いた記事だけだと、日次記事や他カードのコメント欄にある言及を取りこぼす
    // （レイズのように専用記事が途切れている期間があるため）。チーム名を含む発言を拾って補う。
    const mentions = articles
      .filter((a) => a.date >= cutoff)
      .flatMap((a) => a.comments.map((c) => ({ ...c, date: a.date, from: a.id })))
      .filter(
        (c) =>
          !seen.has(c.bodyJa) &&
          (c.bodyJa.includes(t.nameJa) ||
            (t.alt && c.bodyJa.includes(t.alt)) ||
            (t.alts ?? []).some((x) => c.bodyJa.includes(x))),
      )
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
