import Image from 'next/image';
import { SPORT_INFO, type Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';

type Props = {
  sport: Sport;
  locale: Locale;
  imageUrl: string; // 競技プールから pickImage で選んだ実写写真
  /** 記事ヘッダー（hero）ではタイトルを写真に焼き込む。カードでは競技ラベルのみ。 */
  title?: string;
  /** 競技ラベルの代わりに出す上部の小見出し（例: "インタビュー · MLB"）。コラム用。 */
  eyebrow?: string;
  variant?: 'card' | 'hero';
  /** カバーが動画サムネのとき、再生アイコンを重ねて「動画あり」を示す。 */
  hasVideo?: boolean;
  /** hero でカバー画像の出典・帰属を小さく添える（引用配慮）。 */
  credit?: string;
};

// 動画サムネに重ねる再生バッジ。実写写真と区別がつき「動画あり」が一目で分かる。
function PlayBadge() {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
        <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-white" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

/**
 * 記事のキービジュアル。競技ごとの実写写真を背景に、テキスト（競技ラベル／タイトル）を載せる。
 * 写真は競技単位（選手・試合の実写は著作権 NG なので雰囲気カットに留める）。
 */
export default function ArticleCover({
  sport,
  locale,
  imageUrl,
  title,
  eyebrow,
  variant = 'card',
  hasVideo = false,
  credit,
}: Props) {
  const info = SPORT_INFO[sport];
  const label = eyebrow ?? `${info.emoji} ${locale === 'ja' ? info.labelJa : info.labelEn}`;

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
        {hasVideo && <PlayBadge />}
        {credit && (
          <span className="absolute bottom-2 right-3 text-[10px] text-white/60">{credit}</span>
        )}
        <div className="absolute bottom-0 left-0 p-6 sm:p-10">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/85">
            {label}
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
      {hasVideo && <PlayBadge />}
      <span className="absolute left-3 top-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/90 drop-shadow">
        {label}
      </span>
    </div>
  );
}
