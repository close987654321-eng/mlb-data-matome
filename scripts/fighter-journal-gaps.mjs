// ファイターLPのキャリア観測日誌（data/fighter-journal/{slug}.json）の**取りこぼし検出**。
//   node scripts/fighter-journal-gaps.mjs [--json]
//
// なぜ要るか: 選手LP側は 2026-08-13 に journal-gaps.mjs ＋ jp-daily Step 6a を入れて日課にしたが、
// ファイター側には同じ検出が無く、同じドリフトが起きていた。点検で冨澤大智の日誌が 2025-09-28 で
// 止まったまま、戦績には 2025-12-31（篠塚戦・TKO負け）と 2026-06-06（加藤戦・TKO勝ち）の2試合が
// 入っている＝勝敗が動いたのに日誌が黙っている状態だった。ほかにも木村ミノ・ジェシー・ロドリゲス・
// オマリー・ウシクが2か月以上停止していた。
//
// ファイターは MLB と違って試合が月1以下＝「毎日回る CI」が無く、更新は完全に人の手にかかる。
// だから **機械が候補を印字してはじめて日課になる**（6a/6b/6c と同じ思想）。
//
// 検出するのは「試合が終わったら fighters.ts の fights / record / nextFightJa と日誌の nextJa を
// 更新する」という4点更新（fighter-journal-lp の運用）の取りこぼし:
//   A 未収録の試合   fights[] にあるのに日誌の最終エントリより後 ＝ 日誌が戦績に追いついていない
//   B 戦績が未更新   record.asOf < 最新の試合日 ＝ 通算戦績カウンタが古い
//   C 次戦が期限切れ nextFightJa.until を過ぎた ＝ LPの次戦バッジは既に自動で消えている
//   D 予告が期限切れ 日誌に nextJa があるのに nextUntil が未設定/過去 ＝ ブロックがLPから消えている
//   E 未収録の記事   そのファイターのタグが付いた記事が日誌のどのエントリからも参照されていない
//
// A〜D は「事実が動いたのに書いていない」＝必ず直す。E は素材があるという示唆で、書くかは編集判断。
// 撤去記事（data/deleted-ids.json）は E の対象から外す＝もう送客先が無いものを書けとは言わない。
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const JOURNAL_DIR = path.join(ROOT, 'data', 'fighter-journal');
const THREAD_DIR = path.join(ROOT, 'data', 'threads');
const COLUMN_DIR = path.join(ROOT, 'data', 'columns');
// ファイターが登場しうるカテゴリだけ読む（mlb/npb は対象外）。
const SPORTS = ['boxing', 'mma'];
const asJson = process.argv.includes('--json');

/** JST の暦日（until / nextUntil の賞味期限は journalNext と同じものさしで測る）。 */
const todayJst = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

// fighters.ts は TS なので import せず、slug ごとのブロックに切って必要な値だけ拾う
// （カタログが唯一の正＝ここで二重管理しない）。ブロック内の `date:` は fights[] の試合日だけ
// ＝ record は asOf:、nextFightJa は until: と別のキーを使うので取り違えない。
const src = await readFile(path.join(ROOT, 'src/lib/fighters.ts'), 'utf8');
const body = src.slice(src.indexOf('export const FIGHTERS'));
const slugHits = [...body.matchAll(/slug:\s*'([^']+)'/g)];
const catalog = new Map();
for (const [i, hit] of slugHits.entries()) {
  const block = body.slice(hit.index, slugHits[i + 1]?.index ?? body.length);
  const pick = (re) => (block.match(re) ?? [])[1] ?? null;
  const fights = [...block.matchAll(/date:\s*'(\d{4}-\d{2}-\d{2})'/g)].map((m) => {
    const rest = block.slice(m.index);
    const resultJa = (rest.match(/resultJa:\s*'([^']+)'/) ?? [])[1] ?? '';
    const noteJa = (rest.match(/noteJa:\s*'([^']+)'/) ?? [])[1] ?? '';
    return {
      date: m[1],
      opponentJa: (rest.match(/opponentJa:\s*'([^']+)'/) ?? [])[1] ?? '',
      resultJa,
      // エキシビション／別ルールの一戦は通算戦績に加算されない＝record.asOf がその試合より
      // 古くて正しい（例: 平本蓮の 2026-05-10 皇治戦はボクシングルールで MMA 戦績に入らない）。
      // データ自身が noteJa/resultJa に「戦績には含まれない」と書いているのでそれを拾う。
      offRecord: /含まれない|エキシビション/.test(`${noteJa}${resultJa}`),
    };
  });
  catalog.set(hit[1], {
    slug: hit[1],
    nameJa: pick(/nameJa:\s*'([^']+)'/),
    shortJa: [...block.matchAll(/shortJa:\s*\[([^\]]*)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((s) => s[1])),
    recordAsOf: pick(/record:\s*\{[^}]*asOf:\s*'([^']+)'/),
    nextUntil: pick(/nextFightJa:\s*\{[\s\S]*?until:\s*'([^']+)'/),
    nextLabelJa: pick(/nextFightJa:\s*\{[\s\S]*?labelJa:\s*'([^']+)'/),
    fights,
  });
}

/** 撤去台帳に載っている記事 id（E の対象外＝送客先が消えた記事は書き起こさない）。 */
const retiredIds = new Set(
  JSON.parse(await readFile(path.join(ROOT, 'data', 'deleted-ids.json'), 'utf8')).map((d) => d.id),
);

/**
 * 記事が「いつの出来事の話か」。id は必ず `YYYY-MM-DD-slug`（boxing/mma 113本すべてで確認）で、
 * これは**出来事の日**＝過去の試合を後から記事化しても当時の日付が入る。fetchedAt（公開日）で
 * 測ると、2025-12-31 の朝倉未来×シェイドゥラエフ戦を 2026-08-03 に記事化したケースが
 * 「日誌より新しい未収録の記事」に化けるので、必ず id 側を使う。
 */
const subjectDate = (id, fallback) => (/^\d{4}-\d{2}-\d{2}-/.test(id ?? '') ? id.slice(0, 10) : fallback);

// 記事（threads の boxing/mma ＋ columns）を tags つきで集める。
const articles = [];
for (const sport of SPORTS) {
  const dir = path.join(THREAD_DIR, sport);
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const th = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    articles.push({
      id: th.id,
      date: subjectDate(th.id, (th.fetchedAt ?? '').slice(0, 10)),
      tags: th.tags ?? [],
      titleJa: th.title?.ja ?? '',
    });
  }
}
for (const file of (await readdir(COLUMN_DIR)).filter((f) => f.endsWith('.json'))) {
  const col = JSON.parse(await readFile(path.join(COLUMN_DIR, file), 'utf8'));
  articles.push({
    id: col.id,
    date: subjectDate(col.id, (col.publishedAt ?? col.fetchedAt ?? '').slice(0, 10)),
    tags: col.tags ?? [],
    titleJa: col.title?.ja ?? col.titleJa ?? '',
  });
}

const missedFights = [];
const staleRecord = [];
const staleNextFight = [];
const staleNextJa = [];
const undatedNextJa = [];
const missedArticles = [];
/** タグは付くがタイトルに本人が出ない記事の数（E で落とした分＝黙って間引かないため印字する）。 */
let tagOnlyCount = 0;

for (const file of (await readdir(JOURNAL_DIR)).filter((f) => f.endsWith('.json')).sort()) {
  const slug = file.replace(/\.json$/, '');
  const fighter = catalog.get(slug);
  if (!fighter) {
    console.error(`⚠ ${slug}: src/lib/fighters.ts に居ない（カタログに足すか日誌を畳む）`);
    continue;
  }
  const journal = JSON.parse(await readFile(path.join(JOURNAL_DIR, file), 'utf8'));
  const entries = journal.entries ?? [];
  const last = entries.map((e) => e.date).filter(Boolean).sort().at(-1) ?? '';
  const { nameJa } = fighter;

  // A: 戦績にあるのに日誌が触れていない試合。
  for (const fight of fighter.fights) {
    if (fight.date > last) {
      missedFights.push({ slug, nameJa, ...fight, journalLast: last });
    }
  }

  // B: 通算戦績の asOf が最新試合に追いついていない（＝record の勝敗数も疑わしい）。
  //    エキシビション等（offRecord）は record に加算されないので、比較対象から外す。
  const newestFight = fighter.fights.filter((f) => !f.offRecord).map((f) => f.date).sort().at(-1) ?? '';
  if (newestFight && fighter.recordAsOf && fighter.recordAsOf < newestFight) {
    staleRecord.push({ slug, nameJa, recordAsOf: fighter.recordAsOf, newestFight });
  }

  // C: 次戦の賞味期限切れ。until を過ぎるとLPの次戦バッジ・UpcomingFights から自動で消えるので
  //    壊れはしないが、「試合が終わったのに4点更新をしていない」サインになる。
  if (fighter.nextUntil && fighter.nextUntil < todayJst) {
    staleNextFight.push({ slug, nameJa, until: fighter.nextUntil, labelJa: fighter.nextLabelJa ?? '' });
  }

  // D: 日誌の「次の見どころ」。journalNext は nextUntil が**過去のときだけ**非表示にする
  //    （未設定なら出し続ける）ので、消えている＝欠陥なのは期限切れの方だけ。
  //    ファイターは「次戦未発表」が普通にある状態（中谷=手術明け・井上=2027年2月ごろ）で、
  //    そこに期限は書けない＝未設定は欠陥ではなく「期限が無いので陳腐化に気づけない」注意枠。
  if (journal.nextJa && journal.nextUntil && journal.nextUntil < todayJst) {
    staleNextJa.push({ slug, nameJa, nextUntil: journal.nextUntil });
  } else if (journal.nextJa && !journal.nextUntil) {
    undatedNextJa.push({ slug, nameJa });
  }

  // E: そのファイターのタグが付いた記事のうち、日誌のどのエントリからも参照されていないもの。
  //    タグは「その記事に登場する」程度でも付くので、本人が主役の記事だけに絞る＝タイトルに
  //    名前（nameJa / shortJa）が出るもの。落とした件数は必ず印字する（黙って間引かない）。
  const cited = new Set(entries.flatMap((e) => [e.threadId, e.retiredThreadId].filter(Boolean)));
  const names = [nameJa, ...(fighter.shortJa ?? [])].filter(Boolean);
  for (const art of articles) {
    if (!art.tags.includes(nameJa)) continue;
    if (cited.has(art.id) || retiredIds.has(art.id)) continue;
    if (last && art.date <= last) continue; // 日誌が追いついている期間は見ない
    if (names.some((n) => art.titleJa.includes(n))) {
      missedArticles.push({ slug, nameJa, id: art.id, date: art.date, titleJa: art.titleJa });
    } else {
      tagOnlyCount += 1;
    }
  }
}

const bySlugDate = (a, b) => a.date?.localeCompare(b.date) || a.slug.localeCompare(b.slug);
missedFights.sort(bySlugDate);
missedArticles.sort(bySlugDate);

if (asJson) {
  console.log(
    JSON.stringify(
      { missedFights, staleRecord, staleNextFight, staleNextJa, undatedNextJa, missedArticles, tagOnlyCount },
      null,
      2,
    ),
  );
} else {
  const clean =
    missedFights.length === 0 &&
    staleRecord.length === 0 &&
    staleNextFight.length === 0 &&
    staleNextJa.length === 0;
  if (clean) {
    console.log('✓ キャリア観測日誌に取りこぼしなし（戦績・次戦・予告はすべて日誌と整合）');
  }

  if (missedFights.length > 0) {
    console.log(`未収録の試合 ${missedFights.length}件 ＝ 戦績にあるのに日誌が書いていない（最優先）`);
    for (const g of missedFights) {
      const vs = g.opponentJa ? `vs ${g.opponentJa}` : '';
      console.log(`  ${g.date} ${g.nameJa}（${g.slug}）${vs} ${g.resultJa}｜日誌の最終 ${g.journalLast || '—'}`);
    }
  }

  if (staleRecord.length > 0) {
    console.log(`\n通算戦績が未更新 ${staleRecord.length}件 ＝ record.asOf が最新試合より古い`);
    for (const s of staleRecord) {
      console.log(`  ${s.nameJa}（${s.slug}）record.asOf ${s.recordAsOf} < 最新試合 ${s.newestFight}`);
    }
  }

  if (staleNextFight.length > 0) {
    console.log(`\n次戦予告が期限切れ ${staleNextFight.length}件 ＝ LPの次戦バッジは既に消えている`);
    for (const s of staleNextFight) {
      console.log(`  ${s.nameJa}（${s.slug}）until ${s.until}｜${s.labelJa}`);
    }
  }

  if (staleNextJa.length > 0) {
    // 地の文（俺ボイス）は人の編集セッションでしか書けないので、必ず別枠で出す。
    console.log(`\n「次の見どころ」が期限切れ ${staleNextJa.length}件 ＝ LPから消えている（人が書く）`);
    for (const s of staleNextJa) {
      console.log(`  ${s.nameJa}（${s.slug}）nextUntil: ${s.nextUntil}`);
    }
  }

  if (undatedNextJa.length > 0) {
    // 欠陥ではない（次戦未発表なら期限は書けない）が、期限が無い＝古びても自動で消えない。
    console.log(`\n[注意] 期限の無い「次の見どころ」${undatedNextJa.length}件 ＝ 出続けるので内容を目視で`);
    for (const s of undatedNextJa) {
      console.log(`  ${s.nameJa}（${s.slug}）`);
    }
  }

  if (missedArticles.length > 0 || tagOnlyCount > 0) {
    // 参考枠＝「素材はある」という示唆。日誌に落とすかは編集判断なので A〜D とは分けて出す。
    console.log(`\n[参考] 日誌が参照していない記事 ${missedArticles.length}件（書くかは編集判断）`);
    for (const g of missedArticles) {
      console.log(`  ${g.date} ${g.nameJa}（${g.slug}）${g.titleJa || g.id} → ${g.id}`);
    }
    if (tagOnlyCount > 0) {
      console.log(`  （ほかに、タグは付くがタイトルに本人が出ない記事 ${tagOnlyCount}件を除外）`);
    }
  }
}
