import MediaEmbed from './MediaEmbed';
import type { Thread, ThreadComment } from '@/types/thread';

type Props = {
  thread: Thread;
  comments: ThreadComment[]; // フック除外済み・配列順（＝試合の時系列）
  pickedLabel: string; // 「○○件から抜粋」の見出し
  hintLabel: string; // 動画下のスクロール案内
};

/**
 * 「動画を見ながらコメントだけスクロール」する特別レイアウト（watch-along）。
 * - 動画を画面上部に sticky でピン留めし、その裏をコメントが時系列で流れていく。
 * - sticky が効くよう、動画とコメントは同じ親（この section）の直下に縦並びで置く。
 *   動画ラッパは bg-paper + z-10 で、スクロールしたコメントがその背後にきれいに隠れる。
 * - top オフセットはグローバルの sticky ヘッダー高（モバイル ~96px / sm+ ~64px）に合わせる。
 */
export default function WatchAlong({ thread, comments, pickedLabel, hintLabel }: Props) {
  return (
    <section className="mt-8">
      {/* 動画：上部にピン留め。ヘッダーのすぐ下に収まるよう top を合わせる。 */}
      <div className="sticky top-[96px] z-10 -mx-2 bg-paper px-2 pb-3 pt-1 sm:top-16">
        {thread.media && <MediaEmbed media={thread.media} sourceUrl={thread.sourceUrl} />}
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent">
          <span aria-hidden>▶</span>
          {hintLabel}
        </p>
      </div>

      {/* コメント：動画の裏を試合の時系列順に流れる。 */}
      <h2 className="mb-4 mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
        <span className="h-3 w-1 rounded-full bg-accent" />
        {pickedLabel}
      </h2>
      <ul className="space-y-4">
        {comments.map((c, i) => (
          <li
            key={i}
            className={`rounded-xl border p-5 ${
              c.isHighlight ? 'border-accent/30 bg-accent/[0.04]' : 'border-line bg-surface'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-ink-soft">
              <span className="font-medium">u/{c.author}</span>
              <span className="tabular-nums">▲ {c.score.toLocaleString()}</span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">{c.bodyJa}</p>
            <p className="mt-2 border-t border-line/70 pt-2 text-xs italic leading-relaxed text-ink-soft">
              {c.bodyEn}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
