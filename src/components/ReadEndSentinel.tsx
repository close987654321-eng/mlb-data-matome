'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

/**
 * 読了の番兵。本文（コメント列・語り・コラム本文）の直後に置き、画面に入った瞬間に GA4 の
 * read_end を1回だけ送る。GA4 拡張計測の scroll（90%）はフッター込みのページ最下部が基準で
 * 「本文を読み終えたか」を測れないため、本文の終わりそのものを基準にする。
 * IntersectionObserver は実際に表示されたときだけ発火する＝先読み（prefetch）では送られない。
 * 送ったら即 disconnect（戻りスクロールで二重計上しない）。
 */
export default function ReadEndSentinel({
  id,
  category,
  format,
}: {
  /** 記事（コラム）ID */
  id: string;
  /** 競技（mlb / boxing / mma / npb） */
  category: string;
  /** 本文の形式（watch_along / reddit / youtube / interview / story / daily / column） */
  format: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      track('read_end', { article_id: id, category, format });
    });
    io.observe(el);
    return () => io.disconnect();
  }, [id, category, format]);

  return <div ref={ref} aria-hidden="true" className="h-px" />;
}
