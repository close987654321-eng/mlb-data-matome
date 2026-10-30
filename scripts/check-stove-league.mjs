#!/usr/bin/env node
/**
 * data/stove-league.json（ストーブリーグの編集データ）の公開前検査。
 *
 * なぜ要るか: 毎朝6時のクラウド定期実行（.claude/skills/stove-daily/SKILL.md）が人の確認なしで
 * 報道の時系列・関心球団・契約の中身を書き足す。ビルドは JSON の中身の誤りを見ない（未来の日付・出典の無い
 * 記述・存在しない選手の slug でも通る）ので、ここで機械的に落とす。1つでも ✗ があれば終了コード1＝公開しない。
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
  }
}

// ── FA注目選手
const ranks = new Set();
const ids = new Set();
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
  }
}

// ── 出典URLの生存（手元用）
if (LINKS) {
  const urls = new Set();
  const add = (u) => u && urls.add(u);
  add(cat.ranking?.url);
  add(cat.qualifyingOffer?.source);
  for (const d of cat.dates ?? []) add(d.source);
  for (const j of cat.japanese ?? []) {
    for (const t of j.timeline ?? []) add(t.source);
    for (const m of j.marketValue ?? []) add(m.source);
    add(j.outcome?.source);
  }
  for (const b of cat.board ?? []) add(b.outcome?.source);
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
console.log(`✓ stove-league.json OK（日本人${cat.japanese.length}人・FA${cat.board.length}人・日程${cat.dates.length}件・今日 ${today}）`);
