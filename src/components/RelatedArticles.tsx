import { getTranslations } from 'next-intl/server';
import { feedKey } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import { rankNextReads, reasonLabel, type Ranked } from '@/lib/nextRead';
import type { Thread } from '@/types/thread';
import type { Column } from '@/types/column';
import type { Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';

type Props = {
  locale: Locale;
  /**
   * 事前に計算済みの順位（記事詳細ページ用）。これを渡すと再計算しない＝多様性キャップが
   * 「次に読む」カードと関連枠で通算1回で効く（同一選手が card+grid で重複しない）。
   */
  ranked?: Ranked[];
  /** 未計算パス（コラムページ等）: currentKey/sport/currentTags から算出する。 */
  threads?: Thread[];
  columns?: Column[];
  currentKey?: string;
  sport?: Sport;
  currentTags?: string[];
  limit?: number;
};

/**
 * 記事ページ末尾の回遊導線。反応まとめ＋コラムを横断した新着フィードから、
 * nextRead の関連度（選手優先＋共有タグの IDF＋多様性キャップ）で数件出す。
 * 記事ページは元スレへ送るだけの行き止まりになりがちなので、ここで内部回遊を作る。
 * カードには「なぜ近いか」の理由チップ（同一選手／効いた共有タグ）を添える。
 */
export default async function RelatedArticles({
  ranked,
  threads,
  columns,
  currentKey,
  sport,
  currentTags,
  locale,
  limit = 4,
}: Props) {
  const t = await getTranslations();
  // 事前計算があればそれを使う（記事詳細）。無ければ current から算出（コラム等）。
  const items =
    ranked ??
    (currentKey && sport
      ? rankNextReads({
          current: { sport, key: currentKey, tags: currentTags },
          threads: threads ?? [],
          columns: columns ?? [],
          limit,
        })
      : []);
  if (items.length === 0) return null;

  return (
    <section className="mt-14 border-t border-line pt-10">
      <div className="mb-7 flex items-center gap-3">
        <span className="h-4 w-[2px] bg-ink" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
          {t('related.title')}
        </h2>
      </div>
      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
        {items.map(({ item, reason }) => {
          const label = reasonLabel(reason, locale, t as (key: string) => string);
          return (
            <li key={feedKey(item)}>
              {/* 強い根拠（同一選手・効いた共有タグ）だけ理由チップを出す。弱い根拠は出さない。 */}
              {label.strong && (
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                  {label.text}
                </span>
              )}
              <FeedCard item={item} locale={locale} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
