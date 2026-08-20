import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { threadTitle } from '@/lib/series';
import { VOICES_VISIBLE, voiceDate, voiceFormat, type TagVoice } from '@/lib/tagHub';
import type { Locale } from '@/lib/i18n';

/**
 * 選手・ファイタータグLPの「現地ファンの声ピックアップ」。
 * 縦一列（1件1行）で、初期表示は VOICES_VISIBLE 件・残りは <details> のネイティブ開閉で畳む
 * ＝クライアントJSなしの「もっと見る」。閉じていても HTML には全件載る（クローラは全文を読める）。
 * 中身の選び方と日替わりローテーションは tagHubVoices（src/lib/tagHub.ts）が正。
 */
export default function TagVoices({
  voices,
  locale,
  label,
}: {
  voices: TagVoice[];
  locale: Locale;
  label: string;
}) {
  const t = useTranslations();
  if (voices.length === 0) return null;

  const rows = voices.map((voice, i) => {
    const { thread, comment, game } = voice;
    const body = locale === 'ja' ? comment.bodyJa : comment.bodyEn || comment.bodyJa;
    const format = voiceFormat(voice);
    const isYoutube = format === 'youtube';
    const isInterview = format === 'interview';
    return (
      // 同じ記事から複数の声を拾うことがあるので、キーは記事IDだけでは一意にならない
      <li key={`${thread ? `${thread.sport}/${thread.id}` : game?.url}/${i}`} className="py-4">
        <p className="text-sm leading-relaxed text-ink">“{body}”</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-ink-mute">
          <span className="shrink-0 font-medium text-ink-soft">
            {isYoutube || isInterview ? comment.author : `u/${comment.author}`}
          </span>
          {!isInterview && (
            <span className="shrink-0 tabular-nums">
              {isYoutube ? '👍' : '▲'} {comment.score.toLocaleString()}
            </span>
          )}
          {thread ? (
            <Link
              href={`/${thread.sport}/${thread.id}`}
              className="group/row ml-auto flex min-w-0 items-center gap-1 transition-colors hover:text-ink"
            >
              <span className="truncate">
                {thread.fetchedAt.slice(0, 10)} ・ {threadTitle(thread, locale)}
              </span>
              <span
                aria-hidden
                className="shrink-0 transition-transform group-hover/row:translate-x-0.5"
              >
                →
              </span>
            </Link>
          ) : (
            // 声レイヤー由来（まとめ記事が無い試合の声）＝送客先は引用元の公式ハイライト。
            game && (
              <a
                href={game.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/row ml-auto flex min-w-0 items-center gap-1 transition-colors hover:text-ink"
              >
                <span className="truncate">
                  {voiceDate(voice)} ・ {game.label}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 transition-transform group-hover/row:translate-x-0.5"
                >
                  ↗
                </span>
              </a>
            )
          )}
        </div>
      </li>
    );
  });
  const head = rows.slice(0, VOICES_VISIBLE);
  const rest = rows.slice(VOICES_VISIBLE);

  return (
    <section className="space-y-3">
      <SectionHeading label={label} count={voices.length} />
      <div className="border-y border-line">
        <ul className="divide-y divide-line">{head}</ul>
        {rest.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 border-t border-line py-2.5 text-xs text-ink-soft transition-colors hover:text-ink group-open:hidden [&::-webkit-details-marker]:hidden">
              {t('tag.voicesMore', { count: rest.length })}
              <span aria-hidden>↓</span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">{rest}</ul>
          </details>
        )}
      </div>
    </section>
  );
}
