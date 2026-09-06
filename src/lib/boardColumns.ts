import { getAllColumns } from '@/lib/columns';
import type { Column } from '@/types/column';

/**
 * 予測ボード（/cy-young・/mvp・/roy）から、そのレースを読み解いたコラムへの送客を選ぶ。
 *
 * なぜ要るか（2026-09-06 GSC実測）: 賞レース系クエリは直近28日で 6,512表示/139クリックあるのに
 * 加重平均順位は 7.9＝1ページ目の下端に張り付いている。しかもCTRが高いのは「比較」「最新」
 * 「ランキング」を含むクエリ（7.8〜16.0%・素の候補クエリは1〜2%）で、読者が求めているのは
 * 表そのものではなく差分の読み解きだった。ボードLPは表を出す面なので、その先の読み物
 * （データ定点分析コラム）へ内部リンクで送る＝表示の溜まっているボード側から、
 * 読み解き側の面を持ち上げる。
 *
 * 選び方はタグの交差だけ（記事側の tags が正）。ボードごとに配線を書き分けない。
 */

/** 各ボードが拾うコラムのタグ（表記ゆれを両方持つ）。 */
export const BOARD_COLUMN_TAGS = {
  cyYoung: ['サイ・ヤング賞', 'サイヤング賞'],
  mvp: ['MVP'],
  roy: ['新人王'],
} as const;

/** 賞レース全体を読み解いたコラム＝どのボードから見ても関係する（複数レースを1本で扱う定点回）。 */
const CROSS_RACE_TAGS = ['サイ・ヤング賞', 'サイヤング賞', 'MVP', '新人王'];

/**
 * 指定タグに当たるコラムを新着順で返す（既定3本）。
 * 主タグに当たるものを先に並べ、足りなければ他の賞レースを扱った回で埋める
 * ＝ボードが新しくてもコラムが1本も無い面（/roy 初期）が空にならない。
 */
export async function columnsForBoard(tags: readonly string[], limit = 3): Promise<Column[]> {
  const all = await getAllColumns(); // 既に publishedAt 降順
  const hasAny = (c: Column, want: readonly string[]) => (c.tags ?? []).some((t) => want.includes(t));
  const primary = all.filter((c) => hasAny(c, tags));
  const rest = all.filter((c) => !primary.includes(c) && hasAny(c, CROSS_RACE_TAGS));
  return [...primary, ...rest].slice(0, limit);
}
