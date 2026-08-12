import type { Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';
import { vodOffers } from '@/lib/vod';

// 記事下の VOD CTA。競技ごとの視聴サービスを案内する（収益化の器②）。
// ステマ規制（景表法）対応で「PR」を明示し、アフィリンクには rel="sponsored" を付ける。
// 提携前の案件は src/lib/vod.ts 側で非表示にできるので、ここはレンダリングに専念する。
export default function VodCta({
  sport,
  locale,
  heading,
  prLabel,
  watchLabel,
}: {
  sport: Sport;
  locale: Locale;
  heading: string;
  prLabel: string;
  watchLabel: string;
}) {
  const offers = vodOffers(sport);
  if (offers.length === 0) return null; // 提携前で出す案件が無ければ何も描かない

  return (
    <aside className="mt-12 rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{heading}</h2>
        <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
          {prLabel}
        </span>
      </div>
      <ul className="space-y-3">
        {offers.map((o) => (
          <li
            key={o.service}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{o.service}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{o.pitch[locale]}</p>
            </div>
            <a
              href={o.href}
              target="_blank"
              rel="noopener nofollow sponsored"
              // バリューコマース（アマプラ／もしも経由のスカパー!も実体は VC）のタグ仕様。既定の
              // strict-origin だと参照元URLが落ちて成果計測を取りこぼす。
              referrerPolicy="no-referrer-when-downgrade"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[3px] bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
            >
              {/* VC の 1x1 インプレッション計測。元タグどおりリンク内に置く（表示数が計上されないと EPC が読めない）。
                  loading="lazy" は必須＝React 19 は SSR した <img> を <head> で preload するため、
                  外すとピクセルが preload と img で2回発火してインプレッションが二重計上され CTR が半分に見える。
                  遅延読み込みなら「CTA まで実際にスクロールした人」だけが分母になり、数字がそのまま判断に使える。 */}
              {o.impressionPixel && (
                // eslint-disable-next-line @next/next/no-img-element -- 計測ピクセルは next/image で最適化してはいけない
                <img src={o.impressionPixel} alt="" width={1} height={1} loading="lazy" aria-hidden />
              )}
              {watchLabel}
              <span aria-hidden>→</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
