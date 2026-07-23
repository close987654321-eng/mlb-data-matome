import { createNavigation } from 'next-intl/navigation';
import { locales } from './i18n';

// next-intl v4 で createSharedPathnamesNavigation が createNavigation に統合された
// （pathnames を渡さなければ従来の shared pathnames と同挙動）。
export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales: [...locales],
  localePrefix: 'as-needed',
});
