import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gameDateOf } from './gameSeo';
import { getTeam, getTeamById } from './teams';
import { allComments } from './daily';
import type { FeedItem } from './feed';
import type { Thread, ThreadComment, ThreadHomer } from '@/types/thread';

/**
 * チームLPの試合タイムラインが読むデータ。
 *
 * ここが読むのは2つ:
 *  1) data/team-games.json … 直近30日の**全試合の結果**（scripts/fetch-mlb-stats.mjs team-games ＝
 *     CI が毎時更新する公知の数値）。まとめ記事の有無に関わらず並ぶ「試合の背骨」。
 *  2) 記事に焼き込んだ Thread.game … その試合の**まとめ記事へのリンク**と本塁打。
 *
 * 以前は 2 だけでタイムラインを組んでいたので、記事を書いていない試合が丸ごと抜けて
 * 「試合結果」が数日前で止まって見えた（2026-08-07 村山指摘）。1 を背骨にして 2 を重ねる形に変える。
 * team-games.json が未生成でも 2 だけで従来どおり描ける（ビルド安全）。
 */

/** data/team-games.json の1試合（キーは短縮＝毎時コミットされるファイルを小さく保つため）。 */
type ScheduleGame = {
  d: string; // 試合日（JST）
  a: number; // ビジターの teamId
  h: number; // ホームの teamId
  as: number; // ビジターの得点
  hs: number; // ホームの得点
  no?: number; // ダブルヘッダーの試合番号
};
export type TeamSchedule = { asOf: string; season: number; from: string; to: string; games: ScheduleGame[] };

const FILE = path.join(process.cwd(), 'data', 'team-games.json');

let cache: TeamSchedule | null = null;

export async function getTeamSchedule(): Promise<TeamSchedule | null> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as TeamSchedule;
  } catch {
    return null; // 未生成でもビルドは通す（記事由来の行だけでタイムラインを描く）
  }
  return cache;
}

/** チームLPの試合タイムライン1行。そのチーム視点（自軍/相手・勝敗）に組み替えたもの。 */
export type TeamGameRow = {
  /** 試合日（JST）。記事の公開日ではなく試合そのものの日付。 */
  date: string;
  home: boolean;
  score: number;
  oppScore: number;
  oppJa: string;
  oppEn: string;
  /** 勝ち=true / 負け=false / 同点（サスペンデッド等）=null */
  win: boolean | null;
  /** ダブルヘッダーの試合番号（通常の試合は無い）。 */
  gameNo?: number;
  /** その試合のまとめ記事。無い試合は結果だけの行になる。 */
  thread: Thread | null;
  /** 記事に焼き込んだ自軍の本塁打（記事がある試合だけ持てる情報）。 */
  homers?: ThreadHomer[];
};

/** 試合の同一性キー。日程側と記事側の両方から同じ文字列を作れることが条件。 */
function gameKey(date: string, awayJa: string, homeJa: string, away: number, home: number, no?: number): string {
  return `${date}|${awayJa}|${homeJa}|${away}-${home}${no ? `|${no}` : ''}`;
}

/** 記事側（Thread.game）から、そのチームが当事者の試合を key → 行の素 に。 */
function articleRows(feed: FeedItem[], teamJa: string) {
  const map = new Map<string, { thread: Thread; homers?: ThreadHomer[] }>();
  for (const item of feed) {
    if (item.kind !== 'thread') continue;
    const game = item.thread.game;
    if (!game) continue;
    const home = game.home.ja === teamJa;
    if (!home && game.away.ja !== teamJa) continue; // タグが付いているだけの他チームの試合は除く
    const date = gameDateOf(item.thread);
    const no = item.thread.series?.gameNo;
    const key = gameKey(date, game.away.ja, game.home.ja, game.away.score, game.home.score, no);
    // 同じ試合を2本の記事が扱うことがある（試合レポート＋珍プレー記事）。フィードは新着順なので
    // 先に入った方＝通常は試合レポートを残す。
    if (map.has(key)) continue;
    const self = home ? game.home : game.away;
    map.set(key, { thread: item.thread, ...(self.homers?.length ? { homers: self.homers } : {}) });
  }
  return map;
}

/**
 * そのチームの試合タイムライン（新しい順）。日程（全試合）を背骨に、記事がある試合にリンクを重ねる。
 *
 * 日程の窓（既定30日）より古い試合でも、記事がある試合は行として残す＝窓を伸ばさずに
 * 「記事のある試合は必ず辿れる」を保つ。並べ替えのあと limit 件に切る。
 */
export function teamGameRows(
  schedule: TeamSchedule | null,
  feed: FeedItem[],
  teamJa: string,
  limit = 26,
): TeamGameRow[] {
  const articles = articleRows(feed, teamJa);
  const rows: TeamGameRow[] = [];
  const seen = new Set<string>();

  for (const g of schedule?.games ?? []) {
    const away = getTeamById(g.a);
    const home = getTeamById(g.h);
    if (!away || !home) continue;
    const isHome = home.nameJa === teamJa;
    if (!isHome && away.nameJa !== teamJa) continue;
    const key = gameKey(g.d, away.nameJa, home.nameJa, g.as, g.hs, g.no);
    if (seen.has(key)) continue;
    seen.add(key);
    const opp = isHome ? away : home;
    const score = isHome ? g.hs : g.as;
    const oppScore = isHome ? g.as : g.hs;
    const article = articles.get(key);
    rows.push({
      date: g.d,
      home: isHome,
      score,
      oppScore,
      oppJa: opp.nameJa,
      oppEn: opp.info.nameEn,
      win: score === oppScore ? null : score > oppScore,
      ...(g.no ? { gameNo: g.no } : {}),
      thread: article?.thread ?? null,
      ...(article?.homers ? { homers: article.homers } : {}),
    });
  }

  // 日程の窓の外（＝30日より前）にある記事つきの試合を足す。日程JSONが無いときは全部ここで拾う。
  for (const [key, { thread, homers }] of articles) {
    if (seen.has(key)) continue;
    seen.add(key);
    const game = thread.game!;
    const isHome = game.home.ja === teamJa;
    const self = isHome ? game.home : game.away;
    const opp = isHome ? game.away : game.home;
    rows.push({
      date: gameDateOf(thread),
      home: isHome,
      score: self.score,
      oppScore: opp.score,
      oppJa: opp.ja,
      // 記事の en は公式フルネーム（"New York Yankees"）。一覧は短縮名で揃える。
      oppEn: getTeam(opp.ja)?.nameEn ?? opp.en,
      win: self.score === opp.score ? null : self.score > opp.score,
      ...(thread.series?.gameNo ? { gameNo: thread.series.gameNo } : {}),
      thread,
      ...(homers ? { homers } : {}),
    });
  }

  return rows
    .sort((a, b) => b.date.localeCompare(a.date) || (b.gameNo ?? 0) - (a.gameNo ?? 0))
    .slice(0, limit);
}

/** 一言レス（「うおおお」等）を弾く最小文字数。TagVoices と同じ規約。 */
const MIN_BODY = 16;

/**
 * その試合のまとめ記事から「代表の声」を1件。フック引用＞ハイライト＞票数最上位の順。
 * タイムラインに現地の声をちょいちょい挟むために使う（全行に出すと結果が読めなくなるので、
 * 出す行数は呼び出し側＝TeamGames が絞る）。
 */
export function gameVoice(thread: Thread): ThreadComment | null {
  const usable = allComments(thread).filter(
    (c) => ((c.bodyJa ?? '').trim() || (c.bodyEn ?? '').trim()).length >= MIN_BODY,
  );
  if (usable.length === 0) return null;
  return (
    usable.find((c) => c.isHook) ??
    usable.filter((c) => c.isHighlight).sort((a, b) => b.score - a.score)[0] ??
    usable.slice().sort((a, b) => b.score - a.score)[0] ??
    null
  );
}
