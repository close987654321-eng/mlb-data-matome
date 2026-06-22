import type { PlayerStat } from '@/types/thread';
import { playerSlugByJaName } from '@/lib/players';
import { Link } from '@/lib/navigation';

type Props = {
  stats: PlayerStat[];
  heading: string; // ローカライズ済み見出し（例: 「🇯🇵 日本人選手の成績」）
  todayLabel: string; // その試合の行ラベル（例: 「この試合」）
  seasonLabel: string; // 今季の行ラベル（例: 「今季」）
  warLabel: string; // WAR の行ラベル（例: 「WAR」）
  deltaLabel: string; // 前回比の行ラベル（例: 「前回比」）
  rankLabel: string; // 順位の行ラベル（例: 「ランク」）
};

/**
 * 日本人選手の成績ボックス（matome R10）。summaryJa の直下に置き、海外の反応に「成績の文脈」を
 * 1 点そえて差別化する。値は MLB公式 Stats API 由来の数値のみ（公知の事実）で、ロゴ/写真/表組みは持たない。
 * 数値は編集時に scripts/fetch-mlb-stats.mjs で取得して JSON に書き込む（サイト本体は API を叩かない）。
 */
export default function StatBox({
  stats,
  heading,
  todayLabel,
  seasonLabel,
  warLabel,
  deltaLabel,
  rankLabel,
}: Props) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
        <span className="h-3 w-1 rounded-full bg-accent" />
        {heading}
      </h2>
      <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
        {stats.map((s, i) => (
          <div key={i} className={i > 0 ? 'border-t border-line/70 pt-4' : ''}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-bold text-ink">
                {/* 選手ハブがある選手は名前から個別ページへ内部リンク（クラスタ強化） */}
                {(() => {
                  const slug = playerSlugByJaName(s.player);
                  return slug ? (
                    <Link href={`/player/${slug}`} className="hover:text-accent hover:underline">
                      {s.player}
                    </Link>
                  ) : (
                    s.player
                  );
                })()}
                {s.team && (
                  <span className="ml-2 text-xs font-normal text-ink-soft">{s.team}</span>
                )}
              </p>
              {s.note && (
                <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                  {s.note}
                </span>
              )}
            </div>
            {s.today && (
              <p className="mt-1.5 flex gap-2 text-[15px] text-ink">
                <span className="w-14 shrink-0 text-xs font-medium leading-relaxed text-ink-soft">
                  {todayLabel}
                </span>
                <span className="tabular-nums">{s.today}</span>
              </p>
            )}
            {s.season && (
              <p className="mt-1 flex gap-2 text-sm text-ink-soft">
                <span className="w-14 shrink-0 text-xs font-medium leading-relaxed">
                  {seasonLabel}
                </span>
                <span className="tabular-nums">{s.season}</span>
              </p>
            )}
            {s.war && (
              <p className="mt-1 flex gap-2 text-sm text-ink-soft">
                <span className="w-14 shrink-0 text-xs font-medium leading-relaxed">
                  {warLabel}
                </span>
                <span className="font-medium tabular-nums text-ink">{s.war}</span>
              </p>
            )}
            {s.delta && (
              <p className="mt-1 flex gap-2 text-sm text-ink-soft">
                <span className="w-14 shrink-0 text-xs font-medium leading-relaxed">
                  {deltaLabel}
                </span>
                <span className="font-medium tabular-nums text-ink">{s.delta}</span>
              </p>
            )}
            {s.rank && (
              <p className="mt-1 flex gap-2 text-sm text-ink-soft">
                <span className="w-14 shrink-0 text-xs font-medium leading-relaxed">
                  {rankLabel}
                </span>
                <span className="tabular-nums">{s.rank}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
