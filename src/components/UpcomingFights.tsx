import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { fightDayJa, upcomingFights } from '@/lib/fighterHub';
import type { Sport } from '@/lib/sports';

/**
 * 「次の試合」＝ fighters.ts の nextFightJa を試合日順に並べた一覧（ja のみ）。
 *
 * 狙いは内部リンクの網。格闘技は試合が数ヶ月に1度＝記事タグ経由の相互リンクが育たないので、
 * ファイターLP・競技LP・/browse・イベントハブのどこに着地しても「次に何があるか」から
 * 各LPとイベントハブ（/rizin5 等）へ1タップで回れるようにする。イベントハブを持たない
 * 大会（UFC・Prime Video Boxing 等）もここには載るので、ハブの有無に関係なく網が張れる。
 *
 * 数値・大会名は裏取り済みカタログの再表示のみ。until を過ぎた試合はビルド時に自動で消える。
 */
export default async function UpcomingFights({
  sport,
  excludeSlug,
}: {
  /** 競技で絞る（競技LP用）。省略時は全ファイター */
  sport?: Sport;
  /** 自分自身を出さない（ファイターLP用） */
  excludeSlug?: string;
}) {
  const fights = upcomingFights({ sport, excludeSlug });
  if (fights.length === 0) return null;
  const t = await getTranslations();

  return (
    <section className="space-y-5">
      <SectionHeading label={t('upcoming.heading')} count={fights.length} />
      <div className="divide-y divide-line border-y border-line">
        {fights.map(({ fighter, next }) => (
          <div key={fighter.slug} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3.5">
            <span className="shrink-0 text-xs tabular-nums text-ink-mute">{fightDayJa(next.until)}</span>
            <Link
              href={`/tag/${encodeURIComponent(fighter.nameJa)}`}
              className="group text-sm font-semibold text-ink transition-colors hover:text-ink-soft"
            >
              {fighter.nameJa}
              <span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <span className="text-sm text-ink-soft">
              vs {next.opponentJa ?? next.labelJa}
            </span>
            {next.eventJa && (
              <span className="w-full text-xs text-ink-mute sm:ml-auto sm:w-auto">
                {/* 大会名アンカーはイベントハブの検索フレーズそのまま（ハブがある大会のみリンク）。 */}
                {next.href ? (
                  <Link
                    href={next.href}
                    className="underline underline-offset-2 transition-colors hover:text-ink"
                  >
                    {next.eventJa}
                  </Link>
                ) : (
                  next.eventJa
                )}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
