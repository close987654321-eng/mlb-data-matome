import { Link } from '@/lib/navigation';
import { headshotUrl, teamLogoUrl } from '@/lib/teams';
import SectionHeading from '@/components/SectionHeading';

/** 1 選手ぶんの表示データ（page.tsx 側でボードから整形して渡す＝この層は数値を作らない）。 */
export type RaceRow = {
  id: number;
  rank: number;
  name: string;
  score: number;
  isJp: boolean;
  teamId: number | null;
};

/** 1 ボードぶん（MVP / サイヤング）。leagues は NL→AL の順で渡す。 */
export type RaceBoardCard = {
  title: string;
  /** ボードの実 URL（/mvp・/cy-young）。行リンクは `${href}/${id}`。 */
  href: string;
  asOfText: string | null;
  leagues: { label: string; rows: RaceRow[] }[];
  /**
   * ボード本体へのリンク文言。省略時は共通ラベル。カードごとに「サイ・ヤング賞候補〜」と
   * 書き分けて、送り先のページが狙う語とアンカーを一致させる（内部リンクの評価を渡す配線）。
   */
  moreLabel?: string;
};

/**
 * TOP のアワードレース枠。MVP／サイヤング予測ボードの各リーグ上位だけを縦に積んだ
 * ダイジェスト（新聞の「順位表ボックス」）。スコアの式・全順位はボード本体に送客する。
 * 日本人はボード本体と同じく太字で強調。ボード未生成（データ無し）ならセクションごと消える。
 */
export default function RaceBoards({
  heading,
  boardLabel,
  scoreLabel,
  cards,
}: {
  heading: string;
  boardLabel: string;
  scoreLabel: string;
  cards: RaceBoardCard[];
}) {
  if (cards.length === 0) return null;
  return (
    <section className="space-y-4">
      <SectionHeading label={heading} />
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.href} className="flex flex-col rounded-[3px] border border-line">
            <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
              <h3 className="text-sm font-bold tracking-wide text-ink">{card.title}</h3>
              {card.asOfText && (
                <span className="whitespace-nowrap text-[11px] tabular-nums text-ink-mute">
                  {card.asOfText}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-3 px-2 py-3">
              {card.leagues.map((lg) => (
                <div key={lg.label}>
                  <div className="flex items-baseline justify-between px-2">
                    <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">
                      {lg.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-ink-mute">
                      {scoreLabel}
                    </span>
                  </div>
                  <ul className="mt-1">
                    {lg.rows.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`${card.href}/${r.id}`}
                          className="flex items-center gap-2.5 rounded-[2px] px-2 py-1.5 transition-colors hover:bg-surface"
                        >
                          <span className="w-3 shrink-0 text-xs tabular-nums text-ink-mute">
                            {r.rank}
                          </span>
                          <span className="relative inline-block h-8 w-8 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない） */}
                            <img
                              src={headshotUrl(r.id, 'spot')}
                              alt=""
                              width={32}
                              height={32}
                              loading="lazy"
                              className="h-full w-full rounded-full bg-line object-cover object-top"
                            />
                            {r.teamId ? (
                              // eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク
                              <img
                                src={teamLogoUrl(r.teamId)}
                                alt=""
                                width={14}
                                height={14}
                                loading="lazy"
                                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-[2px] bg-paper object-contain p-px ring-1 ring-line"
                              />
                            ) : null}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate text-sm text-ink ${r.isJp ? 'font-bold' : 'font-medium'}`}
                          >
                            {r.name}
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                            {r.score}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Link
              href={card.href}
              className="block border-t border-line px-4 py-2.5 text-xs text-ink-soft transition-colors hover:text-ink"
            >
              {card.moreLabel ?? boardLabel} <span aria-hidden>→</span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
