import { getTeam, type TeamInfo } from './teams';
import { isStopTag, type TagCount } from './tags';
import { getPlayerByJaName, hasMlbStats, PLAYERS, type Player } from './players';
import type { PlayersSnapshot } from './playerStats';
import type { VoiceSubject } from './tagHub';

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
 * チームLPの表示名（ja）。検索の表記ゆれ（例: ダイヤモンドバックスは「Dバックス」が主流・
 * GSC実測）を title/H1 に併記して、実際に打たれるクエリと文字列一致させる。
 */
export function teamDisplayJa(hub: TeamHub): string {
  return hub.info.aliasJa ? `${hub.nameJa}（${hub.info.aliasJa}）` : hub.nameJa;
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
 *
 * ⚠️ **他球団の選手タグも除く**（snapshot の所属で判定）。試合まとめには対戦相手の選手タグも
 * 付くので、素通しすると「ホワイトソックスの話題の中心は岡本和真」のような事実に反する導入文に
 * なる（2026-08-07 実測）。カタログ外の現地選手は所属が分からないので、そのまま話題として残す。
 */
export function teamHubTopics(
  tagLists: string[][],
  nameJa: string,
  jpPlayers: Player[],
  snap: PlayersSnapshot,
): string[] {
  const exclude = new Set<string>([nameJa]);
  for (const p of jpPlayers) {
    exclude.add(p.nameJa);
    for (const a of p.aliases ?? []) exclude.add(a);
  }
  /** そのタグが「別のチームに所属する選手」か（カタログで引ける選手だけ判定できる）。 */
  const isOtherTeamPlayer = (tag: string): boolean => {
    const p = getPlayerByJaName(tag);
    if (!p) return false;
    return snap.players[String(p.mlbId)]?.team !== nameJa;
  };
  const counts = new Map<string, number>();
  for (const tags of tagLists) for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .filter(
      ([tag, count]) =>
        count >= 2 &&
        !isStopTag(tag) &&
        !exclude.has(tag) &&
        !getTeam(tag) &&
        !isOtherTeamPlayer(tag),
    )
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
  /** 「ナ・リーグ西地区首位（61勝33敗）」等（standings.ts の standingPhraseJa）。未生成なら省略。 */
  standingPhrase?: string,
): string {
  const sentences: string[] = [];
  const names = [hub.info.aliasJa, hub.info.nameFull].filter(Boolean).join('／');
  // 「海外の反応まとめ」に加えて「ファンの反応」を連続フレーズで持つ（GSC実測 2026-08-13:
  // 「{チーム}ファンの反応」系クエリが実在し CTR が高いのに、この文字列がページに無かった）。
  sentences.push(
    `${hub.nameJa}（${names}）の試合・選手に対する海外の反応まとめ。現地ファンの反応・コメントを日本語訳で紹介するページ。`,
  );
  if (standingPhrase) sentences.push(`現在${standingPhrase}。`);
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
  /** 「ナ・リーグ西地区首位（61勝33敗）」等。順位＝毎日動く実データがスニペットの鮮度を担う。 */
  standingPhrase?: string,
): string {
  const parts: string[] = [
    // 先頭90字に「海外の反応まとめ」「ファンの反応」の両フレーズを連続一致で収める（intro と同じ処方）。
    `${hub.nameJa}（${[hub.info.aliasJa, hub.info.nameFull].filter(Boolean).join('／')}）への海外の反応まとめ。現地ファンの反応・コメントを日本語訳で紹介。`,
  ];
  if (standingPhrase) parts.push(`現在${standingPhrase}。`);
  if (jpPlayers.length) parts.push(`${year}年は${jpPlayers.map((p) => p.nameJa).join('・')}が所属。`);
  parts.push(`全${articleCount}件を新着順で掲載${updated ? `・最終更新 ${updated}` : ''}。`);
  return parts.join('');
}

/**
 * チームLPの「現地ファンの声ピックアップ」の主題。選手・ファイター用に書いた照合器
 * （tagHubVoices）をチームにも同じ選び方で使うための写し。
 *
 * 英語は**フルネーム**（Chicago White Sox）を主表記にし、単語1つの短縮名（Mets / Reds / Rays）は
 * 混ぜない＝一般語の一部に当たって無関係なコメントを拾うのを避ける（exact と同じ理由）。
 * 日本語の短縮カタカナ（ホワイトソックス）と検索主流表記（Dバックス）は誤爆しないので入れる。
 * 当サイトのコメントは必ず bodyJa（訳）を持つので、実質はこの日本語表記で拾えている。
 */
export function teamVoiceSubject(hub: TeamHub): VoiceSubject {
  const shortEn = hub.info.nameEn.includes(' ') ? [hub.info.nameEn] : []; // "White Sox"=安全 / "Mets"=危険
  return {
    nameJa: hub.nameJa,
    nameEn: hub.info.nameFull,
    aliases: [...shortEn, ...(hub.info.aliasJa ? [hub.info.aliasJa] : [])],
    exact: true,
  };
}

/**
 * 記事が実在するチームLPの一覧（件数つき）。LP 同士を相互リンクする「チーム別の海外の反応」網に使う。
 * 選手LPクラスタ（playerTagHubs）と同じ思想＝同型クエリ（「{チーム名} 海外の反応」）の LP を
 * 内部リンクで密に束ね、クロール深度と内部評価を底上げする。tags は getAllTags()（件数降順）を渡す。
 */
export function teamTagHubs(tags: TagCount[]): { hub: TeamHub; count: number }[] {
  const hubs: { hub: TeamHub; count: number }[] = [];
  for (const { tag, count } of tags) {
    const hub = count >= TEAM_HUB_MIN_ARTICLES ? teamHubOf(tag) : null;
    if (hub) hubs.push({ hub, count });
  }
  return hubs;
}
