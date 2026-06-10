'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/lib/navigation';
import { locales, type Locale } from '@/lib/i18n';

export default function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(next: Locale) {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  return (
    <div className="flex items-center gap-0.5 text-xs">
      {locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="mx-1 text-line">/</span>}
          <button
            type="button"
            onClick={() => switchTo(l)}
            className={`transition-colors ${
              l === locale ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
