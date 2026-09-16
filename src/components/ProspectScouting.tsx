import SectionHeading from '@/components/SectionHeading';
import type { NpbProspect } from '@/lib/npbPlayers';

/**
 * NEXT MLB 選手LPの「海外の評価」＝強みと懸念を左右で対にして出す。
 *
 * なぜ地の文（mlbWatch）と別に要るか: 1段落だと長所と不安が溶けて、どちらを読みに来た人にも
 * 刺さらない。実際の検索は「{選手名} 守備 不安」「{選手名} 課題」「{選手名} 評価」と割れている。
 * 媒体名（sourceName）は伝聞の出所を示すために必ず添える＝編集部の断定に見せない。
 *
 * 色は使わない（サイトのデザイン規律＝無彩色）。強み/懸念の別は見出しと記号だけで示す。
 */
export default function ProspectScouting({
  scouting,
  en,
  heading,
  strengthsLabel,
  concernsLabel,
}: {
  scouting: NonNullable<NpbProspect['scouting']>;
  en: boolean;
  heading: string;
  strengthsLabel: string;
  concernsLabel: string;
}) {
  const col = (
    label: string,
    mark: string,
    items: { ja: string; en: string; sourceName?: string }[],
  ) =>
    items.length > 0 && (
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink-mute">{label}</p>
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.en} className="flex gap-2.5">
              <span aria-hidden className="mt-[3px] shrink-0 text-xs text-ink-mute">
                {mark}
              </span>
              <p className="text-sm leading-relaxed text-ink-soft">
                {en ? item.en : item.ja}
                {item.sourceName && (
                  <span className="ml-1.5 whitespace-nowrap text-xs text-ink-mute">
                    （{item.sourceName}）
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section>
      <div className="mb-3">
        <SectionHeading label={heading} />
      </div>
      <div className="grid gap-8 rounded-[2px] border border-line bg-surface p-5 sm:grid-cols-2 sm:gap-10">
        {col(strengthsLabel, '＋', scouting.strengths)}
        {col(concernsLabel, '−', scouting.concerns)}
      </div>
    </section>
  );
}
