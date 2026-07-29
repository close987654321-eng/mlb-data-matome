import { createNavigation } from 'next-intl/navigation';
import { defaultLocale, locales } from './i18n';

// next-intl v4 で createSharedPathnamesNavigation が createNavigation に統合された
// （pathnames を渡さなければ従来の shared pathnames と同挙動）。
// defaultLocale は必須: as-needed は「default ロケールだけ prefix を省く」設定なので、
// これが無いと全ロケールに prefix が付き（href="/ja/..."）、middleware 側が 307 で
// prefix なしへ落とす＝内部リンク全部がリダイレクト経由になりクロール予算を二重消費する。
export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'as-needed',
});
