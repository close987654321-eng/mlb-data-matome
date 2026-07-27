import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import type { Thread } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

const VISIBLE = 5;

/**
 * トップ最上段の「きょうのMLB」ダイジェスト。
 * GSC実測（2026-07-27）: 「mlb 海外の反応」クラスタ（週600〜700imp・6位台）はほぼ全て
 * トップ「/」に着地する一方 CTR 0.5%＝クリック後に MLB の最新まとめへ即たどり着けない。
 * 検索者が最初に見る位置で当日のMLBまとめを見出し＋更新時刻で提示し、
 * フレーズ一致アンカー（seeAllSport）で /mlb LP へも送客する。
 * 6件目以降は <details> のネイティブ開閉で畳む＝クライアントJSなしの「もっと見る」
 * （閉じていてもHTMLには載る＝トップからの内部リンクとしては全件有効）。
 */
export default function MlbToday({
  threads,
  count,
  label,
  locale,
}: {
  threads: Thread[];
  count: number;
  label: string;
  locale: Locale;
}) {
  const t = useTranslations();
  if (threads.length === 0) return null;
  // 表示は常にJST（サイト規律: ETは書かない）。SSGのためサーバTZに依存させず明示する。
  const stamp = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const row = (th: Thread) => (
    <li key={th.id}>
      <Link href={`/mlb/${th.id}`} className="group/row flex items-baseline gap-3 py-2.5">
        <time className="shrink-0 text-[11px] tabular-nums text-ink-mute">
          {stamp(th.fetchedAt)}
        </time>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink group-hover/row:underline">
          {locale === 'en' ? th.title.en : th.title.ja}
        </span>
        <span className="hidden shrink-0 text-[11px] tabular-nums text-ink-soft sm:inline">
          {t('threads.commentCount', { count: th.totalComments })}
        </span>
      </Link>
    </li>
  );
  const head = threads.slice(0, VISIBLE);
  const rest = threads.slice(VISIBLE);
  return (
    <section className="space-y-3">
      <SectionHeading
        label={t('home.mlbToday')}
        count={count}
        seeAllHref="/mlb"
        seeAllLabel={t('home.seeAllSport', { label })}
        lead
      />
      <div className="border-y border-line">
        <ul className="divide-y divide-line">{head.map(row)}</ul>
        {rest.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 border-t border-line py-2.5 text-xs text-ink-soft transition-colors hover:text-ink group-open:hidden [&::-webkit-details-marker]:hidden">
              {t('home.mlbTodayMore', { count: rest.length })}
              <span aria-hidden>↓</span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">{rest.map(row)}</ul>
            <div className="border-t border-line py-2.5 text-center">
              <Link href="/mlb" className="text-xs text-ink-soft transition-colors hover:text-ink">
                {t('home.seeAllSport', { label })} <span aria-hidden>→</span>
              </Link>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
