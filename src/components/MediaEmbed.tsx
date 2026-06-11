import Image from 'next/image';
import { toEmbedUrl } from '@/lib/media';
import type { ThreadMedia } from '@/types/thread';

type Props = {
  media: ThreadMedia;
  sourceUrl: string; // 埋め込めない動画のときの送客先（元スレ）
};

// キャプション＋出典の脚注。引用配慮として必ず出す。
function Caption({ media }: { media: ThreadMedia }) {
  if (!media.caption && !media.credit) return null;
  return (
    <figcaption className="mt-2 text-xs text-ink-soft">
      {media.caption}
      {media.caption && media.credit && ' '}
      {media.credit && <span className="text-ink-soft/70">（{media.credit}）</span>}
    </figcaption>
  );
}

/**
 * 記事本文に挿し込む元スレのメディア。
 * - image: 直リンク画像を表示（ファイルはコミットしない）
 * - video: 既知プロバイダは公式 iframe で埋め込み、未対応なら元スレへ送客
 */
export default function MediaEmbed({ media, sourceUrl }: Props) {
  if (media.kind === 'image') {
    return (
      <figure className="mt-8">
        <Image
          src={media.url}
          alt={media.caption ?? ''}
          width={1200}
          height={800}
          className="h-auto w-full rounded-xl"
        />
        <Caption media={media} />
      </figure>
    );
  }

  // 自前ホストの動画ファイル（public/media の .mp4 等）は <video> で直接再生できる。
  // 期限切れする署名 URL ではなくローカル保存なので、これが一番確実。
  if (/\.(mp4|webm|mov)$/i.test(media.url)) {
    return (
      <figure className="mt-8">
        <video
          src={media.url}
          poster={media.thumbUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-xl bg-black"
        />
        <Caption media={media} />
      </figure>
    );
  }

  const embed = toEmbedUrl(media.url);
  if (embed) {
    return (
      <figure className="mt-8">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          <iframe
            src={embed}
            title={media.caption ?? 'video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <Caption media={media} />
      </figure>
    );
  }

  // 埋め込み非対応（v.redd.it 等）。サムネがあれば見せつつ元スレへ誘導する。
  return (
    <figure className="mt-8">
      <a
        href={media.url || sourceUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="group relative block overflow-hidden rounded-xl bg-black"
      >
        {media.thumbUrl && (
          <Image
            src={media.thumbUrl}
            alt={media.caption ?? ''}
            width={1200}
            height={675}
            className="h-auto w-full opacity-90 transition-opacity group-hover:opacity-100"
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-7 w-7 fill-white" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </a>
      <Caption media={media} />
    </figure>
  );
}
