import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ReactElement } from 'react';
import { teamField, teamAccent, hexToRgba } from './cardCanvas';

/**
 * 選手系 OG カードの共通土台（背景・黒レイヤー・フォント・3層フレーム）。
 * 個別選手 OG（[slug]/opengraph-image）とハブ OG（player/opengraph-image）で共有し、
 * 「ぼかし観客＋グラウンド背景＋半透明黒レイヤー」のトーンを一箇所で管理する。
 * Satori は filter:blur() 非対応なので、ぼかしは src/assets/og/*.jpg に焼き込み済み。
 * 暗さ（黒レイヤー）だけはライブの overlay 側で乗せる＝アセットを焼き直さず濃さを調整できる。
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

// ── 配色（紙面トーン。既存の選手 OG から継承） ──
export const BG = '#16130F';
export const CREAM = '#FAF8F4';
export const MUTED = '#9b958c';
export const FAINT = '#6f6a62';
export const RULE = '#2b2620';

// ── 背景: ぼかした観客＋グラウンド（球場の空撮）を一度だけ読んで data URI 化しメモ化 ──
let bgPromise: Promise<string | null> | null = null;
export function loadOgBg() {
  if (!bgPromise) {
    bgPromise = (async () => {
      try {
        const variant = process.env.OG_BG === 'full' ? 'crowd-blur' : 'crowd-blur-stands';
        const file = path.join(process.cwd(), 'src', 'assets', 'og', `${variant}.jpg`);
        const data = await fs.readFile(file);
        return `data:image/jpeg;base64,${data.toString('base64')}`;
      } catch {
        return null; // 未配置なら背景なし＝従来の単色 BG に縮退
      }
    })();
  }
  return bgPromise;
}

// ── 同梱フォントを一度だけ読んでメモ化。失敗(未生成)なら null＝英字フォールバック ──
export type FontDef = { name: string; data: Buffer; weight: 400 | 700 | 900; style: 'normal' };
let fontsPromise: Promise<FontDef[] | null> | null = null;
export function loadOgFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      try {
        const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
        const [n7, n9, an] = await Promise.all([
          fs.readFile(path.join(dir, 'noto-jp-700.ttf')),
          fs.readFile(path.join(dir, 'noto-jp-900.ttf')),
          fs.readFile(path.join(dir, 'anton.ttf')),
        ]);
        return [
          { name: 'NotoJP', data: n7, weight: 700, style: 'normal' },
          { name: 'NotoJP', data: n9, weight: 900, style: 'normal' },
          { name: 'Anton', data: an, weight: 400, style: 'normal' },
        ] satisfies FontDef[];
      } catch {
        return null;
      }
    })();
  }
  return fontsPromise;
}

// ── 黒レイヤーの濃さ（上→下）。観客を残しつつ文字を読ませる縦グラデ。0.40→0.74 は
//    「観客を強めに見せる（雰囲気寄り）」採用値（レビュー合意）。warm near-black で既存
//    トーン(#16130F)に馴染ませる。OG_OVERLAY="0.40,0.74" で振れる（味見用）。 ──
export function overlayAlphas(): [number, number] {
  const env = process.env.OG_OVERLAY;
  if (env) {
    const [a, b] = env.split(',').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b)) return [a, b];
  }
  return [0.4, 0.74];
}

// ── チーム色の地に乗る可読トーン（成績カードと同じ＝半透明の白で地に馴染ませる）。
//    旧・紙面トーン用の固定グレー(MUTED/FAINT/RULE)を色地向けに置き換えるための別名。 ──
export const FIELD_MUTED = 'rgba(255,255,255,0.62)';
export const FIELD_FAINT = 'rgba(255,255,255,0.44)';
export const FIELD_RULE = 'rgba(255,255,255,0.16)';

/**
 * チーム色を主役にした OG の土台＝SNS 成績カード（GamelogAnalysis の drawCard）の意匠を踏襲。
 * 地は teamField でチーム色を“色を残したまま暗く正規化”（黄/水色/黒でも白文字が映える）、斜めスイープ＋
 * アクセント斜線で奥行き、内側に細い白罫で「1枚もの」の収まりを出す。Satori は canvas を持たないので、
 * drawCard の背景（線形グラデ＋斜め多角形）を絶対配置 div のグラデ層の重ねで表現する。個別選手 OG は
 * 所属チーム色、ハブ OG はブランド色(ACCENT)を team に渡して同じファミリーに揃える。
 */
export function teamOgFrame(team: string, inner: ReactElement) {
  const field0 = teamField(team, 0.26); // 明るい端
  const field1 = teamField(team, 0.13); // 暗い端
  const sweep = hexToRgba(teamField(team, 0.32), 0.5); // 斜めスイープ（右上がりの淡い帯）
  const acc = teamAccent(team);
  const layer = { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', display: 'flex' };
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        height: '100%',
        background: `linear-gradient(145deg, ${field0} 0%, ${field1} 100%)`,
      }}
    >
      <div style={{ ...layer, background: `linear-gradient(112deg, rgba(0,0,0,0) 44%, ${sweep} 64%, rgba(0,0,0,0) 92%)` }} />
      <div style={{ ...layer, background: `linear-gradient(120deg, rgba(0,0,0,0) 52%, ${hexToRgba(acc, 0.1)} 100%)` }} />
      <div style={{ position: 'absolute', top: 24, left: 24, width: OG_SIZE.width - 48, height: OG_SIZE.height - 48, display: 'flex', border: '2px solid rgba(255,255,255,0.14)', borderRadius: 8 }} />
      {inner}
    </div>
  );
}

// ── 3層フレーム: ①ぼかし観客＋グラウンド（全面・cover）②半透明の黒レイヤー（縦グラデ）
//    ③コンテンツ。背景未配置(bg=null)なら従来の単色 BG に静かに縮退する。 ──
export function ogFrame(bg: string | null, inner: ReactElement) {
  const [ovTop, ovBot] = overlayAlphas();
  const ovMid = (ovTop + ovBot) / 2 + 0.03;
  return (
    <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%', background: BG }}>
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg}
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          background: `linear-gradient(180deg, rgba(14,11,8,${ovTop}) 0%, rgba(14,11,8,${ovMid}) 56%, rgba(14,11,8,${ovBot}) 100%)`,
        }}
      />
      {inner}
    </div>
  );
}
