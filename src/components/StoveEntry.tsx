import { Link } from '@/lib/navigation';
import { getPlayer } from '@/lib/players';
import { getStoveLeague, stoveActive } from '@/lib/stoveLeague';
import type { Locale } from '@/lib/i18n';

/**
 * ストーブリーグ（/stove-league）への入口。オフの間（stove-league.json の activeUntil まで）だけ出る。
 *
 * なぜ要るか: 公開直後のレビューで、ハブへのリンクが TOP・/mlb・FAの反応記事・NEXT MLB の選手LP から
 * 0件だった（入口は選手クラスタのタブだけ）。記事で「鈴木誠也 FA」に着地した人も、TOP に来た人も、
 * ハブの存在に気づけない。文言は「いま誰がFAか」を名前で出す＝読者の問いをそのまま入口にする。
 */
export default async function StoveEntry({ locale, className = '' }: { locale: Locale; className?: string }) {
  const cat = await getStoveLeague();
  if (!cat || !stoveActive(cat)) return null;
  const en = locale === 'en';
  const names = cat.japanese
    .filter((j) => !j.outcome)
    .map((j) => getPlayer(j.slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 3)
    .map((p) => (en ? p.nameEn : p.nameJa));
  const off = `${cat.season}-${String((cat.season + 1) % 100).padStart(2, '0')}`;
  return (
    <Link
      href="/stove-league"
      className={`group flex items-center justify-between gap-3 border border-line bg-surface px-4 py-3.5 transition-colors hover:border-ink ${className}`}
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-mute">
          {en ? `Hot stove ${off}` : `ストーブリーグ ${off}`}
        </span>
        <span className="mt-1 block text-sm font-semibold leading-snug text-ink">
          {en
            ? `${names.join(', ')}: where the Japanese players go, the top 30 free agents and the calendar`
            : `${names.join('・')}らの去就、FA注目選手${cat.board.length}人、日程と海外の反応`}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-ink-mute transition-transform group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
