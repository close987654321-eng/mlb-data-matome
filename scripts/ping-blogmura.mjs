#!/usr/bin/env node
/**
 * にほんブログ村へ更新 Ping を送る（記事を公開したら即・新着一覧に載せるため）。
 *
 * なぜ手動スクリプトか:
 *   このサイトは Next.js + Vercel の静的サイトで、WordPress のように公開時へ自動で
 *   Ping を投げる仕組みが無い。デプロイ完了後にこのコマンドを 1 回叩いて通知する。
 *   ブログ村側は「Ping送信/記事反映」を有効化＋RSS(feed.xml)登録しておくこと。
 *
 * 認証:
 *   環境変数 BLOGMURA_PING_URL（あなた専用の Ping 送信先。半分パスワードなので
 *   公開リポジトリには出さない）。.env.local に BLOGMURA_PING_URL=... を書けば自動で読む。
 *
 * 使い方:
 *   node scripts/ping-blogmura.mjs
 *     → サイト名・サイト URL で weblogUpdates.ping を送り、結果を表示する。
 *
 * 任意の上書き（既定値で困らなければ不要）:
 *   SITE_NAME            ブログ村に登録した表示名（既定: 下記 DEFAULT_SITE_NAME）
 *   NEXT_PUBLIC_SITE_URL サイトの絶対 URL（既定: https://matome-mlb-kaigai.jp）
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_SITE_NAME = '海外の反応 — MLB / ボクシング / MMA';
const DEFAULT_SITE_URL = 'https://matome-mlb-kaigai.jp';

/** .env.local 1 行から KEY=VALUE を拾う（dotenv 依存を増やさない簡易版・fetch-youtube と同方式） */
function loadEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const env = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const m = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (m) return m[1].trim();
  } catch {
    /* .env.local が無ければ環境変数のみ */
  }
  return null;
}

/** XML-RPC の文字列に入れる前に最低限エスケープ（& < > "） */
function xmlEscape(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** weblogUpdates.ping のリクエスト本文（名前・URL の 2 引数の標準 Ping） */
function buildPingBody(siteName, siteUrl) {
  return `<?xml version="1.0"?>
<methodCall>
  <methodName>weblogUpdates.ping</methodName>
  <params>
    <param><value><string>${xmlEscape(siteName)}</string></value></param>
    <param><value><string>${xmlEscape(siteUrl)}</string></value></param>
  </params>
</methodCall>`;
}

async function main() {
  const pingUrl = loadEnv('BLOGMURA_PING_URL');
  if (!pingUrl) {
    console.error(
      'BLOGMURA_PING_URL が未設定。 .env.local に\n  BLOGMURA_PING_URL=https://ping.blogmura.com/xmlrpc/xxxxxxxx/\nを書く（あなた専用 URL・公開しない）。',
    );
    process.exit(1);
  }

  const siteName = loadEnv('SITE_NAME') ?? DEFAULT_SITE_NAME;
  const siteUrl = (loadEnv('NEXT_PUBLIC_SITE_URL') ?? DEFAULT_SITE_URL).replace(/\/$/, '');

  const res = await fetch(pingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', 'User-Agent': 'matome-ping/1.0' },
    body: buildPingBody(siteName, siteUrl),
  });
  const text = await res.text();

  if (!res.ok) {
    console.error(`Ping 送信失敗: HTTP ${res.status} ${res.statusText}\n${text}`);
    process.exit(1);
  }

  // XML-RPC の応答: flerror=0 が成功・1 が失敗。<fault> はサーバ側エラー。
  const fault = /<fault>/.test(text);
  const flerror = /<name>\s*flerror\s*<\/name>\s*<value>\s*<boolean>\s*([01])/i.exec(text);
  const message = /<name>\s*message\s*<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/i.exec(text);
  const faultMsg = /<name>\s*faultString\s*<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/i.exec(text);

  if (fault || (flerror && flerror[1] === '1')) {
    console.error(`Ping は届いたがエラー応答: ${faultMsg?.[1] ?? message?.[1] ?? text.trim()}`);
    process.exit(1);
  }

  console.log(`✅ ブログ村へ Ping 送信: ${siteUrl}`);
  if (message?.[1]) console.log(`   応答: ${message[1].trim()}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
