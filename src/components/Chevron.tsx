/**
 * 共通シェブロン（下向き）。details の開閉や「もっと見る」の絵文字 ▾ を置き換える無彩色SVG。
 * stroke-current でトークン（ink/ink-soft 等）に追従。親 span の group-open:rotate-180 で反転させて使う。
 * 絵文字・記号グリフを全廃しブランド規律（モノクロ・絵文字禁止）に揃えるための最小プリミティブ。
 */
export default function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`h-3 w-3 fill-none stroke-current ${className}`} strokeWidth={1.75}>
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
