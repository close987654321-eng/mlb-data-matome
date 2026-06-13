import StickyVideo from './StickyVideo';
import type { Thread, ThreadComment } from '@/types/thread';

type Props = {
  thread: Thread;
  comments: ThreadComment[]; // フック除外済み・配列順
  pickedLabel: string; // 「○○件から抜粋」の見出し
  hintLabel: string; // 動画下のスクロール案内
};

/**
 * 動画つき記事のデフォルト表示：動画を上部にピン留めし、その裏をコメントが流れていく。
 * 動画とコメントを同じ親（この section）の直下に縦並びで置くことで sticky を成立させる。
 */
export default function WatchAlong({ thread, comments, pickedLabel, hintLabel }: Props) {
  // コメントの出所で表示を変える: reddit=u/接頭辞+▲ / interview=名前のみ / youtube=名前そのまま+👍
  const isInterview = thread.format === 'interview';
  const isYoutube = thread.format === 'youtube';
  const authorLabel = (a: string) => (isInterview || isYoutube ? a : `u/${a}`);
  const scoreMark = isYoutube ? '👍' : '▲';
  return (
    <section className="mt-8">
      {thread.media && (
        <StickyVideo media={thread.media} sourceUrl={thread.sourceUrl} hintLabel={hintLabel} />
      )}

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
              <span className="font-medium">{authorLabel(c.author)}</span>
              {!isInterview && (
                <span className="tabular-nums">
                  {scoreMark} {c.score.toLocaleString()}
                </span>
              )}
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
