import Image from 'next/image';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads, getThread } from '@/lib/data';
import { getAllColumns, getColumn } from '@/lib/columns';
import { buildFeed, feedKey } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import PickupSection from '@/components/PickupSection';
import type { Locale } from '@/lib/i18n';

// TOP に大きく出す「ピックアップ」。手動キュレーション（id 指定）。
const PICKUP_THREADS: { sport: 'mlb'; id: string }[] = [
  { sport: 'mlb', id: '2021-07-02-ohtani-29-30-walsh-walkoff' },
  { sport: 'mlb', id: '2026-06-10-why-no-second-ohtani' },
];
const PICKUP_COLUMNS = ['2026-06-11-freddie-freeman-2500-hits'];

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const [threads, columns, pickThreads, pickColumns] = await Promise.all([
    getAllThreads(),
    getAllColumns(),
    Promise.all(PICKUP_THREADS.map((p) => getThread(p.sport, p.id))),
    Promise.all(PICKUP_COLUMNS.map((id) => getColumn(id))),
  ]);
  // 新着は反応まとめとコラムを横断で混ぜ、日付順で出す（コラム専用ページは廃止）。
  const feed = buildFeed(threads, columns);
  const [featured, ...rest] = feed;
  // 取得できなかった id（リネーム等）は黙って除外する。
  const pickedThreads = pickThreads.filter((x): x is NonNullable<typeof x> => x != null);
  const pickedColumns = pickColumns.filter((x): x is NonNullable<typeof x> => x != null);
  const hasPickup = pickedThreads.length + pickedColumns.length > 0;

  return (
    <div className="space-y-12">
      <section className="border-b border-line pb-8">
        {/* メインビジュアル（ブランドのキービジュアル） */}
        <Image
          src="/logo.png"
          alt={t('site.title')}
          width={1358}
          height={428}
          priority
          className="mb-7 h-auto w-full max-w-xl"
        />
        <h1 className="text-3xl font-bold leading-tight text-ink sm:text-5xl">
          {t('home.heroTitle')}
        </h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-soft sm:text-base">
          {t('home.heroBody')}
        </p>
      </section>

      {hasPickup && (
        <PickupSection threads={pickedThreads} columns={pickedColumns} locale={locale} />
      )}

      {feed.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          {t('threads.empty')}
        </p>
      ) : (
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="h-4 w-1 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
              {t('home.latest')}
            </h2>
          </div>

          {featured && <FeedCard item={featured} locale={locale} featured />}

          {rest.length > 0 && (
            <ul className="grid gap-x-8 gap-y-10 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((item) => (
                <li key={feedKey(item)}>
                  <FeedCard item={item} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
