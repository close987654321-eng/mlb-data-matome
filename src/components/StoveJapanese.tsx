import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';

type Bi = { ja: string; en: string };

/** ハブで1人ぶんに出す材料。page.tsx が data と記事から組み立てて渡す（ここでは計算しない）。 */
export type StoveJpCard = {
  href: string;
  name: Bi;
  team?: Bi;
  status: { label: Bi; done: boolean; team?: Bi };
  rank?: number;
  headline: Bi;
  statLine: string;
  latest?: { date: string; ja: string; en: string; source: string; sourceName: string };
  voice?: { ja: string; author: string; href: string };
};

export type StoveNpbRow = {
  href: string;
  name: Bi;
  team: Bi;
  route: Bi;
  rank?: number;
  headline: Bi;
  statLine?: string;
};

/**
 * /stove-league の主役＝日本人選手の去就。
 *
 * なぜ表でなくカードか: 日本の読者の問いは「鈴木誠也はどこへ行くのか」で、成績の比較ではない。
 * 1人ずつ「状況→現在地の1段落→今季の数字→最新の報道→海外ファンの声」を同じ順で並べ、
 * 詳しい時系列は選手LP（/player/{slug}）に送る＝ハブは短く、LPが深い。
 * MLB組とNPB組は道筋（FA・オプトアウト／ポスティング）が違うので段を分ける。
 */
export default function StoveJapanese({
  mlb,
  npb,
  en,
  rankSource,
}: {
  mlb: StoveJpCard[];
  npb: StoveNpbRow[];
  en: boolean;
  rankSource: string;
}) {
  return (
    <section id="japanese" className="space-y-8">
      <div>
        <SectionHeading
          label={en ? 'Japanese players on the move' : '日本人選手の去就'}
          count={mlb.length + npb.length}
          lead
        />
        <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
          {en
            ? 'Where each Japanese player stands this winter, with the latest reports and what overseas fans are saying.'
            : '今オフ動く可能性がある日本人選手の現在地。最新の報道と、海外ファンの声を選手ごとにまとめています。'}
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">
          {en ? 'MLB: free agents and opt-outs' : 'MLB組（FA・オプトアウト）'}
        </h3>
        <ul className="divide-y divide-line border-y border-line">
          {mlb.map((c) => (
            <li key={c.href} className="py-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                <Link href={c.href} className="text-lg font-bold text-ink hover:text-ink-soft hover:underline">
                  {en ? c.name.en : c.name.ja}
                </Link>
                {c.team && <span className="text-xs text-ink-soft">{en ? c.team.en : c.team.ja}</span>}
                <span
                  className={`inline-flex items-center border px-2 py-0.5 text-xs ${
                    c.status.done ? 'border-ink bg-ink text-surface' : 'border-line text-ink'
                  }`}
                >
                  {en ? c.status.label.en : c.status.label.ja}
                  {c.status.team && (en ? `: ${c.status.team.en}` : `：${c.status.team.ja}`)}
                </span>
                {c.rank && (
                  <span className="text-xs text-ink-mute">
                    {en ? `${rankSource} No. ${c.rank}` : `${rankSource} ${c.rank}位`}
                  </span>
                )}
              </div>

              <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink">{en ? c.headline.en : c.headline.ja}</p>
              {c.statLine && (
                <p className="mt-2 text-sm tabular-nums text-ink-soft">
                  <span className="mr-2 text-xs text-ink-mute">{en ? '2026' : '今季'}</span>
                  {c.statLine}
                </p>
              )}

              {c.latest && (
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
                  <span className="mr-2 text-xs tabular-nums text-ink-mute">{c.latest.date.slice(5).replace('-', '/')}</span>
                  {en ? c.latest.en : c.latest.ja}{' '}
                  <a
                    href={c.latest.source}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="whitespace-nowrap text-xs text-ink-mute underline decoration-line underline-offset-2 hover:text-ink"
                  >
                    {c.latest.sourceName} <span aria-hidden>↗</span>
                  </a>
                </p>
              )}

              {/* 海外ファンの声は記事のコメントの再表示だけ＝ここで新しい引用を作らない（本文と出典は記事側）。 */}
              {c.voice && !en && (
                <blockquote className="mt-4 border-l-2 border-ink pl-3">
                  <p className="text-sm leading-relaxed text-ink">「{c.voice.ja}」</p>
                  <footer className="mt-1 text-xs text-ink-mute">
                    {c.voice.author} ·{' '}
                    <Link href={c.voice.href} className="underline decoration-line underline-offset-2 hover:text-ink">
                      海外の反応を読む →
                    </Link>
                  </footer>
                </blockquote>
              )}

              <Link
                href={`${c.href}#stove`}
                className="mt-4 inline-flex min-h-[44px] items-center text-sm text-ink-soft hover:text-ink hover:underline"
              >
                {en ? 'Full timeline and stats' : '報道の時系列と成績を詳しく'} <span aria-hidden className="ml-1">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {npb.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">
            {en ? 'NPB: posting and international free agency' : 'NPB組（ポスティング・海外FA）'}
          </h3>
          <ul className="divide-y divide-line border-y border-line">
            {npb.map((r) => (
              <li key={r.href} className="py-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                  <Link href={r.href} className="text-base font-bold text-ink hover:text-ink-soft hover:underline">
                    {en ? r.name.en : r.name.ja}
                  </Link>
                  <span className="text-xs text-ink-soft">{en ? r.team.en : r.team.ja}</span>
                  <span className="inline-flex items-center border border-line px-2 py-0.5 text-xs text-ink">
                    {en ? r.route.en : r.route.ja}
                  </span>
                  {r.rank && (
                    <span className="text-xs text-ink-mute">
                      {en ? `${rankSource} No. ${r.rank}` : `${rankSource} ${r.rank}位`}
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">{en ? r.headline.en : r.headline.ja}</p>
                {r.statLine && <p className="mt-1.5 text-sm tabular-nums text-ink-soft">{r.statLine}</p>}
              </li>
            ))}
          </ul>
          <Link
            href="/prospects"
            className="mt-3 inline-flex min-h-[44px] items-center text-sm text-ink-soft hover:text-ink hover:underline"
          >
            {en ? 'All NPB players on the MLB radar' : 'NEXT MLB（ポスティング候補の一覧）へ'} <span aria-hidden className="ml-1">→</span>
          </Link>
        </div>
      )}
    </section>
  );
}
