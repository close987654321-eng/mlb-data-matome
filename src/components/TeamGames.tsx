import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { threadTitle } from '@/lib/series';
import { playerLabel } from '@/lib/playerNames';
import { gameVoice, type TeamGameRow } from '@/lib/teamGames';
import type { Locale } from '@/lib/i18n';

/**
 * チームLPの「試合結果と海外の反応」タイムライン＝ファイターLPの主要試合タイムラインのチーム版。
 *
 * 狙いは複合クエリ（「{チーム} 対 {チーム} 海外の反応」「{チーム} 試合結果」）の受け皿。
 * 記事カードの一覧は「見出し」しか見せないので、スコア・勝敗・本塁打という**探している答え**を
 * 一覧の段階で見せ、そのままその試合のまとめ記事へ送る（CTR 0.04% 問題に当てた試合結果ボックスと同じ発想）。
 *
 * 背骨は data/team-games.json（CI が毎時取り直す**全試合**の結果）＝まとめ記事を書いていない試合も
 * 欠けずに並ぶ。記事がある試合だけタイトルへのリンク・本塁打・現地の声が乗る（2026-08-07 改修）。
 *
 * 値はすべて公知の数値と実在コメントの再表示のみ。中の人メモは data/team-notes.json の手書き
 * （書いた試合にだけ出る＝「ちょいちょい挟む」）。
 */

/** 初期表示する行数。残りは <details> のネイティブ開閉で畳む（クライアントJSなし・HTMLには全件載る）。 */
const VISIBLE = 10;
/** 現地の声を添える行数の上限。全行に付けると結果が読めなくなるので、新しい方から数件だけ。 */
const VOICE_ROWS = 3;

export default async function TeamGames({
  rows,
  locale,
  label,
  notes,
}: {
  rows: TeamGameRow[];
  locale: Locale;
  label: string;
  /** 試合日（JST）→ 中の人メモ。data/team-notes.json 由来（ja のみ）。 */
  notes: Map<string, string>;
}) {
  if (rows.length === 0) return null;
  const t = await getTranslations();
  const en = locale === 'en';

  // 本塁打の表示名を先に解決（カタログ→カタカナ表→英語表記）。行の描画は同期で回す。
  const homerLines = await Promise.all(
    rows.map(async ({ homers }) => {
      if (!homers?.length) return null;
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

  // 現地の声は「記事がある行」の新しい方から VOICE_ROWS 件だけ。
  const voiced = new Set(
    rows
      .map((r, i) => (r.thread ? i : -1))
      .filter((i) => i >= 0)
      .slice(0, VOICE_ROWS),
  );

  const items = rows.map((row, i) => {
    const { date, score, oppScore, oppJa, oppEn, win, home, gameNo, thread } = row;
    const mark = win == null ? '－' : en ? (win ? 'W' : 'L') : win ? '○' : '●';
    const [, m, d] = date.split('-');
    const note = en ? undefined : notes.get(date);
    const voice = thread && voiced.has(i) ? gameVoice(thread) : null;
    const voiceBody = voice ? (en ? voice.bodyEn || voice.bodyJa : voice.bodyJa) : '';

    // 結果の1行。記事がある試合だけリンクにする（記事の無い試合は行き止まりに送らない）。
    const head = (
      <div className="flex items-baseline gap-3 text-sm">
        <span className="w-11 shrink-0 tabular-nums text-xs text-ink-mute">
          {Number(m)}/{Number(d)}
          {gameNo ? <span className="ml-0.5">#{gameNo}</span> : null}
        </span>
        <span
          aria-label={win == null ? undefined : t(win ? 'tag.gameWin' : 'tag.gameLoss')}
          className={`shrink-0 font-bold ${win ? 'text-ink' : 'text-ink-mute'}`}
        >
          {mark}
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-ink">
          {score}-{oppScore}
        </span>
        <span className="min-w-0 truncate text-ink-soft">
          {en ? `vs ${oppEn}` : `${oppJa}戦`}
          <span className="ml-2 text-xs text-ink-mute">
            {en ? (home ? 'Home' : 'Away') : home ? 'ホーム' : 'ビジター'}
          </span>
        </span>
        {thread && (
          <span
            aria-hidden
            className="ml-auto shrink-0 text-ink-mute transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        )}
      </div>
    );

    return (
      <li key={`${date}-${oppJa}-${gameNo ?? 0}-${score}-${oppScore}`} className="py-3.5">
        {thread ? (
          <Link href={`/${thread.sport}/${thread.id}`} className="group block">
            {head}
            {homerLines[i] && (
              <p className="mt-1.5 pl-14 text-xs text-ink-mute">
                {t('tag.gameHomers', { names: homerLines[i]! })}
              </p>
            )}
            <p className="mt-1 pl-14 text-xs text-ink-soft transition-colors group-hover:text-ink">
              <span className="line-clamp-1">{threadTitle(thread, locale)}</span>
            </p>
          </Link>
        ) : (
          head
        )}
        {/* その試合の現地の声＝タイムラインを「結果表」で終わらせない（記事がある試合の新しい数件だけ）。 */}
        {voice && voiceBody && (
          <figure className="mt-2.5 pl-14">
            <blockquote className="border-l border-line pl-3 text-sm leading-relaxed text-ink">
              “{voiceBody}”
            </blockquote>
            <figcaption className="mt-1 pl-3 text-xs text-ink-mute">
              <span className="font-medium text-ink-soft">
                {thread!.format === 'youtube' || thread!.format === 'interview'
                  ? voice.author
                  : `u/${voice.author}`}
              </span>
              {thread!.format !== 'interview' && (
                <span className="ml-2 tabular-nums">
                  {thread!.format === 'youtube' ? '👍' : '▲'} {voice.score.toLocaleString()}
                </span>
              )}
            </figcaption>
          </figure>
        )}
        {/* 中の人メモ＝節目の試合にだけ手書きで挟む一言（ja のみ）。 */}
        {note && (
          <div className="mt-2.5 pl-14">
            <p className="border-l-2 border-ink pl-3 text-sm leading-relaxed text-ink">{note}</p>
            <p className="mt-1 pl-3 text-xs text-ink-mute">{t('tag.gameNoteBy')}</p>
          </div>
        )}
      </li>
    );
  });

  const head = items.slice(0, VISIBLE);
  const rest = items.slice(VISIBLE);

  return (
    <section id="team-games" className="scroll-mt-20 space-y-3">
      <SectionHeading label={label} count={rows.length} />
      <div className="border-y border-line">
        <ul className="divide-y divide-line">{head}</ul>
        {rest.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 border-t border-line py-2.5 text-xs text-ink-soft transition-colors hover:text-ink group-open:hidden [&::-webkit-details-marker]:hidden">
              {t('tag.gamesMore', { count: rest.length })}
              <span aria-hidden>↓</span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">{rest}</ul>
          </details>
        )}
      </div>
      <p className="text-xs text-ink-mute">{t('tag.teamGamesNote')}</p>
    </section>
  );
}
