import { getPlayerByJaName, type Player } from './players';
import { deriveRole } from './playerHero';
import type { PlayerSeason } from './playerStats';
import type { FeedItem } from './feed';
import type { TagCount } from './tags';
import type { Thread, ThreadComment } from '@/types/thread';

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

/** タグLPに直接引用する「現地ファンの声」1件（記事＋その代表コメント）。 */
export type TagVoice = { thread: Thread; comment: ThreadComment };

/** LP に載せる声の総数と、開いた状態でない時に見せる件数（残りは「もっと見る」で開く）。 */
export const VOICES_LIMIT = 20;
export const VOICES_VISIBLE = 5;

/** 候補を拾う記事の窓＝直近何本の記事から声を集めるか（古い記事だけの日を作らない）。 */
const POOL_THREADS = 24;
/** 1記事から拾う声の上限。全記事の1番手 → 2番手 … の順で積むので1記事に偏らない。 */
const PER_THREAD = 3;

/** 記事内のコメントの序列: フック引用 → ハイライト → スコア降順（NextReadCard と同じ考え方）。 */
function rankedComments(thread: Thread): ThreadComment[] {
  const usable = (thread.comments ?? []).filter(
    (c) => (c.bodyJa ?? '').trim() !== '' || (c.bodyEn ?? '').trim() !== '',
  );
  return usable.sort((a, b) => {
    if (!!a.isHook !== !!b.isHook) return a.isHook ? -1 : 1;
    if (!!a.isHighlight !== !!b.isHighlight) return a.isHighlight ? -1 : 1;
    return b.score - a.score;
  });
}

/**
 * 日替わりの種＝JST の通日。SSG なのでこれはビルド時に確定するが、本サイトは成績スナップショット CI と
 * 日次の記事公開ルーチンで毎日デプロイされる＝実運用では日付が変わるたびに選び直される。
 */
export function voiceSeed(now: Date = new Date()): number {
  return Math.floor((now.getTime() + 9 * 60 * 60 * 1000) / 86_400_000); // JST の通日
}

/**
 * タグLPの「現地ファンの声ピックアップ」。直近 POOL_THREADS 本の記事から1本につき最大 PER_THREAD 件の
 * コメントを候補に積み、その日の種で切り出し位置をずらして limit 件を返す。
 * 「{選手名} 海外の反応」で来た人に一覧カードだけでなく反応そのものを LP 上で即見せる＝
 * クエリ意図と一致する実テキストが LP に載る。記事追加だけでなく**日付が変わるだけで中身が入れ替わる**ので、
 * 試合の無い時期でも LP が同じ顔にならない（QDF/再訪の鮮度）。
 * ずらし幅は VOICES_VISIBLE ＝初期表示の5件が毎日まるごと入れ替わる（1件ずつのスライドだと変化が見えない）。
 * 同一記事の n 番手同士は候補列で POOL_THREADS 件離れる＝窓幅 limit がそれ未満なら同じ記事は1日に1回しか出ない。
 */
export function tagHubVoices(feed: FeedItem[], seed = 0, limit = VOICES_LIMIT): TagVoice[] {
  const pool: TagVoice[] = [];
  const threads = feed
    .flatMap((item) => (item.kind === 'thread' ? [item.thread] : []))
    .slice(0, POOL_THREADS)
    .map((thread) => ({ thread, comments: rankedComments(thread) }));
  for (let nth = 0; nth < PER_THREAD; nth++) {
    for (const { thread, comments } of threads) {
      const comment = comments[nth];
      if (comment) pool.push({ thread, comment });
    }
  }
  if (pool.length === 0) return [];
  const start = (((seed * VOICES_VISIBLE) % pool.length) + pool.length) % pool.length;
  return Array.from(
    { length: Math.min(limit, pool.length) },
    (_, i) => pool[(start + i) % pool.length],
  );
}

/**
 * 記事が実在する選手タグLPの一覧（件数つき）。LP 同士を相互リンクする「選手別の海外の反応」網に使う。
 * 「{選手名} 海外の反応」系はどの選手も同型のクエリ＝LP クラスタ内の内部リンクを密にして
 * 個々の LP のクロール深度と内部評価を底上げする。tags は getAllTags()（件数降順）を渡す。
 */
export function playerTagHubs(tags: TagCount[]): { player: Player; count: number }[] {
  const hubs: { player: Player; count: number }[] = [];
  for (const { tag, count } of tags) {
    const player = tagHubOf(tag);
    if (player && count > 0) hubs.push({ player, count });
  }
  return hubs;
}
