import { NextResponse } from 'next/server';

/**
 * 外部スケジューラ（Vercel Cron 等）から叩く「成績スナップショット更新」キック。
 *
 * なぜルート経由で GitHub を起動するのか:
 *  - GitHub Actions の `schedule` トリガーはベストエフォートで大量に間引かれ、毎時のはずが
 *    1日2〜3回しか発火しない（refresh-stats.yml）。一方 `workflow_dispatch` 起動は間引かれず即実行される。
 *  - そこで「信頼できる外部スケジューラ → このルート → 既存ワークフローを workflow_dispatch」で起動する。
 *  - MLB/Savant API を叩く処理は GitHub Actions 側に残る＝「サイト本体(Next.jsランタイム)は API を叩かない」
 *    （CLAUDE.md §4.1）の方針を保ったまま、ここはトークン付きの dispatch を1回投げるだけ。
 *  - 既存の取得・差分コミット・Savant ロジックを 100% 再利用する（このルートは取得も整形もしない）。
 *
 * 必要な環境変数（Vercel に設定）:
 *  - CRON_SECRET       … 呼び出しの認証。Vercel Cron は自動で `Authorization: Bearer <CRON_SECRET>` を送る。
 *                        外部 cron（cron-job.org 等）から叩く場合も同じヘッダを付ける。
 *  - GH_DISPATCH_TOKEN … GitHub の fine-grained PAT。対象リポジトリへ「Actions: Read and write」権限。
 *  - （任意）GH_OWNER / GH_REPO / GH_WORKFLOW / GH_REF で対象を上書き可（既定は本リポジトリ）。
 */

export const dynamic = 'force-dynamic'; // 常に実行（静的化させない）
export const runtime = 'nodejs';

const OWNER = process.env.GH_OWNER ?? 'close987654321-eng';
const REPO = process.env.GH_REPO ?? 'mlb-data-matome';
const WORKFLOW = process.env.GH_WORKFLOW ?? 'refresh-stats.yml';
const REF = process.env.GH_REF ?? 'main';

export async function GET(request: Request) {
  // 認証: CRON_SECRET 未設定なら誰でも叩けてしまうので fail-closed（500）。
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'GH_DISPATCH_TOKEN is not configured' }, { status: 500 });
  }

  // 既存ワークフローを workflow_dispatch で起動（schedule と違い間引かれない）。成功は 204。
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'matome-mlb-kaigai-cron',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: REF }),
    },
  );

  if (res.status === 204) {
    return NextResponse.json({ ok: true, dispatched: `${WORKFLOW}@${REF}` });
  }
  // 失敗は本文を添えて返す（トークン権限・ワークフロー名・ref の取り違えをすぐ切り分けられるように）。
  const detail = await res.text().catch(() => '');
  return NextResponse.json(
    { ok: false, status: res.status, error: detail.slice(0, 500) },
    { status: 502 },
  );
}
