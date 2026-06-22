/**
 * next/image のカスタムローダ。Vercel の画像最適化（/_next/image・従量課金）を**通さず**、
 * 各 CDN の直リンクを src/srcset に出す。
 *
 * 理由: Vercel の無料枠（5,000 変換/月）を使い切ると optimizer が 402
 * （OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED）を返し、YouTube サムネ・カード・ロゴまで
 * **サイト全体の画像が一斉に壊れる**。更新頻度の高い本サイトでは枠が尽きやすいので、
 * 最適化を Vercel に依存せず各 CDN に任せる（恒久的に無料・枠なし）。
 *
 *  - ローカル（/ 始まり）・i.ytimg.com・i.redd.it・i.imgur.com … そのまま直配信。
 *    YouTube サムネは hqdefault(480)/maxresdefault(1280) など固定サイズなので width は無視。
 *  - images.unsplash.com … Unsplash 自身の無料 CDN でリサイズ（w/q を要求幅に上書き）。
 *    Vercel を使わずに応答サイズを最適化できる（auto=format で WebP/AVIF も自動）。
 */
export default function imageLoader({ src, width, quality }) {
  if (src.startsWith('/')) return src; // ローカル public/ 配下はそのまま
  try {
    const u = new URL(src);
    if (u.hostname === 'images.unsplash.com') {
      u.searchParams.set('w', String(width));
      u.searchParams.set('q', String(quality ?? 70));
      u.searchParams.set('auto', 'format');
      return u.toString();
    }
  } catch {
    // 相対パスや不正 URL はそのまま返す
  }
  return src; // ytimg / redd.it / imgur など固定サイズCDNは直リンク（width 不問）
}
