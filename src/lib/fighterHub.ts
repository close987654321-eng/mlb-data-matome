import { getFighterByJaName, type Fighter, type FighterFight } from './fighters';
import type { FeedItem } from './feed';
import type { TagCount } from './tags';

/**
 * 格闘技版タグLP（/tag/{ファイター名}）の判定とコンテンツ生成。
 *
 * 「{選手名} 海外の反応」の SERP はボクシングでも一覧ページ＋YouTube が上位＝
 * 受け皿は記事フィードのタグページ（MLB選手の tagHub と同じ戦略）。MLB と分けるのは
 * データ源の違いだけ: MLB は毎時 snapshot、格闘技は fighters.ts の手動カタログ。
 */
export function fighterHubOf(tag: string): Fighter | null {
  return getFighterByJaName(tag) ?? null;
}

/** 「2026-05-02」→「2026年5月2日」（導入文・タイムライン表示用） */
export function fightDateJa(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/**
 * LP の H1 直下に出す導入文（ja）＝ meta description 兼用。
 * 戦績・直近試合はカタログの裏取り済みの値のみ（無い値は文ごと落とす＝捏造しない）。
 */
export function fighterHubIntroJa(fighter: Fighter, articleCount: number): string {
  const sentences: string[] = [];
  sentences.push(
    `${fighter.nameJa}（${fighter.nameEn}）に対する海外の反応・現地ファンのコメントを日本語訳でまとめたページ。`,
  );
  const r = fighter.record;
  const total = r.wins + r.losses + r.draws;
  const rec = [
    `${total}戦${r.wins}勝`,
    r.losses > 0 ? `${r.losses}敗` : '',
    r.draws > 0 ? `${r.draws}分` : '',
    `（${r.kos}KO）`,
    r.losses === 0 && r.draws === 0 ? '無敗' : '',
  ].join('');
  sentences.push(`${fighter.accoladeJa}で、通算${rec}（${fightDateJa(r.asOf)}時点）。`);
  const latest = fighter.fights[0];
  if (latest) {
    sentences.push(
      `直近の試合は${fightDateJa(latest.date)}、${latest.venueJa}での${latest.opponentJa}戦＝${latest.resultJa}。`,
    );
  }
  sentences.push(
    `試合ハイライトへの現地実況や Reddit の話題スレから、生の反応を全${articleCount}件の記事で紹介している。`,
  );
  return sentences.join('');
}

/**
 * 試合ごとの関連記事。フィード（すでにこのファイターのタグで絞り込み済み）から
 * 対戦相手タグを含む記事を拾う＝タイムラインの各行が「その試合の反応」への入口になる。
 * 「{選手名} {対戦相手} 海外の反応」という複合クエリの受け皿も兼ねる。
 */
export function fightFeedItems(fight: FighterFight, feed: FeedItem[], limit = 3): FeedItem[] {
  const tag = fight.tag ?? fight.opponentJa;
  return feed
    .filter((item) => {
      const tags = (item.kind === 'thread' ? item.thread.tags : item.column.tags) ?? [];
      return tags.includes(tag);
    })
    .slice(0, limit);
}

/**
 * 記事が実在するファイターLPの一覧（件数つき）＝LP同士の相互リンク網。
 * tags は getAllTags()（件数降順）を渡す。tagHub.playerTagHubs のファイター版。
 */
export function fighterTagHubs(tags: TagCount[]): { fighter: Fighter; count: number }[] {
  const hubs: { fighter: Fighter; count: number }[] = [];
  for (const { tag, count } of tags) {
    const fighter = fighterHubOf(tag);
    if (fighter && count > 0) hubs.push({ fighter, count });
  }
  return hubs;
}
