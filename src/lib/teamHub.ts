import { getTeam, type TeamInfo } from './teams';
import { isStopTag } from './tags';
import { hasMlbStats, PLAYERS, type Player } from './players';
import type { PlayersSnapshot } from './playerStats';

/**
 * チームタグLP（リッチ化するタグページ）の判定と導入文の唯一の正。
 *
 * 「{チーム名} 海外の反応」系の検索も選手名と同じ構図＝SERP 上位は一覧ページ
 * （競合のラベル/タグページ・アンテナ特設）で、受け皿は記事フィードであるタグページ
 * （戦略: _local/strategy/2026-07-02-ohtani-seo-strategy.md の横展開。選手タグLP=tagHub.ts と対）。
 *
 * 対象は MLB 30球団の短縮カタカナタグ（teams.ts の TEAMS キー）のみの opt-in。さらに記事が
 * TEAM_HUB_MIN_ARTICLES 件未満のチームは LP 化しない＝生成文つきの薄いページを量産して
 * 品質評価を毀損しない（選手タグLPと同じ規律）。件数が閾値を超えたら自動で LP に昇格する。
 */
export type TeamHub = { nameJa: string; info: TeamInfo };

export const TEAM_HUB_MIN_ARTICLES = 3;

export function teamHubOf(tag: string): TeamHub | null {
  const info = getTeam(tag);
  return info ? { nameJa: tag, info } : null;
}

/**
 * そのチームに今季所属している日本人選手（rival は除外）。所属は snapshot の team が唯一の正
 * （players.ts は所属を持たない＝古くなる情報を二重管理しない方針）。
 * ⚠️ snapshot の team は出場0試合（昇格直後・IL）でも書かれる＝team があっても hubEligible とは
 * 限らないため、hasMlbStats で絞る。これで hubEligible が保証され /player/{slug} へのリンクが
 * 404 しない（選手ハブは dynamicParams=false・hubEligible のみ生成）。
 */
export function teamJpPlayers(snap: PlayersSnapshot, teamJa: string): Player[] {
  return PLAYERS.filter((p) => {
    const season = snap.players[String(p.mlbId)];
    return !p.rival && season?.team === teamJa && hasMlbStats(season);
  });
}

/**
 * チームのフィードで実際に記事が集まっている話題（上位4件）。汎用タグ・チームタグ
 * （自チームと対戦相手）・1件きりのタグに加え、jpPlayers（導入文の「所属」文で列挙済みの
 * 選手名・エイリアス）も除く＝同じ名前を1つの導入文に2回並べない。
 */
export function teamHubTopics(tagLists: string[][], nameJa: string, jpPlayers: Player[]): string[] {
  const exclude = new Set<string>([nameJa]);
  for (const p of jpPlayers) {
    exclude.add(p.nameJa);
    for (const a of p.aliases ?? []) exclude.add(a);
  }
  const counts = new Map<string, number>();
  for (const tags of tagLists) for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([tag, count]) => count >= 2 && !isStopTag(tag) && !exclude.has(tag) && !getTeam(tag))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .slice(0, 4)
    .map(([tag]) => tag);
}

/**
 * チームタグLPの H1 直下と meta description に使う導入文（ja）。所属選手・話題は snapshot と
 * 実在タグの集計値だけを差し込む（捏造しない＝CLAUDE.md §4.4）。移籍や新記事のたびに
 * 文面が変わることが Discover/QDF 向けの鮮度シグナルを兼ねる。
 */
export function teamHubIntroJa(
  hub: TeamHub,
  year: number,
  jpPlayers: Player[],
  topics: string[],
  articleCount: number,
): string {
  const sentences: string[] = [];
  sentences.push(
    `${hub.nameJa}（${hub.info.nameFull}）の試合・選手に対する海外の反応・現地ファンのコメントを日本語訳でまとめたページ。`,
  );
  if (jpPlayers.length) {
    sentences.push(
      `${year}年は${jpPlayers.map((p) => p.nameJa).join('・')}が所属し、その一挙一動が現地で話題になる。`,
    );
  }
  if (topics.length) sentences.push(`話題の中心は${topics.join('・')}など。`);
  sentences.push(
    `試合ハイライトへの現地実況や Reddit の話題スレから、生の反応を全${articleCount}件の記事で紹介している。`,
  );
  return sentences.join('');
}

/**
 * meta description（ja）。日本語 SERP のスニペットは全角90字前後で切られるため、
 * ページ上の導入文（teamHubIntroJa・約200字）をそのまま使わず、KW＋所属選手が
 * 先頭90字に収まる短縮版を別に組む。件数・最終更新は毎日動く＝鮮度シグナルを兼ねる。
 */
export function teamHubDescriptionJa(
  hub: TeamHub,
  year: number,
  jpPlayers: Player[],
  articleCount: number,
  updated?: string,
): string {
  const parts: string[] = [
    `${hub.nameJa}（${hub.info.nameFull}）への海外の反応・現地ファンのコメントを日本語訳でまとめて紹介。`,
  ];
  if (jpPlayers.length) parts.push(`${year}年は${jpPlayers.map((p) => p.nameJa).join('・')}が所属。`);
  parts.push(`全${articleCount}件を新着順で掲載${updated ? `・最終更新 ${updated}` : ''}。`);
  return parts.join('');
}
