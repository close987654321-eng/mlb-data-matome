'use client';

import { Link, usePathname } from '@/lib/navigation';

/**
 * グローバルナビの1項目。現在地をアクティブ表示する（どのページにいるか一目で分かるように）。
 * アクティブ＝差し色(accent)＋太字、非アクティブ＝ink-soft。これまで「海外ファンと見る」だけ常時赤で
 * アクティブが判別できなかったのを、アクティブ項目だけ赤くする方式に統一して解消する。
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
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`transition-colors ${active ? 'font-semibold text-accent' : 'text-ink-soft hover:text-ink'} ${className}`}
    >
      {children}
    </Link>
  );
}
