import { Link } from '@/lib/navigation';
import { teamLogoUrl } from '@/lib/teams';
import SectionHeading from '@/components/SectionHeading';
import {
  bestOfLabel,
  gameScoreLine,
  gameWhen,
  leagueName,
  roundName,
  seriesStatus,
  sideLabel,
  type League,
  type PostseasonData,
  type Series,
  type SeriesSide,
} from '@/lib/postseason';
import type { Locale } from '@/lib/i18n';

/**
 * ポストシーズンのトーナメント表（両リーグ＋ワールドシリーズ）。
 *
 * 並びは勝ち上がりの経路どおり: 地区シリーズ 'A'（第1シード）の相手は WC 'B'（4位対5位）の勝者、
 * 'B'（第2シード）の相手は WC 'A'（3位対6位）の勝者。上下を揃えておくと線を引かなくても経路が読める。
 * 狭い画面では縦に積む（横スクロールさせない）。日程と各試合のスコアは <details> に畳む＝JS なし。
 */
const PATH_ORDER: Record<League, string[][]> = {
  AL: [['F:B', 'F:A'], ['D:A', 'D:B'], ['L:']],
  NL: [['F:B', 'F:A'], ['D:A', 'D:B'], ['L:']],
};

function key(s: Series) {
  return `${s.round}:${s.label ?? ''}`;
}

function TeamRow({
  side,
  won,
  lost,
  en,
  linkable,
  jp,
}: {
  side: SeriesSide;
  won: boolean;
  lost: boolean;
  en: boolean;
  linkable: Set<string>;
  jp: Map<number, string[]>;
}) {
  const name = sideLabel(side, en);
  const players = side.id ? jp.get(side.id) : undefined;
  const label =
    side.id && side.nameJa && linkable.has(side.nameJa) ? (
      <Link
        href={`/tag/${encodeURIComponent(side.nameJa)}`}
        className="underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
      >
        {name}
      </Link>
    ) : (
      name
    );
  return (
    <div className={`flex items-start gap-2 px-3 py-2 ${lost ? 'text-ink-mute' : 'text-ink'}`}>
      <span className="w-4 shrink-0 pt-0.5 text-right text-xs tabular-nums text-ink-mute">{side.seed ?? ''}</span>
      {side.id ? (
        // eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク（再ホストしない）
        <img src={teamLogoUrl(side.id)} alt="" width={20} height={20} loading="lazy" className="mt-0.5 h-5 w-5 shrink-0 object-contain" />
      ) : (
        <span className="mt-0.5 h-5 w-5 shrink-0 rounded-[2px] border border-dashed border-line" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-sm leading-snug ${won ? 'font-bold' : side.id ? 'font-medium' : 'text-ink-soft'}`}>{label}</span>
        {players && players.length > 0 && <span className="block text-[11px] leading-snug text-ink-mute">{players.join('・')}</span>}
      </span>
      <span className={`shrink-0 pt-0.5 text-sm tabular-nums ${won ? 'font-bold' : ''}`}>{side.id ? side.wins : ''}</span>
    </div>
  );
}

function SeriesCard({
  s,
  en,
  linkable,
  jp,
}: {
  s: Series;
  en: boolean;
  linkable: Set<string>;
  jp: Map<number, string[]>;
}) {
  const played = s.games.filter((g) => g.state === 'Final');
  const upcoming = s.games.filter((g) => g.state !== 'Final');
  return (
    <div className="rounded-[4px] border border-line bg-surface">
      {/* ラウンド名は列見出しが持つ＝カードには何戦制だけ（二重に出さない）。 */}
      <div className="border-b border-line px-3 py-1.5 text-right text-[11px] text-ink-mute">{bestOfLabel(s.bestOf, en)}</div>
      <TeamRow side={s.top} won={s.winnerId != null && s.winnerId === s.top.id} lost={s.winnerId != null && s.winnerId !== s.top.id} en={en} linkable={linkable} jp={jp} />
      <div className="mx-3 h-px bg-line" aria-hidden />
      <TeamRow side={s.bottom} won={s.winnerId != null && s.winnerId === s.bottom.id} lost={s.winnerId != null && s.winnerId !== s.bottom.id} en={en} linkable={linkable} jp={jp} />
      <details className="group border-t border-line">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs text-ink-soft [&::-webkit-details-marker]:hidden">
          <span className="flex-1">{seriesStatus(s, en)}</span>
          {s.games.length > 0 && (
            <span aria-hidden className="text-ink-mute transition-transform group-open:rotate-45">
              ＋
            </span>
          )}
        </summary>
        {s.games.length > 0 && (
          <ol className="space-y-1 px-3 pb-2 text-xs text-ink-soft">
            {played.map((g) => (
              <li key={g.gamePk} className="flex gap-2">
                <span className="w-12 shrink-0 text-ink-mute">{en ? `Game ${g.n}` : `第${g.n}戦`}</span>
                <span className="tabular-nums">{gameScoreLine(g, en)}</span>
              </li>
            ))}
            {upcoming.map((g) => (
              <li key={g.gamePk} className="flex gap-2">
                <span className="w-12 shrink-0 text-ink-mute">{en ? `Game ${g.n}` : `第${g.n}戦`}</span>
                <span>
                  {gameWhen(g, en)}
                  {g.ifNecessary && <span className="text-ink-mute">{en ? ' (if necessary)' : '（必要時）'}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </details>
    </div>
  );
}

export default function PostseasonBracket({
  data,
  locale,
  linkable,
  jp,
}: {
  data: PostseasonData;
  locale: Locale;
  linkable: Set<string>;
  jp: Map<number, string[]>;
}) {
  const en = locale === 'en';
  const byKey = (lg: League | null) => new Map(data.series.filter((s) => s.league === lg).map((s) => [key(s), s]));
  const ws = data.series.find((s) => s.round === 'W');
  const colHead = [roundName('F', en, true), roundName('D', en, true), roundName('L', en, true)];

  return (
    <section id="bracket" className="scroll-mt-20">
      <SectionHeading label={en ? `${data.season} Postseason bracket` : `${data.season}年 トーナメント表`} lead />
      <p className="mb-4 mt-1.5 max-w-prose text-sm text-ink-soft">
        {en
          ? 'Numbers are seeds. Tap a series for its schedule and game scores. Undecided spots show who can still fill them.'
          : '数字はシード。各シリーズを開くと日程と試合ごとのスコアが見られます。未確定の枠は、入る可能性のあるチームを表示しています。'}
      </p>
      <div className="space-y-8">
        {(['AL', 'NL'] as League[]).map((lg) => {
          const m = byKey(lg);
          return (
            <div key={lg} id={lg.toLowerCase()} className="scroll-mt-20">
              <h3 className="mb-3 text-sm font-semibold text-ink">{leagueName(lg, en)}</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {PATH_ORDER[lg].map((col, i) => (
                  <div key={i} className="space-y-3">
                    <p className="text-[11px] font-medium tracking-wide text-ink-mute">{colHead[i]}</p>
                    {col.map((k) => {
                      const s = m.get(k);
                      return s ? <SeriesCard key={k} s={s} en={en} linkable={linkable} jp={jp} /> : null;
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {ws && (
          <div id="world-series" className="scroll-mt-20">
            <h3 className="mb-3 text-sm font-semibold text-ink">{roundName('W', en)}</h3>
            <div className="max-w-sm">
              <SeriesCard s={ws} en={en} linkable={linkable} jp={jp} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
