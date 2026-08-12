import type { Thread, ThreadFight } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/**
 * 格闘技の試合記事の「検索結果に出す」タイトル。
 *
 * なぜ専用に作るか（2026-08-12 GSC実測・直近56日）: 結果クエリで記事があるのに拾えていない。
 * 「朝倉海 結果」＝順位65、「rizin 朝倉未来 試合結果」＝順位56。原因はコンテンツ不足ではなく
 * **タイトルにクエリの語が無いこと**で、編集タイトルは
 * 「後藤丈治がテミロフに1R一本勝ち、ファン『マジですげえわ』」＝勝者も決着も入っているのに
 * 「結果」も「vs」も無い。そこで検索結果側のタイトルだけを
 * 「{A} vs {B} 結果｜{勝者}が{R}{決着}勝ち（{興行}）」に組み直す。
 *
 * MLB の gameSeo と同じ関係で、**記事本文の見出しは触らない**（読み物としての引きは残す）。
 * 説明文も従来どおり summaryJa のまま＝要約は既に「誰が誰にどう勝ったか」から書き出しており、
 * ここを機械文に置き換えると質が下がるため。
 *
 * 「vs」は意図的（格闘技の検索クエリは「A vs B」が主流＝MLB の「A 対 B」と逆）。
 */

/** 決着の言い回し。「1R TKO勝ち」「判定3-0勝ち」「勝利」（決着不明時）。 */
function finishJa(fight: ThreadFight): string {
  const round = fight.round ? `${fight.round}R` : '';
  if (!fight.methodJa) return '勝利';
  // 「判定3-0」は「判定3-0勝ち」で自然。KO/TKO/一本も「勝ち」で揃う。
  return `${round}${fight.methodJa}勝ち`;
}

/**
 * 検索結果用タイトル（ja）。fight を持たない記事は null＝呼び出し側は従来の編集タイトルを使う。
 *
 * 対象を `fight` 持ちに絞ることが共食い対策でもある: 同じ試合について「試合そのもの」の記事と
 * 「試合後会見」「敗者インタビュー」「技術解説クリップ」が並存するが、fight を入れているのは
 * 試合本編だけなので、定型タイトルが2ページに付くことがない（backfill-fight-meta.mjs の入力段階で
 * 会見・インタビュー記事を対象外にしている）。
 */
export function fightSeoTitle(thread: Thread, locale: Locale): string | null {
  const f = thread.fight;
  // 英語面は薄いページとして noindex 運用なので、日本語クエリ向けの組み直しはしない。
  if (!f || locale === 'en') return null;
  const head = `${f.aJa} vs ${f.bJa} 結果`;
  const event = f.eventJa ? `（${f.eventJa}）` : '';
  if (!f.winnerJa) return `${head}${event}`;
  return `${head}｜${f.winnerJa}が${finishJa(f)}${event}`;
}
