import { FIGHTERS, getFighterByJaName, type Fighter, type FighterFight } from './fighters';
import type { FeedItem } from './feed';
import type { Sport } from './sports';
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
 * 期限内の次戦ラベル（domestic の title/description の前方に出す）。
 * until（JSTの試合日）を過ぎたらビルド時に消える＝journalNext と同じ賞味期限方式。
 */
export function fighterNextFightJa(fighter: Fighter): string | null {
  return fighterNextFight(fighter)?.labelJa ?? null;
}

/** 期限内の次戦（相手・大会名・イベントハブのパスつき）。期限切れは null。 */
export function fighterNextFight(fighter: Fighter): NonNullable<Fighter['nextFightJa']> | null {
  if (!fighter.nextFightJa) return null;
  return isUpcoming(fighter.nextFightJa.until) ? fighter.nextFightJa : null;
}

/** until（JSTの試合日）が今日以降か＝まだ「次戦」と呼んでいいか。 */
function isUpcoming(until: string): boolean {
  const todayJst = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  return todayJst <= until;
}

/** 「2026-09-10」→「9/10（水）」。試合日は JST 基準（カタログの until と同じ）。 */
export function fightDayJa(until: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${until}T12:00:00+09:00`));
}

export type UpcomingFight = {
  fighter: Fighter;
  next: NonNullable<Fighter['nextFightJa']>;
};

/**
 * 期限内の「次の試合」一覧（試合日の近い順）。カタログ1か所から出すので、
 * ファイターLP・競技LP・/browse・イベントハブのどこに置いても中身がズレない
 * ＝6枚のLPと大会ハブを1枠で結ぶ内部リンクの網（試合が終われば自動で消える）。
 */
export function upcomingFights(opts: { sport?: Sport; excludeSlug?: string } = {}): UpcomingFight[] {
  return FIGHTERS.filter((f) => f.nextFightJa && isUpcoming(f.nextFightJa.until))
    .filter((f) => (opts.sport ? f.sport === opts.sport : true))
    .filter((f) => f.slug !== opts.excludeSlug)
    .map((f) => ({ fighter: f, next: f.nextFightJa! }))
    .sort((a, b) => a.next.until.localeCompare(b.next.until));
}

/**
 * イベントハブのカード欄から選手名→ファイターLPへ張れるか。LPは記事が1件以上ある
 * タグにしか生成されない（tag の generateStaticParams）ので、記事0件のファイターには張らない。
 */
export function linkableFighterOf(nameJa: string, articleTags: Set<string>): Fighter | null {
  const fighter = fighterHubOf(nameJa);
  return fighter && articleTags.has(fighter.nameJa) ? fighter : null;
}

/**
 * LP の meta title（absolute・ja）。「{選手名} 評判・戦績まとめ」で統一（2026-08-06 村山指示）。
 * 「評判」は海外・国内を問わない中立語＝voiceScope（global/domestic）で框を割る必要がない
 * （domestic ファイターに「海外の反応」を名乗らせない制約とも自然に両立する）。
 */
export function fighterHubTitleJa(fighter: Fighter): string {
  return `${fighter.nameJa} 評判・戦績まとめ`;
}

/** LP の H1（ja）＝ title から【】接尾辞を外したもの（tagHub と同じ関係）。 */
export function fighterHubHeadingJa(fighter: Fighter): string {
  if (fighter.voiceScope === 'global') return `${fighter.nameJa}の海外の反応まとめ`;
  const next = fighterNextFightJa(fighter);
  return next ? `${fighter.nameJa}の戦績と次戦・${next}` : `${fighter.nameJa}の戦績とファンの声`;
}

/**
 * LP の H1 直下に出す導入文（ja）＝ meta description 兼用。
 * 戦績・直近試合はカタログの裏取り済みの値のみ（無い値は文ごと落とす＝捏造しない）。
 * 1文目と結びは voiceScope で出し分け（domestic に「海外」を名乗らせない）。
 */
export function fighterHubIntroJa(fighter: Fighter, articleCount: number): string {
  const sentences: string[] = [];
  if (fighter.voiceScope === 'global') {
    sentences.push(
      `${fighter.nameJa}（${fighter.nameEn}）に対する海外の反応・現地ファンのコメントを日本語訳でまとめたページ。`,
    );
  } else {
    // 「次戦情報」は次戦が確定している選手にだけ名乗らせる。試合直後で次が未発表の選手
    // （2026-08-12 クレベル・コイケ）に書くと、説明文と中身がズレる＝看板詐欺を description でやることになる。
    const hasNext = Boolean(fighterNextFight(fighter));
    sentences.push(
      hasNext
        ? `${fighter.nameJa}（${fighter.nameEn}）の戦績・次戦情報と、試合ごとのファンの声をまとめたページ。`
        : `${fighter.nameJa}（${fighter.nameEn}）の戦績と、試合ごとのファンの声をまとめたページ。`,
    );
  }
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
  if (fighter.voiceScope === 'global') {
    sentences.push(
      `試合ハイライトへの現地実況や Reddit の話題スレから、生の反応を全${articleCount}件の記事で紹介している。`,
    );
  } else {
    const next = fighterNextFightJa(fighter);
    if (next) sentences.push(`次戦は${next}。`);
    sentences.push(
      `公式ハイライトのコメント欄から、試合ごとの生の声をキャリア観測日誌と全${articleCount}件の記事で追いかけている。`,
    );
  }
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
