import type { Sport } from './sports';
import { isStopTag, type TagCount } from './tags';

/**
 * 競技カテゴリLP（リッチ化する /{sport} 一覧ページ）の判定とコピーの唯一の正。
 *
 * 「{競技} 海外の反応」系の検索は、SERP 上位が一覧ページ（競合のカテゴリ/ラベル一覧・
 * アンテナの検索結果）で占められている＝受け皿は記事フィードである競技ページ。
 * 選手タグLP（tagHub.ts / _local/strategy/2026-07-02-ohtani-seo-strategy.md）と同じ構図。
 *
 * コピーを書き下ろした競技だけ LP 化する opt-in 方式（一律の生成文で薄い見出しを量産しない）。
 * 新しい競技を LP 化するときは SPORT_HUBS にエントリを足す。
 */
export type SportHub = {
  /** meta title。absolute 指定で layout の template「｜海外の反応」を外し KW の重複を避ける。 */
  titleJa: string;
  /** H1。「{競技} 海外の反応」クエリに正面から当てる。 */
  headingJa: string;
  headingEn: string;
  /** 導入文の固定部。動的部（話題タグ・件数）は sportHubIntroJa が続ける。 */
  leadJa: string;
};

const SPORT_HUBS: Partial<Record<Sport, SportHub>> = {
  mlb: {
    titleJa: 'MLBの海外の反応まとめ｜大谷翔平ら日本人選手への現地の声を日本語訳',
    headingJa: 'MLBの海外の反応まとめ',
    headingEn: 'MLB — Overseas Fan Reactions',
    leadJa:
      '大谷翔平・山本由伸ら日本人選手の活躍や、名勝負・珍プレーに対する海外の反応を、現地ファンのコメントの日本語訳でまとめたページ。翻訳元は海外掲示板 Reddit（r/baseball・r/mlb）と MLB 公式ハイライトのコメント欄。',
  },
  boxing: {
    titleJa: 'ボクシングの海外の反応まとめ｜現地ファンの声を日本語訳',
    headingJa: 'ボクシングの海外の反応まとめ',
    headingEn: 'Boxing — Overseas Fan Reactions',
    leadJa:
      '世界タイトルマッチ・注目のKO・PFP論争に対する海外の反応を、現地ファンのコメントの日本語訳でまとめたページ。翻訳元は海外掲示板 Reddit（r/Boxing）と公式ハイライトのコメント欄。',
  },
};

export function sportHubOf(sport: Sport): SportHub | null {
  return SPORT_HUBS[sport] ?? null;
}

/**
 * LP の H1 直下と meta description に使う導入文（ja）。話題は実在タグの集計値だけを
 * 差し込む（捏造しない＝CLAUDE.md §4.4）。記事が増えるたび文面が変わる＝鮮度シグナルを兼ねる。
 */
export function sportHubIntroJa(hub: SportHub, tags: TagCount[], articleCount: number): string {
  // 汎用タグ（競技名など）と1件タグを除いた上位＝いま実際に記事が集まっている話題。
  const topics = tags
    .filter(({ tag, count }) => !isStopTag(tag) && count >= 2)
    .slice(0, 4)
    .map(({ tag }) => tag);
  const topicSentence = topics.length ? `話題の中心は${topics.join('・')}など。` : '';
  return `${hub.leadJa}${topicSentence}全${articleCount}件を新着順で掲載し、注目の試合があるたびに更新している。`;
}
