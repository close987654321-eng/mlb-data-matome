import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { getTagsBySport } from '@/lib/tags';
import { fighterTagHubs } from '@/lib/fighterHub';
import type { Sport } from '@/lib/sports';

/**
 * 格闘家LP（/tag/{選手名}）への導線。記事が実在するファイター（fighters.ts の opt-in カタログ）
 * を記事数の多い順に並べる。UpcomingFights は次戦が確定しているファイターしか拾えないため、
 * LPが増えるほど（2026-08）TOPからの導線が薄くなる穴を、TeamHubLinks のファイター版として埋める。
 * ファイタータグの無い競技（mlb 等）では何も描画しない。
 */
export default async function FighterHubLinks({ sport }: { sport: Sport }) {
  const fighters = fighterTagHubs(await getTagsBySport(sport)).sort((a, b) => b.count - a.count);
  if (fighters.length === 0) return null;
  const t = await getTranslations();

  return (
    <section aria-label={t('fighterTags.heading')} className="rounded-[4px] border border-line bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-ink-soft">
        {t('fighterTags.heading')}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {fighters.map(({ fighter, count }) => (
          <Link
            key={fighter.slug}
            href={`/tag/${encodeURIComponent(fighter.nameJa)}`}
            className="inline-flex items-center gap-1 rounded-[2px] border border-line px-3 py-1 text-sm text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            {t('fighterTags.anchor', { fighter: fighter.nameJa })}
            <span className="text-xs text-ink-mute">{count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
