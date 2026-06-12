'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  /** シェアする絶対 URL（ロケール込み） */
  url: string;
  /** シェア文に載せる記事タイトル */
  title: string;
};

/**
 * 記事の二次拡散を促すシェアボタン。X / LINE（日本のまとめは LINE 送客が強い）/ URL コピー。
 * 集客が手動 X 運用頼りなので、読者がワンタップで拡散できる導線を記事下に置く。
 */
export default function ShareButtons({ url, title }: Props) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const xUrl = `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`;
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${enc(url)}`;

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
    'inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent';

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
