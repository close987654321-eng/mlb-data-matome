import { scoreLabel, type ScoreKind } from '@/lib/scoreLabel';
import type { StoryBlock, ThreadComment } from '@/types/thread';

/**
 * 語り形式（story）の本文。「地の文 → 証言引用 → 一言チップ」のブロック列をそのまま描く
 * （編集ルールの正は matome R13）。jp-daily（きょうの日本人選手）と、事件性のある大一番・
 * 興行直後の通常記事（Thread.story）が共用する。
 *
 * score=0（票が未取得＝old.reddit がログイン壁の日など）は記号ごと出さない＝実測0票と
 * 区別がつかず、読者には不人気コメントに見えるため（値は捏造しないまま表示だけ落とす）。
 * scoreKind はコメントの出所で変わる（youtube=「いいね 1,869」/ reddit=「▲ 1,869」）。
 * interview のようにスコアを持たない出所では null＝スコアを描かない。
 */
export default function StoryBlocks({
  blocks,
  scoreKind = 'youtube',
  locale,
}: {
  blocks: StoryBlock[];
  /** 票数の数え方。null を渡すとスコア自体を出さない（interview 等）。 */
  scoreKind?: ScoreKind | null;
  /** 票数ラベルの言い方（ja=「いいね」/ en=「likes」）。 */
  locale: string;
}) {
  // 地の文・訳は en 面でも日本語＝html の lang="en" を打ち消して和文として組ませる（ja 面では継ぐ）。
  const jaLang = locale === 'ja' ? undefined : 'ja';
  return (
    <div className="mt-6 space-y-5">
      {blocks.map((b, i) => {
        if (b.type === 'p') {
          // 地の文は読み物の本体＝16px。行間は語りのゆとりを残して 1.9（コメント列の 1.8 より広い）。
          return (
            <p key={i} lang={jaLang} className="text-base leading-[1.9] text-ink">
              {b.text}
            </p>
          );
        }
        if (b.type === 'quote') {
          return <Quote key={i} comment={b.comment} scoreKind={scoreKind} locale={locale} />;
        }
        // chips: 短い一言を畳み掛ける（5chまとめのテンポ）。原文は JSON に保持・表示は訳＋スコアのみ。
        return (
          <ul key={i} className="flex flex-wrap gap-2">
            {b.comments.map((c, j) => (
              <li
                key={j}
                className="rounded-[3px] bg-surface px-3 py-1.5 text-sm text-ink ring-1 ring-line"
              >
                {/* 票数ラベルは面の言語（en なら likes）なので、lang="ja" は訳の部分にだけ付ける */}
                <span lang={jaLang}>“{c.bodyJa}”</span>
                {scoreKind && c.score > 0 && (
                  <span className="ml-1.5 text-xs tabular-nums text-ink-mute">
                    {scoreLabel(c.score, scoreKind, locale)}
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
function Quote({
  comment,
  scoreKind,
  locale,
}: {
  comment: ThreadComment;
  scoreKind: ScoreKind | null;
  locale: string;
}) {
  const jaLang = locale === 'ja' ? undefined : 'ja';
  return (
    <figure className="border-l-4 border-ink py-1 pl-5">
      <blockquote lang={jaLang} className="text-lg font-bold leading-relaxed text-ink">
        “{comment.bodyJa}”
      </blockquote>
      <figcaption className="mt-1.5 min-w-0 text-xs text-ink-soft [overflow-wrap:anywhere]">
        — {comment.author}
        {scoreKind && comment.score > 0 && (
          <>
            {' '}
            <span className="tabular-nums">{scoreLabel(comment.score, scoreKind, locale)}</span>
          </>
        )}
        {/* 原文（英語）は訳の補足。斜体はやめ（和文の中で読みにくい）、lang="en" で英語として組ませる。 */}
        {comment.bodyEn && (
          <span lang="en" className="mt-2 block text-[13px] leading-[1.6] text-ink-soft">
            {comment.bodyEn}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
