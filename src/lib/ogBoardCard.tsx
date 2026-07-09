import { ImageResponse } from 'next/og';
import { ACCENT, getTeamColor } from './teamColors';
import { teamAccent, lightenHex } from './cardCanvas';
import { headshotUrl, teamLogoUrl } from './teams';
import { CREAM, loadOgFonts, teamOgFrame, FIELD_MUTED as MUTED, FIELD_FAINT as FAINT, FIELD_RULE as RULE } from './ogCard';

/**
 * 予測ボード（/cy-young・/mvp）系 OG カードの共通土台。両ボードは「改良はパリティ移植」が
 * 運用ルールなので、OG も1箇所で持ち route ファイルは文言と数値の写像だけにする。
 * 意匠は既存ファミリーを踏襲: ハブ＝/ranking の OG（ブランド色の地＋大判タイトル）、
 * 選手別＝/player/[slug] の OG（チーム色の地＋顔写真＋巨大数字。数字はここでは予測順位）。
 */

export const BOARD_OG_SIZE = { width: 1200, height: 630 };

/**
 * OG URL に埋める「内容の版」ハッシュ（選手ハブ OG の ogVersion と同じ狙い）。
 * 順位や成績が動いた時だけ URL が変わり、SNS スクレイパー/CDN が古い画像を出し続けない。
 */
export function ogVersionOf(rev: string, basis: unknown): string {
  const s = rev + JSON.stringify(basis ?? null);
  let h = 0x811c9dc5; // FNV-1a（依存を増やさない小さなハッシュ）
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// 顔写真/ロゴの data URI 化を URL 単位でメモ化。ボードは選手数が多く（両リーグ規定到達の全員）、
// ロケール×選手ぶんの再取得で CDN を叩き直さないための必須キャッシュ。失敗は null＝写真なしに縮退。
const imgCache = new Map<string, Promise<string | null>>();
export function loadImageDataCached(url: string): Promise<string | null> {
  const hit = imgCache.get(url);
  if (hit) return hit;
  const p = (async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') ?? 'image/png';
      return `data:${ct};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    } catch {
      return null;
    }
  })();
  imgCache.set(url, p);
  return p;
}

/** "2026-07-09 19:20" → "7/9時点"（捏造しない・無ければ空）。 */
export function asOfLabel(asOf?: string): string {
  if (!asOf) return '';
  const m = asOf.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[3])}時点` : '';
}

type Tok = { label: string; value: string };

type FontCtx = { JP?: string; DISP?: string; hasJp: boolean };

// ヘッダー（媒体面）: アクセント縦バー＋「海外の反応」＋年＋右にバッジ。選手 OG と同型。
function header(f: FontCtx, accLt: string, season: number, badge: string, badgeJa: boolean) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <div style={{ display: 'flex', width: 14, height: 42, background: accLt, borderRadius: 3, marginRight: 20 }} />
      <div style={{ display: 'flex', fontFamily: f.JP, fontWeight: 700, fontSize: f.hasJp ? 27 : 24, letterSpacing: f.hasJp ? 2 : 4, color: CREAM }}>
        {f.hasJp ? '海外の反応' : 'MLB SEASON STATS'}
      </div>
      <div style={{ display: 'flex', fontFamily: f.DISP, fontSize: 23, letterSpacing: 4, color: MUTED, marginLeft: 22 }}>
        {`MLB ${season}`}
      </div>
      <div
        style={{
          display: 'flex',
          marginLeft: 'auto',
          border: `1px solid ${MUTED}`,
          borderRadius: 999,
          padding: '7px 22px',
          fontFamily: badgeJa && f.hasJp ? f.JP : f.DISP,
          fontSize: 23,
          letterSpacing: badgeJa && f.hasJp ? 2 : 3,
          color: CREAM,
        }}
      >
        {badge}
      </div>
    </div>
  );
}

// 欄外右下: ドメイン＋データ時点。
function domainNode(f: FontCtx, asOf: string) {
  const label = asOfLabel(asOf);
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', marginLeft: 24, flexShrink: 0 }}>
      <div style={{ display: 'flex', fontFamily: f.JP, fontSize: 21, color: FAINT, letterSpacing: 1 }}>
        matome-mlb-kaigai.jp
      </div>
      {label ? (
        <div style={{ display: 'flex', fontFamily: f.JP, fontSize: 19, color: FAINT, marginLeft: 14 }}>{`・ ${label}`}</div>
      ) : null}
    </div>
  );
}

// 内側コンテンツ枠。下を厚めに空けるのは SNS が画像下に og:title の帯を重ねるため（選手 OG と同じ）。
const CONTAINER_STYLE = {
  position: 'relative' as const,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'space-between' as const,
  color: CREAM,
  padding: '60px 72px 132px 72px',
  fontFamily: 'sans-serif',
};

/** 選手別（ボード詳細ページ）OG のロケール別文言。 */
export type BoardDetailCopy = {
  badge: string; // ヘッダー右の企画名（例: サイヤング予測 / CY YOUNG）
  heroLabel: string; // 巨大順位の上のラベル（例: ナ・リーグ サイ・ヤング賞予測）
  scoreWord: string; // スコア 100 の言い方（スコア / SCORE）
  tokens: Tok[]; // 欄外の成績トークン（最大4）
};

export type BoardDetailOgProps = {
  locale: string;
  season: number;
  asOf: string;
  mlbId: number;
  teamId: number | null;
  league: 'AL' | 'NL';
  rank: number;
  score: number;
  nameJa: string;
  nameEn: string;
  teamJa: string;
  teamEn: string;
  ja: BoardDetailCopy;
  en: BoardDetailCopy;
};

/**
 * 選手別 OG: チーム色の地に「顔写真＋名前」×「巨大な予測順位」。
 * 和フォント未生成(hasJp=false)は英語文言へ縮退し豆腐(□)を出さない。
 */
export async function renderBoardDetailOg(p: BoardDetailOgProps) {
  const fonts = await loadOgFonts();
  const hasJp = fonts != null;
  const useEn = p.locale === 'en' || !hasJp;
  const c = useEn ? p.en : p.ja;
  const f: FontCtx = { JP: hasJp ? 'NotoJP' : undefined, DISP: hasJp ? 'Anton' : undefined, hasJp };

  const teamColor = getTeamColor(p.teamJa);
  const acc = teamAccent(teamColor);
  const accLt = lightenHex(acc, 0.2);

  const [portraitImg, logoImg] = await Promise.all([
    loadImageDataCached(headshotUrl(p.mlbId, 'portrait')),
    p.teamId ? loadImageDataCached(teamLogoUrl(p.teamId)) : Promise.resolve(null),
  ]);

  const portraitBlock = portraitImg ? (
    <div style={{ display: 'flex', position: 'relative', marginRight: 44, flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI 化済みの公式写真 */}
      <img
        src={portraitImg}
        width={152}
        height={228}
        style={{ borderRadius: 8, objectFit: 'cover', objectPosition: 'top', boxShadow: '0 16px 36px rgba(0,0,0,0.42)' }}
      />
      {logoImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI 化済みの公式ロゴ
        <img
          src={logoImg}
          width={62}
          height={62}
          style={{ position: 'absolute', bottom: -14, right: -16, borderRadius: 999, background: '#FAFAF9', padding: 9, objectFit: 'contain', boxShadow: '0 4px 14px rgba(0,0,0,0.32)' }}
        />
      ) : null}
    </div>
  ) : null;

  // 名前ブロック。カタカナのフルネームが多いので中黒で2行に割り、最長行で級数を決める。
  let nameBlock;
  if (!useEn) {
    const parts = p.nameJa.split('・');
    const lines = parts.length >= 2 ? [parts.slice(0, -1).join('・'), parts[parts.length - 1]] : [p.nameJa];
    const longest = Math.max(...lines.map((s) => [...s].length));
    const fsName = longest <= 4 ? 92 : longest <= 6 ? 76 : longest <= 8 ? 62 : longest <= 10 ? 52 : 44;
    nameBlock = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {lines.map((line) => (
          <div key={line} style={{ display: 'flex', fontFamily: f.JP, fontWeight: 900, fontSize: fsName, color: CREAM, lineHeight: 1.08 }}>
            {line}
          </div>
        ))}
        <div style={{ display: 'flex', fontFamily: f.DISP, fontSize: 24, color: MUTED, letterSpacing: 3, marginTop: 10 }}>
          {p.nameEn.toUpperCase()}
        </div>
      </div>
    );
  } else {
    const nm = p.nameEn.toUpperCase();
    const fsName = nm.length <= 12 ? 76 : nm.length <= 18 ? 58 : 46;
    nameBlock = (
      <div style={{ display: 'flex', fontFamily: f.DISP, fontSize: fsName, color: CREAM, lineHeight: 1.05 }}>{nm}</div>
    );
  }

  const leagueJa = p.league === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';
  const metaLine = useEn ? `${p.teamEn} · ${p.league} · ${p.season}` : `${p.teamJa}・${leagueJa}・${p.season}`;

  const rankDigits = String(p.rank);
  const heroSize = rankDigits.length <= 1 ? 165 : 140;

  return new ImageResponse(
    teamOgFrame(
      teamColor,
      <div style={CONTAINER_STYLE}>
        {header(f, accLt, p.season, c.badge, !useEn)}

        {/* 主役: 左=顔写真＋名前 / 右=巨大な予測順位＋スコア */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, minWidth: 0 }}>
            {portraitBlock}
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: portraitImg ? 520 : 760, overflow: 'hidden' }}>
              {nameBlock}
              <div style={{ display: 'flex', fontFamily: f.JP, fontSize: 24, color: MUTED, marginTop: 18 }}>{metaLine}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 36 }}>
            <div style={{ display: 'flex', fontFamily: useEn ? f.DISP : f.JP, fontSize: 22, color: MUTED, letterSpacing: useEn ? 2 : 1, marginBottom: 4 }}>
              {c.heroLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              {useEn ? (
                <div style={{ display: 'flex', fontFamily: f.DISP, fontSize: heroSize, color: CREAM, lineHeight: 1 }}>{`#${rankDigits}`}</div>
              ) : (
                <>
                  <div style={{ display: 'flex', fontFamily: f.DISP, fontSize: heroSize, color: CREAM, lineHeight: 1 }}>{rankDigits}</div>
                  <div style={{ display: 'flex', fontFamily: f.JP, fontWeight: 700, fontSize: 44, color: CREAM, marginLeft: 6, paddingBottom: 8 }}>位</div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', width: '100%', height: 8, background: acc, borderRadius: 2, marginTop: 14 }} />
            <div style={{ display: 'flex', fontFamily: useEn ? f.DISP : f.JP, fontWeight: 700, fontSize: 26, color: accLt, marginTop: 12 }}>
              {`${c.scoreWord} ${p.score.toFixed(1)}`}
            </div>
          </div>
        </div>

        {/* フッター: 罫＋成績トークン＋ドメイン */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', width: '100%', height: 1, background: RULE, marginBottom: 22 }} />
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', flex: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
              {c.tokens.map((tk, i) => (
                <div key={tk.label} style={{ display: 'flex', alignItems: 'baseline', flexShrink: 0 }}>
                  {i > 0 ? <div style={{ display: 'flex', fontFamily: f.JP, fontSize: 20, color: RULE, margin: '0 16px' }}>・</div> : null}
                  <div style={{ display: 'flex', fontFamily: f.JP, fontSize: 20, color: MUTED }}>{tk.label}</div>
                  <div style={{ display: 'flex', fontFamily: f.JP, fontWeight: 700, fontSize: 23, color: CREAM, marginLeft: 8 }}>{tk.value}</div>
                </div>
              ))}
            </div>
            {domainNode(f, p.asOf)}
          </div>
        </div>
      </div>,
    ),
    { ...BOARD_OG_SIZE, ...(fonts ? { fonts } : {}) },
  );
}

/** ハブ（ボード一覧ページ）OG のロケール別文言。 */
export type BoardHubCopy = {
  titleLines: { text: string; latin?: boolean }[]; // 大判タイトル（latin=Anton で組む行）
  lead: string; // タイトル下の指標リスト等
  badge: string;
};

export type BoardHubOgProps = {
  locale: string;
  season: number;
  asOf: string;
  ja: BoardHubCopy;
  en: BoardHubCopy;
  /** 欄外のリーグ別上位（例: NL=ミシオロウスキー・サンチェス…）。名前は姓だけ等の短い形で渡す。 */
  footer: { lg: string; ja: string[]; en: string[] }[];
};

/** ハブ OG: /ranking の OG と同じ「ブランド色の地＋大判タイトル＋SEASON 年」ファミリー。 */
export async function renderBoardHubOg(p: BoardHubOgProps) {
  const fonts = await loadOgFonts();
  const hasJp = fonts != null;
  const useEn = p.locale === 'en' || !hasJp;
  const c = useEn ? p.en : p.ja;
  const f: FontCtx = { JP: hasJp ? 'NotoJP' : undefined, DISP: hasJp ? 'Anton' : undefined, hasJp };

  const acc = teamAccent(ACCENT);
  const accLt = lightenHex(acc, 0.2);

  // 欄外のリーグ別上位: 「NL 名前・名前・名前   AL 名前・…」。各リーグ先頭だけ強調。
  const footerNames = (
    <div style={{ display: 'flex', alignItems: 'baseline', flex: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
      {p.footer.map((g, gi) => (
        <div key={g.lg} style={{ display: 'flex', alignItems: 'baseline', flexShrink: 0, marginLeft: gi > 0 ? 30 : 0 }}>
          <div style={{ display: 'flex', fontFamily: f.DISP, fontSize: 20, color: FAINT, letterSpacing: 2, marginRight: 12 }}>{g.lg}</div>
          {(useEn ? g.en : g.ja).map((name, i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'baseline', flexShrink: 0 }}>
              {i > 0 ? <div style={{ display: 'flex', fontFamily: f.JP, fontSize: 20, color: RULE, margin: '0 12px' }}>・</div> : null}
              <div style={{ display: 'flex', fontFamily: useEn ? f.DISP : f.JP, fontWeight: 700, fontSize: 23, color: i === 0 ? CREAM : MUTED }}>
                {name}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return new ImageResponse(
    teamOgFrame(
      ACCENT,
      <div style={CONTAINER_STYLE}>
        {header(f, accLt, p.season, c.badge, false)}

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxWidth: 820, overflow: 'hidden' }}>
            {c.titleLines.map((line, i) => (
              <div
                key={line.text}
                style={{
                  display: 'flex',
                  fontFamily: useEn || line.latin ? f.DISP : f.JP,
                  fontWeight: 900,
                  fontSize: useEn || line.latin ? 96 : 84,
                  color: CREAM,
                  lineHeight: 1.05,
                  marginTop: i > 0 ? 6 : 0,
                }}
              >
                {line.text}
              </div>
            ))}
            <div style={{ display: 'flex', fontFamily: f.JP, fontSize: 26, color: MUTED, marginTop: 22 }}>{c.lead}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 36 }}>
            <div style={{ display: 'flex', fontFamily: f.DISP, fontSize: 26, color: MUTED, letterSpacing: 4, marginBottom: 2 }}>SEASON</div>
            <div style={{ display: 'flex', fontFamily: f.DISP, fontSize: 150, color: CREAM, lineHeight: 1 }}>{String(p.season)}</div>
            <div style={{ display: 'flex', width: '100%', height: 6, background: acc, borderRadius: 2, marginTop: 14 }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', width: '100%', height: 1, background: RULE, marginBottom: 22 }} />
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            {footerNames}
            {domainNode(f, p.asOf)}
          </div>
        </div>
      </div>,
    ),
    { ...BOARD_OG_SIZE, ...(fonts ? { fonts } : {}) },
  );
}
