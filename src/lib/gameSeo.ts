import type { Thread } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/**
 * 試合記事の「検索結果に出す」説明文と、試合日のヘルパ。
 *
 * ■ 2026-09-01: 「スコア前出しタイトル」の賭けは外れた（撤収済み）
 *
 * 2026-07-30 に、対戦カード検索（「フィリーズ 対 ヤンキース」）へ答えるため、SERP のタイトルだけを
 * 「{ビジター} 対 {ホーム} {スコア}｜{日付}の試合結果と海外の反応」に組み直した（7d2abc0）。
 * 表示は取れているのにクリックが付かない（当時 1記事で 7,713表示 / 3クリック / CTR 0.04%）のは
 * スニペットに答え（スコア）が無いからだ、という読みだった。
 *
 * 2026-09-01 の GSC 実測（直近28日）で決着した。表示は狙いどおり跳ねたが、クリックは動かなかった:
 *
 *   試合レポート記事（id が -vs- 型・この定型タイトルを適用）  151ページ  29,920表示    11クリック  CTR 0.037%
 *   それ以外の全ページ（タグLP・ボード・通常記事）             589ページ  33,707表示  1,100クリック  CTR 3.26%
 *
 *   ・151ページ中 143ページが 28日間クリック0
 *   ・最大の2ページ（ヤンキース対カージナルス 14,236表示 / レッドソックス対アスレチックス 11,114表示）で
 *     合わせて2クリック
 *   ・クエリ側でも同じ: 対戦カードクラス 29,274表示 / 10クリック に対し、
 *     「海外の反応」クラスは 6,368表示 / 422クリック（CTR 6.6%）＝**表示の13%でクリックの72%**
 *
 * 結論: 順位でもスニペットでもなく**クエリの取り違え**だった。「A 対 B」はスコア速報の意図で、
 * SERP は Google 自身のスコアパネルと速報サイトが占める＝海外の反応まとめが順位10位から
 * 割って入れる余地が無い。タイトルを変えても勝てない種類の負けだった。
 *
 * そこで定型タイトルの上書きは廃止し、**編集タイトルをそのまま SERP に出す**（呼び出し側で
 * 「{編集タイトル}｜海外の反応」を組む）。編集タイトルは既に 332本中315本が
 * 「{選手名}が{出来事}…【海外の反応】」型＝自前で勝っているクラスの語を先頭に持っている
 * （例「鈴木誠也が今季14号、PCAが2発で21号、カブス対オリオールズ乱打戦【海外の反応】」）。
 * 実測で CTR 11〜44% を出しているタグLP（菅野智之 43.3% / ホワイトソックス 11.4%）と同じ語形に
 * 記事レイヤーを合わせる、という判断。
 *
 * スコアは**説明文に残す**（gameSeoDescription）＝タイトルは引きに使い、答えはスニペット本文で見せる。
 * 記事本文の見出し（h1）はこの一連の変更を通じて一度も触っていない。
 */

/** series 定型コピー（「海外◯◯ファンと見る…」で始まる title.ja）＝SERP に出しても定型と同じ。 */
const SERIES_COPY_RE = /^海外\S*ファンと見る/;

/**
 * 検索結果に出すタイトル（ja・MLB用）。表示タイトル（threadTitle＝series 記事は watch-along の
 * 定型「海外◯◯ファンと見る {日付} {カード}」）とは役割を分け、SERP には編集タイトル（出来事フック）を出す。
 *
 * なぜ分けるか（2026-09-02）: スコア定型タイトルの撤収（上の実測）で「良いタイトルを定型で隠さない」
 * 方針にしたが、series 記事 157本は threadTitle が定型を返すため、JSON に書かれた出来事フック付きの
 * 編集タイトル（実測122本）が SERP に出ないままだった＝gameSeoTitle と同じ「隠れ」の残り。
 * 表示側（h1・カード・/watch ハブ・OGP）は定型のまま＝看板企画のブランドは変えない。
 * title.ja が定型のコピー（35本）や空のときだけ表示タイトルへ倒す＝改悪はしない。
 */
export function serpTitleJa(thread: Thread, displayTitle: string): string {
  const editorial = thread.title.ja;
  if (!editorial || SERIES_COPY_RE.test(editorial)) return displayTitle;
  return editorial;
}

/** その試合の日付（JST）。series.date 優先・無ければ id 先頭の YYYY-MM-DD。 */
export function gameDateOf(thread: Thread): string {
  return thread.series?.date ?? thread.id.slice(0, 10);
}

/** 「2026年7月28日」。構造化データの説明文など、年まで含めて読ませたいところで使う。 */
export function gameDateLongJa(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

/** 「7月28日」。説明文の先頭に足すスコア1文で使う。 */
function dateLabelJa(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

/**
 * 検索結果用の説明文。要約が既にスコアを含むならそのまま使い（311本中163本は既に
 * 「◯-◯で下した」から始まっている）、含まないときだけ先頭にスコア1文を足す。
 * 二重に書かないための判定なので、表記ゆれ（半角/全角/長音のダッシュ）も見る。
 *
 * タイトルの定型化は撤収したが、こちらは残す＝記事に辿り着いた人には試合の結果を先に見せる。
 */
export function gameSeoDescription(thread: Thread, locale: Locale): string {
  const summary = thread.summaryJa;
  if (!thread.game || locale !== 'ja') return summary;
  const { away, home } = thread.game;
  const head = summary.slice(0, 60);
  const hasScore = new RegExp(
    `${away.score}\\s*[-−ー–—]\\s*${home.score}|${home.score}\\s*[-−ー–—]\\s*${away.score}`,
  ).test(head);
  if (hasScore) return summary;
  const date = dateLabelJa(gameDateOf(thread));
  return `${away.ja}${away.score}-${home.score}${home.ja}（${date}）。${summary}`;
}
