import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import EventCountdown from '@/components/EventCountdown';
import { eventHref, ORG_LABEL, upcomingEvents } from '@/lib/events';

/**
 * /mma ポータル最上段の「次の大会」枠。旧 Rizin5Promo（単発バナー）の後継＝
 * レジストリ（events.ts）から直近の大会を主役に据え、その先の開催予定も1列で見せる。
 * 大会が終わればビルド時に自動で次へ繰り上がる＝バナーの張り替え作業を無くす。
 */
export default async function UpcomingEvents() {
  const events = upcomingEvents();
  if (events.length === 0) return null;
  const t = await getTranslations();
  const [next, ...rest] = events;
  const nextHref = eventHref(next);

  return (
    <section className="border border-ink">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
            {t('events.nextEyebrow')} · {ORG_LABEL[next.org]}
          </span>
          <EventCountdown
            dateIso={next.date}
            daysLeftLabel={t.raw('events.daysLeft') as string}
            todayLabel={t('events.today')}
            doneLabel={t('events.done')}
          />
        </div>
        <h2 className="mt-2 text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">
          {next.nameJa}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {next.dateLabelJa}
          {next.venueJa && <span> ・ {next.venueJa}</span>}
          {next.cityJa && <span>（{next.cityJa}）</span>}
        </p>
        {nextHref && (
          <p className="mt-4">
            <Link
              href={nextHref}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
            >
              {t('events.hubCta')} <span aria-hidden>→</span>
            </Link>
          </p>
        )}
      </div>
      {rest.length > 0 && (
        <div className="divide-y divide-line border-t border-line">
          {rest.map((e) => {
            const href = eventHref(e);
            return (
              <div key={e.slug} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 sm:px-6">
                <span className="shrink-0 text-xs tabular-nums text-ink-mute">{e.date.replaceAll('-', '.')}</span>
                {href ? (
                  <Link
                    href={href}
                    className="group text-sm font-semibold text-ink transition-colors hover:text-ink-soft"
                  >
                    {e.nameJa}
                    <span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-ink">{e.nameJa}</span>
                )}
                {e.venueJa && <span className="text-xs text-ink-mute">{e.venueJa}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
