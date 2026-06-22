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
// サイト内のカード/ヒーロー表示用。確実に存在する hqdefault(480px) でよい。
function videoThumb(url: string, explicit?: string): string | null {
  if (explicit) return explicit;
  const yt = youTubeId(url);
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
}

/**
 * OGP/Discover 用の「大きい」カバー画像を解決する（width/height 付き）。
 * Google Discover と X の summary_large_image は 1200px 幅以上を要求するため、
 * YouTube 動画は maxresdefault(1280x720) を優先する。maxres は元動画が 720p+ の
 * ときだけ存在するので、HEAD で存在確認し、無ければ hqdefault(480x360) に倒す。
 * 画像メディア・ストック写真は元から大きいので寸法指定なしでそのまま使う。
 * async（ビルド時に HEAD を1回叩く。同一 URL は fetch キャッシュで共有される）。
 */
export async function ogCover(
  thread: Thread,
): Promise<{ url: string; width?: number; height?: number }> {
  const m = thread.media;
  if (m?.kind === 'image') return { url: m.url };
  if (m?.kind === 'video') {
    if (m.thumbUrl) return { url: m.thumbUrl };
    const yt = youTubeId(m.url);
    if (yt) {
      const maxres = `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`;
      try {
        const res = await fetch(maxres, { method: 'HEAD', next: { revalidate: false } });
        if (res.ok) return { url: maxres, width: 1280, height: 720 };
      } catch {
        // 不通時は下のストックへ（ビルドを止めない）
      }
      // maxres が無い動画（元動画が 720p 未満）は hqdefault が 480px ＝ Discover/OGP の
      // 1200px 足切りに引っかかる。480px を返すより競技ストック(1600px・適格)に倒すほうが
      // 「Discover に出る」点で有利（実サムネを使いたい記事は media.thumbUrl で明示）。
    }
  }
  // ストック（Unsplash・?w=1600 付き）は十分大きい
  return { url: pickImage(thread.sport, thread.id), width: 1600, height: 900 };
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

// 動画ファサード（クリックで読み込む埋め込み）のポスター画像。サイト内の他サムネと同じ解決。
export function videoPoster(media: ThreadMedia): string | null {
  if (media.kind !== 'video') return null;
  return videoThumb(media.url, media.thumbUrl);
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
