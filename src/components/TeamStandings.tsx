import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { getAllTags } from '@/lib/tags';
import { divisionOfTeam, divisionLabel, getStandings } from '@/lib/standings';
import { teamLogoUrl } from '@/lib/teams';
import { teamHubOf, TEAM_HUB_MIN_ARTICLES } from '@/lib/teamHub';
import SectionHeading from '@/components/SectionHeading';
import type { Locale } from '@/lib/i18n';

/**
 * チームLPの地区順位表。data/standings.json（CI が毎時更新・公知の事実のみ）を読むだけで
 * API は叩かない。自チームの行を強調し、他チームはLP昇格済み（記事3件以上）ならそのLPへ
 * リンク＝チームLP同士の相互回遊網を順位表が兼ねる。未生成なら何も描画しない（ビルド安全）。
 */
export default async function TeamStandings({ teamId, locale }: { teamId: number; locale: Locale }) {
  const [division, { asOf }, tags] = await Promise.all([
    divisionOfTeam(teamId),
    getStandings(),
    getAllTags(),
  ]);
  if (!division) return null;
  const t = await getTranslations();
  // LP昇格済みのチームタグだけリンク化（薄いタグページへ誘導しない＝isTagIndexable と同じ規律）。
  const linkable = new Set(
    tags
      .filter(({ tag, count }) => count >= TEAM_HUB_MIN_ARTICLES && teamHubOf(tag))
      .map(({ tag }) => tag),
  );

  return (
    <section aria-label={t('standings.heading', { division: divisionLabel(division, locale) })}>
      <SectionHeading label={t('standings.heading', { division: divisionLabel(division, locale) })} />
      <div className="mt-4 overflow-x-auto rounded-[4px] border border-line">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-xs text-ink-soft">
              <th className="px-3 py-2 text-left font-medium">{t('standings.rank')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('standings.team')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('standings.w')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('standings.l')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('standings.pct')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('standings.gb')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('standings.last10')}</th>
            </tr>
          </thead>
          <tbody>
            {division.teams.map((row) => {
              const self = row.id === teamId;
              const name = (
                <span className="inline-flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク（再ホストしない） */}
                  <img
                    src={teamLogoUrl(row.id)}
                    alt=""
                    width={20}
                    height={20}
                    loading="lazy"
                    className="h-5 w-5 object-contain"
                  />
                  {row.nameJa}
                </span>
              );
              return (
                <tr
                  key={row.id}
                  className={`border-b border-line last:border-b-0 ${self ? 'bg-surface font-semibold text-ink' : 'text-ink-soft'}`}
                >
                  <td className="px-3 py-2 tabular-nums">{row.rank}</td>
                  <td className="px-3 py-2">
                    {!self && linkable.has(row.nameJa) ? (
                      <Link
                        href={`/tag/${encodeURIComponent(row.nameJa)}`}
                        className="text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
                      >
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.w}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.l}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.pct}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.gb}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.last10 ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {asOf && <p className="mt-2 text-xs text-ink-mute">{t('standings.asOf', { date: asOf })}</p>}
    </section>
  );
}
