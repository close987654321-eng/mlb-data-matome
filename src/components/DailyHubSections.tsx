import Image from 'next/image';
import { Link } from '@/lib/navigation';
import { playerSlugByJaName } from '@/lib/players';
import SectionHeading from '@/components/SectionHeading';
import { issueDate } from '@/lib/frontpage';
import { dailyRows, heroTopQuotes, heroCounts } from '@/lib/dailyHub';
import type { Thread } from '@/types/thread';

/**
 * /daily（きょうの日本人選手ハブ）の増補ブロック群（2026-09-16）。
 *
 * なぜ要るか: ハブは「3行＋カード画像＋記事へのボタン」だけで、検索で来た人（日本人 メジャー 今日の結果）が
 * 「全員の結果」「主役の中身」「明日は誰が投げる」を知るには記事へ1回跳ぶ必要があった。ここで
 *   ① 全員の結果を1表で（主役＋残り全員・きょうの成績・今季）
 *   ② 主役の現地の声をいちばん票の多い2件だけ先出し
 *   ③ きょうの現地ざわつきの見出しと「あすの日本人」
 *   ④ この1週間の主役／主役に選ばれた回数（コレクションとしての面白さ＝再訪の理由）
 * を出す。すべて日次記事 JSON の再表示・集計＝ここで新しい事実は作らない。文言はインライン bilingual
 * （ボードLPと同じ流儀・messages は既存キーのみ）。
 */

function PlayerLink({ name, className }: { name: string; className?: string }) {
  const slug = playerSlugByJaName(name);
  return slug ? (
    <Link href={`/player/${slug}`} className={`${className ?? ''} hover:underline`}>
      {name}
    </Link>
  ) : (
    <span className={className}>{name}</span>
  );
}

/** ① きょうの日本人 全員の結果（主役＋残り全員を1表に）。 */
export function DailyTodayTable({ latest, locale }: { latest: Thread; locale: string }) {
  const en = locale === 'en';
  const rows = dailyRows(latest.daily!);
  const t = en
    ? { heading: 'Every Japanese player today', player: 'Player', game: 'Team · Result', line: 'Today', season: 'Season', hero: 'Player of the day' }
    : { heading: 'きょうの日本人 全員の結果', player: '選手', game: '所属 · 結果', line: 'きょうの成績', season: '今季', hero: '主役' };
  return (
    <section>
      <SectionHeading label={t.heading} count={rows.length} lead level="h2" />
      <div className="mt-4 overflow-x-auto rounded-[2px] border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-mute">
              <th className="px-3 py-2 text-left font-medium">{t.player}</th>
              <th className="px-3 py-2 text-left font-medium">{t.game}</th>
              <th className="px-3 py-2 text-left font-medium">{t.line}</th>
              <th className="px-3 py-2 text-left font-medium">{t.season}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player} className={`border-b border-line last:border-0 ${r.isHero ? 'bg-ink/[0.04]' : ''}`}>
                <td className="px-3 py-2.5 align-top">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PlayerLink name={r.player} className={r.isHero ? 'font-bold text-ink' : 'font-medium text-ink'} />
                    {r.isHero && (
                      <span className="rounded-[2px] border border-ink/30 px-1 py-px text-[10px] font-medium leading-none text-ink-mute">{t.hero}</span>
                    )}
                    {r.note && (
                      <span className="rounded-[2px] border border-ink px-1 py-px text-[10px] font-semibold leading-none text-ink">{r.note}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 align-top text-xs leading-relaxed">
                  <span className="text-ink-mute">{r.team}</span>
                  <span className="block tabular-nums text-ink-soft">{r.result}</span>
                </td>
                <td className="px-3 py-2.5 align-top tabular-nums text-ink">{r.line}</td>
                <td className="px-3 py-2.5 align-top text-xs leading-relaxed tabular-nums text-ink-mute">{r.season ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** ② きょうの主役＝票の多い現地の声2件だけ先出し＋動画サムネ＋記事への導線。 */
export function DailyHeroTeaser({ latest, locale }: { latest: Thread; locale: string }) {
  const en = locale === 'en';
  const d = latest.daily!;
  const quotes = heroTopQuotes(d, 2);
  const thumb = d.hero.media?.kind === 'video' ? d.hero.media.thumbUrl : undefined;
  const t = en
    ? { heading: 'Player of the day', voices: 'Top fan comments on this game', read: 'Read the full story and all reactions', season: 'Season' }
    : { heading: 'きょうの主役', voices: 'この試合への現地の声（票の多い順）', read: '主役の物語と反応を全部読む', season: '今季' };
  return (
    <section>
      <SectionHeading label={t.heading} lead level="h2" />
      <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-line bg-line md:grid-cols-5">
        <div className="bg-paper px-4 py-4 md:col-span-3">
          <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-bold text-ink">
            <PlayerLink name={d.hero.player} />
            {d.hero.note && <span className="rounded-[2px] border border-ink/30 px-2 py-0.5 text-sm font-semibold text-ink">{d.hero.note}</span>}
          </h3>
          <p className="mt-1.5 text-sm text-ink-soft">
            <span className="mr-2 text-xs text-ink-mute">{d.hero.team}</span>
            <span className="tabular-nums">{d.hero.result}</span>
          </p>
          <p className="mt-1 text-sm tabular-nums text-ink">{d.hero.line}</p>
          {d.hero.season && (
            <p className="mt-0.5 text-xs tabular-nums text-ink-mute">
              {t.season} {d.hero.season}
            </p>
          )}
          {quotes.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">{t.voices}</p>
              <ul className="mt-2 space-y-3">
                {quotes.map((c, i) => (
                  <li key={i} className="border-l-2 border-line pl-4">
                    <p className="text-sm leading-relaxed text-ink">“{c.bodyJa}”</p>
                    <p className="mt-1 text-xs text-ink-mute">
                      {c.author} <span className="tabular-nums">👍{(c.score ?? 0).toLocaleString()}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-5">
            <Link
              href={`/mlb/${latest.id}`}
              className="inline-flex min-h-[44px] items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition-opacity hover:opacity-85"
            >
              {t.read}
              <span aria-hidden>→</span>
            </Link>
          </p>
        </div>
        <div className="bg-paper md:col-span-2">
          {thumb ? (
            <Link href={`/mlb/${latest.id}`} className="block h-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- YouTube の公式サムネを直リンク（再ホストしない） */}
              <img src={thumb} alt={d.hero.media?.videoTitle ?? ''} loading="lazy" className="h-full w-full object-cover" />
            </Link>
          ) : d.cardUrl ? (
            <Link href={`/mlb/${latest.id}`} className="block">
              <Image src={d.cardUrl} alt="" width={540} height={675} className="h-auto w-full" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** ③ きょうの現地ざわつき（見出しだけ）＋ あすの日本人。 */
export function DailyBuzzAndTomorrow({ latest, locale }: { latest: Thread; locale: string }) {
  const en = locale === 'en';
  const d = latest.daily!;
  const buzz = d.buzz ?? [];
  const tomorrow = d.tomorrow ?? [];
  if (!buzz.length && !tomorrow.length) return null;
  const t = en
    ? { buzz: 'What local fans buzzed about', tomorrow: 'Tomorrow’s Japanese players', more: 'Read →' }
    : { buzz: 'きょうの現地ざわつき', tomorrow: 'あすの日本人', more: '読む →' };
  return (
    <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {buzz.length > 0 && (
        <div>
          <SectionHeading label={t.buzz} count={buzz.length} level="h2" />
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {buzz.map((b) => (
              <li key={b.title} className="py-3">
                <Link href={`/mlb/${latest.id}`} className="group block">
                  <p className="font-bold leading-snug text-ink group-hover:underline">{b.title}</p>
                  {b.result && <p className="mt-1 text-xs tabular-nums text-ink-mute">{b.result}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tomorrow.length > 0 && (
        <div>
          <SectionHeading label={t.tomorrow} level="h2" />
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink">
            {tomorrow.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="mt-[0.7em] h-px w-4 shrink-0 bg-ink" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** ④ この1週間の主役（最新号を除く直近7号）。 */
export function DailyWeekHeroes({ issues, locale }: { issues: Thread[]; locale: string }) {
  const en = locale === 'en';
  const week = issues.slice(1, 8).filter((th) => th.daily?.hero);
  if (!week.length) return null;
  const t = en ? { heading: 'Players of the day, past week' } : { heading: 'この1週間の主役' };
  return (
    <section>
      <SectionHeading label={t.heading} level="h2" />
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[2px] border border-line">
        {week.map((th) => {
          const h = th.daily!.hero;
          return (
            <li key={th.id}>
              <Link href={`/mlb/${th.id}`} className="group flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-ink/[0.04]">
                <div className="min-w-0">
                  <p className="text-xs tabular-nums text-ink-mute">
                    {issueDate(th.fetchedAt)} · No.{String(th.daily!.cardNo ?? '').padStart(3, '0')}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-bold text-ink group-hover:underline">{h.player}</span>
                    {h.note && <span className="text-sm font-semibold text-ink">{h.note}</span>}
                    <span className="text-xs tabular-nums text-ink-soft">{h.line}</span>
                  </p>
                </div>
                <span aria-hidden className="mt-1 shrink-0 text-ink-mute transition-transform group-hover:translate-x-0.5 group-hover:text-ink">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** ⑤ 主役に選ばれた回数（全号の集計）＝コレクションの「誰がいちばん表紙になったか」。 */
export function DailyHeroCounts({ issues, locale }: { issues: Thread[]; locale: string }) {
  const en = locale === 'en';
  const counts = heroCounts(issues).slice(0, 8);
  if (!counts.length) return null;
  const max = counts[0].count;
  const t = en
    ? { heading: 'Most times as player of the day', lead: `Across all ${issues.length} issues. Chosen purely by the day’s numbers.`, times: (n: number) => `${n}×` }
    : { heading: '主役に選ばれた回数', lead: `全${issues.length}号の集計。主役はその日の成績の数字だけで決まります。`, times: (n: number) => `${n}回` };
  return (
    <section>
      <SectionHeading label={t.heading} level="h2" />
      <p className="mt-2 text-xs text-ink-mute">{t.lead}</p>
      <ul className="mt-3 space-y-2">
        {counts.map((c) => (
          <li key={c.player} className="flex items-center gap-3 text-sm tabular-nums">
            <span className="w-28 shrink-0 truncate">
              <PlayerLink name={c.player} className="font-medium text-ink" />
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-[1px] bg-line" aria-hidden>
              <span className="block h-full bg-ink" style={{ width: `${Math.max(3, Math.round((c.count / max) * 100))}%` }} />
            </span>
            <span className="w-12 shrink-0 text-right text-ink">{t.times(c.count)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
