import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { RIZIN5 } from '@/lib/rizin5';

/**
 * 超RIZIN.5 特設ハブへの導線バナー（/mma LP と RIZIN タグ記事に出す）。
 * 会期後は rizin5.ts の enabled=false でサイト全体から自動で消える。
 */
export default async function Rizin5Promo() {
  if (!RIZIN5.enabled) return null;
  const t = await getTranslations();
  return (
    <section className="border border-ink p-5">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
        {t('rizin5.eyebrow')}
      </span>
      <h2 className="mt-1 text-lg font-bold text-ink">{RIZIN5.nameJa}</h2>
      <p className="mt-1 max-w-prose text-sm text-ink-soft">{t('rizin5.promoLead')}</p>
      <p className="mt-3">
        <Link
          href="/rizin5"
          className="inline-flex items-center gap-1.5 rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
        >
          {t('rizin5.promoCta')} <span aria-hidden>→</span>
        </Link>
      </p>
    </section>
  );
}
