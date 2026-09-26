import { teamLogoUrl } from '@/lib/teams';
import {
  ROUND_ORDER,
  currentRound,
  mdLabel,
  roundName,
  roundStartDates,
  teamLabel,
  type PostseasonData,
} from '@/lib/postseason';
import type { Locale } from '@/lib/i18n';

/**
 * 「いまの局面」＝表の前に置く1枚。検索者の最初の問い（いまどこまで進んだ？次はいつ？優勝は？）に
 * 表を読む前に答える。日程はデータの各ラウンド第1戦の日付（現地）から組む＝手で書き換えない。
 */
export default function PostseasonNow({ data, locale }: { data: PostseasonData; locale: Locale }) {
  const en = locale === 'en';
  const starts = roundStartDates(data);
  const cur = currentRound(data);
  const ws = data.series.find((s) => s.round === 'W');

  let headline: string;
  if (data.champion && ws) {
    const champ = ws.top.id === data.champion.id ? ws.top : ws.bottom;
    const opp = champ === ws.top ? ws.bottom : ws.top;
    headline = en
      ? `The ${teamLabel(data.champion.id, true)} won the ${data.season} World Series, ${champ.wins}-${opp.wins} over the ${opp.id ? teamLabel(opp.id, true) : ''}.`
      : `${data.season}年のワールドシリーズは${teamLabel(data.champion.id, false)}が${opp.id ? `${teamLabel(opp.id, false)}を` : ''}${champ.wins}勝${opp.wins}敗で制しました。`;
  } else if (data.phase === 'race') {
    // 「進出決定」（確定マークあり）と「トーナメント表の位置まで確定」は別物＝両方を数で言う。
    const clinched = [...data.race.AL, ...data.race.NL].filter((r) => r.clinch).length;
    const placed = new Set(data.series.flatMap((s) => [s.top.id, s.bottom.id]).filter(Boolean)).size;
    const end = data.dates.regularEnd ? mdLabel(data.dates.regularEnd, en) : '';
    headline = en
      ? `The regular season ends ${end} (ET). ${clinched} of 12 teams have clinched a berth, and ${placed} have a fixed spot in the bracket.`
      : `レギュラーシーズンは現地${end}まで。12の出場枠のうち${clinched}チームが進出を決め、トーナメント表の位置まで決まったのは${placed}チームです。`;
  } else {
    headline = cur
      ? en
        ? `The ${roundName(cur, true)} is under way.`
        : `いまは${roundName(cur, false)}の最中です。`
      : '';
  }

  return (
    <section aria-label={en ? 'Where the postseason stands' : 'いまの局面'} className="rounded-[4px] border border-line bg-surface p-4 sm:p-5">
      {data.champion ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク（再ホストしない） */}
          <img src={teamLogoUrl(data.champion.id)} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-mute">{en ? `${data.season} champions` : `${data.season}年 ワールドシリーズ優勝`}</p>
            <p className="text-lg font-bold text-ink">{teamLabel(data.champion.id, en)}</p>
          </div>
        </div>
      ) : null}
      {headline && <p className={`text-sm leading-relaxed text-ink ${data.champion ? 'mt-3' : ''}`}>{headline}</p>}
      <ol className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {ROUND_ORDER.map((r) => {
          const st = starts[r];
          const active = cur === r;
          const done = data.champion != null || (cur != null && ROUND_ORDER.indexOf(r) < ROUND_ORDER.indexOf(cur));
          return (
            <li
              key={r}
              className={`rounded-[3px] border px-2.5 py-2 ${active ? 'border-ink text-ink' : 'border-line text-ink-soft'} ${done ? 'text-ink-mute' : ''}`}
            >
              <span className="block font-semibold">{roundName(r, en, true)}</span>
              <span className="block tabular-nums">
                {st ? (en ? `from ${mdLabel(st.any, true)} (ET)` : `現地${mdLabel(st.any, false)}〜`) : '—'}
                {active && <span className="ml-1 font-semibold">{en ? '· now' : '・いまここ'}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
