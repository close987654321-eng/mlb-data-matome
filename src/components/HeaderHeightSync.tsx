'use client';

import { useEffect } from 'react';

/**
 * sticky ヘッダーの実寸を --header-h に書き戻す（描画なし・ResizeObserver 1個）。
 *
 * globals.css の --header-h はマークアップから積み上げた設計値で、SSR と初回描画の既定値として使う。
 * ただし 640〜719px（スマホ横向き・小さめのタブレット）ではデスクトップ用ナビが1行に収まらず
 * 項目名が折り返し、ヘッダーが設計値より高くなる（ja で 79px・en で 73〜93px。設計値は 65px）。
 * 設計値のままだとアンカー着地（scroll-padding）と固定した動画がヘッダーの下に潜るので、
 * 実際の高さを測って上書きする。フォント反映・言語切替・回転による高さの変化にも追従する。
 * サイトヘッダー（layout.tsx の SiteHeader）はページ内で最初の <header>＝PlayerStickyBar と同じ取り方。
 */
export default function HeaderHeightSync() {
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty('--header-h', `${Math.round(header.getBoundingClientRect().height)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => {
      ro.disconnect();
      // 外したら CSS の設計値に戻す（インライン指定を残さない）
      root.style.removeProperty('--header-h');
    };
  }, []);

  return null;
}
