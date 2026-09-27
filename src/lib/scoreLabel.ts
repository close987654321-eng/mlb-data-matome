/**
 * コメント票数の表示ラベル（記事・語り形式・日次・タグLP・観測日誌で共通）。
 *
 * YouTube の高評価は親指の絵文字ではなく文字で出す＝モノクロの誌面にカラー絵文字の黄色が
 * 1件ごとに散らないように（デザイン規律: 絵文字は使わない）。Reddit の ▲ は幾何記号なので残す。
 * 呼び出し側は score > 0 のときだけ呼ぶこと（0 は「未取得」で実測0票ではない＝出さない）。
 * 桁区切りは en-US に固定する（ja も同じカンマ区切り。実行環境のロケールで表記が揺れないように）。
 */
export type ScoreKind = 'youtube' | 'reddit';

export function scoreLabel(score: number, kind: ScoreKind, locale: string): string {
  const n = score.toLocaleString('en-US');
  if (kind === 'reddit') return `▲ ${n}`;
  if (locale === 'ja') return `いいね ${n}`;
  return `${n} ${score === 1 ? 'like' : 'likes'}`;
}
