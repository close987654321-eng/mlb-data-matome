import { pickImage } from '@/lib/sports';
import type { Thread, ThreadMedia } from '@/types/thread';
import type { Column } from '@/types/column';

// 視聴 URL から動画 ID を取り出す（YouTube / Streamable のみ既知。他は埋め込み非対応）。
function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function streamableId(url: string): string | null {
  const m = url.match(/streamable\.com\/(?:e\/)?(\w+)/);
  return m ? m[1] : null;
}

/**
 * 動画の視聴 URL を iframe で使う埋め込み URL に変換する。
 * 既知プロバイダ以外（埋め込みできない）は null を返し、呼び出し側で「元スレで見る」に倒す。
 */
export function toEmbedUrl(url: string): string | null {
  const yt = youTubeId(url);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  const st = streamableId(url);
  if (st) return `https://streamable.com/e/${st}`;
  return null;
}

// 動画のサムネ。明示指定 > YouTube 自動 > なし（呼び出し側でストックに退避）。
function videoThumb(url: string, explicit?: string): string | null {
  if (explicit) return explicit;
  const yt = youTubeId(url);
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
}

/**
 * カード／記事見出しに使うカバー画像 URL を決める。
 * media があればそれ（動画はサムネ）を使い、無ければ従来どおり競技ストックへフォールバック。
 * これで記事ごとに固有のサムネになり「全部同じ」が解消される。
 */
export function coverImage(thread: Thread): string {
  const m = thread.media;
  if (m?.kind === 'image') return m.url;
  if (m?.kind === 'video') return videoThumb(m.url, m.thumbUrl) ?? pickImage(thread.sport, thread.id);
  return pickImage(thread.sport, thread.id);
}

function mediaThumb(m: ThreadMedia): string | null {
  return m.kind === 'image' ? m.url : videoThumb(m.url, m.thumbUrl);
}

/**
 * コラムのカバー。本文の最初のメディアブロック（動画サムネ等）を使い、無ければストックへ退避。
 * 球場のストック写真より、出演クリップのサムネの方が「読みたくなる」ため。
 */
export function columnCover(column: Column): { url: string; isVideo: boolean } {
  for (const b of column.blocks) {
    if (b.type === 'video') {
      const u = mediaThumb(b.media);
      if (u) return { url: u, isVideo: b.media.kind === 'video' };
    }
  }
  return { url: pickImage(column.sport, column.id), isVideo: false };
}
