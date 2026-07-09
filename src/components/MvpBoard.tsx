import { Link } from '@/lib/navigation';
import { PLAYERS } from '@/lib/players';
import SectionHeading from '@/components/SectionHeading';
import { headshotUrl, teamLogoUrl } from '@/lib/teams';
import { type MvpBoard as Board, type MvpRow, type MvpWatch, MVP_DETAIL_TOP } from '@/lib/mvpBoard';

const TOP_N = 12; // 各リーグで通常表示する上位数（＋圏外の日本人は別途 append）

/** 顔写真（丸アバター・公式CDN直リンク）＋ チームロゴのバッジ。CyYoungBoard と同じ流儀。 */
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

/** 小さな「日本」チップ（無彩色）。日本人打者の行に添える。 */
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
  slugByMlbId,
  maxScore,
  en,
  t,
}: {
  league: string;
  rows: MvpRow[];
  slugByMlbId: Map<number, string>;
  maxScore: number;
  en: boolean;
  t: { hitter: string; score: string; wrc: string; ops: string; hr: string; war: string; jp: string; more: string };
}) {
  // 上位 TOP_N ＋ それ以下に居る日本人（強調）を append。境目に区切りを出す。
  const top = rows.slice(0, TOP_N);
  const extraJp = rows.slice(TOP_N).filter((r) => r.isJp);
  const shown: (MvpRow | 'gap')[] = extraJp.length ? [...top, 'gap', ...extraJp] : top;

  return (
    <div>
      <h3 className="mb-2 text-sm font-bold tracking-wide text-ink">{league}</h3>
      <div className="overflow-x-auto rounded-[2px] border border-line">
        <table className="w-full min-w-[560px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-ink-mute">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">{t.hitter}</th>
              <th className="px-3 py-2 text-right font-semibold text-ink">{t.score}</th>
              <th className="px-3 py-2 text-right font-medium">{t.wrc}</th>
              <th className="px-3 py-2 text-right font-medium">{t.ops}</th>
              <th className="px-3 py-2 text-right font-medium">{t.hr}</th>
              <th className="px-3 py-2 text-right font-medium">{t.war}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) =>
              row === 'gap' ? (
                <tr key="gap" className="border-b border-line">
                  <td colSpan={7} className="px-3 py-1 text-center text-xs text-ink-mute">
                    ⋯ {t.more}
                  </td>
                </tr>
              ) : (
                <Row key={row.id} row={row} slug={slugByMlbId.get(row.id)} maxScore={maxScore} en={en} jpLabel={t.jp} />
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ row, slug, maxScore, en, jpLabel }: { row: MvpRow; slug?: string; maxScore: number; en: boolean; jpLabel: string }) {
  const name = en ? row.nameEn : row.nameJa;
  const team = en ? row.teamEn : row.teamJa;
  const why = en ? row.whyEn : row.why;
  // リンク先: 上位N（詳細ページあり）→ /mvp/{id} ／ それ以外で追跡選手 → 選手ハブ ／ 他は素テキスト。
  const detail = row.rank <= MVP_DETAIL_TOP;
  const href = detail ? `/mvp/${row.id}` : slug ? `/player/${slug}` : null;
  const nameCls = row.isJp ? 'font-bold text-ink' : 'font-medium text-ink';
  return (
    <tr className={`border-b border-line last:border-0 ${row.isJp ? 'bg-ink/[0.04]' : ''}`}>
      <td className="px-3 py-2 align-top text-ink-mute">{row.rank}</td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-start gap-2.5">
          <Avatar mlbId={row.id} teamId={row.teamId} name={name} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {href ? (
                <Link href={href} className={`hover:underline ${nameCls}`}>
                  {name}
                </Link>
              ) : (
                <span className={nameCls}>{name}</span>
              )}
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
      <td className="px-3 py-2 align-top text-right font-medium text-ink">{row.wrcPlus ?? '—'}</td>
      <td className="px-3 py-2 align-top text-right text-ink-soft">{row.ops}</td>
      <td className="px-3 py-2 align-top text-right text-ink-soft">{row.hr}</td>
      <td className="px-3 py-2 align-top text-right text-ink-soft">{row.warTotal != null ? row.warTotal.toFixed(1) : '—'}</td>
    </tr>
  );
}

/**
 * MVP 予測ボード＝規定到達打者を AL/NL 別に合成スコアで順位予測し、日本人を強調（CyYoungBoard の野手版）。
 * 各行→詳細（打球の質・バットスピード）や選手ハブへ送客＝「徹底分析→予測」の締め。
 * スコアは断定でなく“データからの見立て”＝式と出典を明示する。サーバーコンポーネント（静的）。
 */
export default function MvpBoard({ board, locale }: { board: Board; locale: string }) {
  const en = locale === 'en';
  const slugByMlbId = new Map(PLAYERS.map((p) => [p.mlbId, p.slug]));
  const w = board.weights;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const t = en
    ? {
        methodTitle: 'How the score works',
        method: `Prediction score = each hitter’s within-league percentile in wRC+ + xwOBA (${pct(w.batting)}), home runs (${pct(w.hr)}), baserunning runs (${pct(w.run)}), defense incl. positional adjustment (${pct(w.def)}) and WAR (${pct(w.war)}), blended. Two-way players (Ohtani) count pitching WAR too. It’s our data-driven read, not a verdict — MVP is a within-league race. Qualified hitters only (~${board.qualifyPa} PA).`,
        cols: { hitter: 'Hitter', score: 'Score', wrc: 'wRC+', ops: 'OPS', hr: 'HR', war: 'WAR', jp: 'JP', more: 'lower in the field' },
        watchTitle: 'Japanese hitters on the cusp',
        watchSub: 'Not yet PA-qualified — where Japan’s bats stand right now.',
        watchGap: (n: number) => `~${n} PA to qualify`,
        source: `Data: MLB Stats API + Baseball Savant (public factual figures). ${board.season} season, as of ${board.asOf}.`,
      }
    : {
        methodTitle: '予測スコアの出し方',
        method: `予測スコア＝各打者のリーグ内パーセンタイルを、打撃 wRC+ ＋ xwOBA（${pct(w.batting)}）・本塁打（${pct(w.hr)}）・走塁run（${pct(w.run)}）・守備run＋位置補正（${pct(w.def)}）・WAR（${pct(w.war)}）で重み付き合算した“データからの見立て”（断定ではない）。MVPはリーグ内争いなので league 別に。二刀流（大谷）は投手WARも合算して評価する。対象は規定打席到達の打者（目安 約${board.qualifyPa}打席）。`,
        cols: { hitter: '打者', score: '予測スコア', wrc: 'wRC+', ops: 'OPS', hr: '本塁打', war: 'WAR', jp: '日本', more: '同リーグの下位' },
        watchTitle: '圏外の注目日本人（規定打席 未達）',
        watchSub: '規定打席にまだ届かない＝現時点では集計圏外。日本人野手の“現在地”。',
        watchGap: (n: number) => `規定まであと約${n}打席`,
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

      {/* NL → AL の順（大谷・鈴木ら日本人野手の多くは NL）。 */}
      {(['NL', 'AL'] as const).map((lg) => (
        <section key={lg} className="space-y-2" aria-label={lg}>
          <LeagueTable league={lg} rows={board.leagues[lg]} slugByMlbId={slugByMlbId} maxScore={maxScore} en={en} t={t.cols} />
        </section>
      ))}

      {/* 圏外の注目日本人（村上ら規定打席未達の野手）。 */}
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

function WatchCard({ wp, slug, en, gapLabel }: { wp: MvpWatch; slug?: string; en: boolean; gapLabel: (n: number) => string }) {
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
          <span className="text-ink-mute">OPS </span>
          <span className="font-medium text-ink">{wp.ops}</span>
        </div>
        <div>
          <span className="text-ink-mute">{en ? 'HR ' : '本塁打 '}</span>
          {wp.hr}
        </div>
        <div>
          <span className="text-ink-mute">{en ? 'RBI ' : '打点 '}</span>
          {wp.rbi}
        </div>
        <div>
          <span className="text-ink-mute">{en ? 'PA ' : '打席 '}</span>
          {wp.pa}
        </div>
      </dl>
      <p className="mt-1.5 text-xs text-ink-mute">{gapLabel(wp.paGap)}</p>
    </div>
  );
}
