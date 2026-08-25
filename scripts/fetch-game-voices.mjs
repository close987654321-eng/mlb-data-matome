#!/usr/bin/env node
/**
 * チームLPの試合タイムラインに出す「1試合1件の現地の声」を取りに行く（data/game-voices.json）。
 *
 * なぜ記事から切り離すか:
 *   タイムラインの声は「その試合のまとめ記事を書いたか」に100%連動していた。2026-07-30 に
 *   「日本人が絡む試合は日次記事1本に集約」と決めた結果、1日あたりの記事本数が 6〜12本 → 1本に落ち、
 *   声のカバー率が 60〜100% → 30〜40% に下がった（窓が転がると全体も同じ水準に落ちる）。
 *   記事本数を戻すのは共食い回避の合意に逆行するので、**声だけを記事から独立させる**。
 *
 * 捏造対策（2026-07-12 の事故の再来を構造的に防ぐ）:
 *   原文・著者・票数・動画IDは**このスクリプトが取得結果からそのまま書き出す**＝人も AI も触らない。
 *   日本語訳 `ja` だけを後から人／エージェントが埋める。`ja` が空のエントリはサイトに出ない
 *   （src/lib/gameVoices.ts の安全弁）＝訳が付くまで表示されないので、未訳のまま公開されない。
 *
 * YouTube API 規約への配慮:
 *   1試合につき**1件だけ**（コメントDBにしない）。書き出し時に data/team-games.json の窓
 *   （直近30日）の外へ出たエントリを落とす＝保存期間もタイムラインの窓と一致する。
 *   落とす直前に球団あたり SEASON_KEEP_PER_TEAM 件だけを data/season-voices.json へ昇格させる
 *   （オフシーズンのLPの燃料。上限つき＝増え続けない・refresh-season で毎月取り直す）。
 *
 * 使い方:
 *   node scripts/fetch-game-voices.mjs                 # team-games.json の最新日
 *   node scripts/fetch-game-voices.mjs 2026-08-05      # 日付指定
 *   node scripts/fetch-game-voices.mjs 2026-07-20..2026-08-06   # 期間（バックフィル）
 *   node scripts/fetch-game-voices.mjs refresh-season  # 今季の声を取り直す（月1・規約の「更新か削除」）
 *   オプション: --dry-run（書かない） --limit N（1回に取る試合数の上限・既定40）
 *
 * 消費ユニット: playlistItems（50本/1ユニット）＋ commentThreads（1試合1ユニット）。
 *   1日ぶんで約12ユニット（無料枠 10,000 の 0.1%）。
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const MLB_CHANNEL = 'UCoLrcjPV5PbUrUyXq5mjc_A';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'game-voices.json');
const SEASON_OUT = path.join(ROOT, 'data', 'season-voices.json');

/**
 * 窓（直近30日）から落ちる声のうち、球団ごとにここまでを「今季の声」として残す。
 *
 * なぜ上限つきか: 全部貯めると機械的なコメントDBになり、規約に配慮して置いた
 * 「保存期間＝タイムラインの窓」の posture が崩れる。残すのは記事の抜粋と同じ扱い
 * ＝訳と出典（動画への送客）が付いた編集物だけ・球団あたりの点数を固定して増え続けない形にする。
 */
const SEASON_KEEP_PER_TEAM = 6;

/* ---------------------------------------------------------------- 共通ヘルパ */

function loadApiKey() {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
  try {
    const m = readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^YOUTUBE_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* .env.local が無ければ環境変数のみ */
  }
  throw new Error('YOUTUBE_API_KEY が無い（.env.local か環境変数に設定）');
}

async function api(key, endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('key', key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${endpoint} ${res.status}: ${await res.text()}`);
  return res.json();
}

/** キー順を固定した JSON（毎日コミットされるファイルを差分の出ない形に保つ）。 */
function stableStringify(value, indent = 2) {
  const norm = (v) => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])]));
    }
    return v;
  };
  return JSON.stringify(norm(value), null, indent);
}

const jstDateOf = (iso) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(iso));

/** 試合の同一性キー。src/lib/teamGames.ts の gameKey と同じ規約（並べ替えで主客に依存しない）。 */
function gameKey(date, teamA, scoreA, teamB, scoreB) {
  const [x, y] = [`${teamA}=${scoreA}`, `${teamB}=${scoreB}`].sort();
  return `${date}|${x}|${y}`;
}

/* ------------------------------------------------------------ カタログ・既存データ */

/** src/lib/teams.ts を唯一の正として teamId ↔ 日本語名 ↔ 英語短縮名を引く。 */
function loadTeams() {
  const src = readFileSync(path.join(ROOT, 'src/lib/teams.ts'), 'utf8');
  const byId = new Map();
  const byUpperEn = new Map();
  const re = /^ {2}([^\s:]+):\s*\{\s*id:\s*(\d+),[^}]*?nameEn:\s*'([^']+)'/gm;
  for (const m of src.matchAll(re)) {
    byId.set(Number(m[2]), m[1]);
    byUpperEn.set(m[3].toUpperCase(), { id: Number(m[2]), ja: m[1] });
  }
  if (byId.size !== 30) throw new Error(`teams.ts の解釈に失敗（${byId.size}球団）`);
  return { byId, byUpperEn };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** 記事（専用まとめ・日次記事）が既に声を持っている試合キーの集合。ここは声レイヤーで埋めない。 */
function articleVoiceKeys() {
  const MIN = 16;
  const usable = (c) => ((c?.bodyJa ?? '').trim() || (c?.bodyEn ?? '').trim()).length >= MIN;
  const quotesOf = (blocks) =>
    (blocks ?? []).flatMap((b) =>
      b.type === 'quote' ? [b.comment] : b.type === 'chips' ? b.comments : [],
    );
  const keys = new Set();
  const bodies = new Set(); // 記事で既出のコメント原文＝同じ発言を二度出さない
  const dir = path.join(ROOT, 'data', 'threads');
  for (const sport of readdirSync(dir)) {
    const sub = path.join(dir, sport);
    for (const f of readdirSync(sub)) {
      if (!f.endsWith('.json')) continue;
      const t = readJson(path.join(sub, f), null);
      if (!t) continue;
      const d = t.daily;
      if (d) {
        const date = t.id.slice(0, 10);
        const add = (result, comments) => {
          const m = (result ?? '').match(/^(\S+)\s+(\d+)-(\d+)\s+(\S+)/);
          if (!m || !(comments ?? []).some(usable)) return;
          keys.add(`${date}${gameKey('', m[1], Number(m[2]), m[4], Number(m[3]))}`);
        };
        add(d.hero.result, quotesOf(d.hero.blocks));
        for (const s of d.shorts) add(s.result, s.quotes ?? []);
        for (const b of d.buzz ?? []) add(b.result, quotesOf(b.blocks));
      }
      const g = t.game;
      if (g) {
        const cs = d
          ? [...quotesOf(d.hero.blocks), ...d.shorts.flatMap((s) => s.quotes ?? [])]
          : t.story
            ? quotesOf(t.story)
            : (t.comments ?? []);
        if (cs.some(usable)) {
          const date = t.series?.date ?? t.id.slice(0, 10);
          keys.add(gameKey(date, g.away.ja, g.away.score, g.home.ja, g.home.score));
        }
      }
      for (const c of t.comments ?? []) if (c.bodyEn) bodies.add(c.bodyEn.trim());
      for (const c of quotesOf(t.story)) if (c.bodyEn) bodies.add(c.bodyEn.trim());
      if (d) {
        for (const c of [
          ...quotesOf(d.hero.blocks),
          ...d.shorts.flatMap((s) => s.quotes ?? []),
          ...(d.buzz ?? []).flatMap((b) => quotesOf(b.blocks)),
        ]) {
          if (c.bodyEn) bodies.add(c.bodyEn.trim());
        }
      }
    }
  }
  return { keys, bodies };
}

/* ------------------------------------------------------------------ 動画の同定 */

/**
 * MLB公式の投稿一覧から `AWAY vs. HOME: Official Full Game Highlights (Month D)` を集める。
 * 全試合ぶん確実に存在する唯一の定型枠＝ここだけを見る（検索は 100 ユニット/回で高い）。
 */
async function fetchHighlightVideos(key, sinceJst) {
  const ch = await api(key, 'channels', { part: 'contentDetails', id: MLB_CHANNEL });
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('MLB公式チャンネルの uploads プレイリストが取れない');

  const videos = [];
  let pageToken;
  let pages = 0;
  for (;;) {
    const pl = await api(key, 'playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploads,
      maxResults: 50,
      ...(pageToken ? { pageToken } : {}),
    });
    pages++;
    let oldest = null;
    for (const it of pl.items ?? []) {
      const publishedAt = it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt;
      if (!publishedAt) continue;
      oldest = jstDateOf(publishedAt);
      const m = (it.snippet?.title ?? '').match(
        /^(.+?) vs\. (.+?): Official Full Game Highlights \(([A-Za-z]+ \d+)\)/,
      );
      if (!m) continue;
      videos.push({
        videoId: it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId,
        awayEn: m[1],
        homeEn: m[2],
        jst: jstDateOf(publishedAt),
      });
    }
    pageToken = pl.nextPageToken;
    // 目的の期間より古いページに入ったら止める（1日ぶんなら1ページで足りる）。
    if (!pageToken || (oldest && oldest < sinceJst) || pages >= 40) break;
  }
  return { videos, pages };
}

/* ------------------------------------------------------------------ コメント選定 */

const BAD = /https?:\/\/|www\.|t\.me\/|@[\w.]+\s*$/i;

/**
 * 賭けサイトのステマ。MLB公式のコメント欄に大量投下されていて、**票数が不自然に高く人気順の
 * 上位に食い込む**（初回取得で40件中10件＝25%が混入した）。試合の話をしているように見えて
 * 中身がサービス名の宣伝なので、票数で選ぶ前に落とす。新しい業者が湧いたらここに足す。
 */
const SPAM = [
  /deliberate odds/i,
  /\bplaced?\s+(a\s+few\s+)?bets?\b/i,
  /\bmy\s+bets?\b/i,
  /\bbetting\s+(with|on)\b/i,
  /\bparlay\b/i,
  /\bpromo\s*code\b/i,
  /\bsportsbook\b/i,
  // 中身の無い定型ボット。「The Atlanta Braves are 70-45🔵⚪️🔴」式の戦績貼りと、動画の再生位置レス。
  /^The .+ are \d{1,3}-\d{1,3}\b/,
  /^\d{1,2}:\d{2}\b/,
  // 試合ではなく**動画そのもの**への感想（サムネ・音声・編集・投稿の速さ）。タイムラインには置けない。
  /\bthumbnails?\b/i,
  /\bupload(s|ed|ing)?\b/i,
  /\bcondensed game/i,
  /\bthe audio\b/i,
  /\bedit(ing|ed)\b/i,
  /\bad breaks?\b/i,
  /\bunlisted\b/i,
  /\bshow(ing)? (multiple |the )?replays?\b/i,
  /\bsound cuts? off\b/i,
  /\bredo the video\b/i,
  // 野球と無関係な他競技の「X vs. Y」対戦煽り連投（同一アカウントが複数動画に同型コメントを量産）。
  /\bvs\.?\s+.+\b(nba|nhl|nfl|rivalry)\b/i,
];

/** タイムラインに1行で置ける発言か。短すぎ・URL・ステマ・絵文字だけ・長すぎを弾く。 */
function usableComment(text) {
  const s = (text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length < 24 || s.length > 240) return null;
  if (BAD.test(s)) return null;
  if (SPAM.some((re) => re.test(s))) return null;
  const letters = (s.match(/[A-Za-z]/g) ?? []).length;
  if (letters < 15) return null; // 絵文字・記号・数字だけの行を弾く
  if (s.split(' ').length < 5) return null;
  return s;
}

async function pickComment(key, videoId, usedBodies) {
  const data = await api(key, 'commentThreads', {
    part: 'snippet',
    videoId,
    order: 'relevance',
    maxResults: 50,
    textFormat: 'plainText',
  });
  const cands = [];
  for (const it of data.items ?? []) {
    const s = it.snippet?.topLevelComment?.snippet;
    if (!s) continue;
    const text = usableComment(s.textDisplay);
    if (!text || usedBodies.has(text)) continue;
    cands.push({ author: s.authorDisplayName, score: s.likeCount ?? 0, en: text });
  }
  // 人気順（YouTube の relevance は返信数も加味するので、票数で明示的に並べ直す）
  cands.sort((a, b) => b.score - a.score);
  return cands[0] ?? null;
}

/* ------------------------------------------------- 今季の声（窓から落ちるぶんの退避） */

const seasonKey = (v) => `${v.d}|${v.a}|${v.h}`;

/**
 * 窓から落ちる声を「今季の声」（data/season-voices.json）へ昇格させる。
 *
 * なぜ要るか: 11月〜2月中旬は試合が無い＝窓が転がるだけで声レイヤーは空になり、チーム・選手LPの
 * 「現地ファンの声ピックアップ」がオフシーズンに全滅する（記事由来の声だけが残る＝2026-08-20 に
 * 直したはずの「LPの先頭が何週間も動かない」状態への逆戻り）。訳は人が付けた資産でもある。
 *
 * 選び方: 訳の付いたものだけを対象に、球団ごとに票数の多い順で SEASON_KEEP_PER_TEAM 件まで。
 * 1件の声は2球団の試合なのでどちらの枠でも拾われうる＝和集合を取ってから試合キーで重複を落とす。
 * 既に昇格済みのぶんも毎回この選抜に混ぜる＝上限を超えて増えず、票数の高い声に入れ替わっていく。
 */
function promoteSeasonVoices(prevSeason, fellOut) {
  const byKey = new Map();
  for (const v of [...prevSeason, ...fellOut.filter((v) => v.ja?.trim())]) byKey.set(seasonKey(v), v);
  const uniq = [...byKey.values()];
  const keep = new Set();
  for (const teamId of new Set(uniq.flatMap((v) => [v.a, v.h]))) {
    const mine = uniq
      .filter((v) => v.a === teamId || v.h === teamId)
      .sort((x, y) => y.score - x.score || y.d.localeCompare(x.d));
    for (const v of mine.slice(0, SEASON_KEEP_PER_TEAM)) keep.add(seasonKey(v));
  }
  return uniq
    .filter((v) => keep.has(seasonKey(v)))
    .sort((x, y) => y.d.localeCompare(x.d) || x.a - y.a || x.h - y.h);
}

/** 「今季の声」を書く（中身が同じなら asOf を据え置く＝毎日の無駄な差分を出さない）。 */
function writeSeasonFile(voices, prevFile, extra = {}) {
  const content = { voices };
  let asOf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const { asOf: prevAsOf, refreshedAt: prevRefreshed, ...prevRest } = prevFile;
  if (stableStringify(prevRest) === stableStringify(content)) asOf = prevAsOf || asOf;
  const refreshedAt = extra.refreshedAt ?? prevRefreshed;
  writeFileSync(
    SEASON_OUT,
    `${stableStringify({ asOf, ...(refreshedAt ? { refreshedAt } : {}), ...content })}\n`,
  );
}

/**
 * 保存した「今季の声」を YouTube に取り直して、更新するか落とす（月1回）。
 *
 * 窓の中の声は毎日の入れ替えで自然に取り直されるが、昇格させたぶんは動かない。ここで動画と
 * コメントの生存を確かめ、消えていれば落とす（票数は最新に更新）＝保存するなら定期的に
 * 更新か削除、という規約の要求に正面から応える。出典が消えた引用をLPに出し続けないための
 * 手当てでもある（記事側の check-dead-videos.mjs と同じ役割）。
 *
 * 上位100件に見つからなければ落とす＝生きている声を巻き込むことはあるが、保存を続けるより安全側に倒す。
 */
async function refreshSeason(dryRun) {
  const key = loadApiKey();
  const prevFile = readJson(SEASON_OUT, null);
  if (!prevFile) throw new Error(`${path.relative(ROOT, SEASON_OUT)} が無い（先に通常実行で昇格させる）`);
  const alive = [];
  let gone = 0;
  let rescored = 0;
  for (const v of prevFile.voices) {
    let items;
    try {
      const data = await api(key, 'commentThreads', {
        part: 'snippet',
        videoId: v.v,
        order: 'relevance',
        maxResults: 100,
        textFormat: 'plainText',
      });
      items = data.items ?? [];
    } catch (e) {
      console.error(`  × ${v.d} ${v.author}: 動画が引けない（${e.message.slice(0, 60)}）`);
      gone++;
      continue;
    }
    const hit = items
      .map((it) => it.snippet?.topLevelComment?.snippet)
      .find((sn) => sn && sn.authorDisplayName === v.author && usableComment(sn.textDisplay) === v.en);
    if (!hit) {
      console.error(`  × ${v.d} ${v.author}: コメントが見つからない`);
      gone++;
      continue;
    }
    const score = hit.likeCount ?? v.score;
    if (score !== v.score) rescored++;
    alive.push({ ...v, score });
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
  console.error(
    `今季の声 ${prevFile.voices.length}件を再取得: 生存 ${alive.length}／消滅 ${gone}／票数更新 ${rescored}` +
      `・消費 約${prevFile.voices.length}ユニット`,
  );
  if (dryRun) return console.error('--dry-run なので書き込みなし');
  writeSeasonFile(alive, prevFile, { refreshedAt: today });
  console.error(`書き込み: ${path.relative(ROOT, SEASON_OUT)}`);
}

/* ---------------------------------------------------------------------- 本体 */

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  if (args[0] === 'refresh-season') return refreshSeason(dryRun);
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 40;
  const range = args.find((a) => /^\d{4}-\d{2}-\d{2}/.test(a));

  const teams = loadTeams();
  const schedule = readJson(path.join(ROOT, 'data', 'team-games.json'), null);
  if (!schedule) throw new Error('data/team-games.json が無い（先に fetch-mlb-stats.mjs team-games）');

  const dates = [...new Set(schedule.games.map((g) => g.d))].sort();
  const [from, to] = range
    ? range.includes('..')
      ? range.split('..')
      : [range, range]
    : [dates[dates.length - 1], dates[dates.length - 1]];

  const { keys: covered, bodies: usedBodies } = articleVoiceKeys();
  const prev = readJson(OUT, { voices: [] });
  const have = new Set(
    prev.voices.map((v) => gameKey(v.d, teams.byId.get(v.a), v.as, teams.byId.get(v.h), v.hs)),
  );
  for (const v of prev.voices) usedBodies.add(v.en);

  // ダブルヘッダー（同じ日・同じ対戦カードが2試合）は動画タイトルに試合番号が無く、どちらの試合の
  // ハイライトか決められない。片方の動画を両方に付けてしまう事故が起きたので、丸ごと対象から外す。
  const pairCount = new Map();
  for (const g of schedule.games) {
    const p = `${g.d}|${g.a}|${g.h}`;
    pairCount.set(p, (pairCount.get(p) ?? 0) + 1);
  }

  // 対象＝期間内・記事に声が無い・声レイヤーにもまだ無い試合
  const targets = schedule.games
    .filter((g) => g.d >= from && g.d <= to)
    .filter((g) => pairCount.get(`${g.d}|${g.a}|${g.h}`) === 1)
    .filter((g) => {
      const k = gameKey(g.d, teams.byId.get(g.a), g.as, teams.byId.get(g.h), g.hs);
      return !covered.has(k) && !have.has(k);
    })
    .sort((a, b) => b.d.localeCompare(a.d));

  console.error(`対象期間 ${from}〜${to} ／ 未カバー ${targets.length}試合（上限 ${limit}）`);
  if (targets.length === 0) {
    console.error('取りに行く試合なし。終了。');
    return;
  }

  const key = loadApiKey();
  const { videos, pages } = await fetchHighlightVideos(key, from);
  console.error(`公式ハイライト ${videos.length}本（playlistItems ${pages}ページ＝${pages}ユニット）`);

  const added = [];
  const usedVideos = new Set(prev.voices.map((v) => v.v));
  let noVideo = 0;
  let noComment = 0;
  let units = pages + 1;

  for (const g of targets.slice(0, limit)) {
    const awayJa = teams.byId.get(g.a);
    const homeJa = teams.byId.get(g.h);
    const cands = videos.filter((v) => {
      const a = teams.byUpperEn.get(v.awayEn.toUpperCase());
      const h = teams.byUpperEn.get(v.homeEn.toUpperCase());
      // 動画の投稿は試合直後＝投稿の JST 日付が試合の JST 日付と一致する（ET夜＝JST翌日も揃う）
      return a?.id === g.a && h?.id === g.h && v.jst === g.d;
    });
    // ダブルヘッダーはタイトルに試合番号が無く、どちらの試合か決められない＝取らない（推測しない）
    if (cands.length !== 1) {
      noVideo++;
      console.error(`  - ${g.d} ${awayJa} @ ${homeJa}: 動画${cands.length === 0 ? 'なし' : '複数'}`);
      continue;
    }
    const video = cands[0];
    // 1本の動画は1試合にしか使わない（ダブルヘッダー除外をすり抜けた場合の最後の砦）。
    if (usedVideos.has(video.videoId)) {
      noVideo++;
      console.error(`  - ${g.d} ${awayJa} @ ${homeJa}: 動画が他の試合と重複`);
      continue;
    }
    usedVideos.add(video.videoId);
    units++;
    const picked = await pickComment(key, video.videoId, usedBodies);
    if (!picked) {
      noComment++;
      console.error(`  - ${g.d} ${awayJa} @ ${homeJa}: 使えるコメントなし`);
      continue;
    }
    usedBodies.add(picked.en);
    added.push({
      d: g.d,
      a: g.a,
      h: g.h,
      as: g.as,
      hs: g.hs,
      v: video.videoId,
      author: picked.author,
      score: picked.score,
      en: picked.en,
      ja: '', // ← 訳はここだけ後から埋める。空のあいだサイトには出ない。
    });
    console.error(`  ✓ ${g.d} ${awayJa} @ ${homeJa}: 👍${picked.score} ${picked.author}`);
  }

  // 窓（team-games.json の期間）の外に出たエントリは落とす＝保存期間をタイムラインと一致させる。
  // ただし落とす直前に、球団あたり上限つきで「今季の声」へ昇格させる（オフシーズンのLPの燃料）。
  const kept = prev.voices.filter((v) => v.d >= schedule.from);
  const fellOut = prev.voices.filter((v) => v.d < schedule.from);
  const voices = [...kept, ...added].sort(
    (x, y) => y.d.localeCompare(x.d) || x.a - y.a || x.h - y.h,
  );
  const prevSeasonFile = readJson(SEASON_OUT, { voices: [] });
  const seasonVoices = promoteSeasonVoices(prevSeasonFile.voices ?? [], fellOut);
  const promoted = seasonVoices.length - (prevSeasonFile.voices ?? []).length;

  const content = { from: schedule.from, to: schedule.to, voices };
  let asOf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const { asOf: prevAsOf, ...prevRest } = prev;
  if (stableStringify(prevRest) === stableStringify(content)) asOf = prevAsOf || asOf;

  console.error(
    `\n新規 ${added.length}／動画なし ${noVideo}／コメントなし ${noComment}` +
      `／窓外へ ${fellOut.length}（うち今季の声へ昇格 ${promoted > 0 ? `+${promoted}` : 0}）` +
      `／合計 ${voices.length}件・今季の声 ${seasonVoices.length}件・消費 約${units}ユニット`,
  );
  const untranslated = voices.filter((v) => !v.ja.trim()).length;
  if (untranslated) console.error(`⚠️ 未訳 ${untranslated}件（ja が空のあいだサイトには出ない）`);

  if (dryRun) {
    console.error('--dry-run なので書き込みなし');
    return;
  }
  writeFileSync(OUT, `${stableStringify({ asOf, ...content })}\n`);
  writeSeasonFile(seasonVoices, prevSeasonFile);
  console.error(
    `書き込み: ${path.relative(ROOT, OUT)} / ${path.relative(ROOT, SEASON_OUT)}`,
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
