import type { Thread, ThreadGame } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/**
 * 試合記事の「検索結果に出す」タイトルと説明文。
 *
 * なぜ専用に作るか（2026-07-30 GSC実測）: 「フィリーズ 対 ヤンキース」のような対戦カード検索は
 * 表示は取れているのにクリックが付かない（1記事で 7,713表示 / 3クリック / CTR 0.04% / 順位9.3）。
 * 原因は順位ではなくスニペットで、当時のタイトルは「ヤンキース vs フィリーズ 2026.7.26 ゲーム
 * ハイライト」＝**探している答え（スコア）がどこにも無い**。そこで検索結果側のタイトルだけを
 * 「{ビジター} 対 {ホーム} {スコア}｜{日付}の試合結果と海外の反応」に組み直す。
 *
 * 記事本文の見出し（editorial なタイトル／シリーズ定型）は**触らない**＝読み物としての引きは残し、
 * SERP で答えを見せる役だけ差し替える（Next の metadata.title.absolute でテンプレートも回避する）。
 * 「対」は意図的（検索クエリが「A 対 B」で来る＝series.ts の seriesTitle と同じ理由）。
 */

/** その試合の日付（JST）。series.date 優先・無ければ id 先頭の YYYY-MM-DD。 */
export function gameDateOf(thread: Thread): string {
  return thread.series?.date ?? thread.id.slice(0, 10);
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dateLabel(date: string, locale: Locale): string {
  const [, m, d] = date.split('-');
  return locale === 'ja'
    ? `${Number(m)}月${Number(d)}日`
    : `${MONTHS_EN[Number(m) - 1]} ${Number(d)}`;
}

/** 「2026年7月28日」。構造化データの説明文など、年まで含めて読ませたいところで使う。 */
export function gameDateLongJa(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

/** 「カブス 対 カージナルス 7-3」。得点はチームの並び順と一致させる（どちらの点か曖昧にしない）。 */
function matchupWithScore(game: ThreadGame, locale: Locale): string {
  const a = locale === 'ja' ? game.away.ja : game.away.en;
  const h = locale === 'ja' ? game.home.ja : game.home.en;
  const joiner = locale === 'ja' ? ' 対 ' : ' vs ';
  return `${a}${joiner}${h} ${game.away.score}-${game.home.score}`;
}

/**
 * 対戦カードクエリを狙う「試合レポート」記事か。id が `{日付}-{チーム}-vs-{チーム}`（DHは -g1/-game2）型
 * のものだけを対象にする。
 *
 * なぜ絞るか: 同じ試合について珍プレー記事（例 `2026-07-06-ohtani-bat-goes-flying`）とレポート記事
 * （`2026-07-06-dodgers-vs-padres`）が並存することがあり、両方に同じ定型タイトルを付けると
 * **同一タイトルの2ページが同じクエリで共食いする**（実測2組）。珍プレー記事は「大谷 バット」のような
 * 別クエリを狙う編集タイトルのままにして、対戦カードは1試合1ページに任せる。
 */
function isGameRecap(thread: Thread): boolean {
  return /^\d{4}-\d{2}-\d{2}-.+-vs-.+$/.test(thread.id);
}

/** DH の試合番号（series.gameNo か id 末尾の -g1/-game2）。無ければ undefined。 */
function gameNoOf(thread: Thread): number | undefined {
  const m = thread.id.match(/-(?:game|g)(\d)$/);
  return thread.series?.gameNo ?? (m ? Number(m[1]) : undefined);
}

/**
 * 検索結果用タイトル。試合レポート以外は null（呼び出し側は従来の threadTitle を使う）。
 * 例: 「ヤンキース 対 フィリーズ 3-1｜7月26日の試合結果と海外の反応」
 * ダブルヘッダーは第N戦を添える＝2試合が同スコアでもタイトルが衝突しない。
 */
export function gameSeoTitle(thread: Thread, locale: Locale): string | null {
  if (!thread.game || !isGameRecap(thread)) return null;
  const date = dateLabel(gameDateOf(thread), locale);
  const no = gameNoOf(thread);
  const game = no ? (locale === 'ja' ? ` 第${no}戦` : ` Game ${no}`) : '';
  return locale === 'ja'
    ? `${matchupWithScore(thread.game, locale)}${game}｜${date}の試合結果と海外の反応`
    : `${matchupWithScore(thread.game, locale)}${game} | ${date} Result & Overseas Fan Reactions`;
}

/**
 * 検索結果用の説明文。要約が既にスコアを含むならそのまま使い（311本中163本は既に
 * 「◯-◯で下した」から始まっている）、含まないときだけ先頭にスコア1文を足す。
 * 二重に書かないための判定なので、表記ゆれ（半角/全角/長音のダッシュ）も見る。
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
  const date = dateLabel(gameDateOf(thread), locale);
  return `${away.ja}${away.score}-${home.score}${home.ja}（${date}）。${summary}`;
}
