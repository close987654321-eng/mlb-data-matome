import { SPORT_INFO, type Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';

type Props = {
  sport: Sport;
  locale: Locale;
  /** 記事ヘッダー（hero）ではタイトルを焼き込む。カードでは省略して抽象ビジュアルにする。 */
  title?: string;
  variant?: 'card' | 'hero';
};

/**
 * 写真が使えない（著作権）ため、記事ごとのビジュアルをプログラムで生成する。
 * 競技アクセント色のグラデ＋競技グリフの透かしで「雑誌の表紙」風にする。
 */
export default function ArticleCover({ sport, locale, title, variant = 'card' }: Props) {
  const info = SPORT_INFO[sport];
  const label = locale === 'ja' ? info.labelJa : info.labelEn;
  const background = `linear-gradient(135deg, ${info.accent} 0%, ${info.accentDark} 100%)`;

  if (variant === 'hero') {
    return (
      <div
        className="relative overflow-hidden rounded-2xl px-6 py-12 text-white sm:px-12 sm:py-16"
        style={{ background }}
      >
        <span className="pointer-events-none absolute -bottom-10 -right-6 select-none text-[16rem] leading-none opacity-15">
          {info.emoji}
        </span>
        <div className="relative">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/85">
            {info.emoji} {label}
          </span>
          {title && (
            <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight sm:text-[2.6rem]">
              {title}
            </h1>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[16/10] overflow-hidden rounded-lg"
      style={{ background }}
    >
      <span className="pointer-events-none absolute -bottom-6 -right-3 select-none text-[8rem] leading-none opacity-20">
        {info.emoji}
      </span>
      <span className="absolute left-4 top-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/90">
        {label}
      </span>
    </div>
  );
}
