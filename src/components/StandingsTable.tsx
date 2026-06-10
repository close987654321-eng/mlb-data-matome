import { useTranslations } from 'next-intl';
import type { Locale, Team } from '@/types/mlb';

type Props = {
  teams: Team[];
  locale: Locale;
};

const DIVISION_ORDER = ['East', 'Central', 'West'] as const;

function winPct(team: Team): number {
  const w = team.wins ?? 0;
  const l = team.losses ?? 0;
  const total = w + l;
  return total === 0 ? 0 : w / total;
}

export default function StandingsTable({ teams, locale }: Props) {
  const t = useTranslations('ranking');
  const tt = useTranslations('teams');

  if (teams.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        {t('noData')}
      </p>
    );
  }

  const grouped = (['AL', 'NL'] as const).map((league) => ({
    league,
    divisions: DIVISION_ORDER.map((division) => ({
      division,
      teams: teams
        .filter((team) => team.league === league && team.division === division)
        .sort((a, b) => winPct(b) - winPct(a)),
    })),
  }));

  return (
    <div className="space-y-8">
      {grouped.map(({ league, divisions }) => (
        <section key={league}>
          <h2 className="mb-3 text-lg font-semibold text-mlbnavy">
            {tt(`league.${league}`)}
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {divisions.map(({ division, teams: divTeams }) => (
              <div key={division} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                  {tt(`division.${division}`)}
                </div>
                <table className="min-w-full text-sm">
                  <thead className="text-xs text-gray-500">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">{tt('team')}</th>
                      <th className="px-2 py-1 text-right">W</th>
                      <th className="px-2 py-1 text-right">L</th>
                      <th className="px-2 py-1 text-right">PCT</th>
                      <th className="px-2 py-1 text-right">±</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divTeams.map((team, idx) => (
                      <tr key={team.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1 text-gray-500">{idx + 1}</td>
                        <td className="px-2 py-1">
                          <span className="font-medium text-gray-900">{team.name[locale]}</span>
                          <span className="ml-1 text-xs text-gray-400">{team.abbr}</span>
                        </td>
                        <td className="px-2 py-1 text-right font-mono tabular-nums">{team.wins ?? '—'}</td>
                        <td className="px-2 py-1 text-right font-mono tabular-nums">{team.losses ?? '—'}</td>
                        <td className="px-2 py-1 text-right font-mono tabular-nums">
                          {team.wins != null && team.losses != null
                            ? winPct(team).toFixed(3).replace(/^0/, '')
                            : '—'}
                        </td>
                        <td
                          className={`px-2 py-1 text-right font-mono tabular-nums ${
                            (team.runDiff ?? 0) > 0
                              ? 'text-emerald-700'
                              : (team.runDiff ?? 0) < 0
                                ? 'text-rose-700'
                                : 'text-gray-500'
                          }`}
                        >
                          {team.runDiff == null
                            ? '—'
                            : team.runDiff > 0
                              ? `+${team.runDiff}`
                              : team.runDiff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
