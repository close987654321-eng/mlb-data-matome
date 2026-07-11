import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { getTagsBySport } from '@/lib/tags';
import { teamHubOf, teamDisplayJa, TEAM_HUB_MIN_ARTICLES } from '@/lib/teamHub';
import type { Sport } from '@/lib/sports';

/**
 * 球団別チームLP（/tag/{チーム名}）への導線。LP昇格済み（記事 TEAM_HUB_MIN_ARTICLES 件以上）の
 * チームだけを記事数の多い順に出す。GSC実測（2026-07）でチーム系クエリが表示の主燃料かつ
 * チームLPがサイト最高CTR＝勝ち筋の受け皿を、クロール経路とアンカーテキストの両面で強化する。
 * チームタグの無い競技（boxing/mma 等）では何も描画しない。
 */
export default async function TeamHubLinks({ sport }: { sport: Sport }) {
  const teams = (await getTagsBySport(sport))
    .map(({ tag, count }) => ({ hub: teamHubOf(tag), tag, count }))
    .filter(({ hub, count }) => hub && count >= TEAM_HUB_MIN_ARTICLES);
  if (teams.length === 0) return null;
  const t = await getTranslations();

  return (
    <section aria-label={t('teamTags.heading')} className="rounded-[4px] border border-line bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-ink-soft">
        {t('teamTags.heading')}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {teams.map(({ hub, tag, count }) => (
          <Link
            key={tag}
            href={`/tag/${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1 rounded-[2px] border border-line px-3 py-1 text-sm text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            {/* alias 併記（例: ダイヤモンドバックス（Dバックス））＝検索の主流表記をアンカーにも載せる */}
            {teamDisplayJa(hub!)}
            <span className="text-xs text-ink-mute">{count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
