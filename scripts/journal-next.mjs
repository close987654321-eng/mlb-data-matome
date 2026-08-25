// 選手タグLPの観測日誌「次の見どころ」（nextJa / nextUntil）を **MLB公式スケジュールの事実だけ**で
// 機械生成する。
//   node scripts/journal-next.mjs              # 期限切れ・未設定の日誌だけ埋める（既定＝CIの日課）
//   node scripts/journal-next.mjs --all        # 手書きも含めて全部を機械文に置き換える
//   node scripts/journal-next.mjs --dry-run    # 書かずに出力だけ見る
//
// なぜ要るか: nextJa は「人が編集セッションで書く（クラウド禁止）」運用だったため、書き手が
// 思い出さないと期限切れ → journalNext がブロックごと落とす → LPの末尾が消える、が繰り返した
// （2026-08-26 の点検で 11人中 7人が期限切れ・残り4人も中身が5日前の予定のまま）。
// editor-note-candidates.mjs / journal-gaps.mjs が「検出」までしか出来なかったのに対し、
// ここは **予告の中身が対戦カード・登板予定という公知の事実だけ** なので、検出でなく生成まで機械に
// やらせられる（game-voices と同じ posture＝人も AI も文言を触らないので捏造が構造的に起きない）。
//
// 手書きの予告（nextAuto が無い＝人が書いた読み物）は **期限内なら絶対に上書きしない**。
// 期限が切れたものだけ機械文で埋める＝LPが空になる時間をゼロにしつつ、編集の上書きは効いたまま。
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const JOURNAL_DIR = path.join(ROOT, 'data', 'player-journal');
const BASE = 'https://statsapi.mlb.com/api/v1';
const argv = process.argv.slice(2);
const all = argv.includes('--all');
const dryRun = argv.includes('--dry-run');
/** 予告に載せる先の日数（これ以上先はカードが決まっていても読者の役に立たない）。 */
const WINDOW_DAYS = 9;

const jstDate = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(d);
const todayJst = jstDate(new Date());
/** 日本時間の暦日（YYYY-MM-DD）→「8月27日」。年またぎは出さない（予告は1週間先まで）。 */
const jaDay = (ymd) => `${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8, 10))}日`;

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'matome-mlb-kaigai/1.0 (journal-next)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// teams.ts が唯一の正（teamId → 日本語短縮名）。TS を import せず必要な2値だけ拾う。
const teamJa = new Map(
  [...(await readFile(path.join(ROOT, 'src/lib/teams.ts'), 'utf8')).matchAll(/^ {2}([^\s:]+): \{ id: (\d+),/gm)].map(
    (m) => [Number(m[2]), m[1]],
  ),
);
// players.ts が唯一の正（slug → mlbId / nameJa）。
const catalog = new Map(
  [
    ...(await readFile(path.join(ROOT, 'src/lib/players.ts'), 'utf8')).matchAll(
      /slug:\s*'([^']+)',\s*nameJa:\s*'([^']+)',\s*nameEn:\s*'[^']*',\s*mlbId:\s*(\d+)/g,
    ),
  ].map((m) => [m[1], { nameJa: m[2], mlbId: Number(m[3]) }]),
);
const snapshot = JSON.parse(await readFile(path.join(ROOT, 'data', 'jp-players-stats.json'), 'utf8'));

const end = new Date(`${todayJst}T00:00:00Z`);
end.setUTCDate(end.getUTCDate() + WINDOW_DAYS);
const endYmd = end.toISOString().slice(0, 10);

/** teamId → 予定試合（JST日付つき・キャッシュしてチーム重複でAPIを叩き直さない）。 */
const scheduleCache = new Map();
async function teamSchedule(teamId) {
  if (scheduleCache.has(teamId)) return scheduleCache.get(teamId);
  const data = await getJson(
    `${BASE}/schedule?sportId=1&teamId=${teamId}&startDate=${todayJst}&endDate=${endYmd}&hydrate=probablePitcher`,
  );
  const games = [];
  for (const day of data.dates ?? []) {
    for (const g of day.games ?? []) {
      // 中止・延期は予告に出さない（読者に嘘の予定を掲げない）。
      if (/Postponed|Cancelled|Suspended/i.test(g.status?.detailedState ?? '')) continue;
      const home = g.teams.home.team.id === teamId;
      const opp = home ? g.teams.away.team : g.teams.home.team;
      const jst = jstDate(new Date(g.gameDate));
      if (jst < todayJst) continue; // 日本時間で既に始まった試合は「次」ではない
      games.push({
        jst,
        home,
        oppJa: teamJa.get(opp.id) ?? opp.name,
        probables: [g.teams.home.probablePitcher?.id, g.teams.away.probablePitcher?.id].filter(Boolean),
      });
    }
  }
  games.sort((a, b) => a.jst.localeCompare(b.jst));
  scheduleCache.set(teamId, games);
  return games;
}

/** 同じ相手・同じ本拠/敵地の連続を1カードにまとめる（「◯連戦」を数えるため）。 */
function toSeries(games) {
  const out = [];
  for (const g of games) {
    const last = out.at(-1);
    if (last && last.oppJa === g.oppJa && last.home === g.home) last.dates.push(g.jst);
    else out.push({ oppJa: g.oppJa, home: g.home, dates: [g.jst] });
  }
  return out;
}

function seriesPhrase(s, first) {
  const n = s.dates.length;
  const day = jaDay(s.dates[0]);
  const head = first ? `日本時間${day}` : day;
  if (n === 1) return s.home ? `${head}に本拠地で${s.oppJa}戦` : `${head}に敵地${s.oppJa}戦`;
  return s.home ? `${head}から本拠地に${s.oppJa}を迎えて${n}連戦` : `${head}から敵地で${s.oppJa}と${n}連戦`;
}

/** 今季の現在地を一文で（スナップショットの数値そのまま＝公知の事実）。 */
function statLine(stats) {
  const h = stats?.hitting;
  const p = stats?.pitching;
  const parts = [];
  if (h && h.plateAppearances >= 50) parts.push(`打率${h.avg}・${h.homeRuns}本塁打・${h.rbi}打点`);
  if (p && p.gamesPlayed > 0) {
    // 中継ぎ／クローザー起用ではセーブが役割そのもの＝勝敗だけだと現在地が伝わらない。
    const rec = `${p.wins}勝${p.losses}敗${p.saves > 0 ? `${p.saves}セーブ` : ''}`;
    parts.push(`${parts.length ? '投げては' : ''}${rec}・防御率${p.era}`);
  }
  return parts.length ? `今季は${parts.join('、')}。` : '';
}

/**
 * 「あと1本で30号」のような**数え上げるだけで出る節目**。予告に読む理由を1つ足すが、
 * 判定は四則演算だけ＝評価や予想は一切入れない（入れた瞬間に機械生成の担保が消える）。
 */
function milestone(stats) {
  const h = stats?.hitting;
  const p = stats?.pitching;
  const hits = [];
  const near = (value, step, within) => {
    const target = Math.ceil((value + 1) / step) * step;
    return target - value <= within ? { target, gap: target - value } : null;
  };
  if (h && h.plateAppearances >= 50) {
    const hr = near(h.homeRuns, 10, 3);
    if (hr) hits.push(`${hr.target}号まであと${hr.gap}本`);
    const rbi = near(h.rbi, 50, 5);
    if (rbi) hits.push(`${rbi.target}打点まであと${rbi.gap}`);
  }
  if (p && p.gamesPlayed > 0) {
    const so = near(p.strikeOuts, 50, 10);
    if (so) hits.push(`${so.target}奪三振まであと${so.gap}`);
    const win = near(p.wins, 5, 1);
    if (win && p.gamesStarted > 0) hits.push(`${win.target}勝目に王手`);
  }
  return hits.length ? `${hits.slice(0, 2).join('、')}。` : '';
}

const results = [];
for (const file of (await readdir(JOURNAL_DIR)).filter((f) => f.endsWith('.json')).sort()) {
  const slug = file.replace(/\.json$/, '');
  const meta = catalog.get(slug);
  if (!meta) {
    results.push({ slug, skip: 'players.ts に居ない' });
    continue;
  }
  const journal = JSON.parse(await readFile(path.join(JOURNAL_DIR, file), 'utf8'));
  const expired = !journal.nextJa || !journal.nextUntil || journal.nextUntil < todayJst;
  // 手書き（nextAuto なし）が生きているうちは触らない＝編集の上書きが常に勝つ。
  if (!all && !expired) {
    results.push({ slug, skip: `期限内（${journal.nextUntil}）` });
    continue;
  }
  const stats = snapshot.players?.[String(meta.mlbId)];
  const teamName = stats?.team;
  const teamId = [...teamJa.entries()].find(([, ja]) => ja === teamName)?.[0];
  if (!teamId) {
    results.push({ slug, skip: `所属チーム不明（snapshot: ${teamName ?? 'なし'}）` });
    continue;
  }
  const games = await teamSchedule(teamId);
  if (games.length === 0) {
    results.push({ slug, skip: '予定試合なし（オフ・移動日のみ）' });
    continue;
  }
  const start = games.find((g) => g.probables.includes(meta.mlbId));
  let series = toSeries(games);
  const sentences = [];
  if (start) {
    // 先発が発表済み＝予告の主役はカードでなく登板日（読者が知りたい順）。登板を含むカードは
    // 直後の文で言い直さない（「敵地ブレーブス戦の先発」→「敵地でブレーブスと2連戦」の重複を避ける）。
    sentences.push(
      `次の登板は日本時間${jaDay(start.jst)}、${start.home ? '本拠地' : '敵地'}${start.oppJa}戦の先発と発表済み。`,
    );
    series = series.filter((s) => !s.dates.includes(start.jst));
  }
  // 窓の端で切れたカードは「1連戦」に見えてしまうので落とす（実際は続きがある）。
  const lastGame = games.at(-1).jst;
  if (series.length > 1 && series.at(-1).dates.length === 1 && series.at(-1).dates[0] === lastGame) series.pop();
  series = series.slice(0, 3);
  if (series.length > 0) {
    const phrase = series.map((s, i) => seriesPhrase(s, i === 0 && !start)).join('、');
    sentences.push(`${start ? `その先は${phrase}` : phrase}。`);
  }
  const line = statLine(stats);
  if (line) sentences.push(line);
  const mile = milestone(stats);
  if (mile) sentences.push(mile);
  const nextJa = sentences.join('');
  const nextUntil = series.at(-1)?.dates.at(-1) ?? start.jst;
  results.push({ slug, nameJa: meta.nameJa, nextJa, nextUntil, was: journal.nextUntil ?? null });
  if (!dryRun) {
    // キー順は既存ファイルの並び（introJa → nextJa → nextUntil → entries）を保つ。
    const updated = { ...journal, nextJa, nextUntil, nextAuto: true };
    delete updated.entries;
    await writeFile(path.join(JOURNAL_DIR, file), `${JSON.stringify({ ...updated, entries: journal.entries }, null, 2)}\n`);
  }
}

const wrote = results.filter((r) => !r.skip);
if (argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`次の見どころ ${dryRun ? '（--dry-run・書き込みなし）' : ''}: ${wrote.length}件更新 / ${results.length - wrote.length}件スキップ`);
  for (const r of results) {
    if (r.skip) console.log(`  - ${r.slug}: ${r.skip}`);
    else console.log(`  ✓ ${r.nameJa}（${r.slug}）〜${r.nextUntil}${r.was ? `（前: ${r.was}）` : ''}\n      ${r.nextJa}`);
  }
}
