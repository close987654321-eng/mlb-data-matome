import { Link } from '@/lib/navigation';

type Door = { href: string; eyebrow: string; title: string; body: string };

/**
 * ストーブリーグのページ群への入口（入口ページ /stove-league から各ページへ）。
 *
 * 2026-11-10 に、1枚で受けていた検索を語ごとのページへ分けた（FAランキング＝/stove-league/fa、
 * メジャー挑戦＝/prospects）。分けたぶん、入口から1タップで行ける札を見出しのすぐ下に置く。
 * 文言はそのページが答える問いを、いまの数字つきで書く（page.tsx が data から組んで渡す）。
 */
export default function StoveDoors({ doors, label }: { doors: Door[]; label: string }) {
  if (!doors.length) return null;
  return (
    <nav aria-label={label} className="grid gap-3 sm:grid-cols-2">
      {doors.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          className="group flex items-center justify-between gap-3 border border-line bg-surface px-4 py-3.5 transition-colors hover:border-ink"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-mute">{d.eyebrow}</span>
            <span className="mt-1 block text-[15px] font-bold leading-snug text-ink">{d.title}</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{d.body}</span>
          </span>
          <span aria-hidden className="shrink-0 text-ink-mute transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      ))}
    </nav>
  );
}
