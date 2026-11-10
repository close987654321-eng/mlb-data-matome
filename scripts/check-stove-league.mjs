#!/usr/bin/env node
/**
 * data/stove-league.json（ストーブリーグの編集データ）の公開前検査。
 *
 * なぜ要るか: 毎朝6時のクラウド定期実行（.claude/skills/stove-daily/SKILL.md）が人の確認なしで
 * 報道の時系列・関心球団・契約の中身を書き足す。ビルドは JSON の中身の誤りを見ない（未来の日付・出典の無い
 * 記述・存在しない選手の slug でも通る）ので、ここで機械的に落とす。1つでも ✗ があれば終了コード1＝公開しない。
 *
 * data/stove-lockout.json（/stove-league/lockout の時系列・争点・日本人への影響）も同じ規則で検査する＝
 * 毎朝の定期実行が書き足す先が2つになっても、公開前に走らせるコマンドは1つのまま。
 * npbPlayers.ts の postingWatch.steps（申請の段階の日付・交渉期限）も形式だけ見る。
 *
 * 使い方:
 *   node scripts/check-stove-league.mjs            # 検査
 *   node scripts/check-stove-league.mjs --links    # 出典URLの生存も確かめる（手元用・クラウドは通信制限で使わない）
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LINKS = process.argv.includes('--links');
const cat = JSON.parse(readFileSync(path.join(ROOT, 'data', 'stove-league.json'), 'utf8'));
const readJson = (rel) => (existsSync(path.join(ROOT, rel)) ? JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')) : null);
const stats = readJson('data/stove-league-stats.json');
const post = readJson('data/postseason.json');
/** ワールドシリーズが今季ぶん決着したか（決着後は「WS終了から◯日後」の言い方が古くなる）。 */
const wsDone = post?.season === cat.season && !!post?.champion;

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

/** JST の今日（YYYY-MM-DD）。未来の日付の検出に使う。 */
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const slugs = new Set(
  [...readFileSync(path.join(ROOT, 'src/lib/players.ts'), 'utf8').matchAll(/slug:\s*'([^']+)',\s*nameJa:/g)].map((m) => m[1]),
);
/** players.ts の slug → mlbId（公式の動きと timeline の突き合わせに使う）。 */
const mlbIdOf = new Map(
  [...readFileSync(path.join(ROOT, 'src/lib/players.ts'), 'utf8').matchAll(/slug:\s*'([^']+)',\s*nameJa:[^\n]*?mlbId:\s*(\d+)/g)].map(
    (m) => [m[1], m[2]],
  ),
);
const dayDiff = (a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;
const prospectSlugs = new Set(
  [...readFileSync(path.join(ROOT, 'src/lib/npbPlayers.ts'), 'utf8').matchAll(/^\s{4}slug:\s*'([^']+)'/gm)].map((m) => m[1]),
);

/** 和文と英数字のあいだの半角スペース（サイトの表記規約で入れない）。 */
const JA = '[\\u3040-\\u30ff\\u3400-\\u9fff\\uff01-\\uff60、。「」『』（）・]';
const SPACE_RULE = new RegExp(`${JA} [A-Za-z0-9]|[A-Za-z0-9] ${JA}`);
const BANNED = /ニキ/;

function checkJa(where, s) {
  if (typeof s !== 'string' || !s.trim()) return err(`${where}: ja が空`);
  if (SPACE_RULE.test(s)) err(`${where}: 和文と英数字のあいだに半角スペース「${s.match(SPACE_RULE)[0]}」`);
  if (BANNED.test(s)) err(`${where}: 禁止表現（ニキ）`);
}

function checkSourced(where, x) {
  if (!/^https:\/\/\S+$/.test(x.source ?? '')) err(`${where}: source が https の URL でない（${x.source ?? 'なし'}）`);
  if (!x.sourceName?.trim()) err(`${where}: sourceName が空`);
}

function checkDate(where, d, { future = false } = {}) {
  if (!ISO.test(d ?? '')) return err(`${where}: 日付の形式が違う（${d}）`);
  if (!future && d > today) err(`${where}: 未来の日付（${d}）`);
}

// ── 全体
checkDate('asOf', cat.asOf);
if (cat.checkedAt) checkDate('checkedAt', cat.checkedAt);
if (cat.checkedAt && cat.asOf > cat.checkedAt) err(`asOf（${cat.asOf}）が checkedAt（${cat.checkedAt}）より新しい`);
checkDate('activeUntil', cat.activeUntil, { future: true });
checkSourced('ranking', { source: cat.ranking?.url, sourceName: cat.ranking?.name });
checkSourced('qualifyingOffer', cat.qualifyingOffer ?? {});

// ── 日程
for (const d of cat.dates ?? []) {
  const w = `dates.${d.key}`;
  if (!d.date && d.afterWs == null) err(`${w}: date も afterWs も無い`);
  if (d.date && !ISO.test(d.date)) err(`${w}: date の形式が違う`);
  checkJa(w, d.ja);
  if (d.jp) checkJa(`${w}.jp`, d.jp.ja);
  checkSourced(w, d);
}

// ── 日本人選手
const OUTCOMES = new Set(['signed', 're-signed', 'stayed', 'retired']);
const ROUTES = new Set(['fa', 'opt-out', 'club-option', 'posting']);
for (const j of cat.japanese ?? []) {
  const w = `japanese.${j.slug}`;
  if (!slugs.has(j.slug)) err(`${w}: players.ts に無い slug`);
  if (!ROUTES.has(j.route)) err(`${w}: route が不正（${j.route}）`);
  checkDate(`${w}.asOf`, j.asOf);
  checkJa(`${w}.headline`, j.headline?.ja);
  if (j.window) checkJa(`${w}.window`, j.window.ja);
  for (const s of j.suitors ?? []) checkJa(`${w}.suitors`, s.ja);
  for (const [i, m] of (j.marketValue ?? []).entries()) {
    checkJa(`${w}.marketValue[${i}]`, m.ja);
    checkSourced(`${w}.marketValue[${i}]`, m);
  }
  const tl = j.timeline ?? [];
  if (!tl.length) err(`${w}: timeline が空`);
  const seen = new Set();
  tl.forEach((t, i) => {
    const tw = `${w}.timeline[${i}]`;
    checkDate(tw, t.date);
    checkJa(tw, t.ja);
    checkSourced(tw, t);
    if (i > 0 && t.date > tl[i - 1].date) err(`${tw}: 新しい順になっていない（${tl[i - 1].date} の後に ${t.date}）`);
    const key = `${t.date}|${t.source}`;
    if (seen.has(key)) err(`${tw}: 同じ日付・同じ出典の重複`);
    seen.add(key);
  });
  if (tl[0] && j.asOf < tl[0].date) err(`${w}: asOf（${j.asOf}）が最新の報道（${tl[0].date}）より古い`);
  // 公式の動き（FA宣言・契約・トレード）が文章に入っていない＝見出しが古いまま残っている合図。
  // 2026-10-30 の初回の定期実行は、FA宣言が出ていたのに「翌日にFAになる」を残した。statsapi の日付は米国東部なので±1日で照合する。
  for (const m of stats?.players?.[mlbIdOf.get(j.slug)]?.moves ?? []) {
    if (!tl.some((t) => dayDiff(t.date, m.date) <= 1)) {
      err(`${w}: 公式の動き（${m.date} ${m.type}）が timeline に無い＝headline / window もいまの状態に直す`);
    }
  }
  // 決着後に「ワールドシリーズ終了から5日後」のような相対の言い方が残っている（実日付に直す）。
  if (wsDone) {
    for (const [k, s] of [['headline', j.headline?.ja], ['window', j.window?.ja]]) {
      if (s && /ワールドシリーズ終了(から|の)\d+日/.test(s) && !s.includes('日本時間')) {
        err(`${w}.${k}: ワールドシリーズが終わったのに相対の日付のまま（日本時間の実日付に直す）`);
      }
    }
  }
  if (j.outcome) {
    const o = j.outcome;
    if (!OUTCOMES.has(o.kind)) err(`${w}.outcome: kind が不正（${o.kind}）`);
    if ((o.kind === 'signed' || o.kind === 're-signed') && !o.team?.ja) err(`${w}.outcome: 契約先の球団が無い`);
    checkDate(`${w}.outcome`, o.date);
    checkJa(`${w}.outcome`, o.ja);
    checkSourced(`${w}.outcome`, o);
    checkTerms(`${w}.outcome`, o);
  }
}

// ── FA注目選手
const ranks = new Set();
const ids = new Set();
const QO = new Set(['offered', 'accepted', 'declined']);
/** 決着を japanese[] 側に書いた日本人（board の同じ選手に outcome が無くても警告しない）。 */
const jpOutcome = new Set((cat.japanese ?? []).filter((j) => j.outcome).map((j) => j.slug));
/** 契約の年数・総額（百万ドル）。書くなら数値で、桁の取り違え（万ドルを入れる等）を止める。 */
function checkTerms(where, x) {
  if (x.years != null && (!Number.isInteger(x.years) || x.years < 1 || x.years > 15)) err(`${where}: years が不正（${x.years}）`);
  if (x.usdM != null && (typeof x.usdM !== 'number' || x.usdM <= 0 || x.usdM > 1000)) {
    err(`${where}: usdM は百万ドル単位の数値（例: 4年1億500万ドル → 105）。${x.usdM}`);
  }
}
if (cat.altRanking) checkSourced('altRanking', { source: cat.altRanking.url, sourceName: cat.altRanking.name });
if (cat.projection) checkSourced('projection', { source: cat.projection.url, sourceName: cat.projection.name });
if (cat.qualifyingOffer?.offered) {
  checkDate('qualifyingOffer.offered', cat.qualifyingOffer.offered.date);
  checkSourced('qualifyingOffer.offered', cat.qualifyingOffer.offered);
}
for (const b of cat.board ?? []) {
  const w = `board#${b.rank}(${b.nameEn})`;
  if (ranks.has(b.rank)) err(`${w}: 順位の重複`);
  ranks.add(b.rank);
  if (b.mlbId) {
    if (ids.has(b.mlbId)) err(`${w}: mlbId の重複`);
    ids.add(b.mlbId);
  }
  if (b.jpSlug && !slugs.has(b.jpSlug)) err(`${w}: jpSlug が players.ts に無い`);
  if (b.prospectSlug && !prospectSlugs.has(b.prospectSlug)) err(`${w}: prospectSlug が npbPlayers.ts に無い`);
  if (!b.mlbId && !b.prospectSlug) err(`${w}: mlbId も prospectSlug も無い`);
  if (!ROUTES.has(b.route)) err(`${w}: route が不正（${b.route}）`);
  checkJa(`${w}.note`, b.note?.ja);
  if (b.outcome) {
    const o = b.outcome;
    if (!OUTCOMES.has(o.kind)) err(`${w}.outcome: kind が不正`);
    if ((o.kind === 'signed' || o.kind === 're-signed') && !o.team?.ja) err(`${w}.outcome: 契約先の球団が無い`);
    checkDate(`${w}.outcome`, o.date);
    checkJa(`${w}.outcome`, o.ja);
    checkSourced(`${w}.outcome`, o);
    checkTerms(`${w}.outcome`, o);
  }
  // FA一覧（/stove-league/fa）の欄。順位と予想契約は他社の数字＝出どころ（カタログ側）が無ければ出さない。
  if (b.espnRank != null) {
    if (!Number.isInteger(b.espnRank) || b.espnRank < 1) err(`${w}: espnRank が正の整数でない（${b.espnRank}）`);
    if (!cat.altRanking?.url) err(`${w}: espnRank があるのに altRanking（出典）が無い`);
  }
  if (b.projection) {
    checkTerms(`${w}.projection`, b.projection);
    if (b.projection.years == null || b.projection.usdM == null) err(`${w}.projection: years と usdM の両方が要る`);
    if (b.projection.note) checkJa(`${w}.projection.note`, b.projection.note.ja);
    if (!cat.projection?.url) err(`${w}: projection があるのに出どころ（カタログの projection）が無い`);
  }
  if (b.qo) {
    if (!QO.has(b.qo.status)) err(`${w}.qo: status が不正（${b.qo.status}）`);
    if (!cat.qualifyingOffer?.offered?.source) err(`${w}.qo: 提示の出典（qualifyingOffer.offered）が無い`);
    // 受諾・拒否は選手ごとの報道＝日付と出典が要る（提示は一斉なのでカタログ側の出典で足りる）。
    if (b.qo.status !== 'offered') {
      checkDate(`${w}.qo`, b.qo.date);
      checkSourced(`${w}.qo`, b.qo);
    }
    // QO を受諾したのに決着が無い＝一覧の「決着」の数と契約内容が食い違う。
    if (b.qo.status === 'accepted' && !b.outcome && !jpOutcome.has(b.jpSlug)) {
      warn(`${w}: QO を受諾したのに outcome（再契約の内容）が無い`);
    }
  }
  for (const [i, s] of (b.suitors ?? []).entries()) {
    checkJa(`${w}.suitors[${i}]`, s.ja);
    checkSourced(`${w}.suitors[${i}]`, s);
  }
}

// ── ロックアウト（data/stove-lockout.json）
const lo = readJson('data/stove-lockout.json');
if (lo) {
  const w0 = 'lockout';
  if (lo.season !== cat.season) err(`${w0}: season（${lo.season}）が stove-league.json（${cat.season}）と違う`);
  checkDate(`${w0}.asOf`, lo.asOf);
  if (lo.checkedAt) checkDate(`${w0}.checkedAt`, lo.checkedAt);
  if (lo.checkedAt && lo.asOf > lo.checkedAt) err(`${w0}: asOf（${lo.asOf}）が checkedAt（${lo.checkedAt}）より新しい`);
  if (!['pending', 'on', 'ended'].includes(lo.status)) err(`${w0}: status が不正（${lo.status}）`);
  checkJa(`${w0}.headline`, lo.headline?.ja);
  if (lo.deadlineNote) checkJa(`${w0}.deadlineNote`, lo.deadlineNote.ja);
  const tl = lo.timeline ?? [];
  if (!tl.length) err(`${w0}: timeline が空`);
  const seen = new Set();
  tl.forEach((t, i) => {
    const tw = `${w0}.timeline[${i}]`;
    checkDate(tw, t.date);
    checkJa(tw, t.ja);
    checkSourced(tw, t);
    if (i > 0 && t.date > tl[i - 1].date) err(`${tw}: 新しい順になっていない（${tl[i - 1].date} の後に ${t.date}）`);
    const key = `${t.date}|${t.source}`;
    if (seen.has(key)) err(`${tw}: 同じ日付・同じ出典の重複`);
    seen.add(key);
  });
  if (tl[0] && lo.asOf < tl[0].date) err(`${w0}: asOf（${lo.asOf}）が最新の報道（${tl[0].date}）より古い`);
  for (const [i, x] of (lo.what?.items ?? []).entries()) checkJa(`${w0}.what.items[${i}]`, x.ja);
  if (!lo.what?.items?.length) err(`${w0}.what: items が空`);
  checkJa(`${w0}.what.vsStrike`, lo.what?.vsStrike?.ja);
  checkSourced(`${w0}.what`, lo.what ?? {});
  for (const [k, list] of [['issues', lo.issues], ['japan', lo.japan], ['history', lo.history]]) {
    for (const [i, x] of (list ?? []).entries()) {
      const xw = `${w0}.${k}[${i}]`;
      checkJa(`${xw}.title`, (x.title ?? x.label)?.ja);
      checkJa(xw, x.ja);
      checkSourced(xw, x);
      if (x.href && !x.href.startsWith('/')) err(`${xw}: href はサイト内のパス（/ から）で書く（${x.href}）`);
      if (x.from) checkDate(`${xw}.from`, x.from);
      if (x.to) checkDate(`${xw}.to`, x.to);
      if (x.from && x.to && x.from > x.to) err(`${xw}: from が to より後`);
      // 日数は from/to から数え直せる値だけ（出典の数字と食い違う写し間違いを止める）。
      // 報道は初日を数に入れる（2021〜22年は「99日間」）ので、両端を含む数え方と含まない数え方のどちらかに合えばよい。
      if (x.days != null && x.from && x.to) {
        const n = dayDiff(x.from, x.to);
        if (x.days !== n && x.days !== n + 1) err(`${xw}: days（${x.days}）が from〜to の日数（${n}〜${n + 1}）と合わない`);
      }
    }
  }
  // 状態と期限の食い違い: 協定の期限を過ぎたのに「期限の前」のまま＝題と見出しが古い合図。
  const cba = (cat.dates ?? []).find((d) => d.key === 'cba')?.date;
  if (lo.status === 'pending' && cba && today > cba) {
    warn(`${w0}: 協定の期限（${cba}）を過ぎたのに status が pending のまま＝on（ロックアウト入り）か ended（妥結）に直し、headline も書き直す`);
  }
}

// ── NEXT MLB の申請の段階（npbPlayers.ts の postingWatch.steps）
{
  const src = readFileSync(path.join(ROOT, 'src/lib/npbPlayers.ts'), 'utf8');
  for (const m of src.matchAll(/steps:\s*\{([^}]*)\}/g)) {
    for (const [, key, d] of m[1].matchAll(/(\w+):\s*'([^']*)'/g)) {
      // until（交渉期限）だけは先の日付でよい。それ以外は起きた日＝未来なら書き間違い。
      checkDate(`npbPlayers.steps.${key}`, d, { future: key === 'until' });
    }
  }
}

// ── 出典URLの生存（手元用）
if (LINKS) {
  const urls = new Set();
  const add = (u) => u && urls.add(u);
  if (lo) {
    for (const t of lo.timeline ?? []) add(t.source);
    add(lo.what?.source);
    for (const x of [...(lo.issues ?? []), ...(lo.japan ?? []), ...(lo.history ?? [])]) add(x.source);
  }
  add(cat.ranking?.url);
  add(cat.qualifyingOffer?.source);
  for (const d of cat.dates ?? []) add(d.source);
  for (const j of cat.japanese ?? []) {
    for (const t of j.timeline ?? []) add(t.source);
    for (const m of j.marketValue ?? []) add(m.source);
    add(j.outcome?.source);
  }
  for (const b of cat.board ?? []) {
    add(b.outcome?.source);
    add(b.qo?.source);
    for (const x of b.suitors ?? []) add(x.source);
  }
  add(cat.altRanking?.url);
  add(cat.projection?.url);
  add(cat.qualifyingOffer?.offered?.source);
  for (const u of urls) {
    try {
      const res = await fetch(u, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
      // 403/406 はボット避け（MLB.com・Bleacher Nation 等）で、ページ自体は生きていることが多い＝警告に留める。
      if (res.status === 404 || res.status === 410) err(`出典が消えている（${res.status}）: ${u}`);
      else if (!res.ok) warn(`出典を確かめられない（${res.status}）: ${u}`);
    } catch (e) {
      warn(`出典に届かない（${e.message}）: ${u}`);
    }
  }
}

for (const w of warns) console.log(`⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`✗ ${e}`);
  console.log(`\n✗ ${errors.length}件の問題＝公開しない`);
  process.exit(1);
}
console.log(
  `✓ stove-league.json OK（日本人${cat.japanese.length}人・FA${cat.board.length}人・日程${cat.dates.length}件・今日 ${today}）${
    lo ? `／stove-lockout.json OK（時系列${lo.timeline.length}件・status=${lo.status}）` : ''
  }`,
);
