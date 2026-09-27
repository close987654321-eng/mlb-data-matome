'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/** ページ全体がこの画面数より短ければ出さない（短いページで戻る必要は無い）。 */
const LONG_PAGE_SCREENS = 4;
/** この画面数より上（読み始めの近く）では出さない。 */
const DEEP_SCREENS = 1.5;
/** 指の揺れで出たり消えたりしないよう、これ未満の移動は向きの判定に使わない。 */
const DIRECTION_SLOP_PX = 6;

/**
 * 「上に戻る」ボタン。全ページ共通（layout に置く）。
 *
 * 常時表示だと本文の右端に重なり続け、読んでいる行を隠す。なので「戻りたい」意図が見えたときだけ出す:
 * ページが長い（画面4枚超）× 十分に読み進めた（画面1.5枚より下）× いま上へスクロールしている。
 * 下へ読み進めている間と、上端の近くでは引っ込める。
 * - scroll は passive リスナー1本を requestAnimationFrame で間引く（1フレーム1回だけ読む）
 * - 出し入れは opacity / transform だけ（レイアウトを動かさない）。動きを減らす設定では遷移なし
 * - iPhone の下端（ホームインジケータ）・横向きの切り欠きを safe-area で避ける
 */
export default function ScrollToTop() {
  const t = useTranslations();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let goingUp = false;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const dy = y - lastY;
      if (Math.abs(dy) >= DIRECTION_SLOP_PX) {
        goingUp = dy < 0;
        lastY = y;
      }
      const vh = window.innerHeight;
      const isLong = document.documentElement.scrollHeight > vh * LONG_PAGE_SCREENS;
      const isDeep = y > vh * DEEP_SCREENS;
      setShow(isLong && isDeep && goingUp);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function scrollTop() {
    // 動きを減らす設定の人には一瞬で戻す（長いページを数秒かけて滑らせない）。
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label={t('scrollTop')}
      title={t('scrollTop')}
      // 隠れている間はフォーカスも受けない（見えないボタンにタブ移動させない）。
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-30 flex h-11 w-11 items-center justify-center rounded-[2px] border border-line bg-paper/90 text-ink shadow-lg backdrop-blur transition-[opacity,transform] duration-200 hover:bg-ink-soft hover:text-paper motion-reduce:transition-none ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path d="M12 5l7 7-1.4 1.4L13 8.8V20h-2V8.8l-4.6 4.6L5 12z" fill="currentColor" />
      </svg>
    </button>
  );
}
