'use client';

import { useEffect, useState } from 'react';
import MediaEmbed from './MediaEmbed';
import type { ThreadMedia } from '@/types/thread';

type Props = {
  media: ThreadMedia;
  sourceUrl: string;
  hintLabel: string; // 動画下のスクロール案内（再生後のみ出す）
  unpinLabel: string; // ピン留めをやめる
  pinLabel: string; // ピン留めに戻す
};

// 「動画は固定しない」を回遊中も覚えておく（記事をまたいで効く。タブを閉じたらリセット）。
const PREF_KEY = 'matome:video-unpinned';

/**
 * 動画つき記事の上部プレイヤー。
 *
 * ピン留めは「見ながらコメントを読む」ための機能なので、**再生した人にだけ**適用する。
 * このサイトの主役はコメントで、動画を見ない読者（検索・SNS から本文だけ読みに来た人）が
 * 大多数。彼らにとって固定プレイヤーは画面（モバイルではヘッダー込みで可視領域の半分）を
 * 恒久的に奪うだけの邪魔者で、しかも閉じる手段が無かった＝2026-07-30 に 2号店の読者から
 * "how the f do you close the video and just look at the comments" と指摘された。
 * - 未再生: 通常フロー（＝スクロールすれば普通に流れて消える）。案内文も出さない。
 * - 再生後: 画面上部に sticky 固定し、その裏をコメントが流れる（従来の watch-along）。
 * - 再生後でも ✕ で固定解除でき、その選択は sessionStorage で回遊中も維持する。
 *
 * sticky が効くよう、これと後続コンテンツは同じ親の直下に縦並びで置くこと。
 * bg-paper + z-10 で、スクロールした本文が動画の背後にきれいに隠れる。
 * top はグローバルの sticky ヘッダー高に合わせる（モバイル ~96px / sm+ ~64px）。
 */
export default function StickyVideo({ media, sourceUrl, hintLabel, unpinLabel, pinLabel }: Props) {
  const [played, setPlayed] = useState(false);
  const [pinned, setPinned] = useState(true);

  // 保存済みの好みは hydration 後に読む（サーバー描画と初期HTMLを一致させる）。
  useEffect(() => {
    if (sessionStorage.getItem(PREF_KEY) === '1') setPinned(false);
  }, []);

  function setPinnedPref(next: boolean) {
    setPinned(next);
    if (next) sessionStorage.removeItem(PREF_KEY);
    else sessionStorage.setItem(PREF_KEY, '1');
  }

  const isSticky = played && pinned;

  return (
    // padding は両状態で同じ＝固定に切り替わった瞬間に本文が跳ねない。
    <div
      className={`-mx-2 bg-paper px-2 pb-3 pt-1 ${isSticky ? 'sticky top-[96px] z-10 sm:top-16' : ''}`}
    >
      <MediaEmbed media={media} sourceUrl={sourceUrl} onVideoActivate={() => setPlayed(true)} />

      {/* 操作行は再生後だけ。未再生の読者に「動画を見ながら」を前提した案内を出さない。 */}
      {played && (
        <div className="mt-2 flex items-center gap-3 text-xs font-medium">
          {pinned ? (
            <>
              <p className="flex items-center gap-1.5 text-ink-soft">
                <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
                {hintLabel}
              </p>
              <button
                type="button"
                onClick={() => setPinnedPref(false)}
                className="ml-auto flex items-center gap-1 text-ink-soft underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
              >
                <span aria-hidden>✕</span>
                {unpinLabel}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setPinnedPref(true)}
              className="ml-auto flex items-center gap-1 text-ink-soft underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
            >
              <span aria-hidden>⇧</span>
              {pinLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
