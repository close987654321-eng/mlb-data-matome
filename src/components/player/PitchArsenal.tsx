import SectionHeading from '@/components/SectionHeading';
import {
  type PitcherArsenal,
  bestWhiffPitch,
  leakiestPitch,
  luckVerdict,
} from '@/lib/pitchArsenal';

// 率（.287 のような3桁）は先頭0を落として野球流に。null は "—"。
const fmt3 = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(3).replace(/^0/, ''));
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)}%`);
const mph = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(1));

/** 要点セル（決め球 / 一番打たれている球 / ERAとxERAの差）。gap-px + bg-line のヘアラインで区切る。 */
function KeyCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-paper px-4 py-3">
      <div className="text-xs text-ink-mute">{label}</div>
      <div className="mt-0.5 font-bold text-ink">{value}</div>
      {sub ? <div className="text-xs tabular-nums text-ink-soft">{sub}</div> : null}
    </div>
  );
}

/**
 * 球種別 徹底分析＝投手を球種レベルで丸裸にするセクション。徹底分析（gamelog）の隣に置く。
 * 「投球割合・球速・空振り率・被wOBA/期待被wOBA・ハードヒット率」＋「どの球を本塁打にされたか」で、
 * ERA（数字）と xERA（中身）の乖離まで見せてサイヤング級の“実力”を測る。
 * サーバーコンポーネント（静的表）。データ源は Baseball Savant（Statcast）の静的JSON。
 */
export default function PitchArsenal({
  arsenal,
  season,
  locale,
}: {
  arsenal: PitcherArsenal;
  season?: number;
  locale: string;
}) {
  const en = locale === 'en';
  const pitches = arsenal.pitches;
  if (!pitches.length) return null;

  const best = bestWhiffPitch(pitches);
  const leak = leakiestPitch(pitches);
  const luck = luckVerdict(arsenal.era, arsenal.xera);
  const hr = arsenal.hrAllowed;
  // usage バーの基準＝最多投球割合（＝一番使う球を満杯に）。0除算を避ける。
  const maxUsage = Math.max(...pitches.map((p) => p.usage ?? 0), 1);
  // 被弾の中で最も飛ばされた1本（“痛打”の具体像）。
  const longestHr =
    hr && hr.list.length
      ? hr.list.reduce((a, b) => ((b.dist ?? 0) > (a.dist ?? 0) ? b : a))
      : null;

  const t = en
    ? {
        title: 'Pitch arsenal',
        sub: 'Usage, velocity, whiff% and wOBA / expected wOBA by pitch — plus which pitch got taken deep. ERA vs xERA shows the true, Cy-Young-level stuff behind the number.',
        putout: 'Putaway pitch',
        hole: 'Leaky pitch',
        luck: 'Results vs stuff',
        pitch: 'Pitch', usage: 'Usage', velo: 'Velo', whiff: 'Whiff', woba: 'wOBA', xwoba: 'xwOBA', hard: 'Hard%', hr: 'HR',
        whiffTop: 'top whiff', hrTitle: 'Home runs allowed by pitch', longest: 'Longest',
        lucky: 'lucky (number better than stuff)', unlucky: 'unlucky (stuff is better)',
        source: `Source: Baseball Savant (Statcast, MLB official)${season ? ` · ${season} season` : ''}. Public factual figures only.`,
      }
    : {
        title: '球種の設計図',
        sub: '球種ごとの投球割合・球速・空振り率・被wOBAと、「どの球を本塁打にされたか」の内訳。ERAとxERA（打球の質から計算した期待防御率）の差からは、数字と投球内容のズレも見えてきます。',
        putout: '決め球',
        hole: '一番打たれている球',
        luck: 'ERAとxERAの差',
        pitch: '球種', usage: '割合', velo: '球速', whiff: '空振り', woba: '被wOBA', xwoba: 'xwOBA', hard: 'ハード%', hr: '被弾',
        whiffTop: '空振り', hrTitle: '被弾の球種内訳', longest: '最も飛ばされた1本',
        lucky: '数字は出来すぎ気味', unlucky: '内容はもっと良い',
        source: `出典: Baseball Savant（Statcast・MLB公式）${season ? `・${season}シーズン` : ''}。数値は公知の事実。`,
      };

  return (
    <section className="space-y-4" aria-label={t.title}>
      <div>
        <SectionHeading label={t.title} lead level="h2" />
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{t.sub}</p>
      </div>

      {/* 要点＝決め球 / 一番打たれている球 / ERAとxERAの差（記事フックの素） */}
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-3">
        <KeyCell label={t.putout} value={best ? best.nameJa : '—'} sub={best ? `${t.whiffTop} ${pct(best.whiff)}` : undefined} />
        <KeyCell label={t.hole} value={leak ? leak.nameJa : '—'} sub={leak ? `${t.woba} ${fmt3(leak.woba)}` : undefined} />
        <KeyCell
          label={t.luck}
          value={arsenal.era != null ? `ERA ${arsenal.era.toFixed(2)}` : '—'}
          sub={
            arsenal.xera != null
              ? `xERA ${arsenal.xera.toFixed(2)}${luck ? ` · ${luck.unlucky ? t.unlucky : t.lucky}` : ''}`
              : undefined
          }
        />
      </dl>

      {/* 球種テーブル（無彩色・角シャープ・数値は tabular-nums。“穴”の行だけ淡く強調） */}
      <div className="overflow-x-auto rounded-[2px] border border-line">
        <table className="w-full min-w-[560px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-ink-mute">
              <th className="px-3 py-2 text-left font-medium">{t.pitch}</th>
              <th className="px-3 py-2 text-right font-medium">{t.usage}</th>
              <th className="px-3 py-2 text-right font-medium">{t.velo}</th>
              <th className="px-3 py-2 text-right font-medium">{t.whiff}</th>
              <th className="px-3 py-2 text-right font-semibold text-ink">{t.woba}</th>
              <th className="px-3 py-2 text-right font-medium">{t.xwoba}</th>
              <th className="px-3 py-2 text-right font-medium">{t.hard}</th>
              <th className="px-3 py-2 text-right font-medium">{t.hr}</th>
            </tr>
          </thead>
          <tbody>
            {pitches.map((p) => {
              const isHole = leak != null && p.type === leak.type;
              return (
                <tr key={p.type} className={`border-b border-line last:border-0 ${isHole ? 'bg-ink/[0.04]' : ''}`}>
                  <td className="px-3 py-2 text-left align-middle">
                    <div className="font-medium text-ink">{p.nameJa}</div>
                    <div className="mt-1 h-1 w-16 overflow-hidden rounded-[1px] bg-line" aria-hidden>
                      <div className="h-full bg-ink" style={{ width: `${Math.round(((p.usage ?? 0) / maxUsage) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-ink">{pct(p.usage)}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">{mph(p.velo)}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">{pct(p.whiff)}</td>
                  <td className="px-3 py-2 text-right font-medium text-ink">{fmt3(p.woba)}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">{fmt3(p.xwoba)}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">{pct(p.hardHit)}</td>
                  <td className="px-3 py-2 text-right text-ink">{p.hr || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 被弾の球種内訳＝「どの球を本塁打にされたか」 */}
      {hr && hr.total > 0 ? (
        <div className="rounded-[2px] border border-line p-4">
          <h3 className="text-sm font-bold text-ink">
            {t.hrTitle}
            <span className="ml-2 tabular-nums text-ink-mute">{hr.total}{en ? '' : '本'}</span>
          </h3>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-ink-soft">
            {Object.entries(hr.byPitch)
              .sort((a, b) => b[1] - a[1])
              .map(([nm, n]) => (
                <li key={nm}>
                  <span className="text-ink">{nm}</span> {n}
                </li>
              ))}
          </ul>
          {longestHr ? (
            <p className="mt-2 text-xs leading-relaxed text-ink-mute">
              {t.longest}: {longestHr.nameJa} {mph(longestHr.velo)}mph
              {longestHr.ev != null ? ` → ${mph(longestHr.ev)}mph` : ''}
              {longestHr.dist != null ? `・${longestHr.dist}ft` : ''}
              {longestHr.d ? `（${longestHr.d}）` : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-[11px] leading-relaxed text-ink-mute">{t.source}</p>
    </section>
  );
}
