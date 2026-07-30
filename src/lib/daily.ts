import type { Thread, ThreadComment, StoryBlock } from '@/types/thread';

/** ブロック列（地の文＋引用＋一言チップ）から実在コメントだけを取り出す。 */
function blockComments(blocks: StoryBlock[]): ThreadComment[] {
  return blocks.flatMap((b) =>
    b.type === 'quote' ? [b.comment] : b.type === 'chips' ? b.comments : [],
  );
}

/**
 * 記事の全コメント（掲載順）。
 *
 * 日次記事（jp-daily）はコメントを本文ブロック（主役の物語・短評・ざわつき）の中に持つので、
 * thread.comments は空になる。件数を数える・フックを拾うといった「記事横断の処理」は必ずここを
 * 通す＝ thread.comments を直接見ると、日次記事だけコメント0件として扱われる
 * （noindex 判定・関連記事の引用・タグLPの声）。
 */
export function allComments(thread: Thread): ThreadComment[] {
  const d = thread.daily;
  if (d) {
    return [
      ...blockComments(d.hero.blocks),
      ...d.shorts.flatMap((s) => s.quotes ?? []),
      ...(d.buzz ? blockComments(d.buzz.blocks) : []),
    ];
  }
  // 語り形式の通常記事（matome R13）＝コメントは story ブロックが持つ。
  if (thread.story) return blockComments(thread.story);
  return thread.comments;
}
