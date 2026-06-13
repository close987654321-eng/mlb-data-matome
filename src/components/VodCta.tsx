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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink"
            >
              {watchLabel}
              <span aria-hidden>→</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
