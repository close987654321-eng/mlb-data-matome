import SectionHeading from '@/components/SectionHeading';
import { Link } from '@/lib/navigation';
import {
  AWARD_LABEL,
  currentAwards,
  finalistRows,
  jpFinalistsPhrase,
  leagueJa,
  winnerRow,
  type AwardKind,
  type FinalistRow,
} from '@/lib/boardSeo';

/**
 * 賞の最終候補（各リーグ上位3人）と受賞者。発表週は検索の問いが「誰が残った？いつ決まる？」に移るので、
 * 表より先にこの答えを置く。正は boardSeo.ts の AWARD_RESULTS（MLB 公式の発表記事が出典）＝
 * ここは ID をボードの行に引き当てて並べるだけ。行に「この表で◯位」を添える＝予測が当たったかを
 * 一目で見せられるのはこのサイトのボードだけ。登録が無い年は何も出さない。
 */
export default function AwardFinalists({
  kind,
  board,
  locale,
  hrefOf,
}: {
  kind: AwardKind;
  board: { season: number; leagues: { NL: FinalistRow[]; AL: FinalistRow[] } };
  locale: string;
  /** 行のリンク先（/roy は詳細ページが無いので渡さない）。 */
  hrefOf?: (row: FinalistRow) => string;
}) {
  const aw = currentAwards(board.season);
  if (!aw) return null;
  const en = locale === 'en';
  const label = AWARD_LABEL[kind];
  const d = aw[kind].date;
  const leagues = (['NL', 'AL'] as const).map((lg) => ({
    lg,
    rows: finalistRows(kind, board, lg),
    winner: winnerRow(kind, board, lg),
  }));
  if (leagues.every((l) => l.rows.length === 0)) return null;
  const decided = leagues.every((l) => l.winner);
  // 表の1位が最終候補に残ったか（予測の答え合わせ）。両リーグとも残っていれば一言で言う。
  const topIn = leagues.filter((l) => l.rows.some((r) => r.rank === 1)).length;

  const heading = en
    ? `${aw.year} ${label.en} ${decided ? 'winners and finalists' : 'finalists'}`
    : `${aw.year}年の${label.ja} ${decided ? '受賞者と最終候補' : '最終候補'}`;
  const lead = en
    ? `MLB announced the top three in each league on ${aw.finalistsAnnounced.en}. ${decided ? '' : `Winners are announced on ${d.en} ET (${d.jstEn} in Japan). `}${topIn === 2 ? 'Both No. 1s on this board made the cut. ' : ''}${jpFinalistsPhrase(kind, board, true)}`
    : `MLBが${aw.finalistsAnnounced.ja}（米国時間）に各リーグの上位3人を発表しました。${decided ? '' : `受賞者の発表は${d.ja}（日本時間${d.jstJa}）です。`}${topIn === 2 ? 'この表の1位は両リーグとも最終候補に入りました。' : ''}${jpFinalistsPhrase(kind, board, false)}`;

  return (
    <section className="space-y-4">
      <SectionHeading label={heading} lead level="h2" />
      <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{lead}</p>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-2">
        {leagues.map(({ lg, rows, winner }) => (
          <div key={lg} className="bg-paper px-4 py-3.5">
            <h3 className="text-xs font-medium tracking-[0.18em] text-ink-mute">
              {en ? `${lg === 'NL' ? 'National' : 'American'} League` : leagueJa(lg)}
            </h3>
            <ul className="mt-2 divide-y divide-line">
              {rows.map((r) => {
                const name = en ? r.nameEn : r.nameJa;
                const won = winner?.id === r.id;
                return (
                  <li key={r.id} className="flex items-baseline gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      {hrefOf ? (
                        <Link href={hrefOf(r)} className="text-sm font-bold text-ink underline-offset-2 hover:underline">
                          {name}
                        </Link>
                      ) : (
                        <span className="text-sm font-bold text-ink">{name}</span>
                      )}
                      <span className="ml-2 text-xs text-ink-soft">{en ? r.teamEn : r.teamJa}</span>
                      {won && (
                        <span className="ml-2 border border-ink px-1.5 py-px text-[11px] font-bold text-ink">
                          {en ? 'Winner' : '受賞'}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-mute">
                      {en ? `No. ${r.rank} here` : `この表で${r.rank}位`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-mute">
        {en ? 'Source: ' : '出典：'}
        <a href={aw.source.url} target="_blank" rel="noopener" className="underline underline-offset-2">
          {aw.source.label}
        </a>
        {en ? ' (finalists listed alphabetically).' : '（最終候補はMLB公式の掲載順＝アルファベット順）'}
      </p>
    </section>
  );
}
