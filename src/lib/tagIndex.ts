import { tagHubOf } from './tagHub';
import { fighterHubOf } from './fighterHub';
import { isStopTag } from './tags';
import { TEAM_HUB_MIN_ARTICLES } from './teamHub';

/**
 * タグページを検索インデックス対象にするかの唯一の正（sitemap と tag ページの robots が共有）。
 *
 * AdSense「有用性の低いコンテンツ」/ 検索品質の対策: タグは大半が「記事1本しか付かない長尾」で、
 * その自動生成LP（全タグの約7割）や、全記事に付く汎用カテゴリ総称（/[sport]・トップと重複する
 * ドアウェイ）が薄いページとして品質シグナルを下げる。実質のあるページだけを検索対象に残す。
 *
 * index する条件:
 *  - 選手タグLP（tagHubOf）… 生成された成績入り導入文＋選手ハブ導線を持ち、記事が少数でも実質がある
 *  - それ以外は「汎用総称でない」かつ「コレクションとして成立する件数（チームLP化と同じ下限=3）」
 *
 * noindex にしてもページ自体は残す（generateStaticParams で生成／内部リンク・被リンクは活かす）。
 * 落とすのは検索インデックスと sitemap への掲載だけ。
 */
export function isTagIndexable(tag: string, count: number): boolean {
  if (tagHubOf(tag) || fighterHubOf(tag)) return true;
  if (isStopTag(tag)) return false;
  return count >= TEAM_HUB_MIN_ARTICLES;
}
