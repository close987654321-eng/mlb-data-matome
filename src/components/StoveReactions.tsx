import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { threadTitle } from '@/lib/series';
import { formatUpdatedAt } from '@/lib/format';
import type { Thread } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/** 最初に開いておく本数。オフは記事が増え続けるので、残りは畳む。 */
const OPEN = 6;

function Item({ t, locale }: { t: Thread; locale: Locale }) {
  const en = locale === 'en';
  return (
    <li>
      <Link href={`/${t.sport}/${t.id}`} className="group block py-3.5">
        <span className="block text-[15px] font-semibold leading-snug text-ink group-hover:underline">
          {threadTitle(t, locale)}
        </span>
        <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink-mute">
          <span>{t.subreddit}</span>
          {t.totalComments > 0 && <span>{en ? `${t.totalComments} comments` : `コメント${t.totalComments}件`}</span>}
          <time dateTime={t.fetchedAt}>{formatUpdatedAt(t.fetchedAt, locale)}</time>
        </span>
      </Link>
    </li>
  );
}

/**
 * ストーブリーグの海外の反応（このサイトの本体）。
 *
 * 以前は画像つきの大きなカードを並べ、ページの14画面目にあった（2026-10-29 のレビュー）。
 * 見出しと出どころだけの一覧にして、日本人の去就のすぐ下に置く＝「誰がどうなるか」を見た人が
 * そのまま「現地はどう見ているか」へ進める。
 */
export default function StoveReactions({ threads, locale }: { threads: Thread[]; locale: Locale }) {
  const en = locale === 'en';
  const head = threads.slice(0, OPEN);
  const rest = threads.slice(OPEN);
  return (
    <section id="reactions">
      <SectionHeading
        label={en ? 'Overseas reactions' : 'ストーブリーグの海外の反応'}
        count={threads.length || undefined}
        lead
      />
      {threads.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          {en ? 'Articles will appear here as the winter moves.' : '動きがあるたびに、ここに記事が並びます。'}
        </p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-line border-b border-line">
            {head.map((t) => (
              <Item key={t.id} t={t} locale={locale} />
            ))}
          </ul>
          {rest.length > 0 && (
            <details className="group">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-center border-b border-line text-sm font-semibold text-ink hover:bg-ink/[0.02] [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">{en ? `Show ${rest.length} more` : `残り${rest.length}本を表示`}</span>
                <span className="hidden group-open:inline">{en ? 'Show fewer' : '閉じる'}</span>
              </summary>
              <ul className="divide-y divide-line border-b border-line">
                {rest.map((t) => (
                  <Item key={t.id} t={t} locale={locale} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
