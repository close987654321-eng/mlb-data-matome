'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 縦に長い選手ページの“現在地”を示す凝縮ミニヘッダ。唯一のクライアント島（<1KB・IO 1個）。
 * ヒーロー帯直後の番兵(sentinel)が画面上に消えたら出す。fixed なので非表示時にレイアウトの隙間を作らない。
 * サイトヘッダ(z-20)の規約 top-[96px] sm:top-16 に合わせ z-10 で潜らせ、本物のヘッダと喧嘩させない。
 */
export default function PlayerStickyBar({
  name,
  heroLabel,
  heroValue,
  dotAccent,
}: {
  name: string;
  heroLabel: string;
  heroValue: string;
  dotAccent: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px w-full" />
      <div
        aria-hidden="true"
        data-stuck={stuck ? 'true' : 'false'}
        className="fixed inset-x-0 top-[96px] z-10 border-b border-line bg-paper/90 backdrop-blur transition-[opacity,transform] duration-200 motion-reduce:transition-none data-[stuck=false]:pointer-events-none data-[stuck=false]:-translate-y-1 data-[stuck=false]:opacity-0 data-[stuck=true]:translate-y-0 data-[stuck=true]:opacity-100 sm:top-16"
      >
        <div className="mx-auto flex h-11 max-w-5xl items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dotAccent ? 'bg-accent' : 'bg-ink-soft'}`} />
            <span className="truncate text-sm font-bold text-ink">{name}</span>
          </div>
          <div className="flex shrink-0 items-baseline gap-1.5">
            <span className="text-[11px] text-ink-soft">{heroLabel}</span>
            <span className="text-sm font-bold tabular-nums text-ink">{heroValue}</span>
          </div>
        </div>
      </div>
    </>
  );
}
