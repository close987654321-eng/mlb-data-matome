/**
 * カード素材（顔写真・チームロゴ）のローカルキャッシュを温める。
 *
 *   node scripts/warm-card-art.mjs [--force] [追加のMLB選手ID...]
 *
 * なぜ必要か: クラウド無人実行（毎日16:00 JST の jp-daily 便）の環境は egress ポリシーで
 * MLB の CDN（img.mlbstatic.com / www.mlbstatic.com）を 403 で弾くことがあり、2026-08-01・08-02 は
 * それで2日連続カードが作れず日次シリーズが止まった。素材を repo に置いておけば CDN に届かない
 * 環境でも同じ絵が出る＝無人運用が止まらない。jp-daily-card.mjs はここに置いたファイルを
 * 「CDN より先に」読む（取れた素材は自動でここに書き足される）。
 *
 * 取る対象:
 *  - 顔写真 … src/lib/players.ts の mlbId（日本人＋ライバル）＋ 引数で足したID
 *  - ロゴ  … src/lib/teams.ts の全球団ID
 * どちらもカタログが唯一の正なので、選手・球団を足したらここを走らせ直すだけでよい。
 *
 * 法務 posture は本体と同じ＝MLB公式の顔写真・ロゴを「記事/カードの引用の範囲」で使う運用を
 * 変えるものではない。取得元・使い道は同じで、取得のタイミングだけを前倒しする。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const CACHE_DIR = path.join(process.cwd(), 'public', 'media', 'card-art');
const force = process.argv.includes('--force');
const extraIds = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);

const headshotUrl = (id) => `https://img.mlbstatic.com/mlb-photos/image/upload/w_500,q_auto:best/v1/people/${id}/headshot/silo/current`;
const logoUrl = (teamId) => `https://www.mlbstatic.com/team-logos/${teamId}.svg`;

async function catalogIds(file, re) {
  const src = await fs.readFile(path.join(process.cwd(), file), 'utf8');
  return [...new Set([...src.matchAll(re)].map((m) => Number(m[1])))];
}

async function warm(name, url, label) {
  const dest = path.join(CACHE_DIR, name);
  if (!force) {
    try {
      const st = await fs.stat(dest);
      if (st.size > 0) return { name, label, status: 'skip' };
    } catch { /* 未取得＝これから取る */ }
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length) break;
        await fs.writeFile(dest, buf);
        return { name, label, status: 'ok', bytes: buf.length };
      }
      if (res.status === 404) return { name, label, status: 'missing' }; // その素材が無い＝リトライ無意味
    } catch { /* ネットワーク断・タイムアウト */ }
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 700));
  }
  return { name, label, status: 'fail' };
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const playerIds = [...new Set([
    ...(await catalogIds('src/lib/players.ts', /mlbId:\s*(\d+)/g)),
    ...extraIds,
  ])];
  const teamIds = await catalogIds('src/lib/teams.ts', /^\s{2}[^\s:]+:\s*\{\s*id:\s*(\d+),/gm);

  console.log(`カード素材キャッシュ → ${path.relative(process.cwd(), CACHE_DIR)}`);
  console.log(`  顔写真 ${playerIds.length}人 / ロゴ ${teamIds.length}球団${force ? '（--force: 既存も取り直す）' : ''}`);

  const jobs = [
    ...playerIds.map((id) => () => warm(`headshot-${id}.png`, headshotUrl(id), `顔写真 ${id}`)),
    ...teamIds.map((id) => () => warm(`team-${id}.svg`, logoUrl(id), `ロゴ ${id}`)),
  ];

  // CDN への同時接続は控えめに（相手に負荷をかけない・レート制限を踏まない）。
  const results = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    results.push(...await Promise.all(jobs.slice(i, i + CONCURRENCY).map((j) => j())));
  }

  const by = (s) => results.filter((r) => r.status === s);
  const bytes = by('ok').reduce((a, r) => a + r.bytes, 0);
  console.log(`  ✓ 取得 ${by('ok').length}点（${(bytes / 1024 / 1024).toFixed(1)}MB）/ 既存 ${by('skip').length}点`);
  for (const r of [...by('missing'), ...by('fail')]) {
    console.error(`  × ${r.label}（${r.status === 'missing' ? '公式に素材なし' : '取得失敗＝CDN に届いていない'}）`);
  }
  if (by('fail').length) {
    console.error('  → 通常ネットワークの端末で走らせ直すこと（クラウド実行環境からは 403 で弾かれる）。');
    process.exit(3);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
