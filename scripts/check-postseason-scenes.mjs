#!/usr/bin/env node
// ポストシーズン名場面（data/postseason-scenes/{season}.json）の検査。
//   node scripts/check-postseason-scenes.mjs            … 全シーズンの構造・引用・中の人の文体
//   node scripts/check-postseason-scenes.mjs --live     … ＋引用コメントが元動画に今も実在するかを YouTube API で照合
//   node scripts/check-postseason-scenes.mjs --todo     … まだ編集していない（中の人のひと言が無い）ポストシーズン試合記事と素材を出す
//
// 運用: 試合記事はクラウドの日次ルーチンが毎日出し、/postseason/live には「速報（記事から自動掲載）」として即載る。
// 編集セッションで --todo を回し、見出し・状況・引用2〜5件・中の人のひと言を data/postseason-scenes/{season}.json に足す
// → --live で元動画と照合 → 公開。中の人の声はクラウドで書かない（matome 手順5c と同じ規律）。
//
// 名場面は「見出し（編集）＋状況（事実）＋海外の反応（引用）＋中の人（俺の声）」の4点で組む。
// 引用は本文を JSON に持たず、記事 JSON（data/threads）のコメントを**投稿者名で参照するだけ**
// ＝描画時に記事から本文・訳・票数を引くので、ここで書き換えも捏造もできない（check-editor-notes と同じ発想）。
// この検査はその参照が切れていないか（記事が無い・投稿者が見つからない・同名が複数）を見る。
//
// --live は捏造の二重チェック。クラウドで作った記事にコメントの捏造が混ざった事故（2026-07-12）があったので、
// 名場面に引き上げる声は元動画のコメント欄に実在するかを API で確かめてから載せる（消費は1動画あたり数ユニット）。
//
// 中の人の文体は x-post スキルの脱AIルールのうち機械で見られるものだけを見る:
// カギカッコ・引用符を使わない／半角スペースを使わない／まとめダッシュを使わない／記号芸と煽り語を使わない。
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data', 'postseason-scenes');
const live = process.argv.includes('--live');
const todo = process.argv.includes('--todo');

function loadEnv(name) {
  if (process.env[name]) return process.env[name];
  return readFile(path.join(ROOT, '.env.local'), 'utf8')
    .then((env) => env.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1].trim().replace(/^["']|["']$/g, '') ?? null)
    .catch(() => null);
}

// 記事化の時に引用符が直線・曲線で入れ替わることがある（’→'）。照合はその差を無視する。
const norm = (s) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

/**
 * 引用の参照。ふつうは投稿者名だけ（"@foo"）。同じ投稿者が1記事に2件書いているときは
 * 英文の書き出しで1件に絞る（{ author, en }）。描画側 src/lib/postseasonScenes.ts と同じ規則。
 */
function pick(comments, q) {
  const author = typeof q === 'string' ? q : q.author;
  return comments.filter((c) => c.author === author && (typeof q === 'string' || norm(c.bodyEn).startsWith(norm(q.en))));
}
const label = (q) => (typeof q === 'string' ? q : `${q.author}（${q.en}…）`);

async function videoComments(key, videoId) {
  const out = [];
  let pageToken;
  for (let i = 0; i < 6; i++) {
    const u = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    u.search = new URLSearchParams({
      // 引用には返信コメントもある＝replies も取る（API が1スレッドあたり最大5件まで同梱して返す）。
      part: 'snippet,replies',
      videoId,
      maxResults: '100',
      order: 'relevance',
      textFormat: 'plainText',
      key,
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const res = await fetch(u);
    if (!res.ok) throw new Error(`YouTube API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    for (const it of j.items ?? []) {
      const s = it.snippet.topLevelComment.snippet;
      out.push({ author: s.authorDisplayName, text: s.textOriginal });
      for (const r of it.replies?.comments ?? []) out.push({ author: r.snippet.authorDisplayName, text: r.snippet.textOriginal });
    }
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

const STYLE = [
  { re: /[「」『』“”"]/, why: 'カギカッコ・引用符（海外の声は地の文に溶かす）' },
  { re: / /, why: '半角スペース' },
  { re: /——|―/, why: 'まとめダッシュ' },
  { re: /草|ｗ|驚愕|衝撃|号泣/, why: '記号芸・煽り語' },
  { re: /ニキ/, why: '「ニキ」表現（§4.4 で禁止）' },
];

const files = (await readdir(DIR).catch(() => [])).filter((f) => f.endsWith('.json'));

if (todo) {
  // まだ場面になっていない試合記事（ラウンドのタグ付き・日次以外）を新しい順に。素材として要約と上位コメントを出す。
  const ROUND_TAGS = ['ワイルドカードシリーズ', '地区シリーズ', 'リーグ優勝決定シリーズ', 'ワールドシリーズ'];
  const done = new Set();
  for (const f of files) for (const sc of JSON.parse(await readFile(path.join(DIR, f), 'utf8')).scenes) done.add(sc.threadId);
  const dir = path.join(ROOT, 'data', 'threads', 'mlb');
  const ids = (await readdir(dir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort().reverse();
  let n = 0;
  for (const id of ids) {
    const t = JSON.parse(await readFile(path.join(dir, `${id}.json`), 'utf8'));
    // その年のポストシーズン（9月以降）の記事だけ。前年のワールドシリーズを振り返る6月の記事などは対象外。
    const season = Number(t.fetchedAt.slice(0, 4));
    if (t.fetchedAt < `${season}-09-01`) continue;
    if (t.daily || done.has(id) || !(t.tags ?? []).some((x) => ROUND_TAGS.includes(x))) continue;
    n++;
    console.log(`\n### ${id}\n${t.title.ja}\n${t.summaryJa}`);
    const top = [...(t.comments ?? [])].sort((a, b) => b.score - a.score).slice(0, 12);
    for (const c of top) console.log(`  ${c.author}  ${c.score}  ${norm(c.bodyEn).slice(0, 110)}\n      ${norm(c.bodyJa).slice(0, 80)}`);
  }
  console.log(n ? `\n未編集 ${n}本` : '未編集の試合記事はない');
  process.exit(0);
}
let errors = 0;
let warns = 0;
const key = live ? await loadEnv('YOUTUBE_API_KEY') : null;
if (live && !key) {
  console.error('YOUTUBE_API_KEY が無いので --live は実行できない（.env.local に置く）');
  process.exit(1);
}

for (const f of files) {
  const data = JSON.parse(await readFile(path.join(DIR, f), 'utf8'));
  const seen = new Set();
  for (const sc of data.scenes) {
    const tag = `${f}:${sc.threadId}`;
    if (seen.has(sc.threadId)) {
      console.log(`✗ ${tag} 同じ記事の場面が2つある（1記事1場面）`);
      errors++;
    }
    seen.add(sc.threadId);
    let thread;
    try {
      thread = JSON.parse(await readFile(path.join(ROOT, 'data', 'threads', 'mlb', `${sc.threadId}.json`), 'utf8'));
    } catch {
      console.log(`✗ ${tag} 記事が見つからない（撤去・改名されたら場面も外す）`);
      errors++;
      continue;
    }
    const comments = thread.comments ?? [];
    for (const q of sc.quotes) {
      const hits = pick(comments, q);
      if (hits.length !== 1) {
        console.log(`✗ ${tag} 引用 ${label(q)} が記事に ${hits.length} 件（ちょうど1件で参照する＝同じ投稿者が複数なら { author, en } で絞る）`);
        errors++;
      }
    }
    if (sc.quotes.length < 2 || sc.quotes.length > 5) {
      console.log(`! ${tag} 引用は2〜5件が目安（いま${sc.quotes.length}件）`);
      warns++;
    }
    for (const field of ['headline', 'take']) {
      const text = sc[field] ?? '';
      for (const { re, why } of field === 'headline' ? STYLE.filter((s) => !/半角/.test(s.why)) : STYLE) {
        if (re.test(text)) {
          console.log(`✗ ${tag} ${field} に${why}: ${text.match(re)[0]}`);
          errors++;
        }
      }
    }
    if (live) {
      const vid = thread.media?.url?.match(/[?&]v=([\w-]{11})/)?.[1];
      if (!vid) {
        console.log(`! ${tag} 動画IDが取れないので照合を飛ばした`);
        warns++;
        continue;
      }
      const yt = await videoComments(key, vid);
      for (const q of sc.quotes) {
        const c = pick(comments, q)[0];
        if (!c) continue;
        const a = c.author;
        // 記事は長いコメントを抜粋することがある＝元コメントが記事の本文を含んでいれば実在とみなす。
        const found = yt.find((y) => y.author === a && norm(y.text).includes(norm(c.bodyEn).replace(/…$/, '')));
        const sameAuthor = yt.find((y) => y.author === a);
        if (found) continue;
        if (sameAuthor) {
          console.log(`! ${tag} ${a} は実在するが本文が一致しない（編集された可能性）\n    記事: ${norm(c.bodyEn).slice(0, 90)}\n    現在: ${norm(sameAuthor.text).slice(0, 90)}`);
          warns++;
        } else {
          console.log(`✗ ${tag} ${a} が元動画のコメント（関連度順・最大600件）に見つからない（返信6件目以降・削除の可能性）`);
          errors++;
        }
      }
    }
  }
  console.log(`${f}: ${data.scenes.length}場面`);
}

console.log(errors ? `✗ ${errors}件のエラー・${warns}件の注意` : `✓ OK（注意${warns}件）${live ? '・元動画と照合済み' : ''}`);
process.exit(errors ? 1 : 0);
