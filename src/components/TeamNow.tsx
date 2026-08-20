import { useTranslations } from 'next-intl';
import SectionHeading from '@/components/SectionHeading';
import { threadTitle } from '@/lib/series';
import { divisionLabel, type StandingRow, type StandingsDivision } from '@/lib/standings';
import type { TeamHub } from '@/lib/teamHub';
import { voiceDate, voiceFormat, type TagVoice } from '@/lib/tagHub';
import type { Locale } from '@/lib/i18n';

/**
 * チームタグLPの「いま」ブロック＝選手LPの PlayerNow のチーム版。
 * 「{チーム名} 海外の反応」で着地した人の第一意図「直近、現地はどう言ってる？／今どういう状況？」に
 * ファーストビューで答える: 最新の声1つ＋順位・勝敗・ゲーム差の現在地。
 *
 * 数値はすべて data/standings.json（CI が毎時更新する公知の事実）の再表示で、ここでは何も計算で
 * 作らない。順位表が未生成なら声だけ・声が拾えなければ数字だけに退化する（ビルド安全）。
 * 直近の試合そのものは、このすぐ下の TeamGames（試合タイムライン）が受け持つ＝ここには出さない。
 */

/** 連勝/連敗コード（"W3" / "L2"）を読める日本語に。未知の書式はそのまま出す（捏造しない）。 */
function streakLabel(streak: string | undefined, locale: Locale): string | null {
  if (!streak) return null;
  if (locale === 'en') return streak;
  const m = streak.match(/^([WL])(\d+)$/);
  if (!m) return streak;
  return `${m[2]}${m[1] === 'W' ? '連勝' : '連敗'}`;
}

export default function TeamNow({
  locale,
  hub,
  standing,
  asOf,
  voice,
  gamesAnchor,
}: {
  locale: Locale;
  hub: TeamHub;
  standing: { row: StandingRow; division: StandingsDivision } | null;
  asOf?: string;
  voice: TagVoice | null;
  /** 直近の試合セクションが下にあるか（フッターのジャンプを出すかの判定）。 */
  gamesAnchor: boolean;
}) {
  const t = useTranslations();
  const en = locale === 'en';
  const name = en ? hub.info.nameEn : hub.nameJa;

  const row = standing?.row;
  const bigs: { label: string; value: string }[] = row
    ? [
        {
          label: standing ? divisionLabel(standing.division, locale) : '',
          value: en ? `#${row.rank}` : `${row.rank}位`,
        },
        { label: t('tag.statWl'), value: `${row.w}-${row.l}` },
        { label: t('tag.statPct'), value: row.pct },
      ]
    : [];

  const streak = streakLabel(row?.streak, locale);
  const quoteBody = voice
    ? (locale === 'ja' ? voice.comment.bodyJa : voice.comment.bodyEn || voice.comment.bodyJa).trim()
    : '';

  if (bigs.length === 0 && !quoteBody) return null;

  return (
    <section className="space-y-5">
      <SectionHeading
        label={quoteBody ? t('tag.now', { name }) : t('tag.teamPanelTitle', { name })}
      />
      <div className="rounded-[3px] border border-line bg-surface p-5 sm:p-6">
        {/* 最新の声＝このLPの顔。「{チーム名} 海外の反応」の意図に最初の1画面で答える。 */}
        {voice && quoteBody && (
          <figure className="border-b border-line pb-5">
            <blockquote className="max-w-prose text-lg font-bold leading-relaxed text-ink sm:text-xl">
              “{quoteBody}”
            </blockquote>
            <figcaption className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-mute">
              <span className="font-medium text-ink-soft">
                {voiceFormat(voice) === 'reddit'
                  ? `u/${voice.comment.author}`
                  : voice.comment.author}
              </span>
              {voiceFormat(voice) !== 'interview' && (
                <span className="tabular-nums">
                  {voiceFormat(voice) === 'youtube' ? '👍' : '▲'}{' '}
                  {voice.comment.score.toLocaleString()}
                </span>
              )}
              {/* 出どころ＝記事（内部リンク先はこの下の一覧が持つ）か、声レイヤーなら試合のカード。 */}
              <span className="min-w-0 truncate">
                {voiceDate(voice)} ・{' '}
                {voice.thread ? threadTitle(voice.thread, locale) : voice.game?.label}
              </span>
            </figcaption>
          </figure>
        )}

        {/* 数字の現在地＝順位・勝敗・勝率とゲーム差。声（上）を状況で裏づける。 */}
        {bigs.length > 0 && row && (
          <div className={quoteBody ? 'mt-5 border-t border-line pt-5' : ''}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <dl className="grid grid-cols-3 gap-x-8 gap-y-1">
                {bigs.map((b) => (
                  <div key={b.label}>
                    <dt className="text-xs text-ink-mute">{b.label}</dt>
                    <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-ink sm:text-3xl">
                      {b.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="text-right">
                <p className="text-xs text-ink-mute">{t('tag.statGb')}</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-ink sm:text-3xl">
                  {row.gb}
                </p>
                {(row.last10 || streak) && (
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {[row.last10 ? t('tag.statLast10', { record: row.last10 }) : null, streak]
                      .filter(Boolean)
                      .join(en ? ' · ' : ' ・ ')}
                  </p>
                )}
              </div>
            </div>
            {asOf && (
              <p className="mt-3 text-right text-xs text-ink-mute">
                {t('tag.asOfDate', { date: asOf.slice(0, 10) })}
              </p>
            )}
          </div>
        )}

        {gamesAnchor && (
          <div className="mt-5 border-t border-line pt-3.5">
            <a
              href="#team-games"
              className="inline-flex items-center gap-1 text-sm font-semibold text-ink transition-colors hover:text-ink-soft"
            >
              {t('tag.teamGamesJump')}
              <span aria-hidden>↓</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
