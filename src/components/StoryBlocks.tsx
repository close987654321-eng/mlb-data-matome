import type { StoryBlock, ThreadComment } from '@/types/thread';

/**
 * 語り形式（story）の本文。「地の文 → 証言引用 → 一言チップ」のブロック列をそのまま描く
 * （編集ルールの正は matome R13）。jp-daily（きょうの日本人選手）と、事件性のある大一番・
 * 興行直後の通常記事（Thread.story）が共用する。
 *
 * scoreMark はコメントの出所で変わる（youtube=👍 / reddit=▲）。interview のようにスコアを
 * 持たない出所では省略＝スコアを描かない。
 */
export default function StoryBlocks({
  blocks,
  scoreMark = '👍',
}: {
  blocks: StoryBlock[];
  /** スコアの記号。null を渡すとスコア自体を出さない（interview 等）。 */
  scoreMark?: string | null;
}) {
  return (
    <div className="mt-6 space-y-5">
      {blocks.map((b, i) => {
        if (b.type === 'p') {
          return (
            <p key={i} className="text-[15px] leading-[1.9] text-ink">
              {b.text}
            </p>
          );
        }
        if (b.type === 'quote') {
          return <Quote key={i} comment={b.comment} scoreMark={scoreMark} />;
        }
        // chips: 短い一言を畳み掛ける（5chまとめのテンポ）。原文は JSON に保持・表示は訳＋スコアのみ。
        return (
          <ul key={i} className="flex flex-wrap gap-2">
            {b.comments.map((c, j) => (
              <li
                key={j}
                className="rounded-[3px] bg-surface px-3 py-1.5 text-sm text-ink ring-1 ring-line"
              >
                “{c.bodyJa}”
                {scoreMark && (
                  <span className="ml-1.5 text-xs tabular-nums text-ink-mute">
                    {scoreMark}
                    {c.score.toLocaleString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

/** コメントの大きめ引用。地の文の「証言」として立たせる（原文併記＝翻訳の透明性）。 */
function Quote({ comment, scoreMark }: { comment: ThreadComment; scoreMark: string | null }) {
  return (
    <figure className="border-l-4 border-ink py-1 pl-5">
      <blockquote className="text-lg font-bold leading-relaxed text-ink">
        “{comment.bodyJa}”
      </blockquote>
      <figcaption className="mt-1.5 text-xs text-ink-soft">
        — {comment.author}
        {scoreMark && (
          <>
            {' '}
            <span className="tabular-nums">
              {scoreMark}
              {comment.score.toLocaleString()}
            </span>
          </>
        )}
        {comment.bodyEn && (
          <span className="mt-1 block italic leading-relaxed text-ink-mute">{comment.bodyEn}</span>
        )}
      </figcaption>
    </figure>
  );
}
