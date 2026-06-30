'use client';

/**
 * 選手ページ上部（ヒーロー直下）に置く「成績カードを作る」入口。カードメーカー本体（GamelogAnalysis）は
 * ページ中段にあり見つかりにくいので、ファーストビュー近くから 1 タップで同じモーダルを開く（発見導線）。
 * 本体とは window のカスタムイベントで疎結合する（state を跨いで持ち上げない＝サーバーコンポーネントの
 * ページに薄いクライアント島を 1 つ足すだけ）。実際の開閉と計測は GamelogAnalysis 側が受ける。
 */
export default function MakeCardButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('mlb:open-card', { detail: 'hero' }))}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-[2px] border border-ink bg-ink px-4 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="9" r="1.6" />
        <path d="M21 15l-5-5L6 20" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
