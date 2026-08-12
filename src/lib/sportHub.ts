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
  // mlb/boxing に続いて LP 化（2026-07-30）。2026-08-12 に RIZIN 主軸のポータルへ刷新＝
  // タイトル・導入とも RIZIN 前方（大会日程・結果・視聴方法のクエリ形）に寄せ、UFC=海外の反応の
  // 燃料という分業を明示する（合意の経緯は _local/strategy/2026-08-12-rizin-search-plan.md）。
  mma: {
    titleJa: 'RIZIN・UFCの海外の反応まとめ｜大会日程・結果・視聴方法',
    headingJa: 'RIZIN・UFCの海外の反応まとめ',
    headingEn: 'MMA — RIZIN & UFC Fan Reactions',
    leadJa:
      'RIZIN・ブレイキングダウン・UFCの大会日程と結果、注目カードへの現地ファンの声を日本語でまとめたページ。超RIZIN.5のようなビッグイベントは特設ページで開催前から追いかけ、大会が終わるたび結果と反応をここにアーカイブしていく。翻訳元は海外掲示板 Reddit（r/MMA・r/ufc）と公式ハイライトのコメント欄。',
  },
  npb: {
    titleJa: 'NPB注目株の海外の反応まとめ｜next メジャーリーガーへの現地の評価',
    headingJa: 'NEXT MLB — NPB注目株の海外の反応',
    headingEn: 'NEXT MLB — NPB Prospects Abroad',
    // 翻訳元は実際の記事に合わせる（npb の記事は海外メディア発が主・Reddit ではない）。
    leadJa:
      'ポスティング・MLB挑戦が噂される NPB の選手を、海外スカウトや現地メディアがどう評価しているかを日本語訳でまとめたページ。翻訳元は MLB Trade Rumors ほか海外メディアの記事と、海外掲示板・公式ハイライトのコメント欄。',
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
