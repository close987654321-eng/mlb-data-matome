import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';

/**
 * サイトの 2 本柱（選手LPディレクトリ＝海外の反応の定点 / 選手成績＝数値の権威）への入口。
 * 左セルは旧 /watch から /browse へ差し替え（2026-08-01・村山指示）＝TOP の内部リンクも
 * 検索で上がってきた選手LP群へ集める（ヘッダーの watch→browse スワップと同じ配線）。
 * 角丸ボックスを並べる「ボタン感」をやめ、ヘアライン罫で仕切った雑誌の特集バンドにする。
 * gap-px + bg-line + 各セル bg-paper で、セル間に 1px 罫（縦/モバイルは横）を出す。
 * 枠は上下の border-y だけ。ホバーは bg-surface へ微かに持ち上げ＋矢印が進む程度に抑える。
 */
export default function TwoPillars({ browseCount, asOf }: { browseCount: number; asOf?: string }) {
  const t = useTranslations();
  return (
    <section className="grid gap-px overflow-hidden border-y border-line bg-line sm:grid-cols-2">
      <Link href="/browse" className="group bg-paper px-4 py-7 transition-colors hover:bg-surface sm:px-7">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-mute">
          Reactions
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-ink">
          {t('home.pillarBrowseTitle')}
        </h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
          {t('home.pillarBrowseLead')}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
          {t('home.pillarBrowseCount', { count: browseCount })}
          <span className="text-ink-soft transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </Link>
      <Link href="/player" className="group bg-paper px-4 py-7 transition-colors hover:bg-surface sm:px-7">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-mute">
          Stats
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-ink">{t('nav.players')}</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
          {t('home.pillarPlayerLead')}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
          {asOf ? t('player.asOf', { date: asOf }) : t('home.playersAll')}
          <span className="text-ink-soft transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </Link>
    </section>
  );
}
