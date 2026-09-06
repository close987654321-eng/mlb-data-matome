import { bdReelStock } from '@/lib/bdReel';

/**
 * オーディションマラソン（BdReel）の列の在庫。
 *
 * ⚠️ **ページに埋めない**。94本ぶんの動画とコメントを RSC ペイロードに乗せると
 * BD イベントページだけ +117KB（RSC は日本語を \uXXXX で書き出す）＝リールを開かない人にも
 * 毎回運ばせることになる。4号店の `/reel.json` と同じで、**開いたときに初めて読む**。
 *
 * これはデータであってページではない: sitemap に載せない・noindex を返す
 * （薄い自動生成面の posture＝CLAUDE.md §4.2+）。
 */
export const dynamic = 'force-static';

export async function GET() {
  // 1ファイルを全大会で共有する＝素の列だけを返し、今大会を先頭に置く並べ替えはクライアントが行う。
  const data = await bdReelStock();
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-robots-tag': 'noindex',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });
}
