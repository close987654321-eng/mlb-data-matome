import { ImageResponse } from 'next/og';
import { PLAYERS } from '@/lib/players';
import { getPlayersSnapshot, type PlayerSeason } from '@/lib/playerStats';
import { ACCENT } from '@/lib/teamColors';
import { teamAccent, lightenHex } from '@/lib/cardCanvas';
import { locales, type Locale } from '@/lib/i18n';
import { CREAM, loadOgFonts, teamOgFrame, FIELD_MUTED as MUTED, FIELD_FAINT as FAINT, FIELD_RULE as RULE } from '@/lib/ogCard';

/**
 * /ranking（日本人選手 成績ランキング）の OG カード。選手ハブ OG と同じ成績カード意匠のファミリー
 * （teamOgFrame＝ブランド色の地・白罫）に揃える。主役は「大判タイトル＝ランキング＋WAR上位の掲載選手」。
 * 数値は捏造せずスナップショット由来の年・時点・実在の掲載選手のみ（順位は WAR で並べる）。
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = '日本人MLB選手 成績ランキング｜WAR・本塁打・防御率｜海外の反応';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** "2026-06-23 09:09" → "6/23時点"（捏造しない・無ければ空）。 */
function asOfLabel(asOf?: string): string {
  if (!asOf) return '';
  const m = asOf.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[3])}時点` : '';
}

export default async function Image({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const en = locale === 'en';
  const [fonts, snap] = await Promise.all([loadOgFonts(), getPlayersSnapshot()]);
  const hasJp = fonts != null;
  const JP = hasJp ? 'NotoJP' : undefined;
  const DISP = hasJp ? 'Anton' : undefined;
  const yr = snap.season || 2026;
  const acc = teamAccent(ACCENT);
  const accLt = lightenHex(acc, 0.2);

  // 掲載選手（日本人・今季MLB成績あり）を WAR（打者/投手の高い方）で降順＝表紙の並びに「ランキング感」を出す。
  const bestWar = (s: PlayerSeason) => Math.max(s.saber?.hit ?? -99, s.saber?.pit ?? -99);
  const roster = PLAYERS.filter((p) => !p.rival)
    .map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined }))
    .filter((x): x is { p: (typeof PLAYERS)[number]; s: PlayerSeason } => Boolean(x.s && x.s.league))
    .sort((a, b) => bestWar(b.s) - bestWar(a.s));
  const names = roster.map((x) => (en && x.p.nameEn ? x.p.nameEn : x.p.nameJa));

  const titleTop = en || !hasJp ? 'JAPANESE MLB' : '日本人MLB選手';
  const titleBot = en || !hasJp ? 'RANKINGS' : '成績ランキング';
  const titleFont = en || !hasJp ? DISP : JP;
  const titleSize = en || !hasJp ? 96 : 88;
  const lead = en ? 'WAR · HR · ERA · Strikeouts' : 'WAR・本塁打・防御率・奪三振';
  const badge = en ? 'RANKING' : 'ランキング';
  const asOf = asOfLabel(snap.asOf);

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <div style={{ display: 'flex', width: 14, height: 42, background: accLt, borderRadius: 3, marginRight: 20 }} />
      <div style={{ display: 'flex', fontFamily: JP, fontWeight: 700, fontSize: hasJp ? 27 : 24, letterSpacing: hasJp ? 2 : 4, color: CREAM }}>
        {hasJp ? '海外の反応' : 'MLB SEASON STATS'}
      </div>
      <div style={{ display: 'flex', fontFamily: DISP, fontSize: 23, letterSpacing: 4, color: MUTED, marginLeft: 22 }}>
        {`MLB ${yr}`}
      </div>
      <div
        style={{
          display: 'flex',
          marginLeft: 'auto',
          border: `1px solid ${MUTED}`,
          borderRadius: 999,
          padding: '7px 22px',
          fontFamily: hasJp && !en ? JP : DISP,
          fontSize: 23,
          letterSpacing: hasJp && !en ? 2 : 3,
          color: CREAM,
        }}
      >
        {badge}
      </div>
    </div>
  );

  const domain = (
    <div style={{ display: 'flex', alignItems: 'baseline', marginLeft: 24, flexShrink: 0 }}>
      <div style={{ display: 'flex', fontFamily: JP, fontSize: 21, color: FAINT, letterSpacing: 1 }}>
        matome-mlb-kaigai.jp
      </div>
      {asOf ? (
        <div style={{ display: 'flex', fontFamily: JP, fontSize: 19, color: FAINT, marginLeft: 14 }}>{`・ ${asOf}`}</div>
      ) : null}
    </div>
  );

  return new ImageResponse(
    teamOgFrame(
      ACCENT,
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: CREAM,
          padding: '60px 72px 132px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        {header}

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxWidth: 820, overflow: 'hidden' }}>
            <div style={{ display: 'flex', fontFamily: titleFont, fontWeight: 900, fontSize: titleSize, color: CREAM, lineHeight: 1.05 }}>
              {titleTop}
            </div>
            <div style={{ display: 'flex', fontFamily: titleFont, fontWeight: 900, fontSize: titleSize, color: CREAM, lineHeight: 1.05, marginTop: 6 }}>
              {titleBot}
            </div>
            <div style={{ display: 'flex', fontFamily: JP, fontSize: 26, color: MUTED, marginTop: 22 }}>{lead}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 36 }}>
            <div style={{ display: 'flex', fontFamily: DISP, fontSize: 26, color: MUTED, letterSpacing: 4, marginBottom: 2 }}>SEASON</div>
            <div style={{ display: 'flex', fontFamily: DISP, fontSize: 150, color: CREAM, lineHeight: 1 }}>{String(yr)}</div>
            <div style={{ display: 'flex', width: '100%', height: 6, background: acc, borderRadius: 2, marginTop: 14 }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', width: '100%', height: 1, background: RULE, marginBottom: 22 }} />
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', flex: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
              {names.map((name, i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'baseline', flexShrink: 0 }}>
                  {i > 0 ? <div style={{ display: 'flex', fontFamily: JP, fontSize: 20, color: RULE, margin: '0 16px' }}>・</div> : null}
                  <div style={{ display: 'flex', fontFamily: en || !hasJp ? DISP : JP, fontWeight: 700, fontSize: 23, color: i === 0 ? CREAM : MUTED }}>
                    {name}
                  </div>
                </div>
              ))}
            </div>
            {domain}
          </div>
        </div>
      </div>,
    ),
    { ...size, ...(fonts ? { fonts } : {}) },
  );
}
