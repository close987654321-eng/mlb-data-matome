import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/lib/navigation';
import { SPORT_INFO } from '@/lib/sports';
import { coverImage, columnCover } from '@/lib/media';
import type { Thread } from '@/types/thread';
import type { Column } from '@/types/column';
import type { Locale } from '@/lib/i18n';

// ピックアップは thread / column を混在で並べるので、両者を共通の見た目に正規化する。
type Pick =
  | { kind: 'thread'; node: Thread }
  | { kind: 'column'; node: Column };

type Normalized = {
  href: string;
  eyebrow: string;
  title: string;
  lead: string;
  cover: string;
  hasVideo: boolean;
};

function normalize(pick: Pick, locale: Locale, kindLabel: (k: string) => string): Normalized {
  if (pick.kind === 'thread') {
    const t = pick.node;
    const info = SPORT_INFO[t.sport];
    return {
      href: `/${t.sport}/${t.id}`,
      eyebrow: locale === 'ja' ? info.labelJa : info.labelEn,
      title: locale === 'ja' ? t.title.ja : t.title.en,
      lead: t.summaryJa,
      cover: coverImage(t),
      hasVideo: t.media?.kind === 'video',
    };
  }
  const c = pick.node;
  const info = SPORT_INFO[c.sport];
  const cover = columnCover(c);
  return {
    href: `/columns/${c.id}`,
    eyebrow: `${kindLabel(c.kind)} · ${locale === 'ja' ? info.labelJa : info.labelEn}`,
    title: locale === 'ja' ? c.title.ja : c.title.en,
    lead: c.lead,
    cover: cover.url,
    hasVideo: cover.isVideo,
  };
}

// 動画サムネに重ねる小さな再生マーク（リスト行用）。
function MiniPlay() {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
        <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 fill-white" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

type Props = {
  threads: Thread[];
  columns: Column[];
  locale: Locale;
};

export default function PickupSection({ threads, columns, locale }: Props) {
  const t = useTranslations();
  const kindLabel = (k: string) => t(`columns.kind.${k}`);

  const picks: Pick[] = [
    ...threads.map((node) => ({ kind: 'thread' as const, node })),
    ...columns.map((node) => ({ kind: 'column' as const, node })),
  ];
  const items = picks.map((p) => normalize(p, locale, kindLabel));
  const [lead, ...rest] = items;

  return (
    <section>
      {/* 見出し: 赤の縦バー + ラベル + 全幅の細い罫で「特集面」感を出す（ベタ囲みは使わない）。 */}
      <div className="mb-7 flex items-baseline gap-3">
        <span className="h-4 w-1 shrink-0 self-center rounded-full bg-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          {t('home.pickup')}
        </h2>
        <span className="text-xs text-ink-soft">{t('home.pickupLead')}</span>
        <span className="ml-1 h-px flex-1 self-center bg-line" />
      </div>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
        {/* 主役: 1本を大きく見せる */}
        <Link href={lead.href} className="group block lg:col-span-7">
          <div className="relative overflow-hidden rounded-2xl">
            <Image
              src={lead.cover}
              alt=""
              width={1200}
              height={750}
              priority
              className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            {lead.hasVideo && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-7 w-7 fill-white" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            )}
          </div>
          <span className="mt-4 inline-block text-xs font-medium uppercase tracking-[0.16em] text-accent">
            {lead.eyebrow}
          </span>
          <h3 className="mt-2 text-2xl font-bold leading-snug text-ink decoration-accent/40 underline-offset-4 group-hover:underline sm:text-[1.7rem]">
            {lead.title}
          </h3>
          <p className="mt-3 line-clamp-2 max-w-prose text-sm leading-relaxed text-ink-soft">
            {lead.lead}
          </p>
        </Link>

        {/* 脇: 残りを番号つきの薄いサムネリストで添える */}
        <ol className="lg:col-span-5">
          {rest.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-start gap-4 border-t border-line py-5 first:border-t-0 first:pt-0"
              >
                <div className="relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-md sm:w-32">
                  <Image
                    src={item.cover}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                  {item.hasVideo && <MiniPlay />}
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
                    {item.eyebrow}
                  </span>
                  <h3 className="mt-1 line-clamp-3 font-bold leading-snug text-ink decoration-accent/40 underline-offset-4 group-hover:underline">
                    {item.title}
                  </h3>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
