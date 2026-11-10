import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import { getStoveLeague, getStoveStats, stoveActive, worldSeriesEnd, faStatus, offseasonLabel } from '@/lib/stoveLeague';
import { leagueJa } from '@/lib/boardSeo';

type Row = { id: number; rank: number; nameJa: string; nameEn: string; league: 'AL' | 'NL' };

/** 表に出す人数の上限（FAランキングの順位が高い順）。 */
const MAX = 6;

/**
 * 賞レースのボードから、ストーブリーグへ送る欄。オフの間（stove-league.json の activeUntil まで）だけ出る。
 *
 * なぜ要るか: 賞レース3ボードは10〜11月の表示の大半を集めている（2026-10-26〜11-08 で表示27,796）が、
 * 受賞者の発表が終わると検索が落ちる。来た人の次の関心は「この選手は来年どこでプレーするのか」＝
 * ボードに載っている選手のうちFA市場にいる選手を、いまの状況つきで並べてFA一覧へ送る。
 * 中身は2つの data の突き合わせ（ボードの選手ID × FAランキングの選手ID）だけ＝新しい事実は作らない。
 */
export default async function BoardStoveLink({
  board,
  locale,
}: {
  board: { season: number | string; leagues: { NL: Row[]; AL: Row[] } };
  locale: string;
}) {
  const cat = await getStoveLeague();
  if (!cat || !stoveActive(cat) || Number(board.season) !== cat.season) return null;
  const [stats, wsEnd] = await Promise.all([getStoveStats(), worldSeriesEnd(cat.season)]);
  const en = locale === 'en';
  const byId = new Map(cat.board.filter((b) => b.mlbId).map((b) => [b.mlbId!, b]));
  const hits = [...board.leagues.NL, ...board.leagues.AL]
    .flatMap((r) => {
      const b = byId.get(r.id);
      return b ? [{ r, b, st: faStatus(b, stats.players[String(r.id)], Boolean(wsEnd)) }] : [];
    })
    .sort((x, y) => x.b.rank - y.b.rank)
    .slice(0, MAX);
  const off = offseasonLabel(cat.season);
  const more = (
    <Link
      href="/stove-league/fa"
      className="flex min-h-[48px] items-center justify-center gap-2 border-b border-line text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.02]"
    >
      {en ? `Free agent rankings ${off}: who has signed, who is left` : `FAランキング${off}：誰が決まり、誰が残っているか`}
      <span aria-hidden>→</span>
    </Link>
  );
  return (
    <section className="space-y-3">
      <SectionHeading
        label={en ? 'From this board to the free agent market' : 'この表の選手の今オフ（FA・移籍）'}
        seeAllHref="/stove-league"
        seeAllLabel={en ? 'Hot stove' : 'ストーブリーグ'}
        lead
      />
      {hits.length > 0 ? (
        <>
          <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
            {en
              ? 'Players on this board who are free agents this winter, with their rank on the free agent list and where things stand.'
              : 'この表に載っている選手のうち、今オフFAになった選手。FAランキングの順位と、いまの状況です。'}
          </p>
          <ul className="divide-y divide-line border-y border-line">
            {hits.map(({ r, b, st }) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="font-bold text-ink">{en ? r.nameEn : r.nameJa}</span>
                <span
                  className={`inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 text-[11px] ${
                    st.done ? 'border-ink bg-ink text-surface' : 'border-line text-ink'
                  }`}
                >
                  {en ? st.label.en : st.label.ja}
                  {st.team && (en ? `: ${st.team.en}` : `：${st.team.ja}`)}
                </span>
                <span className="text-xs text-ink-mute">
                  {en
                    ? `No. ${r.rank} here (${r.league}) · FA No. ${b.rank}`
                    : `この表で${leagueJa(r.league)}${r.rank}位・FAランキング${b.rank}位`}
                </span>
              </li>
            ))}
          </ul>
          {more}
        </>
      ) : (
        <div className="border-t border-line">{more}</div>
      )}
    </section>
  );
}
