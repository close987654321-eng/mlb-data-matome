'use client';

import { useEffect, useState } from 'react';

/**
 * 開催日カウントダウン（あと◯日）。
 * SSG だとビルド時点の残日数が焼き込まれて翌日ズレるため、ここだけクライアントで数え直す。
 * 文言は親（サーバー側）から受け取る＝このコンポーネントに i18n を持ち込まない。
 */
export default function EventCountdown({
  dateIso,
  daysLeftLabel,
  todayLabel,
  doneLabel,
}: {
  /** 開催日 YYYY-MM-DD（JST） */
  dateIso: string;
  /** 残り日数の文言。{days} を置換する */
  daysLeftLabel: string;
  todayLabel: string;
  doneLabel: string;
}) {
  // 初回レンダー（サーバーHTML）は null＝非表示にして hydration mismatch を避ける。
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const compute = () => {
      const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const today = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate());
      const [y, m, d] = dateIso.split('-').map(Number);
      setDays(Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000));
    };
    compute();
    // 日付境界をまたいだら更新（開きっぱなしのタブ対策・1時間ごとで十分）。
    const timer = setInterval(compute, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [dateIso]);

  if (days === null) return null;
  const text =
    days > 0 ? daysLeftLabel.replace('{days}', String(days)) : days === 0 ? todayLabel : doneLabel;
  return (
    <span className="inline-block border border-ink px-3 py-1 text-sm font-bold tracking-wide text-ink">
      {text}
    </span>
  );
}
