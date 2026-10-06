import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { scoringLines, type ScoringLine } from '@/lib/scoring';
import { playerLabel } from '@/lib/playerNames';
import { bestOfLabel, gameWhen, roundName } from '@/lib/postseason';
import { getTeamById, teamLogoUrl } from '@/lib/teams';
import {
  flowVoices,
  jpPostseasonTotals,
  PS_VOICES_PER_GAME,
  type PsGame,
  type PsRound,
  type TeamPsRun,
} from '@/lib/teamPostseason';
import { scoreLabel } from '@/lib/scoreLabel';
import type { Player } from '@/lib/players';
import type { TeamHub } from '@/lib/teamHub';
import type { Locale } from '@/lib/i18n';
import { allComments } from '@/lib/daily';
import type { ThreadComment } from '@/types/thread';

/**
 * チームLPの「ポストシーズンの戦い」欄。ポストシーズン中は LP の先頭（「いま」ブロックの位置）に置く。
 *
 * 1画面目で答えるのは「いまどこまで勝ち上がった？次はいつ？」（勝ち上がりの道のり＋次戦）。
 * その下に試合ごとのカード＝スコア・得点経過（試合の流れ）・日本人選手の成績・現地ファンの声。
 * 声はフック＋記事の流れに沿った抜粋6件（村山「5コメント以上・流れがわかるように」）で、全部読みたい
 * 人は記事へ。値はすべて postseason.json と記事 JSON の再表示（ここで新しい事実は作らない）。
 *
 * 文言はインライン bilingual（DailyHubSections と同じ）＝この欄だけの言い回しを messages に散らさない。
 */

/** 最初から開いておくラウンド数（新しい順）。古いラウンドは <details> で畳む＝HTML には全部載る。 */
const OPEN_ROUNDS = 2;

const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];

function dateLabel(date: string, en: boolean): string {
  const [y, m, d] = date.split('-').map(Number);
  if (en) return `${m}/${d}`;
  const wd = WEEK_JA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}（${wd}）`;
}

function teamName(id: number | null | undefined, en: boolean): string {
  const t = getTeamById(id);
  return t ? (en ? t.info.nameEn : t.nameJa) : en ? 'TBD' : '未定';
}

/** ラウンドの勝敗の言い方（「2勝0敗でリード」「3勝1敗で突破」）。 */
function roundState(r: PsRound, en: boolean): string {
  const rec = en ? `${r.wins}-${r.losses}` : `${r.wins}勝${r.losses}敗`;
  switch (r.state) {
    case 'won':
      return r.round === 'W' ? (en ? `Won ${rec}` : `${rec}で世界一`) : en ? `Advanced ${rec}` : `${rec}で突破`;
    case 'lost':
      return en ? `Eliminated ${rec}` : `${rec}で敗退`;
    case 'upcoming':
      return en ? 'Upcoming' : 'これから';
    default:
      if (r.wins === r.losses) return en ? `Tied ${rec}` : `${rec}のタイ`;
      return r.wins > r.losses ? (en ? `Lead ${rec}` : `${rec}でリード`) : en ? `Trail ${rec}` : `${rec}`;
  }
}

function authorOf(c: ThreadComment, format: string | undefined): string {
  return format === 'reddit' || !format ? `u/${c.author}` : c.author;
}

export default async function TeamPostseason({
  run,
  hub,
  locale,
  jpPlayers,
  notes,
  children,
}: {
  run: TeamPsRun;
  hub: TeamHub;
  locale: Locale;
  /** 所属日本人選手（成績行と通算に使う） */
  jpPlayers: Player[];
  /** 試合日（JST）→ 中の人メモ（data/team-notes.json・ja のみ） */
  notes: Map<string, string>;
  /** 現在地パネルと試合カードの間に挟むもの（編集部ノート＝30秒で全体像→試合ごとの詳細の順にする） */
  children?: React.ReactNode;
}) {
  const en = locale === 'en';
  const name = en ? hub.info.nameEn : hub.nameJa;
  const jpNames = jpPlayers.map((p) => p.nameJa);
  const playerOf = new Map(jpPlayers.map((p) => [p.nameJa, p]));
  const latest = run.rounds[0];
  const need = Math.ceil(latest.bestOf / 2);

  // 得点経過・勝敗投手の名前は非同期で解決（カタログ→カタカナ表→英語）。描画は同期で回す。
  const games = run.rounds.flatMap((r) => r.games);
  const scoring = new Map<PsGame, ScoringLine[]>();
  const decisions = new Map<PsGame, string>();
  await Promise.all(
    games.map(async (g) => {
      const game = g.thread?.game;
      if (!game) return;
      scoring.set(g, await scoringLines(game, locale, hub.nameJa));
      const d = game.decisions;
      if (d) {
        const parts: string[] = [];
        if (d.winner) parts.push(`${en ? 'W' : '勝'} ${(await playerLabel(d.winner, { locale })).label}`);
        if (d.loser) parts.push(`${en ? 'L' : '負'} ${(await playerLabel(d.loser, { locale })).label}`);
        if (d.save) parts.push(`${en ? 'SV' : 'S'} ${(await playerLabel(d.save, { locale })).label}`);
        decisions.set(g, parts.join(en ? ' · ' : '　'));
      }
    }),
  );
  const totals = jpPostseasonTotals(run, jpNames);

  // 道のり＝古い順（ワイルドカード→地区→…）。各試合の○●を並べて一目で勝ち上がりを見せる。
  const path = [...run.rounds].reverse();

  // 「いま」の数字。進行中のラウンドの勝敗・通算・次戦（決着済みなら最終成績）。
  const bigs: { label: string; value: string; sub?: string }[] = [
    {
      label: roundName(latest.round, en),
      value: en ? `${latest.wins}-${latest.losses}` : `${latest.wins}勝${latest.losses}敗`,
      sub:
        latest.state === 'live' && latest.wins > latest.losses
          ? en
            ? `${need - latest.wins} win${need - latest.wins === 1 ? '' : 's'} to advance`
            : `突破まであと${need - latest.wins}勝`
          : roundState(latest, en),
    },
  ];
  // 通算はラウンドを2つ以上戦ってから＝1ラウンド目だけなら上の数字と同じになる。
  if (run.rounds.length > 1) {
    bigs.push({
      label: en ? 'Postseason' : 'ポストシーズン通算',
      value: en ? `${run.totalW}-${run.totalL}` : `${run.totalW}勝${run.totalL}敗`,
    });
  }
  if (run.next) {
    bigs.push({
      label: en ? 'Next game' : '次の試合',
      value: gameWhen(run.next.game, en),
      sub: en
        ? `${roundName(run.next.round, true)} G${run.next.game.n} · ${run.next.home ? 'Home' : 'Away'} vs ${teamName(run.next.oppId, true)}`
        : `${roundName(run.next.round, false)}第${run.next.game.n}戦・${run.next.home ? '本拠地' : '敵地'}で${teamName(run.next.oppId, false)}戦`,
    });
  }

  const roundBlocks = run.rounds.map((r) => (
    <div key={r.round} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink pb-2">
        <h3 className="text-base font-bold text-ink">
          {roundName(r.round, en)}
          <span className="ml-2 text-sm font-semibold text-ink-soft">
            {en ? `vs ${teamName(r.oppId, true)}` : `対${teamName(r.oppId, false)}`}
          </span>
        </h3>
        <p className="text-xs text-ink-mute">
          {bestOfLabel(r.bestOf, en)}
          <span className="ml-2 font-semibold text-ink">{roundState(r, en)}</span>
        </p>
      </div>
      {r.games.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {en ? 'Game 1 has not been played yet.' : '第1戦はまだ行われていません。'}
        </p>
      ) : (
        <ol className="space-y-8">
          {r.games.map((g) => {
            const thread = g.thread;
            const lines = scoring.get(g) ?? [];
            const { hook, voices } = thread ? flowVoices(thread, PS_VOICES_PER_GAME, en) : { hook: null, voices: [] };
            const fmt = thread?.format;
            const scoreKind = fmt === 'reddit' || !fmt ? 'reddit' : 'youtube';
            const jpRows = (thread?.stats ?? []).filter((s) => jpNames.includes(s.player) && s.today);
            const note = en ? undefined : notes.get(g.date);
            const seriesTail =
              g.wins === Math.ceil(g.bestOf / 2)
                ? en
                  ? `Won series ${g.wins}-${g.losses}`
                  : `${g.wins}勝${g.losses}敗で突破`
                : g.losses === Math.ceil(g.bestOf / 2)
                  ? en
                    ? `Lost series ${g.wins}-${g.losses}`
                    : `${g.wins}勝${g.losses}敗で敗退`
                  : en
                    ? `Series ${g.wins}-${g.losses}`
                    : `シリーズ${g.wins}勝${g.losses}敗`;
            const commentTotal = thread ? allComments(thread).length : 0;
            return (
              <li key={`${g.round}-${g.n}`} id={`ps-${g.round}-${g.n}`} className="space-y-4">
                {/* 試合の結果1行＝この試合の「答え」。記事があれば見出しごと記事へ。 */}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-bold text-ink">{en ? `Game ${g.n}` : `第${g.n}戦`}</span>
                  <span className="text-xs tabular-nums text-ink-mute">{dateLabel(g.date, en)}</span>
                  <span className={`text-sm font-bold ${g.win ? 'text-ink' : 'text-ink-mute'}`}>
                    {en ? (g.win ? 'W' : 'L') : g.win ? '○' : '●'}
                  </span>
                  <span className="text-xl font-bold tabular-nums tracking-tight text-ink">
                    {g.score}-{g.oppScore}
                  </span>
                  <span className="text-sm text-ink-soft">
                    {en ? `vs ${teamName(g.oppId, true)}` : `${teamName(g.oppId, false)}戦`}
                    <span className="ml-1.5 text-xs text-ink-mute">
                      {en ? (g.home ? 'Home' : 'Away') : g.home ? '本拠地' : '敵地'}
                    </span>
                  </span>
                  <span className="ml-auto text-xs font-semibold text-ink-soft">{seriesTail}</span>
                </div>

                {/* 得点経過＝試合の流れ。自軍の得点は墨・相手は薄墨、節目（先制・逆転…）に印。 */}
                {lines.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-ink-mute">{en ? 'Scoring' : '得点経過'}</p>
                    <ol className="mt-1.5 divide-y divide-line border-y border-line">
                      {lines.map((l, i) => (
                        <li key={i} className="flex items-baseline gap-3 py-1.5 text-sm">
                          <span className="w-12 shrink-0 text-xs tabular-nums text-ink-mute">{l.inning}</span>
                          <span className={`min-w-0 flex-1 ${l.self ? 'text-ink' : 'text-ink-mute'}`}>
                            {l.text}
                            <span className="ml-1.5 text-xs tabular-nums">+{l.runs}</span>
                            {l.turn && (
                              <span
                                className={`ml-2 inline-block rounded-[2px] px-1.5 py-px text-[11px] font-semibold ${
                                  l.self ? 'bg-ink text-paper' : 'ring-1 ring-line text-ink-soft'
                                }`}
                              >
                                {l.turn}
                              </span>
                            )}
                          </span>
                          <span
                            className={`shrink-0 tabular-nums font-semibold ${l.self ? 'text-ink' : 'text-ink-mute'}`}
                          >
                            {l.score}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {decisions.get(g) && <p className="mt-1.5 text-xs text-ink-mute">{decisions.get(g)}</p>}
                  </div>
                )}

                {/* 日本人選手のこの試合の成績（記事の成績ボックスと同じ値）。 */}
                {jpRows.length > 0 && (
                  <ul className="space-y-1">
                    {jpRows.map((s) => {
                      const p = playerOf.get(s.player);
                      return (
                        <li key={s.player} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="font-semibold text-ink">{en && p ? p.nameEn : s.player}</span>
                          <span lang="ja" className="text-ink-soft">
                            {s.today}
                          </span>
                          {s.note && (
                            <span className="rounded-[2px] bg-ink px-1.5 py-px text-[11px] font-semibold text-paper">
                              {s.note}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* 現地の声＝フック（その試合を象徴する一言）＋流れに沿った抜粋。 */}
                {hook && (
                  <figure className="border-l-4 border-ink py-0.5 pl-4">
                    <blockquote className="text-base font-bold leading-relaxed text-ink sm:text-lg">
                      “{en ? hook.bodyEn || hook.bodyJa : hook.bodyJa}”
                    </blockquote>
                    <figcaption className="mt-1.5 text-xs text-ink-mute">
                      <span className="font-medium text-ink-soft">{authorOf(hook, fmt)}</span>
                      {hook.score > 0 && (
                        <span className="ml-2 tabular-nums">{scoreLabel(hook.score, scoreKind, locale)}</span>
                      )}
                    </figcaption>
                  </figure>
                )}
                {voices.length > 0 && (
                  <ul className="divide-y divide-line border-y border-line">
                    {voices.map((c, i) => (
                      <li key={i} className="py-3">
                        <p className="text-[15px] leading-[1.8] text-ink">“{en ? c.bodyEn || c.bodyJa : c.bodyJa}”</p>
                        <p className="mt-1 text-xs text-ink-mute">
                          <span className="font-medium text-ink-soft [overflow-wrap:anywhere]">{authorOf(c, fmt)}</span>
                          {c.score > 0 && <span className="ml-2 tabular-nums">{scoreLabel(c.score, scoreKind, locale)}</span>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 中の人メモ（節目の試合にだけ手書き・ja のみ）。 */}
                {note && (
                  <div>
                    <p className="border-l-2 border-ink pl-3 text-sm leading-relaxed text-ink">{note}</p>
                    <p className="mt-1 pl-3 text-xs text-ink-mute">中の人メモ</p>
                  </div>
                )}

                {thread ? (
                  <Link
                    href={`/${thread.sport}/${thread.id}`}
                    className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink transition-colors hover:text-ink-soft"
                  >
                    {en
                      ? `Read all ${commentTotal} fan reactions to Game ${g.n}`
                      : `第${g.n}戦の海外の反応を全部読む（${commentTotal}件）`}
                    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                ) : (
                  <p className="text-xs text-ink-mute">
                    {en
                      ? 'The fan-reaction roundup for this game is on the way.'
                      : 'この試合の海外の反応まとめは準備中です（公式ハイライトの公開後に追加）。'}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  ));

  return (
    <section id="postseason-run" className="space-y-6">
      <SectionHeading
        lead
        label={en ? `${name} in the ${run.season} Postseason` : `${name}のポストシーズン${run.season}｜試合結果と海外の反応`}
      />

      {/* いまの現在地＝勝ち上がりの道のり・数字・次戦。「どこまで来た？次はいつ？」に1画面目で答える。 */}
      <div className="rounded-[3px] border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク（再ホストしない） */}
          <img src={teamLogoUrl(hub.info.id)} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
          <p className="text-sm font-semibold leading-snug text-ink">{en ? run.statusEn : run.statusJa}</p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {bigs.map((b, i) => (
            <div key={b.label} className={i === 2 ? 'col-span-2 sm:col-span-1' : ''}>
              <dt className="text-xs text-ink-mute">{b.label}</dt>
              <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-ink sm:text-3xl">{b.value}</dd>
              {b.sub && <dd className="mt-0.5 text-xs text-ink-soft">{b.sub}</dd>}
            </div>
          ))}
        </dl>

        {/* 道のり（古い順）。各試合の○●はその試合のカードへのジャンプ。 */}
        <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-line pt-4 text-xs">
          {path.map((r, i) => (
            <li key={r.round} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-ink-mute">
                  →
                </span>
              )}
              <span className="font-semibold text-ink-soft">{roundName(r.round, en, true)}</span>
              <span className="flex gap-1">
                {[...r.games].reverse().map((g) => (
                  <a
                    key={g.n}
                    href={`#ps-${g.round}-${g.n}`}
                    aria-label={
                      en
                        ? `Game ${g.n}: ${g.win ? 'W' : 'L'} ${g.score}-${g.oppScore}`
                        : `第${g.n}戦 ${g.win ? '勝ち' : '負け'} ${g.score}-${g.oppScore}`
                    }
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-[2px] text-[11px] font-bold ${
                      g.win ? 'bg-ink text-paper' : 'text-ink-mute ring-1 ring-line'
                    }`}
                  >
                    {g.n}
                  </a>
                ))}
                {r.games.length === 0 && <span className="text-ink-mute">{en ? 'next' : 'これから'}</span>}
              </span>
              {r.state === 'won' && <span className="text-ink-soft">{en ? 'advanced' : '突破'}</span>}
              {r.state === 'lost' && <span className="text-ink-mute">{en ? 'out' : '敗退'}</span>}
            </li>
          ))}
        </ol>

        {/* 日本人選手のポストシーズン通算（全試合に記事があるときだけ＝足し上げが嘘にならないとき）。 */}
        {totals.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
            {totals.map((tt) => {
              const p = playerOf.get(tt.player);
              return (
                <li key={tt.player} className="text-sm">
                  {p ? (
                    <Link
                      href={`/tag/${encodeURIComponent(p.nameJa)}`}
                      className="font-semibold text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
                    >
                      {en ? p.nameEn : p.nameJa}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink">{tt.player}</span>
                  )}
                  <span className="ml-2 text-xs text-ink-mute">
                    {en ? `Postseason (${tt.games} G)` : `ポストシーズン通算（${tt.games}試合）`}
                  </span>
                  <span className="mt-0.5 block text-ink-soft">{en ? tt.lineEn : tt.line}</span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3.5 text-sm font-semibold">
          <Link href="/postseason#schedule" className="text-ink transition-colors hover:text-ink-soft">
            {en ? 'Schedule & how to watch' : '日程（日本時間）・放送予定'} <span aria-hidden>→</span>
          </Link>
          <Link href="/postseason#bracket" className="text-ink transition-colors hover:text-ink-soft">
            {en ? 'Bracket' : 'トーナメント表'} <span aria-hidden>→</span>
          </Link>
          <Link href="/postseason/live" className="text-ink transition-colors hover:text-ink-soft">
            {en ? 'Key moments live' : '名場面ライブ'} <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      {children}

      {/* 試合ごとのカード（新しいラウンド・新しい試合が先）。古いラウンドは畳む。 */}
      <div className="space-y-10">{roundBlocks.slice(0, OPEN_ROUNDS)}</div>
      {roundBlocks.length > OPEN_ROUNDS && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 border-y border-line py-2.5 text-xs text-ink-soft transition-colors hover:text-ink group-open:hidden [&::-webkit-details-marker]:hidden">
            {en ? 'Earlier rounds' : `${path
              .slice(0, roundBlocks.length - OPEN_ROUNDS)
              .map((r) => roundName(r.round, false))
              .join('・')}の試合を見る`}
            <span aria-hidden>↓</span>
          </summary>
          <div className="mt-6 space-y-10">{roundBlocks.slice(OPEN_ROUNDS)}</div>
        </details>
      )}

      <p className="text-xs leading-relaxed text-ink-mute">
        {en
          ? 'Scores and scoring plays are from MLB official game data. Fan voices are excerpts from comments on each official highlight, in the order of the roundup (the flow of the game).'
          : 'スコア・得点経過は MLB 公式の試合データ。現地ファンの声は各試合の公式ハイライトに寄せられたコメントからの抜粋で、まとめ記事の並び（試合の流れ）の順に並べています。'}
      </p>
    </section>
  );
}
