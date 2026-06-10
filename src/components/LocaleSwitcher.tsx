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
    <div className="flex items-center gap-1 text-xs">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          className={`rounded px-2 py-1 ${
            l === locale ? 'bg-white text-mlbnavy' : 'text-white/70 hover:text-white'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
