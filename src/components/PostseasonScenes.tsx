import { Link } from '@/lib/navigation';
import { scoreLabel } from '@/lib/scoreLabel';
import { leagueName, roundName } from '@/lib/postseason';
import type { Scene } from '@/lib/postseasonScenes';
import type { Locale } from '@/lib/i18n';
import GameBox from '@/components/GameBox';

/**
 * ポストシーズン名場面の部品（/postseason/live の本体と、/postseason・TOP の入口）。
 *
 * 動画を埋め込まない＝テキストだけで山場の熱を伝える面。だから1場面の中の順番を固定する:
 * 試合の情報（どの試合か）→ 見出し（何が起きたか）→ 状況（事実だけ）→ スコアカード（記事と同じ GameBox）→
 * 海外の反応（現地の熱）→ 中の人（読者の隣で見ている人の一言）。
 * スコアカードは2026-10-06追加（村山依頼）＝動画が無いぶん、何回にどう点が動いたかを線スコアで見せる。
 * 読み心地の規律（CLAUDE.md §6）どおり、コメント列は枠で囲まず罫線と余白、強調は左の2px墨線、票数は scoreLabel。
 */

export function dayLabel(day: string, en: boolean): string {
  return new Intl.DateTimeFormat(en ? 'en-US' : 'ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: en ? 'short' : 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${day}T12:00:00+09:00`));
}

function roundLine(s: Scene, en: boolean): string {
  if (!s.round) return '';
  const lg = s.league ? `${en ? s.league : leagueName(s.league, false)} ` : '';
  const g = s.gameN ? (en ? ` Game ${s.gameN}` : ` 第${s.gameN}戦`) : '';
  return `${lg}${roundName(s.round, en)}${g}`;
}

/** スコアカードの日付表示（記事ページの GameBox と同じ規則＝記事の日付・JST）。 */
function gameDateLabel(s: Scene): string {
  const g = (s.thread.series?.date ?? s.thread.id.slice(0, 10)).split('-');
  return `${g[0]}.${Number(g[1])}.${Number(g[2])}`;
}

function ScoreLine({ s }: { s: Scene }) {
  if (!s.score) return null;
  const { away, home, as, hs } = s.score;
  return (
    <span className="tabular-nums text-ink">
      <span className={as > hs ? 'font-bold' : ''}>{away}</span> {as}-{hs}{' '}
      <span className={hs > as ? 'font-bold' : ''}>{home}</span>
    </span>
  );
}

export function SceneCard({ scene: s, locale }: { scene: Scene; locale: string }) {
  const en = locale === 'en';
  const jaLang = en ? 'ja' : undefined;
  const total = s.thread.comments?.length ?? 0;
  return (
    <article id={s.thread.id} className="border-b border-line pb-10 pt-8 first:pt-2">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink-mute">
        <span className="font-medium tracking-wide">{roundLine(s, en)}</span>
        {/* スコアカードが出る試合は下の GameBox が勝敗を見せる＝ここでの二重表示はしない。 */}
        {!s.thread.game && <ScoreLine s={s} />}
        {s.jp.length > 0 && (
          <span lang={jaLang} className="rounded-[2px] border border-ink px-1.5 py-px text-[11px] font-semibold text-ink">
            {s.jp.join('・')}
          </span>
        )}
        {!s.curated && <span className="text-[11px]">{en ? 'Auto from the game thread' : '速報（記事から自動掲載）'}</span>}
      </p>

      <h3 lang={jaLang} className="mt-2 text-xl font-bold leading-snug text-ink [font-feature-settings:'palt'] sm:text-2xl">
        {s.headline}
      </h3>
      {s.lead && (
        <p lang={jaLang} className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
          {s.lead}
        </p>
      )}

      {s.thread.game && (
        <GameBox
          game={s.thread.game}
          dateLabel={gameDateLabel(s)}
          locale={locale as Locale}
          lpTags={s.thread.tags}
          heading={null}
          className="mt-5"
        />
      )}

      {s.quotes.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {s.quotes.map((c) => (
            <li key={`${c.author}-${c.bodyEn.slice(0, 16)}`} className="py-4">
              <p lang={jaLang} className="text-base leading-[1.8] text-ink">
                {c.bodyJa}
              </p>
              <p lang="en" className="mt-1.5 text-[13px] leading-[1.6] text-ink-soft [overflow-wrap:anywhere]">
                {c.bodyEn}
              </p>
              <p className="mt-1.5 text-xs text-ink-mute [overflow-wrap:anywhere]">
                {c.author}
                {c.score > 0 && <span className="ml-2 tabular-nums">{scoreLabel(c.score, 'youtube', locale)}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {s.take && (
        <div className="mt-6 border-l-2 border-ink pl-4">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-mute">{en ? 'FROM THE EDITOR' : '中の人のひと言'}</p>
          <p lang={jaLang} className="mt-1.5 text-base leading-[1.9] text-ink">
            {s.take}
          </p>
        </div>
      )}

      <p className="mt-5 text-sm">
        <Link href={`/${s.thread.sport}/${s.thread.id}`} className="text-ink underline underline-offset-4 hover:text-ink-soft">
          {en ? `All reactions from this game (${total})` : `この試合の海外の反応をすべて読む（${total}件）`}
        </Link>
      </p>
    </article>
  );
}

/** /postseason と TOP に置く入口。最新の数場面の見出しだけを並べて本体へ送る。 */
export function SceneTeaser({ scenes, locale, count = 3 }: { scenes: Scene[]; locale: string; count?: number }) {
  if (!scenes.length) return null;
  const en = locale === 'en';
  return (
    <section aria-label={en ? 'Postseason moments' : 'ポストシーズン名場面'} className="border-y border-ink py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-ink">{en ? 'Postseason moments, live' : 'ポストシーズン名場面ライブ'}</h2>
        <span className="text-xs text-ink-mute">{en ? `${scenes.length} moments · updated as games end` : `${scenes.length}場面・試合ごとに更新`}</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {scenes.slice(0, count).map((s) => (
          <li key={s.thread.id} className="text-sm leading-snug">
            <span className="mr-2 text-xs tabular-nums text-ink-mute">{dayLabel(s.dayJst, en)}</span>
            <Link href={`/postseason/live#${s.thread.id}`} className="font-semibold text-ink hover:underline">
              {s.headline}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        <Link href="/postseason/live" className="text-ink underline underline-offset-4 hover:text-ink-soft">
          {en ? 'Read every moment with overseas reactions' : '全場面を海外の反応と中の人のひと言で読む'} <span aria-hidden>→</span>
        </Link>
      </p>
    </section>
  );
}
