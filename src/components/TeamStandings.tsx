import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { getAllTags } from '@/lib/tags';
import { divisionOfTeam, divisionLabel, getStandings } from '@/lib/standings';
import { getPostseason, postseasonStatusOf } from '@/lib/postseason';
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
  const [division, { asOf, season }, tags, postseason] = await Promise.all([
    divisionOfTeam(teamId),
    getStandings(),
    getAllTags(),
    getPostseason(),
  ]);
  if (!division) return null;
  const t = await getTranslations();
  // 9月下旬〜10月は「このチームはポストシーズンに出るのか・どこまで勝ち上がったか」が順位表の次の問い。
  // 答えを1行で添えて /postseason（トーナメント表）へ送る。前年のアーカイブ表示中（年が違う）は出さない。
  const psStatus = postseason && postseason.season === season ? postseasonStatusOf(postseason, teamId) : null;
  const en = locale === 'en';
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
      {psStatus && (
        <p className="mt-3 text-sm text-ink">
          <span className="text-ink-soft">{en ? 'Postseason: ' : 'ポストシーズン：'}</span>
          <span className="font-semibold">{en ? psStatus.en : psStatus.ja}</span>
          <Link
            href="/postseason"
            className="ml-2 text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
          >
            {en ? 'Full bracket →' : 'トーナメント表を見る →'}
          </Link>
        </p>
      )}
    </section>
  );
}
