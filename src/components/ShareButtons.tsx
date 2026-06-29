'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  /** シェアする絶対 URL（ロケール込み） */
  url: string;
  /** シェア文に載せる記事タイトル */
  title: string;
};

/**
 * 記事の二次拡散を促すシェアボタン。X / はてブ / LINE（日本のまとめは LINE 送客が強い）/ URL コピー。
 * 集客が手動 X 運用頼りなので、読者がワンタップで拡散できる導線を記事下に置く。
 * はてブは「3 ユーザーで新着→人気エントリー」で瞬発力が大きいので数も見せて 2・3 人目を呼ぶ。
 */
export default function ShareButtons({ url, title }: Props) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const [hatenaCount, setHatenaCount] = useState<number | null>(null);
  const enc = encodeURIComponent;
  const xUrl = `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`;
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${enc(url)}`;
  // はてブのエントリーページ（ここから 1 クリックでブックマーク）。https は /entry/s/。
  const hatenaUrl = `https://b.hatena.ne.jp/entry/s/${url.replace(/^https?:\/\//, '')}`;

  // ブクマ数はカウント API が CORS 非対応なので JSONP で取得（静的ページでも実数が出る）。
  // 0 件のときはバッジを出さない（新規記事に「0」を並べると逆に弱く見えるため）。
  useEffect(() => {
    const cb = `__hbcount_${Math.random().toString(36).slice(2)}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const cleanup = () => {
      delete w[cb];
      script.remove();
    };
    w[cb] = (data: { count?: number }) => {
      if (typeof data?.count === 'number' && data.count > 0) setHatenaCount(data.count);
      cleanup();
    };
    script.src = `https://b.hatena.ne.jp/entry/jsonlite/?url=${encodeURIComponent(url)}&callback=${cb}`;
    script.onerror = cleanup;
    document.body.appendChild(script);
    return cleanup;
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // クリップボード非対応環境は黙って無視（X/LINE は使える）
    }
  };

  const btn =
    'inline-flex items-center gap-1.5 rounded-[2px] border border-line px-3.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {t('share.label')}
      </span>
      <a href={xUrl} target="_blank" rel="noopener noreferrer" className={btn} aria-label="X">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        X
      </a>
      <a
        href={hatenaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
        aria-label="はてなブックマークに追加"
      >
        <span aria-hidden className="text-[13px] font-extrabold leading-none">
          B!
        </span>
        はてブ
        {hatenaCount !== null && (
          <span className="ml-0.5 rounded-full bg-ink/[0.06] px-1.5 text-[11px] font-bold text-ink-soft">
            {hatenaCount}
          </span>
        )}
      </a>
      <a href={lineUrl} target="_blank" rel="noopener noreferrer" className={btn} aria-label="LINE">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
          <path d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.55 7.48 8.35 8.12.32.07.77.21.88.49.1.25.07.65.03.9l-.14.85c-.04.25-.2.99.87.54 1.07-.45 5.76-3.39 7.86-5.81 1.45-1.59 2.15-3.2 2.15-5.08C22 5.69 17.52 2 12 2zM7.75 12.85H5.7a.53.53 0 0 1-.53-.53V8.2a.53.53 0 0 1 1.06 0v3.59h1.52a.53.53 0 0 1 0 1.06zm2.08-.53a.53.53 0 0 1-1.06 0V8.2a.53.53 0 0 1 1.06 0zm4.85 0a.53.53 0 0 1-.36.5.54.54 0 0 1-.17.03.53.53 0 0 1-.43-.21l-2.1-2.85v2.53a.53.53 0 0 1-1.06 0V8.2a.53.53 0 0 1 .36-.5.53.53 0 0 1 .6.18l2.1 2.86V8.2a.53.53 0 0 1 1.06 0zm3.4-2.59a.53.53 0 0 1 0 1.06h-1.52v.99h1.52a.53.53 0 0 1 0 1.06h-2.05a.53.53 0 0 1-.53-.53V8.2a.53.53 0 0 1 .53-.53h2.05a.53.53 0 0 1 0 1.06h-1.52v.99z" />
        </svg>
        LINE
      </a>
      <button type="button" onClick={copy} className={btn}>
        {copied ? t('share.copied') : t('share.copy')}
      </button>
    </div>
  );
}
