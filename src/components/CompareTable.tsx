'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/lib/navigation';

// 見比べ用のソート可能な比較表。列ヘッダクリックで並び替え（数値）。サーバーで全行を
// 渡すので HTML にデータは載る（クローラ可）＋クライアントでソートだけ足す。
export type CompareCol = {
  key: string;
  label: string;
  better: 'high' | 'low'; // 良い方向（降順/昇順の初期向き）
};
export type CompareCell = { v: number | null; d: string }; // v=ソート用数値 / d=表示
export type CompareRow = {
  slug: string;
  name: string;
  team?: string;
  values: Record<string, CompareCell>;
};

export default function CompareTable({
  rows,
  cols,
  defaultKey,
  hint,
}: {
  rows: CompareRow[];
  cols: CompareCol[];
  defaultKey: string;
  hint?: string;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState(defaultKey);
  const [dir, setDir] = useState<'asc' | 'desc'>(
    cols.find((c) => c.key === defaultKey)?.better === 'low' ? 'asc' : 'desc',
  );

  // 横スクロールの「まだ続きがある」を端のフェードで示す（スマホで見やすく）。
  // スクロール中の再描画はジャンクの元。rAF で 1 フレーム 1 回に間引き、かつ端の状態が
  // 実際に変わったときだけ setState する（毎フレーム全行を作り直さない＝なめらかに保つ）。
  const scrollRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef({ l: false, r: false });
  const rafRef = useRef(0);
  const [edge, setEdge] = useState({ l: false, r: false });

  const measure = () => {
    const el = scrollRef.current;
    if (!el) return;
    const l = el.scrollLeft > 4;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    if (l === edgeRef.current.l && r === edgeRef.current.r) return; // 変化なし＝再描画しない
    edgeRef.current = { l, r };
    setEdge({ l, r });
  };

  const onScroll = () => {
    if (rafRef.current) return; // 次フレームの計測が予約済みなら何もしない
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      measure();
    });
  };

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const sorted = [...rows].sort((a, b) => {
    const av = a.values[sortKey]?.v;
    const bv = b.values[sortKey]?.v;
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // 値なしは末尾
    if (bv == null) return -1;
    return dir === 'asc' ? av - bv : bv - av;
  });

  const onSort = (c: CompareCol) => {
    if (c.key === sortKey) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(c.key);
      setDir(c.better === 'low' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="relative -mx-5 sm:mx-0">
      {hint && edge.r && (
        <p className="mb-1.5 px-5 text-[11px] text-ink-soft sm:hidden">{hint}</p>
      )}
      {/* 端のフェード（続きがある側だけ出す）。スクロール領域に被せるだけでクリックは透過。 */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-paper to-transparent transition-opacity ${
          edge.l ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-paper to-transparent transition-opacity ${
          edge.r ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="overflow-x-auto overscroll-x-contain px-5 sm:px-0"
      >
        <table className="w-full min-w-[560px] table-fixed border-collapse text-sm">
          <colgroup>
            {/* 固定する選手名列を圧縮（従来は余白を吸って肥大していた）。残りの数値列は均等割り。 */}
            <col className="w-[116px] sm:w-[132px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line text-ink-soft">
              <th className="sticky left-0 z-20 border-r border-line bg-paper px-2.5 py-2.5 text-left font-semibold">
                選手
              </th>
              {cols.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => onSort(c)}
                    className={`inline-flex items-center gap-0.5 transition-colors hover:text-ink ${
                      c.key === sortKey ? 'text-accent' : ''
                    }`}
                  >
                    {c.label}
                    {c.key === sortKey && <span aria-hidden>{dir === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              // 行ぜんぶをクリック可能に（選手名だけだと分かりづらいため）。名前は実リンクのまま
              // 残してSEO・キーボード操作を担保し、行クリックはマウス操作の利便性として足す。
              <tr
                key={r.slug}
                onClick={() => router.push(`/player/${r.slug}`)}
                className="group cursor-pointer border-b border-line/60 hover:bg-surface"
              >
                <td className="sticky left-0 z-20 border-r border-line bg-paper px-2.5 py-3 text-left group-hover:bg-surface">
                  <span className="flex items-center gap-1">
                    <Link
                      href={`/player/${r.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 font-medium leading-tight text-ink group-hover:text-accent"
                    >
                      {r.name}
                    </Link>
                    {r.team && <span className="shrink-0 text-[10px] text-ink-soft">{r.team}</span>}
                    <span aria-hidden className="ml-auto shrink-0 text-xs text-ink-soft transition-colors group-hover:text-accent">
                      ›
                    </span>
                  </span>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums text-ink">
                    {r.values[c.key]?.d ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
