#!/usr/bin/env node
/**
 * 貼ってあるアフィリエイトリンクの「死活検査」。
 *
 * なぜ要るか: 2026-08-20、もしも経由のスカパー!リンクが **404「無効な広告リンク」** になっているのを
 * 別件のついでに発見した。mma記事66本＋/mma LP＋/rizin5 が壊れた PR 枠を出したままで、8/27 の
 * PPV 発売直前だった。ASP は提携終了・広告差し替え・広告主都合の停止を**こちらに通知しない**ので、
 * 公開時に正しかったリンクは黙って死ぬ。動画の経年劣化を check-dead-videos.mjs が見ているのと同じ理由で、
 * **収益に直結するリンクこそ定期的に叩いて生死を見る**（気づかなければ収益ゼロのまま流れ続ける）。
 *
 * 使い方:
 *   node scripts/check-affiliate-links.mjs            # 検査してレポート（終了コード 0）
 *   node scripts/check-affiliate-links.mjs --strict   # 死んでいるリンクがあれば終了コード 1
 *   node scripts/check-affiliate-links.mjs --json     # 機械可読
 *
 * ⚠️ このスクリプトは ASP のクリック計測エンドポイントを実際に叩く＝レポートにクリックが載りうる。
 * だから **User-Agent で自分がボットだと名乗る**（ASP 側のボット除外に引っかかるのが正しい姿）。
 * 週1回・数本だけに留めること。人間のブラウザを騙る UA は使わない＝成果の水増しに見えるため。
 *
 * 判定の根拠（2026-08-20 に実測した各社の応答）:
 *   - バリューコマース `ck.jp.ap.valuecommerce.com/servlet/referral`
 *       200 + 本文に `VIEW_URL`（着地URL）と `ITRACK_INFO`（pid+広告ID）が埋まっていれば生存。
 *       ついでに**着地URLと広告IDも出す**＝広告主がLPを差し替えて訴求とズレた場合に気づける。
 *   - もしも `af.moshimo.com/af/c/click` … 死ぬと 404 + 本文「無効な広告リンク」
 *   - A8 `px.a8.net/svt/ejp` … 生きていれば 302 で広告主ドメインへ飛ぶ
 *   - それ以外（提携前に置いてある公式URL等）… 4xx/5xx でなければ生存
 *     ただし 403/405/429 は**ボット拒否と区別できない**ので「判定不能」にする（誤報を出さないため）。
 *
 * 検出後の手当て:
 *   1. まず ASP 管理画面で提携状態と広告の有無を確認する（勝手に別リンクへ差し替えない）
 *   2. 代替リンクがあるなら src/lib/vod.ts の href を差し替え
 *   3. 無いなら `href: null` にする＝vodOffers が落として CTA ごと非表示になる安全弁がある。
 *      **壊れたリンクを出し続けるより消すほうがマシ**（読者を404に送らない）
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const VOD_TS = path.join(ROOT, 'src', 'lib', 'vod.ts');
const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const AS_JSON = argv.includes('--json');

// 人間のふりをしない＝ASP のボット除外に正しく引っかかるための UA。
const UA =
  'matome-affiliate-linkcheck/1.0 (+https://matome-mlb-kaigai.jp; weekly liveness check; not a user click)';

/** アフィリエイトの計測ドメイン。ASP を増やしたらここに足す（拾い漏れると黙って死ぬ）。 */
const AFFILIATE_HOSTS = [
  'ck.jp.ap.valuecommerce.com', // バリューコマース（クリック）
  'ad.jp.ap.valuecommerce.com', // バリューコマース（1x1 インプレッション計測）
  'px.a8.net', // A8.net
  'af.moshimo.com', // もしもアフィリエイト
  'h.accesstrade.net', // アクセストレード（将来用）
  't.afi-b.com', // afb（将来用）
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * 検査対象のURLを集める。
 * ①src 配下の全 .ts/.tsx から、既知のアフィ計測ドメインの直リンク
 * ②vod.ts の vcTag('pid') / vcPixel('pid')（ヘルパ経由なので文字列としては現れない）
 * ③vod.ts の href 全部（提携前に置いてある公式URLも読者の行き先＝死んだら404に送ってしまう）
 */
function collectLinks() {
  const found = new Map(); // url -> { url, refs: [{file, line}] }
  const add = (url, file, line) => {
    const rel = path.relative(ROOT, file);
    const hit = found.get(url) ?? { url, refs: [] };
    // 同じ行が2つの正規表現に当たることがある（直リンクと href: の両方）ので重複は畳む。
    if (!hit.refs.some((r) => r.file === rel && r.line === line)) hit.refs.push({ file: rel, line });
    found.set(url, hit);
  };

  const vodSrc = readFileSync(VOD_TS, 'utf8');
  const sid = vodSrc.match(/const VC_SID = '(\d+)'/)?.[1];

  for (const file of walk(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      const line = i + 1;
      // ① 直リンク
      for (const m of text.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        const url = m[0].replace(/[.,]$/, '');
        // vcTag/vcPixel の定義そのもの（`…pid=${pid}`）はテンプレートで、リンクではない。
        if (url.includes('${')) continue;
        try {
          if (AFFILIATE_HOSTS.includes(new URL(url).host)) add(url, file, line);
        } catch {
          /* URL に見えて解析できないものは無視 */
        }
      }
      // ② VC ヘルパ経由（vcTag/vcPixel は pid だけを引数に取る）
      if (sid) {
        for (const m of text.matchAll(/vcTag\('(\d+)'\)/g)) {
          add(`https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${sid}&pid=${m[1]}`, file, line);
        }
        for (const m of text.matchAll(/vcPixel\('(\d+)'\)/g)) {
          add(`https://ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=${sid}&pid=${m[1]}`, file, line);
        }
      }
      // ③ vod.ts の href（提携前の公式URLを含む）
      if (file === VOD_TS) {
        const m = text.match(/href: '(https?:\/\/[^']+)'/);
        if (m) add(m[1], file, line);
      }
    });
  }
  return [...found.values()];
}

/** 1本を叩いて判定する。戻り値の status は 'alive' | 'dead' | 'unknown'。 */
async function check(url) {
  const host = new URL(url).host;
  let res;
  try {
    // リダイレクトは追わない＝A8 の 302 先（広告主ドメイン）そのものを判定材料にするため。
    res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': UA } });
  } catch (e) {
    return { url, host, status: 'unknown', note: `到達できず (${e.message})` };
  }
  const code = res.status;
  const location = res.headers.get('location');

  if (host === 'ck.jp.ap.valuecommerce.com') {
    const body = await res.text().catch(() => '');
    const view = body.match(/VIEW_URL=([^&"']+)/)?.[1];
    // ITRACK_INFO = 0 + pid(9桁) + 広告ID(8桁) + 日時。広告IDが読めると「どの広告のpidか」が分かる。
    const adId = body.match(/ITRACK_INFO=\d(\d{9})(\d{8})/)?.[2]?.replace(/^0+/, '');
    if (code === 200 && view) {
      const landing = decodeURIComponent(view);
      return { url, host, status: 'alive', note: `広告${adId ?? '?'} → ${landing}` };
    }
    return { url, host, status: 'dead', note: `VC が着地URLを返さない (HTTP ${code})` };
  }

  if (host === 'af.moshimo.com') {
    const body = await res.text().catch(() => '');
    if (code === 404 || body.includes('無効な広告リンク')) {
      return { url, host, status: 'dead', note: 'もしも「無効な広告リンク」' };
    }
    return { url, host, status: code < 400 ? 'alive' : 'dead', note: `HTTP ${code}` };
  }

  if (host === 'px.a8.net') {
    if (code >= 300 && code < 400 && location) {
      const dest = new URL(location, url).host;
      // 広告主ドメインへ飛べば生存。a8 内で完結する 302 はエラー面の可能性が高い。
      if (dest !== host) return { url, host, status: 'alive', note: `→ ${dest}` };
      return { url, host, status: 'dead', note: `a8 内で完結する転送 (${location})` };
    }
    return { url, host, status: 'dead', note: `転送されない (HTTP ${code})` };
  }

  // 計測ピクセルと、提携前に置いてある公式URL。
  if (code === 403 || code === 405 || code === 429) {
    // ボット拒否と本当の死は区別できない。誤報を出さず「人が見る」に倒す。
    return { url, host, status: 'unknown', note: `HTTP ${code}（ボット拒否の可能性・要目視）` };
  }
  return { url, host, status: code < 400 ? 'alive' : 'dead', note: `HTTP ${code}` };
}

async function main() {
  const links = collectLinks();
  const results = [];
  for (const link of links) {
    const r = await check(link.url);
    results.push({ ...r, refs: link.refs });
    // ASP に連打をかけない（週1・数本の検査なので十分すぎるが礼儀として）。
    await new Promise((r2) => setTimeout(r2, 300));
  }

  const dead = results.filter((r) => r.status === 'dead');
  const unknown = results.filter((r) => r.status === 'unknown');

  if (AS_JSON) {
    console.log(JSON.stringify({ checked: results.length, dead, unknown, results }, null, 2));
  } else {
    console.log(`アフィリエイトリンク ${results.length}本を検査\n`);
    for (const r of results) {
      const mark = r.status === 'alive' ? '○' : r.status === 'dead' ? '×' : '?';
      console.log(`${mark} ${r.url}`);
      console.log(`    ${r.note}`);
      console.log(`    ${r.refs.map((x) => `${x.file}:${x.line}`).join(', ')}`);
    }
    console.log('');
    if (!dead.length) console.log('死んでいるリンクは無し');
    else {
      console.log(`死亡: ${dead.length}本 ← 手当ての手順はこのファイル冒頭のコメント`);
      console.log('（ASP管理画面で提携状態を確認 → 代替リンクに差し替え、無ければ href: null で非表示に）');
    }
    if (unknown.length) console.log(`判定不能: ${unknown.length}本（ボット拒否の可能性・目視で確認）`);
  }

  if (STRICT && dead.length) process.exit(1);
}

await main();
