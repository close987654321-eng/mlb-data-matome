import Image from 'next/image';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getThreadsBySport } from '@/lib/data';
import { getColumnsBySport } from '@/lib/columns';
import { buildFeed, feedKey } from '@/lib/feed';
import { SPORTS, SPORT_INFO, isSport } from '@/lib/sports';
import FeedCard from '@/components/FeedCard';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => SPORTS.map((sport) => ({ locale, sport })));
}

export default async function SportPage({
  params,
}: {
  params: Promise<{ locale: Locale; sport: string }>;
}) {
  const { locale, sport } = await params;
  unstable_setRequestLocale(locale);
  if (!isSport(sport)) notFound();
  const t = await getTranslations();
  const info = SPORT_INFO[sport];
  // 反応まとめとコラム／インタビューを競技ごとに統合し、新着順で1グリッドに出す。
  const [threads, columns] = await Promise.all([
    getThreadsBySport(sport),
    getColumnsBySport(sport),
  ]);
  const feed = buildFeed(threads, columns);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl">
        <Image
          src={info.heroImages[0]}
          alt=""
          width={1600}
          height={600}
          priority
          className="h-56 w-full object-cover sm:h-72"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="absolute bottom-0 left-0 p-6 text-white sm:p-8">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/80">
            {t('nav.reactions')}
          </span>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
            {info.emoji} {locale === 'ja' ? info.labelJa : info.labelEn}
          </h1>
          <p className="mt-1 text-sm text-white/80">{info.subreddits.join(' · ')}</p>
        </div>
      </section>

      {feed.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
          {t('threads.empty')}
        </p>
      ) : (
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {feed.map((item) => (
            <li key={feedKey(item)}>
              <FeedCard item={item} locale={locale} showSport={false} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
