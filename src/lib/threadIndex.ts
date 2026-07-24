import type { Thread } from '@/types/thread';

// 記事単位の index 可否の唯一の正（タグLPの isTagIndexable と対の関係）。
// AdSense「有用性の低いコンテンツ」却下(2026-07-05)の再申請に向け、コメント抜粋が
// 明白に薄い YouTube 試合記事を Google に出さない。ページ自体は残す＝X導線・回遊・
// /watch 掲載は維持する（消すのではなく検索面から下げるだけ）。
// matome の編集下限は25件だが、noindex の線は「誰が見ても薄い」10件未満に留める：
// 25件で切ると既存記事の半数超が検索から消え、jp-games の網羅価値（選手ハブの燃料）まで失う。
const MIN_INDEXABLE_YT_COMMENTS = 10;

export function isThreadIndexable(t: Thread): boolean {
  if (t.noindex) return false;
  if (t.format === 'youtube' && t.comments.length < MIN_INDEXABLE_YT_COMMENTS) return false;
  return true;
}
