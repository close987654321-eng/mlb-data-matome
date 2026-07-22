import { useTranslations } from 'next-intl';
import ThreadCard from '@/components/ThreadCard';
import SectionHeading from '@/components/SectionHeading';
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
          <SectionHeading
            label={z.label}
            count={z.count}
            seeAllHref={`/${z.sport}`}
            // アンカーテキストに「{競技}の海外の反応まとめ」を含める＝/{sport} LP（sportHub）へ
            // 検索フレーズ一致の内部リンクを張り、トップに集中している「◯◯ 海外の反応」クエリの
            // 受け皿として LP を押し上げる（GSC実測 2026-07-22: /mlb LP は表示ゼロ）
            seeAllLabel={t('home.seeAllSport', { label: z.label })}
            lead={z.lead}
          />
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
