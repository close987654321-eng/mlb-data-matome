import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { threadTitle } from '@/lib/series';
import { allComments } from '@/lib/daily';
import { reasonLabel, type Ranked } from '@/lib/nextRead';
import type { Locale } from '@/lib/i18n';

/**
 * オチ直後（感情のピーク）に置く「次に読む」プライムカード。回遊の一等地。
 * ページ唯一の塗り CTA をここへ移し、次記事のフック引用を大きく見せて内部回遊へ引き込む。
 * 元スレ（外部）ボタンは footer でテキストリンクに降格＝「去る」導線より「次を読む」導線を上に置く。
 *
 * pick は nextRead.rankNextReads の最上位。thread のときだけプライムカードにする
 * （フック引用を見せられるため）。column のときは null を返し、related 側で通常カードとして出す。
 * 配色は無彩色（サイトの design system＝赤は題字罫とシリーズバッジ専用）。塗りは footer から移設した ink 塗り。
 */
export default async function NextReadCard({ pick, locale }: { pick: Ranked; locale: Locale }) {
  const t = await getTranslations();
  const { item, reason } = pick;
  if (item.kind !== 'thread') return null;

  const thread = item.thread;
  const title = threadTitle(thread, locale);
  const teaserComment =
    (() => {
      // 日次記事はコメントを本文ブロックに持つので allComments を通す（直接見ると引用が空になる）。
      const cs = allComments(thread);
      return cs.find((c) => c.isHook) ?? cs.find((c) => c.isHighlight) ?? cs[0];
    })();
  const teaser = teaserComment
    ? locale === 'ja'
      ? teaserComment.bodyJa
      : teaserComment.bodyEn || teaserComment.bodyJa
    : '';
  const label = reasonLabel(reason, locale, t as (key: string) => string);

  return (
    <Link
      href={`/${thread.sport}/${thread.id}`}
      className="group mt-10 block rounded-[3px] border border-ink/20 bg-ink/[0.03] p-6 transition-colors hover:bg-ink/[0.06]"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
        {t('nextRead.eyebrow')}
        {label.strong ? ` · ${label.text}` : ''}
      </span>
      <p className="mt-3 text-lg font-bold leading-snug text-ink sm:text-xl">{title}</p>
      {teaser && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">“{teaser}”</p>
      )}
      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors group-hover:bg-ink-soft">
        {t('nextRead.cta')}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
