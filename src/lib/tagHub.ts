import { getPlayerByJaName, type Player } from './players';
import { deriveRole } from './playerHero';
import type { PlayerSeason } from './playerStats';

/**
 * タグLP（リッチ化するタグページ）の判定と導入文の唯一の正。
 *
 * 「海外の反応 {選手名}」系の検索は、SERP 上位が一覧ページ（競合のラベル/タグページ・
 * アンテナ特設）で占められている＝受け皿は記事フィードであるタグページ
 * （戦略: _local/strategy/2026-07-02-ohtani-seo-strategy.md）。
 * 選手ハブ /player は「{選手名} 成績」系KWの受け皿＝役割分担し、title を競合させない。
 *
 * 対象は日本人選手（非 rival）の正式名タグのみの opt-in:
 *  - 全タグを一律リッチ化すると生成文の薄いページを量産して品質評価を毀損する
 *  - エイリアス表記のタグ（例: フリーマン）までLP化すると同一選手で重複LPになる
 */
export function tagHubOf(tag: string): Player | null {
  const p = getPlayerByJaName(tag);
  if (!p || p.rival || p.nameJa !== tag) return null;
  return p;
}

/**
 * タグLPの H1 直下に出す導入文（ja）。数値は snapshot の実在値のみを使い、
 * 無い値は文ごと落とす（捏造しない＝CLAUDE.md §4.4）。成績が毎日動く＝文面が毎日変わる
 * ことが Discover/QDF 向けの鮮度シグナルを兼ねる。
 */
export function tagHubIntroJa(
  player: Player,
  season: PlayerSeason | null,
  year: number,
  articleCount: number,
): string {
  const sentences: string[] = [];
  sentences.push(
    `${player.nameJa}（${player.nameEn}）に対する海外の反応・現地ファンのコメントを日本語訳でまとめたページ。`,
  );
  if (season) {
    const role = deriveRole(season);
    const h = season.hitting;
    const p = season.pitching;
    const bat: string[] = [];
    if (h?.avg != null && h.avg !== '') bat.push(`打率${h.avg}`);
    if (h?.homeRuns != null && h.homeRuns !== '') bat.push(`${h.homeRuns}本塁打`);
    if (h?.ops != null && h.ops !== '') bat.push(`OPS${h.ops}`);
    const pit: string[] = [];
    if (p?.era != null && p.era !== '') pit.push(`防御率${p.era}`);
    if (p?.wins != null && p.wins !== '') pit.push(`${p.wins}勝`);
    if (p?.strikeOuts != null && p.strikeOuts !== '') pit.push(`${p.strikeOuts}奪三振`);
    const team = season.team ? `${season.team}で` : '';
    if (role === 'two-way' && (bat.length || pit.length)) {
      const parts: string[] = [];
      if (bat.length) parts.push(`打っては${bat.join('・')}`);
      if (pit.length) parts.push(`投げては${pit.join('・')}`);
      sentences.push(`${year}年は${team}${parts.join('、')}。`);
    } else if (role === 'pitcher' && pit.length) {
      sentences.push(`${year}年は${team}${pit.join('・')}。`);
    } else if (bat.length) {
      sentences.push(`${year}年は${team}${bat.join('・')}。`);
    }
  }
  sentences.push(
    `試合ハイライトへの現地実況や Reddit の話題スレから、生の反応を全${articleCount}件の記事で紹介している。`,
  );
  return sentences.join('');
}
