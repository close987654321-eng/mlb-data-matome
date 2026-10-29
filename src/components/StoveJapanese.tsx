import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';

type Bi = { ja: string; en: string };
type Status = { label: Bi; done: boolean; team?: Bi };

/** ハブで1人ぶんに出す材料。page.tsx が data と記事から組み立てて渡す（ここでは計算しない）。 */
export type StoveJpCard = {
  /** ページ内アンカー（一覧の行から飛ぶ先）。 */
  anchor: string;
  href: string;
  name: Bi;
  photo?: string;
  team?: Bi;
  status: Status;
  rank?: number;
  headline: Bi;
  statLine: string;
  /** 関心が報じられた球団。空配列＝まだ報道が無い。undefined＝この道筋では問いにならない（オプトアウトの判断待ち）。 */
  suitors?: Bi[];
  voice?: { ja: string; author: string; href: string };
  group: 'mlb' | 'npb';
};

function StatusChip({ status, en, small = false }: { status: Status; en: boolean; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 ${small ? 'text-[11px]' : 'text-xs'} ${
        status.done ? 'border-ink bg-ink text-surface' : 'border-line text-ink'
      }`}
    >
      {en ? status.label.en : status.label.ja}
      {status.team && (en ? `: ${status.team.en}` : `：${status.team.ja}`)}
    </span>
  );
}

function Photo({ src, alt, size }: { src?: string; alt: string; size: string }) {
  if (!src) return <span aria-hidden className={`${size} shrink-0 rounded-full bg-ink/[0.05]`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない＝PlayerHero と同じ扱い）
    <img src={src} alt={alt} loading="lazy" className={`${size} shrink-0 rounded-full bg-ink/[0.04] object-cover`} />
  );
}

function suitorsText(c: StoveJpCard, en: boolean): string {
  if (c.status.done) return '';
  if (c.suitors === undefined) return en ? 'Awaiting his decision' : '残るかどうかの判断待ち';
  if (!c.suitors.length) return en ? 'No suitors reported yet' : '関心球団の報道はまだない';
  return c.suitors.map((s) => (en ? s.en : s.ja)).join(en ? ', ' : '・');
}

/**
 * 見出し直下の「日本人選手の去就」一覧。
 *
 * なぜ要るか: このページに来る人の第一の問いは「日本人は誰が、どうなるのか」。カードを縦に並べるだけだと
 * 9人を見渡すのにスマホで4画面かかり、答えがファーストビューに出なかった（2026-10-29 のレビュー）。
 * 1行＝1人で状況・関心球団・MLB公式の順位だけを並べ、詳しい中身は下のカード（アンカー）と選手LPへ送る。
 */
export function StoveSummary({ cards, en, rankSource }: { cards: StoveJpCard[]; en: boolean; rankSource: string }) {
  return (
    <section id="japanese" aria-labelledby="japanese-h">
      <SectionHeading label={<span id="japanese-h">{en ? 'Japanese players this winter' : '日本人選手の去就'}</span>} count={cards.length} lead />
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {cards.map((c) => {
          // NPB組の詳しいカードは下で畳んでいる（専用ハブ /prospects がある）ので、一覧から選手LPへ直接送る。
          const inner = (
            <>
              <Photo src={c.photo} alt="" size="h-9 w-9" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-bold text-ink">{en ? c.name.en : c.name.ja}</span>
                  <StatusChip status={c.status} en={en} small />
                  {c.rank && (
                    <span className="text-[11px] text-ink-mute">
                      {en ? `${rankSource} No. ${c.rank}` : `${rankSource}${c.rank}位`}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-soft">
                  {c.team && (en ? c.team.en : c.team.ja)}
                  {suitorsText(c, en) && (
                    <>
                      <span aria-hidden className="mx-1.5 text-ink-mute">·</span>
                      {c.suitors?.length ? (en ? 'Linked: ' : '関心：') : ''}
                      {suitorsText(c, en)}
                    </>
                  )}
                </span>
              </span>
              <span
                aria-hidden
                className={`shrink-0 text-ink-mute transition-transform ${c.group === 'npb' ? 'group-hover:translate-x-0.5' : 'group-hover:translate-y-0.5'}`}
              >
                {c.group === 'npb' ? '→' : '↓'}
              </span>
            </>
          );
          const cls = 'group flex min-h-[56px] items-center gap-3 py-2.5 transition-colors hover:bg-ink/[0.02]';
          return (
            <li key={c.anchor}>
              {c.group === 'npb' ? (
                <Link href={c.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <a href={`#${c.anchor}`} className={cls}>
                  {inner}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * 日本人選手のカード（一覧の下の詳細）。1人ぶんを「状況→現在地の1段落→今季→関心球団→海外ファンの声」の
 * 同じ順で並べ、報道の時系列は選手LPに送る＝ハブは短く、LPが深い。
 * MLB組とNPB組は道筋（FA・オプトアウト／ポスティング）が違うので段を分ける。
 */
export default function StoveJapanese({
  cards,
  en,
  rankSource,
}: {
  cards: StoveJpCard[];
  en: boolean;
  rankSource: string;
}) {
  const groups: { key: 'mlb' | 'npb'; label: Bi }[] = [
    { key: 'mlb', label: { ja: 'MLB組（FA・オプトアウト）', en: 'In MLB: free agents and opt-outs' } },
    { key: 'npb', label: { ja: 'NPB組（ポスティング・海外FA）', en: 'From NPB: posting and international FA' } },
  ];
  return (
    <section aria-labelledby="japanese-detail-h" className="space-y-8">
      <div>
        <SectionHeading
          label={<span id="japanese-detail-h">{en ? 'Player by player' : '選手ごとの現在地'}</span>}
          lead
        />
        <p className="mt-1.5 max-w-prose text-sm text-ink-soft">
          {en
            ? 'The latest on each player and what overseas fans are saying. Full report timelines are on each player page.'
            : '1人ずつの現在地と海外ファンの声。報道の時系列は各選手のページにまとめています。'}
        </p>
      </div>

      {groups.map((g) => {
        const list = cards.filter((c) => c.group === g.key);
        if (!list.length) return null;
        const body = (
            <ul className="grid border-t border-line lg:grid-cols-2 lg:gap-x-10">
              {list.map((c) => (
                <li key={c.anchor} id={c.anchor} className="border-b border-line py-6">
                  <div className="flex items-center gap-3">
                    <Photo src={c.photo} alt={en ? c.name.en : c.name.ja} size="h-12 w-12" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <Link href={c.href} className="text-lg font-bold text-ink hover:text-ink-soft hover:underline">
                          {en ? c.name.en : c.name.ja}
                        </Link>
                        {c.team && <span className="text-xs text-ink-soft">{en ? c.team.en : c.team.ja}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <StatusChip status={c.status} en={en} />
                        {c.rank && (
                          <span className="text-xs text-ink-mute">
                            {en ? `${rankSource} No. ${c.rank}` : `${rankSource}${c.rank}位`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-[15px] leading-relaxed text-ink">{en ? c.headline.en : c.headline.ja}</p>
                  {c.statLine && (
                    <p className="mt-2 text-sm tabular-nums text-ink-soft">
                      <span className="mr-2 text-xs text-ink-mute">{en ? '2026' : '今季'}</span>
                      {c.statLine}
                    </p>
                  )}
                  {suitorsText(c, en) && (
                    <p className="mt-1 text-sm text-ink-soft">
                      <span className="mr-2 text-xs text-ink-mute">{en ? 'Suitors' : '関心球団'}</span>
                      {suitorsText(c, en)}
                    </p>
                  )}

                  {/* 海外ファンの声は記事のコメントの再表示だけ＝ここで新しい引用を作らない（本文と出典は記事側）。 */}
                  {c.voice && !en && (
                    <blockquote className="mt-4 border-l-2 border-ink pl-3">
                      <p className="text-sm leading-relaxed text-ink">「{c.voice.ja}」</p>
                      <footer className="mt-1 text-xs text-ink-mute">{c.voice.author}</footer>
                      <Link
                        href={c.voice.href}
                        className="mt-1 inline-flex min-h-[44px] items-center text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
                      >
                        海外の反応を読む <span aria-hidden className="ml-1">→</span>
                      </Link>
                    </blockquote>
                  )}

                  <Link
                    href={c.href}
                    className="mt-2 inline-flex min-h-[44px] items-center text-sm text-ink-soft hover:text-ink hover:underline"
                  >
                    {g.key === 'npb'
                      ? en
                        ? 'Posting reports and stats'
                        : 'ポスティング報道と成績を詳しく'
                      : en
                        ? 'Full timeline and stats'
                        : '報道の時系列と成績を詳しく'}{' '}
                    <span aria-hidden className="ml-1">→</span>
                  </Link>
                </li>
              ))}
            </ul>
        );
        // NPB組は専用ハブ（/prospects）があり、各カードも長い（報道の要約が2〜3文）ので畳む。
        // このページの主役は MLB組の去就＝NPB組まで開くとスマホで2画面ぶん伸びる（2026-10-29 のレビュー）。
        if (g.key === 'npb') {
          return (
            <details key={g.key} className="group/npb">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between border-y border-line text-sm font-semibold text-ink hover:bg-ink/[0.02] [&::-webkit-details-marker]:hidden">
                <span>
                  {en ? g.label.en : g.label.ja}
                  <span className="ml-2 font-normal text-ink-mute">{en ? `${list.length} players` : `${list.length}人`}</span>
                </span>
                <span aria-hidden className="text-ink-mute transition-transform group-open/npb:rotate-45">＋</span>
              </summary>
              {body}
            </details>
          );
        }
        return (
          <div key={g.key}>
            <h3 className="mb-3 text-sm font-semibold text-ink">{en ? g.label.en : g.label.ja}</h3>
            {body}
          </div>
        );
      })}
    </section>
  );
}
