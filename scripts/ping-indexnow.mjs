#!/usr/bin/env node
/**
 * IndexNow 即時インデックス通知（Bing / Yandex / Naver ほか対応。Google は IndexNow 非対応だが
 * sitemap + GSC 側で拾う）。新記事を公開・デプロイした直後に走らせ、検索エンジンへ「今すぐ来て」と通知する。
 *
 * 仕組み: 公開された鍵ファイル `https://<site>/<key>.txt`（中身=key）で所有を証明し、
 *         api.indexnow.org に変更 URL 一覧を POST する。鍵は秘密ではない（公開前提のトークン）。
 *
 * 鍵の解決順: 環境変数 INDEXNOW_KEY（.env.local）→ public/*.txt の自動検出（ファイル名==中身）。
 *   → 既定では public/<key>.txt をコミットしてあるので、設定なしでそのまま動く。
 *
 * 使い方:
 *   node scripts/ping-indexnow.mjs --latest 3      … 直近3記事＋その競技一覧＋トップを通知
 *   node scripts/ping-indexnow.mjs /mlb/2026-06-18-foo   … パス指定（自ロケール=ja）
 *   node scripts/ping-indexnow.mjs https://.../mlb/foo   … フル URL 指定
 *   node scripts/ping-indexnow.mjs --all           … 全記事＋競技一覧＋トップ（初回一括投入用）
 *
 * 環境変数: NEXT_PUBLIC_SITE_URL（既定: https://matome-mlb-kaigai.jp）
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const THREADS_DIR = join(ROOT, 'data/threads');
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://matome-mlb-kaigai.jp').replace(/\/$/, '');
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** .env.local から 1 つの値を拾う（fetch-youtube / ping-blogmura と同方式・依存を増やさない）。 */
function loadEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`));
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .env.local が無くてもよい */
  }
  return undefined;
}

/** 鍵を解決する。env が無ければ public/ の鍵ファイル（名前==中身・16進）を自動検出。 */
function resolveKey() {
  const fromEnv = loadEnv('INDEXNOW_KEY');
  if (fromEnv) return fromEnv;
  for (const f of readdirSync(PUBLIC_DIR)) {
    if (!f.endsWith('.txt')) continue;
    const name = f.slice(0, -4);
    if (!/^[a-f0-9]{8,128}$/i.test(name)) continue;
    if (readFileSync(join(PUBLIC_DIR, f), 'utf8').trim() === name) return name;
  }
  return undefined;
}

/** mtime 降順で新しい記事ファイルを集める（{sport, id}）。 */
async function newestThreads(limit) {
  const out = [];
  for (const sport of await readdir(THREADS_DIR)) {
    let files;
    try { files = await readdir(join(THREADS_DIR, sport)); } catch { continue; }
    for (const f of files.filter((x) => x.endsWith('.json'))) {
      const s = await stat(join(THREADS_DIR, sport, f));
      out.push({ sport, id: f.slice(0, -5), mtime: s.mtimeMs });
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return limit ? out.slice(0, limit) : out;
}

/** 記事 1 本が変える URL（記事本体＋その競技一覧＋トップ）。ja は接頭辞なしが正規。 */
function urlsForThread({ sport, id }) {
  return [`${SITE_URL}/${sport}/${id}`, `${SITE_URL}/${sport}`, `${SITE_URL}/`];
}

function toAbsolute(arg) {
  if (arg.startsWith('http')) return arg.replace(/\/$/, '') || arg;
  if (arg.startsWith('/')) return `${SITE_URL}${arg}`;
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const key = resolveKey();
  if (!key) {
    console.error('✗ INDEXNOW_KEY が見つかりません。.env.local に設定するか public/<key>.txt を置いてください。');
    process.exit(1);
  }

  const urls = new Set();
  const flat = args.join(' ');
  const latestMatch = flat.match(/--latest(?:[=\s]+(\d+))?/);
  const wantAll = args.includes('--all');

  for (const a of args) {
    const u = toAbsolute(a);
    if (u) urls.add(u);
  }
  if (wantAll) {
    urls.add(`${SITE_URL}/`);
    for (const t of await newestThreads(null)) urlsForThread(t).forEach((u) => urls.add(u));
  } else if (latestMatch) {
    const n = latestMatch[1] ? Number(latestMatch[1]) : 5;
    for (const t of await newestThreads(n)) urlsForThread(t).forEach((u) => urls.add(u));
  }

  const urlList = [...urls];
  if (urlList.length === 0) {
    console.error('使い方: node scripts/ping-indexnow.mjs --latest 3 | --all | <URL/パス...>');
    process.exit(1);
  }

  const host = new URL(SITE_URL).host;
  const body = { host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList };
  console.log(`IndexNow → ${host}（${urlList.length} URL・key=${key.slice(0, 6)}…）`);
  urlList.forEach((u) => console.log(`  · ${u}`));

  // --dry: 送信せず URL を確認するだけ（デプロイ前の検証・誤爆防止）。
  if (args.includes('--dry')) {
    console.log('（--dry: 送信しませんでした）');
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  // 200=受理 / 202=受理（検証保留）。それ以外は本文を出す。
  if (res.ok) {
    console.log(`✅ 送信成功（HTTP ${res.status}）`);
  } else {
    console.error(`✗ 失敗 HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
}

main();
