'use client';

import { useEffect, useRef } from 'react';
import { Link, usePathname } from '@/lib/navigation';

/**
 * グローバルナビの1項目。現在地をアクティブ表示する（どのページにいるか一目で分かるように）。
 * アクティブ＝濃いインク＋太字、非アクティブ＝ink-soft。色（赤）は誌面の一点に温存する方針なので、
 * 現在地はインクの濃淡だけで示す（無彩色）。
 * usePathname は next-intl 版でロケール接頭辞を含まない（ja=/player, en でも /player）。
 */
export default function NavLink({
  href,
  exact = false,
  className = '',
  children,
}: {
  href: string;
  /** 完全一致のみアクティブ（トップ "/" 用）。既定は前方一致（/player → /player/ohtani も含む）。 */
  exact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const ref = useRef<HTMLAnchorElement>(null);
  // 横スクロールのタブで現在地が画面の外にあると、どこにいるか分からない（スマホで「ストーブリーグ」が
  // 右端の外にあった）。親の横スクロールだけを動かして中央に寄せる。scrollIntoView はページの
  // 縦位置まで動かす（戻る操作で復元した位置を壊す）ので使わない。
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    let box = el.parentElement;
    while (box && box.scrollWidth <= box.clientWidth) box = box.parentElement;
    if (!box) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.left >= b.left && r.right <= b.right) return;
    box.scrollLeft += r.left - b.left - (b.width - r.width) / 2;
  }, [active]);
  return (
    <Link
      ref={ref}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`transition-colors ${active ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'} ${className}`}
    >
      {children}
    </Link>
  );
}
