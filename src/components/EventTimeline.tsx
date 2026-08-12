import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { eventHref, isUpcomingEvent, ORG_LABEL, timelineEvents, type FightEvent } from '@/lib/events';

/**
 * 大会スケジュール・アーカイブの年表。開催前（近い順）→ 終了（新しい順）。
 * 大会が終わってもエントリは残る＝時間が経つほどここがRIZINのアーカイブとして厚くなる。
 * リンク先は 特設/イベントページ ＞ 結果まとめ記事 ＞ リンク無し の順で解決（events.ts が正）。
 */
export default async function EventTimeline({
  excludeSlug,
}: {
  /** イベントページ自身に置くとき、自分の行を出さない */
  excludeSlug?: string;
} = {}) {
  const events = timelineEvents().filter((e) => e.slug !== excludeSlug);
  if (events.length === 0) return null;
  const t = await getTranslations();

  return (
    <section className="space-y-5">
      <SectionHeading label={t('events.timelineHeading')} count={events.length} />
      <div className="divide-y divide-line border-y border-line">
        {events.map((e) => (
          <EventRow key={e.slug} event={e} hubLabel={t('events.hub')} resultsLabel={t('events.results')} doneLabel={t('events.done')} />
        ))}
      </div>
    </section>
  );
}

function EventRow({
  event,
  hubLabel,
  resultsLabel,
  doneLabel,
}: {
  event: FightEvent;
  hubLabel: string;
  resultsLabel: string;
  doneLabel: string;
}) {
  const upcoming = isUpcomingEvent(event);
  const href = eventHref(event);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3.5">
      <span className="shrink-0 text-xs tabular-nums text-ink-mute">{event.date.replaceAll('-', '.')}</span>
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.15em] text-ink-mute">
        {ORG_LABEL[event.org]}
      </span>
      {href ? (
        <Link
          href={href}
          className="group text-sm font-semibold text-ink transition-colors hover:text-ink-soft"
        >
          {event.nameJa}
          <span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      ) : (
        <span className="text-sm font-semibold text-ink">{event.nameJa}</span>
      )}
      {event.venueJa && (
        <span className="text-xs text-ink-mute">
          {event.venueJa}
          {event.cityJa && `（${event.cityJa}）`}
        </span>
      )}
      <span className="ml-auto shrink-0 text-xs text-ink-soft">
        {/* 終了大会は結果まとめ記事へ（「{大会名} 結果」クエリの受け皿は記事側＝共食い防止）。 */}
        {!upcoming && event.archiveHref ? (
          <Link href={event.archiveHref} className="underline underline-offset-2 transition-colors hover:text-ink">
            {resultsLabel} →
          </Link>
        ) : !upcoming ? (
          doneLabel
        ) : href ? (
          hubLabel
        ) : null}
      </span>
    </div>
  );
}
