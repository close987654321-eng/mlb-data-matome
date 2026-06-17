#!/usr/bin/env node
/**
 * ブログランキング各社へ更新 Ping を送る（記事を公開したら即・新着一覧に載せるため）。
 *
 * 送信先（どちらも標準の weblogUpdates.ping＝XML-RPC を受け付ける）:
 *   - にほんブログ村        … BLOGMURA_PING_URL
 *   - 人気ブログランキング  … WITH2_PING_URL（blog.with2.net/ping.php/...）
 *   設定された送信先だけに送る。両方未設定ならエラー終了。
 *
 * なぜ手動スクリプトか:
 *   このサイトは Next.js + Vercel の静的サイトで、WordPress のように公開時へ自動で
 *   Ping を投げる仕組みが無い。デプロイ完了後にこのコマンドを 1 回叩いて通知する。
 *   各社側で「Ping送信/記事反映」を有効化＋RSS(feed.xml)登録しておくこと。
 *
 * 認証:
 *   環境変数 BLOGMURA_PING_URL / WITH2_PING_URL（あなた専用の Ping 送信先。半分
 *   パスワードなので公開リポジトリには出さない）。.env.local に書けば自動で読む。
 *
 * 使い方:
 *   node scripts/ping-blogmura.mjs
 *     → サイト名・サイト URL で weblogUpdates.ping を各社へ送り、結果を表示する。
 *
 * 任意の上書き（既定値で困らなければ不要）:
 *   SITE_NAME            ランキングに登録した表示名（既定: 下記 DEFAULT_SITE_NAME）
 *   NEXT_PUBLIC_SITE_URL サイトの絶対 URL（既定: https://matome-mlb-kaigai.jp）
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_SITE_NAME = '海外の反応 — MLB / ボクシング / MMA';
const DEFAULT_SITE_URL = 'https://matome-mlb-kaigai.jp';

/** 送信先一覧（環境変数名と表示名）。設定されているものだけ送る。 */
const PING_TARGETS = [
  { env: 'BLOGMURA_PING_URL', label: 'にほんブログ村' },
  { env: 'WITH2_PING_URL', label: '人気ブログランキング' },
];

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

/** 1 送信先へ Ping を投げ、成功/失敗を返す（throw せず結果を返して全件試す） */
async function sendPing({ label, pingUrl, siteName, siteUrl }) {
  try {
    const res = await fetch(pingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=UTF-8', 'User-Agent': 'matome-ping/1.0' },
      body: buildPingBody(siteName, siteUrl),
    });
    const text = await res.text();

    if (!res.ok) {
      return { ok: false, label, detail: `HTTP ${res.status} ${res.statusText}\n${text.trim()}` };
    }

    // XML-RPC の応答: flerror=0 が成功・1 が失敗。<fault> はサーバ側エラー。
    const fault = /<fault>/.test(text);
    const flerror = /<name>\s*flerror\s*<\/name>\s*<value>\s*<boolean>\s*([01])/i.exec(text);
    const message = /<name>\s*message\s*<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/i.exec(text);
    const faultMsg = /<name>\s*faultString\s*<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/i.exec(text);

    if (fault || (flerror && flerror[1] === '1')) {
      return { ok: false, label, detail: faultMsg?.[1]?.trim() ?? message?.[1]?.trim() ?? text.trim() };
    }

    return { ok: true, label, detail: message?.[1]?.trim() ?? null };
  } catch (err) {
    return { ok: false, label, detail: err.message ?? String(err) };
  }
}

async function main() {
  const siteName = loadEnv('SITE_NAME') ?? DEFAULT_SITE_NAME;
  const siteUrl = (loadEnv('NEXT_PUBLIC_SITE_URL') ?? DEFAULT_SITE_URL).replace(/\/$/, '');

  const targets = PING_TARGETS.map((t) => ({ ...t, pingUrl: loadEnv(t.env) })).filter(
    (t) => t.pingUrl,
  );

  if (targets.length === 0) {
    console.error(
      'Ping 送信先が未設定。 .env.local に少なくとも 1 つ書く（あなた専用 URL・公開しない）:\n' +
        '  BLOGMURA_PING_URL=https://ping.blogmura.com/xmlrpc/xxxxxxxx/\n' +
        '  WITH2_PING_URL=https://blog.with2.net/ping.php/xxxxxxx/xxxxxxxxxx',
    );
    process.exit(1);
  }

  const results = await Promise.all(
    targets.map((t) => sendPing({ label: t.label, pingUrl: t.pingUrl, siteName, siteUrl })),
  );

  for (const r of results) {
    if (r.ok) {
      console.log(`✅ ${r.label} へ Ping 送信: ${siteUrl}${r.detail ? `\n   応答: ${r.detail}` : ''}`);
    } else {
      console.error(`❌ ${r.label} へ Ping 失敗: ${r.detail}`);
    }
  }

  // 1 件でも失敗したら非ゼロ終了（CI/手順で気付けるように）
  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
