import type { Thread } from '@/types/thread';
import type { Column } from '@/types/column';
import type { Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';
import { buildFeed, feedKey, type FeedItem } from '@/lib/feed';
import { isStopTag, tagCountMap } from '@/lib/tags';
import { primaryPlayerOf, type Player } from '@/lib/players';

/**
 * 「次に読む」関連度スコアラー（回遊の唯一の正）。
 * 記事末の RelatedArticles と、オチ直後の「次に読む」プライムカードが同じ順位付けを共有する。
 *
 * 旧実装の欠点＝「共有タグ数」で測っていたため、全記事の約4割に付く『海外の反応』が
 * 全候補に +1 して識別力を潰し、同点は単なる新着順になっていた（編集的に最も近い記事が埋もれる）。
 *
 * v2 の関連度 = ①同一選手ブースト（最優先＝作品ハブを持たない MLB では選手ハブが常緑の回遊先）
 *              ②共有タグの IDF 合計（レアなタグほど重い・STOPLIST は 0）
 *              ③同カテゴリの微小ボーナス ④新着（安定ソートで担保）。
 * さらに ⑤多様性キャップ（同一選手は上位に最大 MAX_PER_PLAYER 件まで）で1選手独占を防ぐ。
 */

/** 関連の理由（カードに出す小さな根拠チップ）。強い順に player > tag > sport > latest。 */
export type RelReason =
  | { kind: 'player'; player: Player }
  | { kind: 'tag'; tag: string }
  | { kind: 'sport' }
  | { kind: 'latest' };

export type Ranked = { item: FeedItem; score: number; reason: RelReason };

/**
 * 理由チップの表示ラベル。player/tag は「なぜ近いか」を具体的に見せる強い根拠、
 * sport/latest は弱い根拠なので strong=false（描画側で出す/出さないを選べる）。
 */
export function reasonLabel(
  reason: RelReason,
  locale: Locale,
  t: (key: string) => string,
): { text: string; strong: boolean } {
  switch (reason.kind) {
    case 'player':
      return { text: locale === 'ja' ? reason.player.nameJa : reason.player.nameEn, strong: true };
    case 'tag':
      return { text: `#${reason.tag}`, strong: true };
    case 'sport':
      return { text: t('related.because.category'), strong: false };
    default:
      return { text: t('related.because.latest'), strong: false };
  }
}

const SAME_PLAYER_BOOST = 100; // 同一選手は他要因を必ず上回る（選手ハブ回遊を最優先）
const SAME_SPORT_BOOST = 0.5; // タグ無しの同点を割るだけの微小値
const MAX_PER_PLAYER = 2; // 上位に同一選手を並べすぎない（多様性）

const sportOf = (item: FeedItem): Sport =>
  item.kind === 'thread' ? item.thread.sport : item.column.sport;
const tagsOf = (item: FeedItem): string[] =>
  (item.kind === 'thread' ? item.thread.tags : item.column.tags) ?? [];

/**
 * 関連度の基準（現在の記事）。反応まとめ（Thread）でもコラム（Column）でも回せるよう軽量化。
 * thread があれば選手ブーストに使う（column は選手ハブに属さないので null になる）。
 */
export type RankFocus = {
  sport: Sport;
  key: string; // 現在記事の feedKey（自分自身を候補から除くため）
  tags?: string[];
  thread?: Thread;
};

export type RankParams = {
  current: RankFocus;
  threads: Thread[];
  columns: Column[];
  /** 除外する feedKey（例: プライムカードで既に見せた記事を related から外す）。 */
  excludeKeys?: Set<string>;
  limit?: number;
};

export function rankNextReads({
  current,
  threads,
  columns,
  excludeKeys,
  limit,
}: RankParams): Ranked[] {
  const currentKey = current.key;

  // IDF: レアなタグほど重い。STOPLIST（海外の反応・競技総称等）は 0 に落とす。
  const df = tagCountMap(threads);
  const N = Math.max(threads.length, 1);
  const idf = (tag: string): number => {
    if (isStopTag(tag)) return 0;
    return Math.log(N / (1 + (df.get(tag) ?? 0)));
  };

  // 記事 → 主役選手を一度だけ引く（候補ごとに再計算すると重いため feedKey で memo）。
  const playerByKey = new Map<string, Player | null>();
  const playerOf = (t: Thread): Player | null => {
    const k = `thread/${t.sport}/${t.id}`;
    if (!playerByKey.has(k)) playerByKey.set(k, primaryPlayerOf(t));
    return playerByKey.get(k) ?? null;
  };
  const currentPlayer = current.thread ? playerOf(current.thread) : null;
  const currentTags = new Set((current.tags ?? []).filter((tag) => !isStopTag(tag)));

  const feed = buildFeed(threads, columns).filter((item) => {
    const k = feedKey(item);
    return k !== currentKey && !(excludeKeys?.has(k) ?? false);
  });

  const scored: Ranked[] = feed.map((item) => {
    // 共有タグの IDF 合計＋最も効いた共有タグ（理由チップ用）。
    let sharedIdf = 0;
    let topTag: { tag: string; w: number } | null = null;
    for (const tag of tagsOf(item)) {
      if (!currentTags.has(tag)) continue;
      const w = idf(tag);
      if (w <= 0) continue;
      sharedIdf += w;
      if (!topTag || w > topTag.w) topTag = { tag, w };
    }

    const candPlayer = item.kind === 'thread' ? playerOf(item.thread) : null;
    const samePlayer = !!currentPlayer && candPlayer?.slug === currentPlayer.slug;
    const sameSport = sportOf(item) === current.sport;

    const score =
      (samePlayer ? SAME_PLAYER_BOOST : 0) + sharedIdf + (sameSport ? SAME_SPORT_BOOST : 0);

    const reason: RelReason = samePlayer
      ? { kind: 'player', player: currentPlayer! }
      : topTag
        ? { kind: 'tag', tag: topTag.tag }
        : sameSport
          ? { kind: 'sport' }
          : { kind: 'latest' };

    return { item, score, reason };
  });

  // 安定ソート＋ feed が新着順なので、スコア同点は新着順を保つ。
  scored.sort((a, b) => b.score - a.score);

  // 多様性キャップ: 同一選手は上位に MAX_PER_PLAYER 件まで（選手なしは制限しない）。
  const perPlayer = new Map<string, number>();
  const picked: Ranked[] = [];
  for (const r of scored) {
    const slug =
      r.reason.kind === 'player'
        ? r.reason.player.slug
        : r.item.kind === 'thread'
          ? playerByKey.get(`thread/${r.item.thread.sport}/${r.item.thread.id}`)?.slug ?? null
          : null;
    if (slug) {
      const n = perPlayer.get(slug) ?? 0;
      if (n >= MAX_PER_PLAYER) continue;
      perPlayer.set(slug, n + 1);
    }
    picked.push(r);
    if (limit && picked.length >= limit) break;
  }
  return picked;
}
