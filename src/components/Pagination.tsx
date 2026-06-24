import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';

/**
 * 一覧の実 URL ページ送り。/mlb（1ページ目）→ /mlb/p/2 … のように遷移する。
 * 旧 LoadMoreFeed（JS 追加読み込み・非表示分が DOM に出ない）を置き換え、各ページが
 * 静的 URL を持つことで 2 ページ目以降の記事もクロール・インデックスされるようにする。
 * セグメントは "p"（"page" だと一覧の page.tsx とフォルダ名が衝突してビルドが壊れる）。
 *
 * 数百記事＝30〜80ページでも破綻しないよう、番号は省略表示（先頭・末尾・現在±2）にする。
 * 全件 URL は実在するので省略は表示だけ＝クロール可能性はタグ/競技導線で別途担保。
 */
function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  const keep = new Set<number>([1, totalPages]);
  for (let n = page - 2; n <= page + 2; n++) {
    if (n >= 1 && n <= totalPages) keep.add(n);
  }
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push('gap');
    out.push(n);
    prev = n;
  }
  return out;
}

export default async function Pagination({
  basePath,
  page,
  totalPages,
}: {
  /** locale 接頭辞なしのベース（トップは ""、カテゴリは "/mlb" 等）。Link が locale を付ける。 */
  basePath: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const t = await getTranslations();
  // 1ページ目はベース URL（/mlb 等）、2ページ目以降は /mlb/p/N。
  const href = (n: number) => (n <= 1 ? basePath || '/' : `${basePath}/p/${n}`);
  const items = pageWindow(page, totalPages);

  const numCls =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm transition-colors';

  return (
    <nav
      aria-label={t('pagination.label')}
      className="mt-12 flex flex-wrap items-center justify-center gap-2"
    >
      {page > 1 && (
        <Link href={href(page - 1)} className={`${numCls} border-line text-ink hover:border-accent`}>
          {t('pagination.prev')}
        </Link>
      )}
      {items.map((it, i) =>
        it === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-ink-soft" aria-hidden>
            …
          </span>
        ) : it === page ? (
          <span
            key={it}
            aria-current="page"
            className={`${numCls} border-accent bg-accent font-medium text-white`}
          >
            {it}
          </span>
        ) : (
          <Link
            key={it}
            href={href(it)}
            className={`${numCls} border-line text-ink hover:border-accent hover:text-accent`}
          >
            {it}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={href(page + 1)} className={`${numCls} border-line text-ink hover:border-accent`}>
          {t('pagination.next')}
        </Link>
      )}
    </nav>
  );
}
