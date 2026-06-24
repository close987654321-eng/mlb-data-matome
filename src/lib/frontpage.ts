import type { Thread } from '@/types/thread';
import type { Sport } from '@/lib/sports';

const key = (t: Thread) => `${t.sport}/${t.id}`;
const byNewest = (a: Thread, b: Thread) => b.fetchedAt.localeCompare(a.fetchedAt);

/**
 * トップの「本日の一面／編集部ピック」を選ぶ。手動優先＋自動フォールバック（2026-06-24 合意）。
 *  1. editorPick が立った記事を優先度（昇順）で出す＝編集の意思（競技を問わず最優先＝大一番の上書き用）。
 *  2. 足りなければ自動フォールバック。preferSport（既定 mlb）の記事を優先しつつコメント数降順で補う
 *     ＝サイトの主役 MLB を一面の既定にしながら、いま盛り上がっている記事を拾う。
 * これで手書き id の陳腐化（旧 PICKUP_THREADS の 2021 記事問題）を構造的に防ぎ、ゼロ運用日でも破綻しない。
 * すべて静的 JSON から決まる純関数＝SSG 維持・サイト本体は API を叩かない。
 */
export function getFrontPagePicks(threads: Thread[], count: number, preferSport: Sport = 'mlb'): Thread[] {
  const picked = threads
    .filter((t) => typeof t.editorPick === 'number')
    .sort((a, b) => a.editorPick! - b.editorPick! || byNewest(a, b));
  const pickedIds = new Set(picked.map(key));

  // フォールバック母集団＝新着上位 RECENT_POOL 件を「preferSport を先・次にコメント数降順」。
  // 「全期間のコメント数王者」を出すと毎回同じ古い記事が居座るので、直近に窓を切る。
  const RECENT_POOL = 40;
  const fallback = [...threads]
    .sort(byNewest)
    .slice(0, RECENT_POOL)
    .filter((t) => !pickedIds.has(key(t)))
    .sort((a, b) => {
      const ap = a.sport === preferSport ? 0 : 1;
      const bp = b.sport === preferSport ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return b.totalComments - a.totalComments;
    });

  const seen = new Set<string>();
  const out: Thread[] = [];
  for (const t of [...picked, ...fallback]) {
    const k = key(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= count) break;
  }
  return out;
}

/** ISO 日時 → "YYYY.M.D"（前ゼロ落とし）。Date を介さず文字列処理で TZ 事故を避ける。 */
export function issueDate(iso: string | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return '';
  return `${y}.${Number(m)}.${Number(d)}`;
}
