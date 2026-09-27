'use client';

import { Link } from '@/lib/navigation';
import { track } from '@/lib/analytics';

/**
 * 「次に読む」カードのリンク部分だけをクライアント化する薄い殻（カードの中身はサーバー描画のまま
 * children で受ける）。クリックで GA4 の next_read_click を送り、読了（read_end）から次の記事へ
 * 進んだ率を測れるようにする。
 */
export default function NextReadLink({
  href,
  destinationId,
  fromId,
  className,
  children,
}: {
  href: string;
  destinationId: string;
  fromId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => track('next_read_click', { destination_id: destinationId, from_id: fromId })}
    >
      {children}
    </Link>
  );
}
