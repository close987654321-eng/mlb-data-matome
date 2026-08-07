import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { threadTitle } from '@/lib/series';
import { playerLabel } from '@/lib/playerNames';
import { getTeam } from '@/lib/teams';
import type { TeamGameRow } from '@/lib/teamHub';
import type { Locale } from '@/lib/i18n';

/**
 * チームLPの「試合結果と海外の反応」タイムライン＝ファイターLPの主要試合タイムラインのチーム版。
 *
 * 狙いは複合クエリ（「{チーム} 対 {チーム} 海外の反応」「{チーム} 試合結果」）の受け皿。
 * 記事カードの一覧は「見出し」しか見せないので、スコア・勝敗・本塁打という**探している答え**を
 * 一覧の段階で見せ、そのままその試合のまとめ記事へ送る（CTR 0.04% 問題に当てた試合結果ボックスと同じ発想）。
 *
 * 値は記事に焼き込んだ Thread.game（MLB公式スケジュールAPI由来の公知の数値）の再表示のみ。
 * 本塁打の日本語表記は playerNames.ts が正（未収録の選手は公式英語表記のまま出る＝捏造しない）。
 */
export default async function TeamGames({
  rows,
  locale,
  label,
}: {
  rows: TeamGameRow[];
  locale: Locale;
  label: string;
}) {
  if (rows.length === 0) return null;
  const t = await getTranslations();
  const en = locale === 'en';

  // 本塁打の表示名を先に解決（カタログ→カタカナ表→英語表記）。行の描画は同期で回す。
  const homerLines = await Promise.all(
    rows.map(async ({ self }) => {
      const homers = self.homers ?? [];
      if (homers.length === 0) return null;
      const names = await Promise.all(
        homers.map(async (h) => {
          const { label: name } = await playerLabel(h.name, { locale, mlbId: h.id });
          // 1試合2本以上はその本数、それ以外は今季通算の号数（GameBox と同じ規約）。
          const suffix =
            h.hr && h.hr >= 2
              ? en
                ? ` (${h.hr})`
                : `（${h.hr}本）`
              : h.no
                ? en
                  ? ` (#${h.no})`
                  : `（今季${h.no}号）`
                : '';
          return `${name}${suffix}`;
        }),
      );
      return names.join(en ? ', ' : '・');
    }),
  );

  return (
    <section id="team-games" className="space-y-3 scroll-mt-20">
      <SectionHeading label={label} count={rows.length} />
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((row, i) => {
          const { thread, date, self, opp, win, home } = row;
          const mark = win == null ? '－' : en ? (win ? 'W' : 'L') : win ? '○' : '●';
          // 相手名は短縮表記（"Yankees"）。記事の game は公式フルネームを持つので teams.ts で引き直す。
          const oppEn = getTeam(opp.ja)?.nameEn ?? opp.en;
          const [, m, d] = date.split('-');
          return (
            <li key={`${thread.sport}/${thread.id}`}>
              <Link href={`/${thread.sport}/${thread.id}`} className="group block py-3.5">
                <div className="flex items-baseline gap-3 text-sm">
                  <span className="w-11 shrink-0 tabular-nums text-xs text-ink-mute">
                    {Number(m)}/{Number(d)}
                  </span>
                  <span
                    aria-label={win == null ? undefined : t(win ? 'tag.gameWin' : 'tag.gameLoss')}
                    className={`shrink-0 font-bold ${win ? 'text-ink' : 'text-ink-mute'}`}
                  >
                    {mark}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">
                    {self.score}-{opp.score}
                  </span>
                  <span className="min-w-0 truncate text-ink-soft">
                    {en ? `vs ${oppEn}` : `${opp.ja}戦`}
                    <span className="ml-2 text-xs text-ink-mute">
                      {en ? (home ? 'Home' : 'Away') : home ? 'ホーム' : 'ビジター'}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="ml-auto shrink-0 text-ink-mute transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </div>
                {homerLines[i] && (
                  <p className="mt-1.5 pl-14 text-xs text-ink-mute">
                    {t('tag.gameHomers', { names: homerLines[i]! })}
                  </p>
                )}
                <p className="mt-1 pl-14 text-xs text-ink-soft transition-colors group-hover:text-ink">
                  <span className="line-clamp-1">{threadTitle(thread, locale)}</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-mute">{t('tag.teamGamesNote')}</p>
    </section>
  );
}
