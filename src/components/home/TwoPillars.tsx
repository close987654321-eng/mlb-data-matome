import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';

/**
 * サイトの 2 本柱（海外ファンと見る＝体験 / 選手成績＝数値の権威）への入口。
 * 角丸ボックスを並べる「ボタン感」をやめ、ヘアライン罫で仕切った雑誌の特集バンドにする。
 * gap-px + bg-line + 各セル bg-paper で、セル間に 1px 罫（縦/モバイルは横）を出す。
 * 枠は上下の border-y だけ。ホバーは bg-surface へ微かに持ち上げ＋矢印が進む程度に抑える。
 */
export default function TwoPillars({ watchCount, asOf }: { watchCount: number; asOf?: string }) {
  const t = useTranslations();
  return (
    <section className="grid gap-px overflow-hidden border-y border-line bg-line sm:grid-cols-2">
      <Link href="/watch" className="group bg-paper px-4 py-7 transition-colors hover:bg-surface sm:px-7">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          <span aria-hidden>▶</span> Watch-Along
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">{t('nav.watch')}</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
          {t('home.pillarWatchLead')}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
          {t('watch.count', { count: watchCount })}
          <span className="text-accent transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </Link>
      <Link href="/player" className="group bg-paper px-4 py-7 transition-colors hover:bg-surface sm:px-7">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          <span aria-hidden>📊</span> Stats
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">{t('nav.players')}</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
          {t('home.pillarPlayerLead')}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
          {asOf ? t('player.asOf', { date: asOf }) : t('home.playersAll')}
          <span className="text-accent transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </Link>
    </section>
  );
}
