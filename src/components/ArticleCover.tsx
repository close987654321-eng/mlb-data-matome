import Image from 'next/image';
import { SPORT_INFO, type Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';

type Props = {
  sport: Sport;
  locale: Locale;
  imageUrl: string; // 競技プールから pickImage で選んだ実写写真
  /** 記事ヘッダー（hero）ではタイトルを写真に焼き込む。カードでは競技ラベルのみ。 */
  title?: string;
  variant?: 'card' | 'hero';
};

/**
 * 記事のキービジュアル。競技ごとの実写写真を背景に、テキスト（競技ラベル／タイトル）を載せる。
 * 写真は競技単位（選手・試合の実写は著作権 NG なので雰囲気カットに留める）。
 */
export default function ArticleCover({ sport, locale, imageUrl, title, variant = 'card' }: Props) {
  const info = SPORT_INFO[sport];
  const label = locale === 'ja' ? info.labelJa : info.labelEn;

  if (variant === 'hero') {
    return (
      <div className="relative overflow-hidden rounded-2xl">
        <Image
          src={imageUrl}
          alt=""
          width={1600}
          height={800}
          priority
          className="h-64 w-full object-cover sm:h-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-10">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/85">
            {info.emoji} {label}
          </span>
          {title && (
            <h1 className="mt-3 max-w-3xl text-2xl font-bold leading-tight text-white drop-shadow-sm sm:text-[2.3rem] sm:leading-tight">
              {title}
            </h1>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg">
      <Image
        src={imageUrl}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
      <span className="absolute left-3 top-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/90 drop-shadow">
        {info.emoji} {label}
      </span>
    </div>
  );
}
