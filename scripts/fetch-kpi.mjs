#!/usr/bin/env node
/**
 * 週次 KPI 取得（kpi-weekly スキルの取得エンジン）。
 * GA4 Data API と Search Console API をサービスアカウント（読み取り専用）で叩き、
 * 「今週 vs 先週」の数字を1つの JSON にまとめる。依存ゼロ（Node 18+ の fetch / crypto のみ）。
 *
 * 使い方:
 *   node scripts/fetch-kpi.mjs weekly           # 人間向けサマリ（設定確認・手動実行用）
 *   node scripts/fetch-kpi.mjs weekly --json    # kpi-weekly スキルが読む構造化 JSON
 *   node scripts/fetch-kpi.mjs sites            # サービスアカウントが見える GSC サイト一覧（設定検証用）
 *
 * 必要な env（.env.local か環境変数。クラウド定期実行はシークレット登録）:
 *   GA4_PROPERTY_ID                  … GA4 管理→プロパティ設定の数値 ID（G- で始まる測定IDではない）
 *   GOOGLE_APPLICATION_CREDENTIALS   … サービスアカウント JSON キーのファイルパス（ローカル向け）
 *   GOOGLE_SERVICE_ACCOUNT_JSON      … JSON 文字列そのもの（1行で置ける環境向け）
 *   GOOGLE_SERVICE_ACCOUNT_JSON_B64  … 上の base64（改行を含められない環境向け。3つのうちどれか1つ）
 *   GSC_SITE                         … 省略時 sc-domain:matome-mlb-kaigai.jp
 *
 * 法務メモ: 自サイトの計測データを自分で読むだけ（Google の各 API 利用規約の通常利用）。
 * サイト本体（Next.js ランタイム）からは叩かない＝CLAUDE.md §4.1 と同じ posture。
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import path from 'node:path';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
].join(' ');
const CARD_EVENTS = ['card_open', 'card_share', 'card_copy', 'card_copy_image'];

/** .env.local から拾う（dotenv 依存を増やさない簡易版。fetch-youtube.mjs と同じ流儀） */
function loadEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const m = env.match(new RegExp(`^${name}=(.+)$`, 'm'));
    // 値を引用符で囲んでいても動くように剥がす
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    /* .env.local が無ければ環境変数のみ */
  }
  return null;
}

function loadServiceAccount() {
  const b64 = loadEnv('GOOGLE_SERVICE_ACCOUNT_JSON_B64');
  if (b64) return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  const raw = loadEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (raw) return JSON.parse(raw);
  const file = loadEnv('GOOGLE_APPLICATION_CREDENTIALS');
  if (file) return JSON.parse(readFileSync(file, 'utf8'));
  return null;
}

/** サービスアカウントで OAuth2 アクセストークンを取る（JWT Bearer フロー） */
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
    iss: sa.client_email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(sa.private_key, 'base64url');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).access_token;
}

async function apiPost(token, url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url.split('?')[0]} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** JST の暦日で offsetDays 日前の YYYY-MM-DD */
function jstDate(offsetDays) {
  return new Date(Date.now() + 9 * 3600e3 + offsetDays * 86400e3)
    .toISOString()
    .slice(0, 10);
}

// ---------------------------------------------------------------- GA4

async function ga4Report(token, propertyId, body) {
  return apiPost(
    token,
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    body,
  );
}

/**
 * 2 dateRanges のレポートを {this:{...}, prev:{...}} の行マップに整形。
 * GA4 は複数 dateRanges 指定時に dateRange 次元（date_range_0=1つ目, date_range_1=2つ目）を
 * 自動付与する。位置は決め打ちせず名前で探す。万一付与されない場合（次元なしレポートの
 * 仕様ブレ保険）は行順で 0=this, 1=prev とみなす。
 */
function splitRanges(report, dimName) {
  const out = { this: {}, prev: {} };
  const dims = (report.dimensionHeaders ?? []).map((d) => d.name);
  const rangeIdx = dims.indexOf('dateRange');
  const keyIdx = dimName ? dims.indexOf(dimName) : -1;
  const rows = report.rows ?? [];
  for (const [i, row] of rows.entries()) {
    const range =
      rangeIdx >= 0
        ? row.dimensionValues[rangeIdx].value === 'date_range_1'
          ? 'prev'
          : 'this'
        : !dimName && rows.length === 2 && i === 1
          ? 'prev'
          : 'this';
    const key = keyIdx >= 0 ? row.dimensionValues[keyIdx].value : '_total';
    // 同キーは合算（例: playerPages を pagePath 行で受けて合計する用途）
    const vals = row.metricValues.map((m) => Number(m.value));
    const prev = out[range][key];
    out[range][key] = prev ? prev.map((v, j) => v + vals[j]) : vals;
  }
  return out;
}

async function fetchGa4(token, propertyId, win, warnings) {
  const dateRanges = [
    { startDate: win.this.start, endDate: win.this.end },
    { startDate: win.prev.start, endDate: win.prev.end },
  ];
  const metricNames = (names) => names.map((name) => ({ name }));

  // レポートは独立に取り、1つの失敗で全体を道連れにしない（取れた分だけで出す）
  const reports = {
    totals: {
      dateRanges,
      metrics: metricNames(['sessions', 'totalUsers', 'screenPageViews', 'engagementRate']),
    },
    channels: {
      dateRanges,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: metricNames(['sessions']),
      limit: 20,
    },
    sources: {
      dateRanges,
      dimensions: [{ name: 'sessionSource' }],
      metrics: metricNames(['sessions']),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 30,
    },
    // utm_source=card は上位30位に入らない規模でも正確に取るため専用レポートで拾う
    cardSessions: {
      dateRanges,
      dimensions: [{ name: 'sessionSource' }],
      metrics: metricNames(['sessions']),
      dimensionFilter: {
        filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'EXACT', value: 'card' } },
      },
    },
    topPages: {
      dateRanges: [dateRanges[0]],
      dimensions: [{ name: 'pagePath' }],
      metrics: metricNames(['screenPageViews']),
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    },
    // フィルタ対象の次元は明示的に要求し、行を合算する（次元なしフィルタの仕様に依存しない）
    playerPages: {
      dateRanges,
      dimensions: [{ name: 'pagePath' }],
      metrics: metricNames(['screenPageViews', 'userEngagementDuration']),
      dimensionFilter: {
        filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/player' } },
      },
      limit: 10000,
    },
    cardEvents: {
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: metricNames(['eventCount']),
      dimensionFilter: {
        filter: { fieldName: 'eventName', inListFilter: { values: CARD_EVENTS } },
      },
    },
  };

  const names = Object.keys(reports);
  const settled = await Promise.allSettled(
    names.map((n) => ga4Report(token, propertyId, reports[n])),
  );
  const got = {};
  names.forEach((n, i) => {
    if (settled[i].status === 'fulfilled') got[n] = settled[i].value;
    else warnings.push(`GA4 ${n} 取得失敗: ${settled[i].reason?.message ?? settled[i].reason}`);
  });
  if (Object.keys(got).length === 0) return null;

  const num = (rows, key, i = 0) => rows?.[key]?.[i] ?? 0;
  const sumRows = (m) => {
    // pagePath 行の合算値（splitRanges が同キー合算するのは同一キーのみなので、ここで全行を足す）
    let views = 0;
    let engaged = 0;
    for (const vals of Object.values(m ?? {})) {
      views += vals[0];
      engaged += vals[1];
    }
    return { views, avgEngagedSec: views ? Math.round(engaged / views) : 0 };
  };

  const totalRows = got.totals ? splitRanges(got.totals) : null;
  const cardRows = got.cardSessions ? splitRanges(got.cardSessions, 'sessionSource') : null;
  const playerRows = got.playerPages ? splitRanges(got.playerPages, 'pagePath') : null;

  return {
    totals: totalRows
      ? {
          this: {
            sessions: num(totalRows.this, '_total', 0),
            users: num(totalRows.this, '_total', 1),
            pageViews: num(totalRows.this, '_total', 2),
            engagementRate: num(totalRows.this, '_total', 3),
          },
          prev: {
            sessions: num(totalRows.prev, '_total', 0),
            users: num(totalRows.prev, '_total', 1),
            pageViews: num(totalRows.prev, '_total', 2),
            engagementRate: num(totalRows.prev, '_total', 3),
          },
        }
      : null,
    channels: got.channels ? splitRanges(got.channels, 'sessionDefaultChannelGroup') : null,
    sources: got.sources ? splitRanges(got.sources, 'sessionSource') : null,
    cardSessions: cardRows
      ? { this: num(cardRows.this, 'card'), prev: num(cardRows.prev, 'card') }
      : null,
    topPages: got.topPages
      ? (got.topPages.rows ?? []).map((r) => ({
          path: r.dimensionValues[0].value,
          views: Number(r.metricValues[0].value),
        }))
      : null,
    playerPages: playerRows
      ? { this: sumRows(playerRows.this), prev: sumRows(playerRows.prev) }
      : null,
    cardEvents: got.cardEvents ? splitRanges(got.cardEvents, 'eventName') : null,
  };
}

// ---------------------------------------------------------------- GSC

async function gscQuery(token, site, body) {
  return apiPost(
    token,
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    body,
  );
}

function gscTotals(res) {
  const row = res.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    position: row?.position ? Math.round(row.position * 10) / 10 : null,
  };
}

async function fetchGsc(token, site, win, warnings) {
  // Discover は type: 'discover'（現行 Search Console API。searchType は非推奨エイリアス）
  const range = (w) => ({ startDate: w.start, endDate: w.end, dataState: 'all' });
  const queries = {
    webThis: { ...range(win.this), type: 'web' },
    webPrev: { ...range(win.prev), type: 'web' },
    discThis: { ...range(win.this), type: 'discover' },
    discPrev: { ...range(win.prev), type: 'discover' },
    topQueries: { ...range(win.this), type: 'web', dimensions: ['query'], rowLimit: 10 },
    discPages: { ...range(win.this), type: 'discover', dimensions: ['page'], rowLimit: 5 },
  };
  const names = Object.keys(queries);
  const settled = await Promise.allSettled(names.map((n) => gscQuery(token, site, queries[n])));
  const got = {};
  names.forEach((n, i) => {
    if (settled[i].status === 'fulfilled') got[n] = settled[i].value;
    else warnings.push(`GSC ${n} 取得失敗: ${settled[i].reason?.message ?? settled[i].reason}`);
  });
  if (Object.keys(got).length === 0) return null;

  return {
    web:
      got.webThis || got.webPrev
        ? { this: gscTotals(got.webThis ?? {}), prev: gscTotals(got.webPrev ?? {}) }
        : null,
    discover:
      got.discThis || got.discPrev
        ? { this: gscTotals(got.discThis ?? {}), prev: gscTotals(got.discPrev ?? {}) }
        : null,
    topQueries: got.topQueries
      ? (got.topQueries.rows ?? []).map((r) => ({
          query: r.keys[0],
          clicks: r.clicks,
          impressions: r.impressions,
        }))
      : null,
    discoverPages: got.discPages
      ? (got.discPages.rows ?? []).map((r) => ({
          page: r.keys[0],
          clicks: r.clicks,
          impressions: r.impressions,
        }))
      : null,
  };
}

// ---------------------------------------------------------------- main

function setupGuide(missing) {
  return [
    `KPI 取得に必要な設定が足りない: ${missing.join(' / ')}`,
    '',
    'セットアップ手順（初回のみ・詳細は .claude/skills/kpi-weekly/references/setup.md）:',
    '  1. Google Cloud Console でサービスアカウントを作り JSON キーを保存',
    '     （API: Google Analytics Data API と Google Search Console API を有効化）',
    '  2. GA4 管理→プロパティのアクセス管理 に service account のメールを「閲覧者」で追加',
    '  3. Search Console 設定→ユーザーと権限 に同じメールを「制限付き」で追加',
    '  4. .env.local に GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json と GA4_PROPERTY_ID=数値 を書く',
  ].join('\n');
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const asJson = rest.includes('--json');

  const sa = loadServiceAccount();
  const propertyId = loadEnv('GA4_PROPERTY_ID');
  const site = loadEnv('GSC_SITE') ?? 'sc-domain:matome-mlb-kaigai.jp';

  const missing = [];
  if (!sa) missing.push('サービスアカウント（GOOGLE_APPLICATION_CREDENTIALS 等）');
  if (!propertyId) missing.push('GA4_PROPERTY_ID');

  if (cmd === 'sites') {
    if (!sa) {
      console.error(setupGuide(missing));
      process.exit(1);
    }
    const token = await getAccessToken(sa);
    const res = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
      headers: { authorization: `Bearer ${token}` },
    });
    console.log(JSON.stringify(await res.json(), null, 2));
    return;
  }

  if (cmd !== 'weekly') {
    console.error('usage: node scripts/fetch-kpi.mjs weekly [--json] | sites');
    process.exit(1);
  }
  if (!sa) {
    console.error(setupGuide(missing));
    process.exit(1);
  }

  // 集計窓: GA4 は昨日までの7日間。GSC は反映遅延があるので3日前終わりの7日間。
  const win = {
    ga4: {
      this: { start: jstDate(-7), end: jstDate(-1) },
      prev: { start: jstDate(-14), end: jstDate(-8) },
    },
    gsc: {
      this: { start: jstDate(-9), end: jstDate(-3) },
      prev: { start: jstDate(-16), end: jstDate(-10) },
    },
  };

  const warnings = [];
  const token = await getAccessToken(sa);

  let ga4 = null;
  if (propertyId) {
    try {
      ga4 = await fetchGa4(token, propertyId, win.ga4, warnings);
    } catch (e) {
      warnings.push(`GA4 取得失敗: ${e.message}`);
    }
  } else {
    warnings.push('GA4_PROPERTY_ID 未設定のため GA4 をスキップ');
  }

  let gsc = null;
  try {
    gsc = await fetchGsc(token, site, win.gsc, warnings);
  } catch (e) {
    warnings.push(`GSC 取得失敗（site=${site}）: ${e.message}`);
  }
  if (!gsc || warnings.some((w) => w.startsWith('GSC') && /403|404/.test(w))) {
    warnings.push(
      'GSC が 403/404 の場合はサイト表記ズレの可能性。`node scripts/fetch-kpi.mjs sites` で登録済み一覧を確認',
    );
  }

  if (!ga4 && !gsc) {
    console.error(warnings.join('\n'));
    process.exit(1);
  }

  const out = { generatedAt: new Date().toISOString(), window: win, ga4, gsc, warnings };

  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  // 人間向けサマリ（設定確認・手動実行用の最小表示。整形と考察は kpi-weekly スキルの仕事）
  const pct = (a, b) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : 'n/a');
  console.log(`# KPI ${win.ga4.this.start}〜${win.ga4.this.end}（先週比）`);
  if (ga4?.totals) {
    const t = ga4.totals;
    console.log(
      `GA4: sessions ${t.this.sessions} (${pct(t.this.sessions, t.prev.sessions)}) / ` +
        `PV ${t.this.pageViews} (${pct(t.this.pageViews, t.prev.pageViews)}) / ` +
        `card経由 ${ga4.cardSessions?.this ?? 'n/a'}`,
    );
  }
  if (ga4?.sources) {
    const top = Object.entries(ga4.sources.this)
      .sort((a, b) => b[1][0] - a[1][0])
      .slice(0, 5)
      .map(([s, v]) => `${s}:${v[0]}`)
      .join(' ');
    console.log(`流入源Top5: ${top}`);
  }
  if (gsc?.web) {
    console.log(
      `GSC web: click ${gsc.web.this.clicks} (${pct(gsc.web.this.clicks, gsc.web.prev.clicks)}) / ` +
        `imp ${gsc.web.this.impressions}`,
    );
  }
  if (gsc?.discover) {
    console.log(
      `GSC Discover: click ${gsc.discover.this.clicks} / imp ${gsc.discover.this.impressions}` +
        (gsc.discover.this.impressions > 0 ? ' ← 着火の兆候あり' : '（未点火）'),
    );
  }
  for (const w of warnings) console.log(`⚠️ ${w}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
