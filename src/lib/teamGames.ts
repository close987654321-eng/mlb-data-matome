import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gameDateOf } from './gameSeo';
import { getTeam, getTeamById } from './teams';
import { allComments } from './daily';
import type { StoryBlock, Thread, ThreadComment, ThreadHomer } from '@/types/thread';

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
  /** その試合を扱った記事。無い試合は結果だけの行になる。 */
  thread: Thread | null;
  /** 記事がその試合そのもののまとめか（false = 日次記事の中で触れているだけ）。表示の出し分けに使う。 */
  dedicated: boolean;
  /** その試合の現地ファンの声（実在コメント1件）。記事があっても声が取れない試合は null。 */
  voice: ThreadComment | null;
  /** 記事に焼き込んだ自軍の本塁打（専用記事だけが持てる情報）。 */
  homers?: ThreadHomer[];
};

/**
 * 試合の同一性キー。日程・専用記事・日次記事の3系統から同じ文字列を作れることが条件。
 * ビジター/ホームの順に依存しないよう「チーム名＋その得点」の組を並べ替えて作る＝日次記事の
 * `result` 文字列（自軍が先頭）からも同じキーを作れる。ダブルヘッダーで得点が入れ替わっただけの
 * 2試合も、チームと得点が対で紐づいているので別キーになる。
 */
function gameKey(date: string, teamA: string, scoreA: number, teamB: string, scoreB: number): string {
  const [x, y] = [`${teamA}=${scoreA}`, `${teamB}=${scoreB}`].sort();
  return `${date}|${x}|${y}`;
}

/** 日次記事の結果1行（例「ホワイトソックス 6-5 ヤンキース ○（延長10回）」）＝自軍が先頭。 */
function parseDailyResult(result: string | undefined): { key: string } | null {
  const m = (result ?? '').match(/^(\S+)\s+(\d+)-(\d+)\s+(\S+)/);
  return m ? { key: gameKey('', m[1], Number(m[2]), m[4], Number(m[3])) } : null;
}

/** その試合を扱った記事と、そこから拾える現地の声1件。 */
type GameSource = {
  thread: Thread;
  dedicated: boolean;
  comment: ThreadComment | null;
  homers?: ThreadHomer[];
};

/** 一言レス（「うおおお」等）を弾く最小文字数。TagVoices と同じ規約。 */
const MIN_BODY = 16;

function usable(c: ThreadComment): boolean {
  return ((c.bodyJa ?? '').trim() || (c.bodyEn ?? '').trim()).length >= MIN_BODY;
}

/** 候補コメントから「代表の声」を1件。フック引用＞ハイライト＞票数最上位。 */
function pickVoice(comments: ThreadComment[]): ThreadComment | null {
  const list = comments.filter(usable);
  if (list.length === 0) return null;
  return (
    list.find((c) => c.isHook) ??
    list.filter((c) => c.isHighlight).sort((a, b) => b.score - a.score)[0] ??
    list.slice().sort((a, b) => b.score - a.score)[0] ??
    null
  );
}

/**
 * 試合キー → その試合を扱った記事と声。**全記事**から作る（タグ絞りではない）。
 *
 * 供給源は2系統。専用記事が無い試合でも、日次記事（きょうの日本人選手）がその試合に触れていれば
 * そこから声を拾う＝タイムライン上部（＝まだ個別記事が書かれていない直近の試合）の空白が埋まる。
 * 実測で初期表示10行のカバー率が 20% → 32% に上がる（2026-08-07・村山「各試合に海外ファンの
 * コメントを」）。専用記事が優先＝より深い記事へ送る。
 */
export function buildGameSources(threads: Thread[]): Map<string, GameSource> {
  const map = new Map<string, GameSource>();
  // 先に日次記事（弱い供給源）を入れ、あとから専用記事で上書きする。
  for (const thread of threads) {
    const d = thread.daily;
    if (!d) continue;
    const date = thread.id.slice(0, 10); // 日次記事の id は JST 日付
    const add = (result: string | undefined, comments: ThreadComment[]) => {
      const parsed = parseDailyResult(result);
      const comment = pickVoice(comments);
      if (!parsed || !comment) return;
      const key = `${date}${parsed.key}`;
      const prev = map.get(key);
      // 同じ試合に複数の証言がある（主役＋短評）なら票数の多い方を残す
      if (prev?.comment && prev.comment.score >= comment.score) return;
      map.set(key, { thread, dedicated: false, comment });
    };
    const quotesOf = (blocks: StoryBlock[]) =>
      blocks.flatMap((b) => (b.type === 'quote' ? [b.comment] : b.type === 'chips' ? b.comments : []));
    add(d.hero.result, quotesOf(d.hero.blocks));
    for (const s of d.shorts) add(s.result, s.quotes ?? []);
    // ④ ざわつき枠は「日本人が絡まない試合」を拾える唯一の供給源＝result を書いた回だけ紐づく。
    for (const b of d.buzz ?? []) add(b.result, quotesOf(b.blocks));
  }
  for (const thread of threads) {
    const game = thread.game;
    if (!game) continue;
    const key = gameKey(
      gameDateOf(thread),
      game.away.ja,
      game.away.score,
      game.home.ja,
      game.home.score,
    );
    // 同じ試合を2本の記事が扱うことがある（試合レポート＋珍プレー記事）。線スコアまで持つ方＝
    // 試合レポートを優先し、同格なら先勝ち。
    const prev = map.get(key);
    if (prev?.dedicated && !(game.away.innings?.length && !prev.thread.game?.away.innings?.length)) {
      continue;
    }
    map.set(key, { thread, dedicated: true, comment: pickVoice(allComments(thread)) });
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
  threads: Thread[],
  teamJa: string,
  limit = 26,
): TeamGameRow[] {
  const sources = buildGameSources(threads);
  const rows: TeamGameRow[] = [];
  const seen = new Set<string>();

  /** 専用記事から、自軍の本塁打を取り出す（日次記事は線スコアを持たないので undefined）。 */
  const homersOf = (src: GameSource | undefined, isHome: boolean): ThreadHomer[] | undefined => {
    const game = src?.dedicated ? src.thread.game : undefined;
    const self = game ? (isHome ? game.home : game.away) : undefined;
    return self?.homers?.length ? self.homers : undefined;
  };

  for (const g of schedule?.games ?? []) {
    const away = getTeamById(g.a);
    const home = getTeamById(g.h);
    if (!away || !home) continue;
    const isHome = home.nameJa === teamJa;
    if (!isHome && away.nameJa !== teamJa) continue;
    const key = gameKey(g.d, away.nameJa, g.as, home.nameJa, g.hs);
    if (seen.has(key)) continue;
    seen.add(key);
    const opp = isHome ? away : home;
    const score = isHome ? g.hs : g.as;
    const oppScore = isHome ? g.as : g.hs;
    const src = sources.get(key);
    const homers = homersOf(src, isHome);
    rows.push({
      date: g.d,
      home: isHome,
      score,
      oppScore,
      oppJa: opp.nameJa,
      oppEn: opp.info.nameEn,
      win: score === oppScore ? null : score > oppScore,
      ...(g.no ? { gameNo: g.no } : {}),
      thread: src?.thread ?? null,
      dedicated: src?.dedicated ?? false,
      voice: src?.comment ?? null,
      ...(homers ? { homers } : {}),
    });
  }

  // 日程の窓の外（＝30日より前）にある専用記事つきの試合を足す。日程JSONが無いときは全部ここで拾う。
  for (const thread of threads) {
    const game = thread.game;
    if (!game) continue;
    const isHome = game.home.ja === teamJa;
    if (!isHome && game.away.ja !== teamJa) continue;
    const key = gameKey(
      gameDateOf(thread),
      game.away.ja,
      game.away.score,
      game.home.ja,
      game.home.score,
    );
    if (seen.has(key)) continue;
    seen.add(key);
    const src = sources.get(key);
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
      thread: src?.thread ?? thread,
      dedicated: src?.dedicated ?? true,
      voice: src?.comment ?? null,
      // この行は専用記事そのものから組んでいるので、本塁打はその記事の自軍側を使う。
      ...(self.homers?.length ? { homers: self.homers } : {}),
    });
  }

  return rows
    .sort((a, b) => b.date.localeCompare(a.date) || (b.gameNo ?? 0) - (a.gameNo ?? 0))
    .slice(0, limit);
}
