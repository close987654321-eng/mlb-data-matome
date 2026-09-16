import SectionHeading from '@/components/SectionHeading';
import type { NpbProspect } from '@/lib/npbPlayers';

/**
 * NEXT MLB 選手LPの「ポスティング最新情報」ブロック。
 *
 * なぜ `posting`（通年の一般論）と別に要るか: オフが近づくと検索意図が
 * 「{選手名} ポスティング」「{選手名} メジャー どこ」＝**いつ・どこが・誰が報じたか**に変わる。
 * 段落1つでは答えられないので、現在地（level/headline）・関心球団・報道の時系列を分けて出す。
 * 値は npbPlayers.ts のカタログの再表示のみ＝ここで推測・計算をしない（§4.4）。
 *
 * 色は使わない（デザイン規律＝無彩色／赤は題字罫と SeriesBadge の2点のみ）。段階は
 * ドットの塗り分けだけで示し、断定に見える着色をしない＝報道ベースであることと見た目を一致させる。
 */
export default function PostingWatch({
  watch,
  en,
  heading,
  levelLabel,
  routeLabel,
  windowLabel,
  suitorsLabel,
  marketLabel,
  timelineLabel,
  asOfLabel,
}: {
  watch: NonNullable<NpbProspect['postingWatch']>;
  en: boolean;
  heading: string;
  levelLabel: string;
  /** 「ポスティング」/「海外FA」の既訳ラベル。道筋が違えば読者の次の疑問も違う。 */
  routeLabel: string;
  windowLabel: string;
  suitorsLabel: string;
  marketLabel: string;
  timelineLabel: string;
  /** 「{date} 時点」の既訳文字列。 */
  asOfLabel: string;
}) {
  return (
    <section>
      <div className="mb-3">
        <SectionHeading label={heading} />
      </div>

      <div className="rounded-[2px] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 border border-line px-2 py-1 text-xs font-medium tracking-wide text-ink">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                watch.level === 'expected'
                  ? 'bg-ink'
                  : watch.level === 'rumored'
                    ? 'bg-ink-soft'
                    : 'bg-ink-mute'
              }`}
            />
            {levelLabel}
          </span>
          {/* 道筋（ポスティング/海外FA）は段階と同じ高さに置く＝「認められるか」と「本人が決める」の
              違いが、現在地を読む前提になるため。 */}
          <span className="inline-flex items-center border border-line px-2 py-1 text-xs tracking-wide text-ink-soft">
            {routeLabel}
          </span>
          <span className="text-xs text-ink-mute">{asOfLabel}</span>
        </div>

        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink">
          {en ? watch.headline.en : watch.headline.ja}
        </p>

        {watch.window && (
          <div className="mt-4 border-t border-line/70 pt-4">
            <p className="text-xs text-ink-soft">{windowLabel}</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
              {en ? watch.window.en : watch.window.ja}
            </p>
          </div>
        )}

        {watch.suitors?.length ? (
          <div className="mt-4 border-t border-line/70 pt-4">
            <p className="text-xs text-ink-soft">{suitorsLabel}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {watch.suitors.map((s) => (
                <li
                  key={s.en}
                  className="rounded-[2px] border border-line px-2.5 py-1 text-xs text-ink-soft"
                >
                  {en ? s.en : s.ja}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {watch.marketValue?.length ? (
          <div className="mt-4 border-t border-line/70 pt-4">
            <p className="text-xs text-ink-soft">{marketLabel}</p>
            <ul className="mt-2 space-y-3">
              {watch.marketValue.map((m) => (
                <li key={m.source}>
                  <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
                    {en ? m.en : m.ja}
                  </p>
                  {/* 金額は必ず「誰が言ったか」とセットで出す＝編集部の予想に見せない。 */}
                  <a
                    href={m.source}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-1 inline-flex items-center text-xs text-ink-mute underline decoration-line underline-offset-2 transition-colors hover:text-ink"
                  >
                    {m.sourceName} <span aria-hidden className="ml-1">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {watch.timeline.length > 0 && (
          <div className="mt-4 border-t border-line/70 pt-4">
            <p className="text-xs text-ink-soft">{timelineLabel}</p>
            <ol className="mt-3 space-y-4">
              {watch.timeline.map((t) => (
                <li key={`${t.date}-${t.source}`} className="grid gap-1 sm:grid-cols-[6.5rem_1fr] sm:gap-4">
                  <p className="text-xs tabular-nums text-ink-mute">{t.date}</p>
                  <div>
                    <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
                      {en ? t.en : t.ja}
                    </p>
                    {/* 出典は必ず送客（報道ベースであることを読者が検証できる状態にする）。 */}
                    <a
                      href={t.source}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="mt-1 inline-flex items-center text-xs text-ink-mute underline decoration-line underline-offset-2 transition-colors hover:text-ink"
                    >
                      {t.sourceName} <span aria-hidden className="ml-1">↗</span>
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
