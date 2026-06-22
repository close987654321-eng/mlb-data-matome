'use client';

import { useState } from 'react';
import { Link } from '@/lib/navigation';

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
}: {
  rows: CompareRow[];
  cols: CompareCol[];
  defaultKey: string;
}) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [dir, setDir] = useState<'asc' | 'desc'>(
    cols.find((c) => c.key === defaultKey)?.better === 'low' ? 'asc' : 'desc',
  );

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
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-ink-soft">
            <th className="sticky left-0 bg-paper px-2 py-2 text-left font-semibold">選手</th>
            {cols.map((c) => (
              <th key={c.key} className="px-2 py-2 text-right font-semibold">
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
            <tr key={r.slug} className="border-b border-line/60 hover:bg-surface">
              <td className="sticky left-0 bg-paper px-2 py-2 text-left">
                <Link href={`/player/${r.slug}`} className="font-medium text-ink hover:text-accent">
                  {r.name}
                </Link>
                {r.team && <span className="ml-1 text-[11px] text-ink-soft">{r.team}</span>}
              </td>
              {cols.map((c) => (
                <td key={c.key} className="px-2 py-2 text-right tabular-nums text-ink">
                  {r.values[c.key]?.d ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
