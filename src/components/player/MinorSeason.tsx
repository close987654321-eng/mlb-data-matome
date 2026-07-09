import type { Player } from '@/lib/players';
import type { PlayerSeason } from '@/lib/playerStats';
import { headshotUrl } from '@/lib/teams';
import SectionHeading from '@/components/SectionHeading';
import Chevron from '@/components/Chevron';

/**
 * マイナー（AAA 等）でプレー中の選手の「選手詳細」。村上ら MLB 昇格前の注目打者向け。
 *
 * なぜ PlayerHero と分けるか: MLB のヒーロー帯は「MLB全体○位」等のリーグ順位を前提にするが、
 * AAA の選手は league=null で MLB 内の順位を持たない。順位UIをそのまま流用すると誤解を生むので、
 * 「マイナー（AAA）の現在地」であることを明示した専用の軽量詳細を出す（[[mlb-stats-enrichment-decision]]
 * の誠実さ方針＝数値は公知の事実だけ・過度な断定はしない）。
 *
 * データは snapshot（jp-players-stats.json）の hitting / saber / fielding / sprintSpeed のみ＝サイト本体は
 * API を叩かない。インライン bilingual（mvp/cy-young ページと同じ流儀）で self-contained にする。
 */

/** 率（.240 等）は文字列で来る。wOBA など数値は先頭 0 を落として .### 表記に整える。 */
function rate3(v: number | null | undefined): string | null {
  return v == null ? null : v.toFixed(3).replace(/^0(?=\.)/, '');
}

type Cell = { l: string; v: string | number | null | undefined };
/** null/undefined/空を落として表示可能なセルだけ返す（0 は残す＝盗塁0などは事実）。 */
function cells(items: Cell[]): { l: string; v: string }[] {
  return items.flatMap((c) => (c.v == null || c.v === '' ? [] : [{ l: c.l, v: String(c.v) }]));
}

function StatGrid({ items }: { items: { l: string; v: string }[] }) {
  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-5">
      {items.map((s) => (
        <div key={s.l} className="bg-paper px-3 py-2.5 sm:px-4 sm:py-3">
          <dt className="text-xs text-ink-mute">{s.l}</dt>
          <dd className="mt-0.5 text-base font-bold tabular-nums text-ink sm:text-lg">{s.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function MinorSeason({
  player,
  season,
  year,
  asOf,
  locale,
}: {
  player: Player;
  season: PlayerSeason;
  year: number;
  asOf: string;
  locale: string;
}) {
  const en = locale === 'en';
  const name = en ? player.nameEn : player.nameJa;
  const h = season.hitting;
  const p = season.pitching;
  const sb = season.saber;
  const f = season.fielding;
  const team = season.team ?? (en ? 'Minors (AAA)' : 'マイナー');
  const wrc = sb?.wrcplus != null ? String(Math.round(sb.wrcplus)) : null;
  const woba = rate3(sb?.woba);
  const sprint = season.sprintSpeed != null ? `${season.sprintSpeed} ft/s` : null;

  // ヒーローの大きい数字（打者）＝ AVG / HR / OPS / wRC+。値のあるものだけ。
  const marquee = h
    ? cells([
        { l: en ? 'AVG' : '打率', v: h.avg },
        { l: en ? 'HR' : '本塁打', v: h.homeRuns },
        { l: 'OPS', v: h.ops },
        { l: 'wRC+', v: wrc },
      ])
    : [];

  const batItems = h
    ? cells([
        { l: en ? 'AVG' : '打率', v: h.avg },
        { l: en ? 'OBP' : '出塁率', v: h.obp },
        { l: en ? 'SLG' : '長打率', v: h.slg },
        { l: 'OPS', v: h.ops },
        { l: en ? 'wOBA' : 'wOBA', v: woba },
        { l: 'wRC+', v: wrc },
        { l: en ? 'G' : '試合', v: h.gamesPlayed },
        { l: en ? 'PA' : '打席', v: h.plateAppearances },
        { l: en ? 'AB' : '打数', v: h.atBats },
        { l: en ? 'H' : '安打', v: h.hits },
        { l: en ? '2B' : '二塁打', v: h.doubles },
        { l: en ? '3B' : '三塁打', v: h.triples },
        { l: en ? 'HR' : '本塁打', v: h.homeRuns },
        { l: en ? 'RBI' : '打点', v: h.rbi },
        { l: en ? 'R' : '得点', v: h.runs },
        { l: en ? 'BB' : '四球', v: h.baseOnBalls },
        { l: en ? 'SO' : '三振', v: h.strikeOuts },
        { l: en ? 'SB' : '盗塁', v: h.stolenBases },
        { l: 'BABIP', v: h.babip },
      ])
    : [];

  const pitItems = p
    ? cells([
        { l: en ? 'ERA' : '防御率', v: p.era },
        { l: 'WHIP', v: p.whip },
        { l: en ? 'W' : '勝', v: p.wins },
        { l: en ? 'L' : '敗', v: p.losses },
        { l: en ? 'G' : '登板', v: p.gamesPlayed },
        { l: en ? 'IP' : '投球回', v: p.inningsPitched },
        { l: en ? 'SO' : '奪三振', v: p.strikeOuts },
        { l: en ? 'BB' : '与四球', v: p.baseOnBalls },
      ])
    : [];

  const fieldItems = f
    ? cells([
        { l: en ? 'G' : '試合', v: f.gamesPlayed },
        { l: en ? 'GS' : '先発', v: f.gamesStarted },
        { l: en ? 'INN' : '守備回', v: f.innings },
        { l: en ? 'PO' : '刺殺', v: f.putOuts },
        { l: en ? 'A' : '補殺', v: f.assists },
        { l: en ? 'E' : '失策', v: f.errors },
        { l: en ? 'FLD%' : '守備率', v: f.fielding },
        { l: 'OAA', v: f.oaa },
      ])
    : [];
  // 走力は守備位置を問わず出せる身体能力（DH でも付く）。守備が無くても単独で見せる。
  const speedItems = sprint ? [{ l: en ? 'Sprint speed' : '走力', v: sprint }] : [];

  const lede = h
    ? en
      ? `${h.gamesPlayed} games for ${team} (Triple-A) this ${year} season: ${h.homeRuns} HR, ${h.ops} OPS${wrc ? `, ${wrc} wRC+` : ''}.`
      : `AAA・${team}で今季${h.gamesPlayed}試合に出場し${h.homeRuns}本塁打・OPS${h.ops}${wrc ? `（wRC+${wrc}）` : ''}。`
    : player.bio;

  const note = en
    ? `Data: MLB Stats API (public factual figures) + Baseball Savant (sprint speed). These are Triple-A numbers — a snapshot of where he stands before a big-league call-up; qualified-batter thresholds and MLB rankings are shown for major-leaguers only. As of ${asOf}, not real-time.`
    : `出典: MLB公式Stats API（数値は公知の事実）＋Baseball Savant（走力）。マイナー（AAA）成績＝メジャー昇格前の現在地で、規定打席やMLB内の順位はメジャーの選手のみ表示します。${asOf}時点・リアルタイム更新ではありません。`;

  return (
    <>
      {/* ヒーロー帯（軽量）: 顔写真＋AAAバッジ＋名前＋現在地の地の文。 */}
      <section className="flex flex-wrap items-center gap-5 border-b border-line pb-6 motion-safe:animate-[rise_.32s_ease-out_both]">
        <div className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない） */}
          <img
            src={headshotUrl(player.mlbId, 'portrait')}
            alt={name}
            width={100}
            height={150}
            className="h-[132px] w-[88px] rounded-[2px] border-b-[3px] border-ink/60 bg-paper object-cover object-top sm:h-[150px] sm:w-[100px]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-mute">
            {en ? 'Japanese player' : '日本人選手'}
            <span className="rounded-[2px] border border-ink/30 px-1.5 py-px text-[10px] tracking-normal text-ink-soft">
              AAA
            </span>
          </span>
          <h1 className="mt-1.5 text-3xl font-bold text-ink sm:text-4xl">
            {player.nameJa}
            <span className="ml-2 text-base font-normal text-ink-soft">{player.nameEn}</span>
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {team}
            {f?.position ? <span className="text-ink-mute"> ・ {f.position}</span> : null}
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">{lede}</p>
        </div>
      </section>

      {/* ヒーローの大きい数字（打者）。 */}
      {marquee.length > 0 && (
        <section>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-4">
            {marquee.map((s) => (
              <div key={s.l} className="bg-paper px-4 py-4 text-center sm:py-5">
                <dt className="text-xs uppercase tracking-wider text-ink-mute">{s.l}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-ink sm:text-3xl">{s.v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* 今季成績（AAA）。 */}
      {batItems.length > 0 && (
        <section>
          <div className="mb-3">
            <SectionHeading label={en ? `${year} Triple-A batting` : `${year}年 今季成績（AAA）`} lead level="h2" />
          </div>
          <StatGrid items={batItems} />
        </section>
      )}

      {pitItems.length > 0 && (
        <section>
          <div className="mb-3">
            <SectionHeading label={en ? `${year} Triple-A pitching` : `${year}年 今季成績（AAA・投手）`} lead level="h2" />
          </div>
          <StatGrid items={pitItems} />
        </section>
      )}

      {/* 守備・走力。 */}
      {(fieldItems.length > 0 || speedItems.length > 0) && (
        <section>
          <div className="mb-3">
            <SectionHeading
              label={en ? 'Fielding & speed' : '守備・走力'}
              lead
              level="h2"
            />
          </div>
          {fieldItems.length > 0 && (
            <>
              {f?.position && (
                <p className="mb-2 text-xs text-ink-mute">
                  {en ? 'Primary position' : '主なポジション'}: {f.position}
                </p>
              )}
              <StatGrid items={fieldItems} />
            </>
          )}
          {speedItems.length > 0 && (
            <div className={fieldItems.length > 0 ? 'mt-3' : ''}>
              <StatGrid items={speedItems} />
            </div>
          )}
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-ink-mute">{note}</p>

      {/* 経歴・外部権威URL（MLB版のヒーロー分岐と同じ畳み込み）。 */}
      <details className="group border-t border-line pt-2">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          {en ? 'About' : '選手について'}
          <span aria-hidden="true" className="text-ink-soft transition-transform group-open:rotate-180">
            <Chevron />
          </span>
        </summary>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">{player.bio}</p>
        {player.sameAs.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-soft">
            {player.sameAs.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex min-h-[44px] items-center underline hover:text-ink"
              >
                {url.includes('wikipedia') ? 'Wikipedia' : url.includes('mlb.com') ? 'MLB.com' : '公式'}
              </a>
            ))}
          </p>
        )}
      </details>
    </>
  );
}
