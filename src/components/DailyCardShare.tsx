'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';

/**
 * 「きょうの1枚」の配布ボタン。カードは保存してもらってこそ意味がある配布物なので、
 * 見せ方は3点セットで固定する:
 *   1. ワンタップ共有 — Web Share API で**画像ファイルごと** OS の共有シートに渡す
 *      （X・LINE・インスタに画像付きでそのまま渡る。「保存してから添付」の手数をゼロにする）
 *   2. 共有が使えない環境（PC 等）は download リンクに自動で切り替え（カードは同一オリジン配信
 *      なので download 属性が効く）
 *   3. 「保存・転載OK」を明文化 — まとめ/ファンアカウントは“許可が明示された画像”しか安心して
 *      転載できない。転載されるたびにカード足元のドメインが露出する＝配布そのものが宣伝になる
 */
export default function DailyCardShare({
  cardUrl,
  cardNo,
  shareLabel,
  saveLabel,
  licenseLabel,
}: {
  cardUrl: string;
  cardNo?: number;
  shareLabel: string;
  saveLabel: string;
  licenseLabel: string;
}) {
  const [canShare, setCanShare] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const fileName = `jp-daily-${cardNo != null ? `no${String(cardNo).padStart(3, '0')}` : 'card'}.jpg`;

  const share = async () => {
    setBusy(true);
    track('card_share', { kind: 'daily', no: cardNo, method: 'share' });
    try {
      const blob = await (await fetch(cardUrl)).blob();
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        // text は渡さない＝iOS 共有シートの「コピー」で画像が2枚乗るのを防ぐ（GameResultCard と同じ判断）。
        await navigator.share({ files: [file] });
        return;
      }
      // files 非対応の share 実装 → download に倒す
      save();
    } catch {
      /* キャンセルは尊重（勝手に保存へ倒さない） */
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    track('card_share', { kind: 'daily', no: cardNo, method: 'save' });
    const a = document.createElement('a');
    a.href = cardUrl;
    a.download = fileName;
    a.click();
  };

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={canShare ? share : save}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-2 bg-ink px-6 text-sm font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M12 3l4 4h-3v7h-2V7H8l4-4zM5 14h2v5h10v-5h2v7H5v-7z" />
        </svg>
        {canShare ? shareLabel : saveLabel}
      </button>
      <p className="text-xs text-ink-mute">{licenseLabel}</p>
    </div>
  );
}
