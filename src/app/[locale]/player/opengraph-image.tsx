import { ImageResponse } from 'next/og';
import { getAllThreads } from '@/lib/data';
import { PLAYERS, hubEligible } from '@/lib/players';
import { getPlayersSnapshot } from '@/lib/playerStats';
import { ACCENT } from '@/lib/teamColors';
import { teamAccent, lightenHex } from '@/lib/cardCanvas';
import { locales, type Locale } from '@/lib/i18n';
import { CREAM, loadOgFonts, teamOgFrame, FIELD_MUTED as MUTED, FIELD_FAINT as FAINT, FIELD_RULE as RULE } from '@/lib/ogCard';

/**
 * /player ハブ（日本人選手 成績まとめ・比較）の OG カード。個別選手 OG と同じ成績カード意匠の
 * ファミリー（teamOgFrame＝チーム色の地・白罫）に揃える。個別が所属チーム色なのに対し、ハブは
 * 単一チームを持たないのでブランド色(ACCENT=赤)を地にする。主役の違いは、個別は「選手名＋巨大成績」、
 * ハブは「一覧の表紙＝大判タイトル＋掲載選手の並び」。数値は捏造せずスナップショット由来の年・時点・実在の掲載選手のみ。
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'MLB日本人選手の今季成績まとめ・比較｜海外の反応';

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
  const [fonts, all, snap] = await Promise.all([
    loadOgFonts(),
    getAllThreads(),
    getPlayersSnapshot(),
  ]);
  const hasJp = fonts != null;
  const JP = hasJp ? 'NotoJP' : undefined;
  const DISP = hasJp ? 'Anton' : undefined;
  const yr = snap.season || 2026;
  // 色地の上で映えるブランドアクセント（成績カードと同じ処理＝彩度/明度を持ち上げた鮮やか版）。
  const acc = teamAccent(ACCENT);
  const accLt = lightenHex(acc, 0.2);

  // 掲載選手（hubEligible）。ライバル枠を除いた日本人選手を表紙の並びに使う（実在のみ）。
  const roster = PLAYERS.filter(
    (p) => !p.rival && hubEligible(p, all, snap.players[String(p.mlbId)]),
  );
  const names = roster.map((p) => (en && p.nameEn ? p.nameEn : p.nameJa));

  // 和フォント未生成時は和文を出さず英字表紙へ縮退（豆腐(□)を出さない）。
  const titleTop = en || !hasJp ? 'MLB JAPANESE' : '日本人MLB選手';
  const titleBot = en || !hasJp ? 'PLAYERS' : '今季成績まとめ';
  const titleFont = en || !hasJp ? DISP : JP;
  const titleSize = en || !hasJp ? 96 : 88;
  const lead = en ? 'Season stats & comparison' : '成績まとめ・比較／現地の評判';
  const badge = en ? 'ROSTER' : '選手名鑑';
  const asOf = asOfLabel(snap.asOf);

  // ヘッダー（媒体面）。アクセント色の縦バー＋「海外の反応」＋年＋右に名鑑バッジ。
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

        {/* 主役: 左=大判タイトル(2行)＋リード / 右=SEASON 年（個別カードの巨大数字スロットを踏襲） */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxWidth: 780, overflow: 'hidden' }}>
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

        {/* フッター: 罫＋掲載選手の並び＋ドメイン（個別カードのトークン行を踏襲） */}
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
