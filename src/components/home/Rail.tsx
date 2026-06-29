import SectionHeading from '@/components/SectionHeading';

/**
 * トップの横スクロール棚。無彩色の編集的見出し（SectionHeading）＋ scroll-snap の行。
 * 記事が数百本に増えても一等地は固定長で、続きは横スクロール／実 URL へ逃がす。
 * モバイルでは画面端まで馴染むよう -mx-5（main の px-5 を相殺）でブリードさせる。
 */
export default function Rail({
  label,
  count,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  label: string;
  count?: number;
  seeAllHref?: string;
  seeAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <SectionHeading label={label} count={count} seeAllHref={seeAllHref} seeAllLabel={seeAllLabel} />
      <ul className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2">{children}</ul>
    </section>
  );
}
