// GA4 イベント送信の薄いラッパ。gtag は layout.tsx の init で window に生える（lazyOnload なので
// 早すぎるクリックでは未ロードのことがある）。未ロード時は同じスタブを定義して dataLayer に積む＝
// 後から本物の gtag.js が読まれた時にキューが処理される。クライアントからのみ呼ぶ（SSR は何もしない）。
type Params = Record<string, string | number | boolean | undefined>;

type Gtag = (...args: unknown[]) => void;
interface GtagWindow {
  gtag?: Gtag;
  dataLayer?: unknown[];
}

export function track(event: string, params?: Params): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as GtagWindow;
  if (typeof w.gtag !== 'function') {
    // init スクリプト未到達でも取りこぼさないよう、同じスタブを置いてキューに積む。
    const dl = (w.dataLayer = w.dataLayer ?? []);
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      dl.push(arguments);
    };
  }
  w.gtag('event', event, params);
}
