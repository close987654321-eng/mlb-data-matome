// SNS シェアカード（選手カード／試合結果カード）が共有する canvas 描画ユーティリティ。
// 色の正規化（チーム色を“色つきのまま暗く”した地・暗い無彩色でも映えるアクセント）と図形は純関数なので
// 両カードで1か所に持つ。モノクロ規律の例外＝オフサイトのSNS素材なのでチーム色を主役に使う（運営合意・
// [[design-system-monochrome]]）。ロゴ/写真は MLB公式CDN を crossOrigin で読む前提（canvas を汚さず
// toBlob/toDataURL が通る）。

export const SANS =
  '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';

/** '#RRGGBB' → 'rgba(r,g,b,a)'（チーム色の透過レイヤー用）。 */
export function hexToRgba(hex: string, a: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** '#RRGGBB' → [r,g,b]。 */
export function hexToRgbArr(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 2色を t で混色して '#RRGGBB' を返す（カード地のチーム色シェード生成用）。 */
export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgbArr(a);
  const B = hexToRgbArr(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
export const lightenHex = (hex: string, t: number) => mixHex(hex, '#FFFFFF', t);
export const darkenHex = (hex: string, t: number) => mixHex(hex, '#000000', t);

const clamp01 = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = f(h + 1 / 3); g = f(h); b = f(h - 1 / 3);
  }
  return `#${[r, g, b].map((n) => Math.round(n * 255).toString(16).padStart(2, '0')).join('')}`;
}
/** カードの“地”＝チーム色の色相・彩度を保ったまま暗い色つきに正規化（真っ黒回避＋白文字が映える）。 */
export function teamField(hex: string, l: number): string {
  const [h, s] = rgbToHsl(...hexToRgbArr(hex));
  return hslToHex(h, clamp01(s, 0.32, 0.82), l);
}
/** カードのアクセント＝鮮やかめ（バナー/枠/グロー）。暗い・無彩色チームでも視認できる明るさに引き上げ。 */
export function teamAccent(hex: string): string {
  const [h, s, l] = rgbToHsl(...hexToRgbArr(hex));
  return hslToHex(h, clamp01(s, 0.42, 1), clamp01(l, 0.5, 0.64));
}

/** 角丸長方形のパスを引く（ctx.roundRect が無い環境にもフォールバック）。 */
export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** チームロゴを白い丸バッジに収めて描く。 */
export function drawLogoBadge(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FAFAF9';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E7E6E3';
  ctx.stroke();
  const iw = img.naturalWidth || 100;
  const ih = img.naturalHeight || 100;
  const box = (r - r * 0.32) * 2;
  const scale = Math.min(box / iw, box / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}
