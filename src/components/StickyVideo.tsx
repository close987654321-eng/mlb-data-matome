import MediaEmbed from './MediaEmbed';
import type { ThreadMedia } from '@/types/thread';

type Props = {
  media: ThreadMedia;
  sourceUrl: string;
  hintLabel: string; // 動画下のスクロール案内
};

/**
 * 「動画を見ながら本文（コメント／コラム）だけスクロール」用の、上部ピン留め動画。
 * - 動画を画面上部に sticky で固定し、その裏を後続コンテンツが流れていく。
 * - sticky が効くよう、これと後続コンテンツは同じ親の直下に縦並びで置くこと。
 *   bg-paper + z-10 で、スクロールした本文が動画の背後にきれいに隠れる。
 * - top はグローバルの sticky ヘッダー高に合わせる（モバイル ~96px / sm+ ~64px）。
 */
export default function StickyVideo({ media, sourceUrl, hintLabel }: Props) {
  return (
    <div className="sticky top-[96px] z-10 -mx-2 bg-paper px-2 pb-3 pt-1 sm:top-16">
      <MediaEmbed media={media} sourceUrl={sourceUrl} />
      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent">
        <span aria-hidden>▶</span>
        {hintLabel}
      </p>
    </div>
  );
}
