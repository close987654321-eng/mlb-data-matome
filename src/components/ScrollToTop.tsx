'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * 一定スクロールで現れる「上に戻る」ボタン。watch-along 等の長い記事の離脱を減らす。
 * 全ページ共通（layout に置く）。スクロール量が少ないページでは出ない。
 */
export default function ScrollToTop() {
  const t = useTranslations();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('scrollTop')}
      title={t('scrollTop')}
      className="fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper/90 text-ink shadow-lg backdrop-blur transition-colors hover:bg-accent hover:text-paper"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path d="M12 5l7 7-1.4 1.4L13 8.8V20h-2V8.8l-4.6 4.6L5 12z" fill="currentColor" />
      </svg>
    </button>
  );
}
