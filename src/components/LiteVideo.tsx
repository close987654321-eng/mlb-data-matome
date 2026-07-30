'use client';

import { useState } from 'react';
import Image from 'next/image';

type Props = {
  embedUrl: string; // toEmbedUrl の結果（クエリ無しの埋め込み URL）
  thumbUrl: string; // ファサードのポスター画像（無ければ空文字）
  title: string;
  // 再生開始の通知。StickyVideo が「見る人だけピン留めする」判定に使う。
  onActivate?: () => void;
};

/**
 * YouTube / Streamable のファサード（lite-youtube パターン）。
 * 初期はサムネ＋再生ボタンだけを描画し、クリックで初めて本物の iframe（autoplay）を読み込む。
 * これで記事ページの初期ロードからプレイヤー一式（JS+CSS で ~0.9MB）を外し、
 * TBT・メインスレッド処理・転送量を大幅に削減する。動画は実際に見る人だけが読み込む。
 */
export default function LiteVideo({ embedUrl, thumbUrl, title, onActivate }: Props) {
  const [active, setActive] = useState(false);

  if (active) {
    // クリック後＝ユーザー操作起点なので autoplay は許可される。
    return (
      <iframe
        src={`${embedUrl}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setActive(true);
        onActivate?.();
      }}
      aria-label={title}
      className="group absolute inset-0 h-full w-full"
    >
      {thumbUrl && (
        <Image
          src={thumbUrl}
          alt=""
          fill
          // 動画枠は本文カラム幅（最大 ~768px）。4:3 サムネは object-cover で 16:9 にトリミング。
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/5">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform group-hover:scale-105">
          <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-white" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
