import { Link } from '@/lib/navigation';
import { PLAYERS } from '@/lib/players';
import SectionHeading from '@/components/SectionHeading';
import { headshotUrl, teamLogoUrl } from '@/lib/teams';
import { type RoyBoard as Board, type RoyRow, type RoyWatch } from '@/lib/royBoard';

const TOP_N = 12; // 各リーグで通常表示する上位数（＋圏外の日本人は別途 append）

/** 顔写真（丸アバター・公式CDN直リンク）＋ チームロゴのバッジ。CyYoungBoard / MvpBoard と同じ意匠。 */
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

/** 小さなチップ（無彩色）。日本人フラグと役割（野手/投手）に使う。 */
function Chip({ label, strong = false }: { label: string; strong?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-[2px] border px-1 py-px text-[10px] font-medium leading-none ${
        strong ? 'border-ink/30 text-ink-mute' : 'border-line text-ink-mute'
      }`}
    >
      {label}
    </span>
  );
}

type Cols = {
  player: string;
  score: string;
  war: string;
  rate: string; // 打率 / 防御率
  count: string; // 本塁打 / 奪三振
  volume: string; // 打席 / 投球回
  jp: string;
  bat: string;
  pit: string;
  more: string;
};

function LeagueTable({
  league,
  rows,
  maxScore,
  en,
  t,
  slugByMlbId,
}: {
  league: string;
  rows: RoyRow[];
  maxScore: number;
  en: boolean;
  t: Cols;
  slugByMlbId: Map<number, string>;
}) {
  // 上位 TOP_N ＋ それ以下に居る日本人（強調）を append。境目に区切りを出す。
  const top = rows.slice(0, TOP_N);
  const extraJp = rows.slice(TOP_N).filter((r) => r.isJp);
  const shown: (RoyRow | 'gap')[] = extraJp.length ? [...top, 'gap', ...extraJp] : top;

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold tracking-wide text-ink">{league}</h2>
      <div className="overflow-x-auto rounded-[2px] border border-line">
        <table className="w-full min-w-[620px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-ink-mute">
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">{t.player}</th>
              <th className="px-3 py-2 text-right font-semibold text-ink">{t.score}</th>
              <th className="px-3 py-2 text-right font-medium">{t.war}</th>
              <th className="px-3 py-2 text-right font-medium">{t.rate}</th>
              <th className="px-3 py-2 text-right font-medium">{t.count}</th>
              <th className="px-3 py-2 text-right font-medium">{t.volume}</th>
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
                <Row key={row.id} row={row} maxScore={maxScore} en={en} t={t} slug={slugByMlbId.get(row.id)} />
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  row,
  maxScore,
  en,
  t,
  slug,
}: {
  row: RoyRow;
  maxScore: number;
  en: boolean;
  t: Cols;
  slug?: string;
}) {
  const name = en ? row.nameEn : row.nameJa;
  const team = en ? row.teamEn : row.teamJa;
  const why = en ? row.whyEn : row.why;
  const nameCls = row.isJp ? 'font-bold text-ink' : 'font-medium text-ink';
  // 新人王ボードは詳細ページを持たない（/cy-young・/mvp の詳細202ページは索引方針を検討中のため
  // 面を増やさない）。選手ハブがある選手だけ行をリンクにし、無い選手はプレーンに出す。
  const rate = row.role === 'bat' ? (row.avg ?? '—') : (row.era ?? '—');
  const count = row.role === 'bat' ? `${row.hr}` : `${row.so}`;
  const volume = row.role === 'bat' ? `${row.pa}` : (row.ipDisp ?? '—');

  return (
    <tr
      className={`group relative border-b border-line transition-colors last:border-0 hover:bg-ink/[0.06] ${row.isJp ? 'bg-ink/[0.04]' : ''}`}
    >
      <td className="px-3 py-2 align-top text-ink-mute">{row.rank}</td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-start gap-2.5">
          <Avatar mlbId={row.id} teamId={row.teamId} name={name} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {slug ? (
                <Link href={`/player/${slug}`} className={`${nameCls} after:absolute after:inset-0 group-hover:underline`}>
                  {name}
                </Link>
              ) : (
                <span className={nameCls}>{name}</span>
              )}
              <Chip label={row.role === 'bat' ? t.bat : t.pit} />
              {row.isJp && <Chip label={t.jp} strong />}
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
      <td className="px-3 py-2 align-top text-right font-medium text-ink">{row.war != null ? row.war.toFixed(2) : '—'}</td>
      <td className="px-3 py-2 align-top text-right text-ink-soft">{rate}</td>
      <td className="px-3 py-2 align-top text-right text-ink-soft">{count}</td>
      <td className="px-3 py-2 align-top text-right text-ink-soft">{volume}</td>
    </tr>
  );
}

/**
 * 新人王 予測ボード＝ルーキー資格者を AL/NL 別に合成スコアで順位予測し、日本人を強調。
 * 野手と投手が同じ表に混ざる（新人王は1つの賞）ので、行に役割チップを添え、
 * 数値列は「率／カウント／出場量」の3枠にして役割ごとに中身を差し替える。
 * スコアは断定でなく予測＝式と出典を明示する。サーバーコンポーネント（静的）。
 */
export default function RoyBoard({ board, locale }: { board: Board; locale: string }) {
  const en = locale === 'en';
  const slugByMlbId = new Map(PLAYERS.map((p) => [p.mlbId, p.slug]));
  const w = board.weights;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const t = en
    ? {
        methodTitle: 'How the score works',
        method: `Rookie of the Year is one award contested by hitters and pitchers together, so WAR is the shared currency (${pct(w.war)}) across the whole rookie field in each league. The role-specific quality (${pct(w.role)}: wRC+ for hitters, FIP for pitchers) and playing time (${pct(w.volume)}: plate appearances or innings) are ranked within each role, so a hitter and a pitcher are never compared on the same rate stat. Rookie eligibility follows MLB’s official rookie pool. Listed players need at least ${board.minPa} PA or ${board.minIp} IP. It’s our data-driven read, not a verdict.`,
        cols: {
          player: 'Player',
          score: 'Score',
          war: 'WAR',
          rate: 'AVG / ERA',
          count: 'HR / SO',
          volume: 'PA / IP',
          jp: 'JP',
          bat: 'BAT',
          pit: 'PIT',
          more: 'lower in the field',
        },
        leagues: { AL: 'AL Rookie of the Year candidates', NL: 'NL Rookie of the Year candidates' },
        watchTitle: 'Japanese rookies below the cutoff',
        watchSub: 'Rookie-eligible but not yet at the playing-time cutoff — where they stand right now.',
        source: `Data: MLB Stats API (public factual figures). ${board.season} season, as of ${board.asOf}.`,
      }
    : {
        methodTitle: '予測スコアの出し方',
        method: `新人王は野手と投手が1つの賞を争うので、WAR を役割をまたぐ共通の物差し（${pct(w.war)}）としてリーグのルーキー全体の中で順位づけしています。役割ごとの中身（${pct(w.role)}＝野手はwRC+・投手はFIP）と出場量（${pct(w.volume)}＝打席数・投球回）は、野手は野手、投手は投手の母集団の中で比べる＝打率と防御率を直接ぶつけることはしません。ルーキー資格の判定はMLB公式のルーキー区分に従っています。表に載るのは${board.minPa}打席または${board.minIp}投球回以上の選手です。現時点の成績にもとづく予測です。`,
        cols: {
          player: '選手',
          score: '予測スコア',
          war: 'WAR',
          rate: '打率/防御率',
          count: '本塁打/奪三振',
          volume: '打席/投球回',
          jp: '日本',
          bat: '野手',
          pit: '投手',
          more: 'この間の選手は省略',
        },
        // 表の見出しは「AL」「NL」の記号でなく、検索で打たれる語（ア・リーグ 新人王候補）で書く。
        // /cy-young・/mvp で効いた形をそのまま移植（boardSeo.ts）。
        leagues: { AL: 'ア・リーグ 新人王候補', NL: 'ナ・リーグ 新人王候補' },
        watchTitle: '出場数が下限に届いていない日本人ルーキー',
        watchSub: 'ルーキー資格はあるものの、まだ打席数・投球回が表の下限に届いていない選手たち。',
        source: `出典: MLB公式Stats API（公知の数値）。${board.season}シーズン・${board.asOf}時点。`,
      };

  const maxScore = Math.max(...board.leagues.NL.map((r) => r.score), ...board.leagues.AL.map((r) => r.score), 1);

  return (
    <div className="space-y-8">
      {/* スコアの作り方（透明性＝断定でないことを明示） */}
      <div className="rounded-[2px] border border-line p-4">
        <h2 className="text-sm font-bold text-ink">{t.methodTitle}</h2>
        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-ink-soft">{t.method}</p>
      </div>

      {/* AL → NL の順（2026年は村上・岡本・今井の日本人3人がいずれもア・リーグ）。
          id はリーグ別クエリからの着地点（/roy#al）。 */}
      {(['AL', 'NL'] as const).map((lg) => (
        <section key={lg} id={lg.toLowerCase()} className="space-y-2" aria-label={t.leagues[lg]}>
          <LeagueTable
            league={t.leagues[lg]}
            rows={board.leagues[lg]}
            maxScore={maxScore}
            en={en}
            t={t.cols}
            slugByMlbId={slugByMlbId}
          />
        </section>
      ))}

      {/* 下限未達の日本人ルーキー。 */}
      {board.watch.length > 0 && (
        <section>
          <SectionHeading label={t.watchTitle} lead level="h2" />
          <p className="mb-3 mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{t.watchSub}</p>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {board.watch.map((wp) => (
              <WatchCard key={wp.id} wp={wp} slug={slugByMlbId.get(wp.id)} en={en} />
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-ink-mute">{t.source}</p>
    </div>
  );
}

function WatchCard({ wp, slug, en }: { wp: RoyWatch; slug?: string; en: boolean }) {
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
        {wp.role === 'bat' ? (
          <>
            <div>
              <span className="text-ink-mute">{en ? 'AVG ' : '打率 '}</span>
              <span className="font-medium text-ink">{wp.avg ?? '—'}</span>
            </div>
            <div>
              <span className="text-ink-mute">OPS </span>
              {wp.ops ?? '—'}
            </div>
            <div>
              <span className="text-ink-mute">{en ? 'PA ' : '打席 '}</span>
              {wp.pa ?? '—'}
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="text-ink-mute">ERA </span>
              <span className="font-medium text-ink">{wp.era ?? '—'}</span>
            </div>
            <div>
              <span className="text-ink-mute">{en ? 'SO ' : '奪三振 '}</span>
              {wp.so ?? '—'}
            </div>
            <div>
              <span className="text-ink-mute">{en ? 'IP ' : '回 '}</span>
              {wp.ipDisp ?? '—'}
            </div>
          </>
        )}
      </dl>
      <p className="mt-1.5 text-xs text-ink-mute">
        {wp.role === 'bat'
          ? en
            ? `~${wp.paGap} PA to the cutoff`
            : `下限まであと約${wp.paGap}打席`
          : en
            ? `~${wp.ipGap} IP to the cutoff`
            : `下限まであと約${wp.ipGap}回`}
      </p>
    </div>
  );
}
