import { Link } from '@/lib/navigation';
import { PLAYERS } from '@/lib/players';
import SectionHeading from '@/components/SectionHeading';
import { headshotUrl, teamLogoUrl } from '@/lib/teams';
import { type CyYoungBoard as Board, type CyRow, type CyWatch } from '@/lib/cyYoungBoard';

const TOP_N = 12; // 各リーグで通常表示する上位数（＋圏外の日本人は別途 append）

/** 顔写真（丸アバター・公式CDN直リンク）＋ チームロゴのバッジ。小さく添える（無彩色規律への例外＝村山依頼）。 */
function Avatar({ mlbId, teamId, name, size = 40 }: { mlbId: number; teamId: number | null; name: string; size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない） */}
      <img
        src={headshotUrl(mlbId, 'spot')}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        className="h-full w-full rounded-full bg-line object-cover object-top"
      />
      {teamId ? (
        // eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク
        <img
          src={teamLogoUrl(teamId)}
          alt=""
          width={16}
          height={16}
          loading="lazy"
          className="absolute -bottom-1 -right-1 h-4 w-4 rounded-[2px] bg-paper object-contain p-px ring-1 ring-line"
        />
      ) : null}
    </span>
  );
}

/** 小さな「日本」チップ（無彩色）。日本人投手の行に添える。 */
function JpChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-[2px] border border-ink/30 px-1 py-px text-[10px] font-medium leading-none text-ink-mute">
      {label}
    </span>
  );
}

function LeagueTable({
  league,
  rows,
  maxScore,
  en,
  t,
}: {
  league: string;
  rows: CyRow[];
  maxScore: number;
  en: boolean;
  t: { pitcher: string; score: string; era: string; xera: string; ip: string; kbb: string; jp: string; more: string };
}) {
  // 上位 TOP_N ＋ それ以下に居る日本人（強調）を append。境目に区切りを出す。
  const top = rows.slice(0, TOP_N);
  const extraJp = rows.slice(TOP_N).filter((r) => r.isJp);
  const shown: (CyRow | 'gap')[] = extraJp.length ? [...top, 'gap', ...extraJp] : top;

  return (
    <div>
      <h3 className="mb-2 text-sm font-bold tracking-wide text-ink">{league}</h3>
      <div className="overflow-x-auto rounded-[2px] border border-line">
        <table className="w-full min-w-[560px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-ink-mute">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">{t.pitcher}</th>
              <th className="px-3 py-2 text-right font-semibold text-ink">{t.score}</th>
              <th className="px-3 py-2 text-right font-medium">{t.era}</th>
              <th className="px-3 py-2 text-right font-medium">{t.xera}</th>
              <th className="px-3 py-2 text-right font-medium">{t.ip}</th>
              <th className="px-3 py-2 text-right font-medium">{t.kbb}</th>
              <th className="w-6 px-2 py-2" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) =>
              row === 'gap' ? (
                <tr key="gap" className="border-b border-line">
                  <td colSpan={8} className="px-3 py-1 text-center text-xs text-ink-mute">
                    ⋯ {t.more}
                  </td>
                </tr>
              ) : (
                <Row key={row.id} row={row} maxScore={maxScore} en={en} jpLabel={t.jp} />
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ row, maxScore, en, jpLabel }: { row: CyRow; maxScore: number; en: boolean; jpLabel: string }) {
  const name = en ? row.nameEn : row.nameJa;
  const team = en ? row.teamEn : row.teamJa;
  const why = en ? row.whyEn : row.why;
  // 行全体がリンク: 名前の Link を after:inset-0 で行いっぱいに広げる（tr は relative）。全投手に詳細ページあり。
  const nameCls = row.isJp ? 'font-bold text-ink' : 'font-medium text-ink';
  return (
    <tr
      className={`group relative border-b border-line transition-colors last:border-0 hover:bg-ink/[0.06] ${row.isJp ? 'bg-ink/[0.04]' : ''}`}
    >
      <td className="px-3 py-2 align-top text-ink-mute">{row.rank}</td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-start gap-2.5">
          <Avatar mlbId={row.id} teamId={row.teamId} name={name} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link href={`/cy-young/${row.id}`} className={`${nameCls} after:absolute after:inset-0 group-hover:underline`}>
                {name}
              </Link>
              {row.isJp && <JpChip label={jpLabel} />}
            </div>
            <div className="mt-0.5 text-xs leading-relaxed text-ink-mute">
              {team}
              {why ? <> · {why}</> : null}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 align-top text-right">
        <span className="font-bold text-ink">{row.score.toFixed(1)}</span>
        <span className="mt-1 block h-1 w-14 overflow-hidden rounded-[1px] bg-line" aria-hidden>
          <span className="block h-full bg-ink" style={{ width: `${Math.round((row.score / maxScore) * 100)}%` }} />
        </span>
      </td>
      <td className="px-3 py-2 align-top text-right font-medium text-ink">{row.era}</td>
      <td className="px-3 py-2 align-top text-right text-ink-soft">{row.xera != null ? row.xera.toFixed(2) : '—'}</td>
      <td className="px-3 py-2 align-top text-right text-ink-soft">{row.ipDisp}</td>
      <td className="px-3 py-2 align-top text-right text-ink-soft">{row.kbbPct != null ? `${row.kbbPct.toFixed(1)}%` : '—'}</td>
      <td className="px-2 py-2 text-right align-middle text-ink-mute transition-colors group-hover:text-ink" aria-hidden>
        ›
      </td>
    </tr>
  );
}

/**
 * サイ・ヤング賞 予測ボード＝規定到達投手を AL/NL 別に合成スコアで順位予測し、日本人投手を強調。
 * 行全体がリンク＝各行→ /cy-young/{id} 詳細ページ（スコア内訳＋球種の設計図）へ送客。
 * スコアは断定でなく予測＝式と出典を明示する。サーバーコンポーネント（静的）。
 */
export default function CyYoungBoard({ board, locale }: { board: Board; locale: string }) {
  const en = locale === 'en';
  const slugByMlbId = new Map(PLAYERS.map((p) => [p.mlbId, p.slug]));
  const w = board.weights;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const t = en
    ? {
        methodTitle: 'How the score works',
        method: `Prediction score = each pitcher’s within-league percentile in ERA + xERA (${pct(w.prevention)}), K-BB% (${pct(w.kbb)}), innings (${pct(w.ip)}), WHIP (${pct(w.whip)}) and HR/9 (${pct(w.hr9)}), blended. It’s our data-driven read, not a verdict — Cy Young is a within-league race, and volume (innings) keeps relievers out. Qualified starters only (~${board.qualifyIp} IP).`,
        cols: { pitcher: 'Pitcher', score: 'Score', era: 'ERA', xera: 'xERA', ip: 'IP', kbb: 'K-BB%', jp: 'JP', more: 'lower in the field' },
        watchTitle: 'Japanese starters on the cusp',
        watchSub: 'Dominant by rate, but not yet innings-qualified — where the rest of Japan’s rotation stands.',
        watchGap: (n: number) => `~${n} IP to qualify`,
        na: 'ERA', naSub: 'GS',
        source: `Data: MLB Stats API + Baseball Savant (public factual figures). ${board.season} season, as of ${board.asOf}.`,
      }
    : {
        methodTitle: '予測スコアの出し方',
        method: `各指標が同じリーグの規定投手の中でどの位置にいるかを0〜100で数値化し、ERA＋xERA（${pct(w.prevention)}）・K-BB%（${pct(w.kbb)}）・投球回（${pct(w.ip)}）・WHIP（${pct(w.whip)}）・HR/9（${pct(w.hr9)}）の重みをつけて合算したものが予測スコアです。サイ・ヤング賞はリーグ内での争いなのでAL/NL別に集計し、対象は規定投球回（目安 約${board.qualifyIp}回）に到達した先発に絞っています。現時点の成績にもとづく予測です。`,
        cols: { pitcher: '投手', score: '予測スコア', era: 'ERA', xera: 'xERA', ip: '投球回', kbb: 'K-BB%', jp: '日本', more: 'この間の投手は省略' },
        watchTitle: '規定投球回に届いていない日本人先発',
        watchSub: '投球内容は上位級でも、投球回がまだ規定に届かずランキングの対象外の投手たち。規定に到達すれば上の表に入ってきます。',
        watchGap: (n: number) => `規定まであと約${n}回`,
        na: 'ERA', naSub: '先発',
        source: `出典: MLB公式Stats API＋Baseball Savant（公知の数値）。${board.season}シーズン・${board.asOf}時点。`,
      };

  const maxScore = Math.max(
    ...board.leagues.NL.map((r) => r.score),
    ...board.leagues.AL.map((r) => r.score),
    1,
  );

  return (
    <div className="space-y-8">
      {/* スコアの作り方（透明性＝断定でないことを明示） */}
      <div className="rounded-[2px] border border-line p-4">
        <h2 className="text-sm font-bold text-ink">{t.methodTitle}</h2>
        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-ink-soft">{t.method}</p>
      </div>

      {/* NL → AL の順（大谷・山本ら日本人はほぼ NL）。 */}
      {(['NL', 'AL'] as const).map((lg) => (
        <section key={lg} className="space-y-2" aria-label={lg}>
          <LeagueTable league={lg} rows={board.leagues[lg]} maxScore={maxScore} en={en} t={t.cols} />
        </section>
      ))}

      {/* 圏外の注目日本人（大谷ら規定未達の先発）。 */}
      {board.watch.length > 0 && (
        <section>
          <SectionHeading label={t.watchTitle} lead level="h2" />
          <p className="mb-3 mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{t.watchSub}</p>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {board.watch.map((wp) => (
              <WatchCard key={wp.id} wp={wp} slug={slugByMlbId.get(wp.id)} en={en} gapLabel={t.watchGap} />
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-ink-mute">{t.source}</p>
    </div>
  );
}

function WatchCard({ wp, slug, en, gapLabel }: { wp: CyWatch; slug?: string; en: boolean; gapLabel: (n: number) => string }) {
  const team = en ? wp.teamEn : wp.teamJa;
  return (
    <div className="bg-paper px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Avatar mlbId={wp.id} teamId={wp.teamId} name={wp.nameJa} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            {slug ? (
              <Link href={`/player/${slug}`} className="font-bold text-ink hover:underline">
                {wp.nameJa}
              </Link>
            ) : (
              <span className="font-bold text-ink">{wp.nameJa}</span>
            )}
            {wp.league ? <span className="text-xs text-ink-mute">{wp.league}</span> : null}
          </div>
          <div className="mt-0.5 text-xs text-ink-mute">{team}</div>
        </div>
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm tabular-nums text-ink-soft">
        <div>
          <span className="text-ink-mute">ERA </span>
          <span className="font-medium text-ink">{wp.era}</span>
        </div>
        {wp.xera != null ? (
          <div>
            <span className="text-ink-mute">xERA </span>
            {wp.xera.toFixed(2)}
          </div>
        ) : null}
        <div>
          <span className="text-ink-mute">{en ? 'IP ' : '回 '}</span>
          {wp.ipDisp}
        </div>
        <div>
          <span className="text-ink-mute">WHIP </span>
          {wp.whip}
        </div>
      </dl>
      <p className="mt-1.5 text-xs text-ink-mute">{gapLabel(wp.ipGap)}</p>
    </div>
  );
}
