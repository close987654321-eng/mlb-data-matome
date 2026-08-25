// 選手タグLPのシーズン観測日誌（data/player-journal/{slug}.json）の**取りこぼし検出**。
//   node scripts/journal-gaps.mjs [--json]
//
// なぜ要るか: 2026-07-30 に日本人絡みの試合を日次記事1本へ集約して以降、日誌の追記
// （matome 手順5c）が jp-daily の手順に組み込まれておらず、担当が「思い出したときだけ」に
// なっていた。2026-08-13 の点検で全11人が2〜13日ぶん止まり、22試合が未収録だった
// （鈴木誠也の20号・山本由伸の7連敗ストップという山場まで抜けていた）。
// 6b（中の人メモ＝team-note-candidates.mjs）・6c（声レイヤー＝fetch-game-voices.mjs）と同じで、
// **機械が候補を印字してはじめて日課になる**ので、日誌にも同じ検出器を置く。
//
// 判定はシンプルに「日誌の最終エントリより後の jp-daily 記事に、その選手が主役（hero）または
// ③（shorts）で出ているか」。出ていれば未収録＝追記対象。記事側にいない日は出場なしとみなす
// （出場したのに記事に無いケースは jp-games の games レーダーの担当で、ここでは見ない）。
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const JOURNAL_DIR = path.join(ROOT, 'data', 'player-journal');
const THREAD_DIR = path.join(ROOT, 'data', 'threads', 'mlb');
const asJson = process.argv.includes('--json');

// players.ts は TS なので import せず slug ↔ nameJa だけ拾う（カタログが唯一の正）。
const catalog = new Map(
  [
    ...(await readFile(path.join(ROOT, 'src/lib/players.ts'), 'utf8')).matchAll(
      /slug:\s*'([^']+)'[\s\S]{0,400}?nameJa:\s*'([^']+)'/g,
    ),
  ].map((m) => [m[1], m[2]]),
);

const dailies = [];
for (const file of (await readdir(THREAD_DIR)).filter((f) => /-jp-daily\.json$/.test(f)).sort()) {
  dailies.push(JSON.parse(await readFile(path.join(THREAD_DIR, file), 'utf8')));
}

/** JST の暦日（`journalNext` の期限判定と同じものさし）。 */
const todayJst = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

const gaps = [];
const staleNext = [];
for (const file of (await readdir(JOURNAL_DIR)).filter((f) => f.endsWith('.json')).sort()) {
  const slug = file.replace(/\.json$/, '');
  const nameJa = catalog.get(slug);
  if (!nameJa) {
    console.error(`⚠ ${slug}: src/lib/players.ts に居ない（カタログに足すか日誌を畳む）`);
    continue;
  }
  const journal = JSON.parse(await readFile(path.join(JOURNAL_DIR, file), 'utf8'));
  const dates = (journal.entries ?? []).map((e) => e.date).sort();
  const last = dates.at(-1) ?? '';
  // 「次の見どころ」は期限が切れると journalNext が自動で消す＝壊れはしないが、LP から
  // ブロックごと消える。2026-08-26 から scripts/journal-next.mjs（毎時CI）が期限切れを公式
  // スケジュールの事実で埋めるので、ここに出るのは「CIがまだ回っていない／埋められなかった」
  // 分だけ＝出たら journal-next.mjs を手で回すか、埋まらない理由（所属不明・試合なし）を見る。
  if (journal.nextJa && (!journal.nextUntil || journal.nextUntil < todayJst)) {
    staleNext.push({ slug, nameJa, nextUntil: journal.nextUntil ?? null });
  }
  for (const daily of dailies) {
    const date = daily.id.slice(0, 10);
    if (date <= last) continue;
    const hero = daily.daily?.hero?.player === nameJa ? daily.daily.hero : null;
    const short = (daily.daily?.shorts ?? []).find((s) => s.player === nameJa);
    if (!hero && !short) continue;
    gaps.push({
      slug,
      nameJa,
      date,
      threadId: daily.id,
      corner: hero ? 'hero' : 'shorts',
      result: (hero ?? short).result ?? '',
      line: (hero ?? short).line ?? '',
    });
  }
}

if (asJson) {
  console.log(JSON.stringify({ gaps, staleNext }, null, 2));
} else {
  if (gaps.length === 0) {
    console.log('✓ 観測日誌に取りこぼしなし（jp-daily に出ている試合はすべて収録済み）');
  } else {
    console.log(`未収録 ${gaps.length}件（matome 手順5c で追記する）`);
    for (const g of gaps) {
      console.log(`  ${g.date} ${g.nameJa}（${g.slug}）${g.corner} ${g.result} ${g.line} → ${g.threadId}`);
    }
  }
  if (staleNext.length > 0) {
    // 追記（クラウド可）とは担当が違うので、必ず別枠で出す。
    console.log(
      `\n「次の見どころ」が期限切れ ${staleNext.length}件 ＝ LPから消えている（node scripts/journal-next.mjs で埋まる）`,
    );
    for (const s of staleNext) {
      console.log(`  ${s.nameJa}（${s.slug}）nextUntil: ${s.nextUntil ?? '未設定'}`);
    }
  }
}
