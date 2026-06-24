import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import ThreadCard from '@/components/ThreadCard';
import type { Thread } from '@/types/thread';
import type { Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';

export type SportZone = {
  sport: Sport;
  label: string;
  emoji: string;
  count: number; // その競技の総記事数（在庫量を実数で見せる）
  threads: Thread[]; // 表示する最新 N 件
  lead?: boolean; // 主役競技（MLB）。見出しを一段大きく＋枠を多めに取り「MLB が主役」を視覚化する
};

/**
 * 競技別ゾーン。並び順は sports.ts（SoT）で MLB を先頭・主役（lead）として大きく出す。
 * 主役の MLB は枠数も見出しも一段大きく、ボクシング/MMA はそれぞれ専用ゾーンを必ず持たせる
 * ＝「MLB を強調しつつ少数競技も埋もれさせない」両立。ゾーン頭に件数バッジ＋「すべて見る →」で一覧へ送客。
 */
export default function SportZones({ zones, locale }: { zones: SportZone[]; locale: Locale }) {
  const t = useTranslations();
  return (
    <div className="space-y-12">
      {zones.map((z) => (
        <section key={z.sport} className="space-y-5">
          <div className="flex items-center gap-3">
            <span className={`${z.lead ? 'h-6' : 'h-4'} w-1 rounded-full bg-accent`} />
            <h2
              className={`font-bold uppercase tracking-wider text-ink ${
                z.lead ? 'text-lg sm:text-xl' : 'text-sm font-semibold'
              }`}
            >
              <span aria-hidden className="mr-1">
                {z.emoji}
              </span>
              {z.label}
            </h2>
            <span className="text-xs text-ink-soft">{z.count}</span>
            <Link
              href={`/${z.sport}`}
              className="ml-auto text-xs font-medium text-accent transition-colors hover:text-accent-ink"
            >
              {t('home.seeAll')} →
            </Link>
          </div>
          <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {z.threads.map((th) => (
              <li key={`${th.sport}/${th.id}`}>
                <ThreadCard thread={th} locale={locale} showSport={false} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
