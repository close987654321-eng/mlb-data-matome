import SectionHeading from '@/components/SectionHeading';
import { POSTSEASON_BROADCAST, showBroadcast, type PostseasonData } from '@/lib/postseason';
import type { Locale } from '@/lib/i18n';

/**
 * 日本での放送・配信。「mlb ポストシーズン 放送」は Google トレンドの関連キーワード（30日・日本）で
 * 急上昇の1位（2026-10-06 確認）＝トーナメント表を見に来た人の次の問い。中身は POSTSEASON_BROADCAST
 * （各社の公式発表の範囲）だけで、閉幕後・年が合わない年は出さない。
 * アフィリエイトの導線は文中に混ぜず、この直後の VodCta（PR表記＋rel=sponsored）に分ける。
 */
export default function PostseasonBroadcast({ data, locale }: { data: PostseasonData; locale: Locale }) {
  if (!showBroadcast(data)) return null;
  const en = locale === 'en';
  const b = POSTSEASON_BROADCAST;
  return (
    <section id="watch" className="space-y-4">
      <div>
        <SectionHeading label={en ? 'How to watch in Japan' : '日本での放送・配信'} lead level="h2" />
        <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
          {en
            ? `Where the ${data.season} postseason airs in Japan, per the broadcasters’ announcements.`
            : `${data.season}年のポストシーズンを日本で見る方法です。各社の公式発表の範囲でまとめています。`}
        </p>
      </div>
      <dl className="divide-y divide-line border-y border-line">
        {b.items.map((i) => (
          <div key={i.name} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
            <dt className="text-sm font-bold text-ink">{en && 'nameEn' in i ? i.nameEn : i.name}</dt>
            <dd className="text-sm leading-relaxed text-ink-soft">{en ? i.en : i.ja}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-mute">{en ? b.sourceEn : b.sourceJa}</p>
    </section>
  );
}
