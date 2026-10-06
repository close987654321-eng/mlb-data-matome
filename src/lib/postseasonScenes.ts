import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Thread, ThreadComment } from '@/types/thread';
import { teamLabel, type League, type PostseasonData, type Round } from '@/lib/postseason';
import { PLAYERS } from '@/lib/players';

/**
 * ポストシーズン名場面（/postseason/live）のデータ。動画を見なくても、試合の山場と現地ファンの熱が
 * テキストだけで追える面＝「見出し（編集）＋状況（事実）＋海外の反応（引用）＋中の人（俺の声）」の4点で1場面。
 *
 * 2層で組む:
 * - **編集した場面**（data/postseason-scenes/{season}.json）＝見出し・状況・引用の選び・中の人の一言を人が書いたもの。
 * - **自動の場面**＝まだ編集していない試合記事を、記事のタイトル・要約・上位コメントからそのまま並べたもの。
 *   ポストシーズンの試合記事はクラウドの日次ルーチンが毎日出す＝記事が出た時点でこの面にも載る（リアルタイム性）。
 *   中の人の一言は付かない（俺の声はクラウドで書かない＝matome 手順5c と同じ規律）。編集セッションで足す。
 *
 * 引用は本文を持たず、記事のコメントを投稿者名で参照する＝描画のたびに記事から本文・訳・票数を引く
 * （書き換えも捏造もできない）。参照の検査は scripts/check-postseason-scenes.mjs（--live で元動画とも照合）。
 */

/** 引用の参照。ふつうは投稿者名だけ。同じ投稿者が1記事に2件書いているときは英文の書き出しで絞る。 */
export type SceneQuoteRef = string | { author: string; en: string };

export type SceneEntry = {
  threadId: string;
  headline: string;
  lead: string;
  quotes: SceneQuoteRef[];
  take: string;
  /** この場面に絡む日本人選手（表示名）。空配列＝日本人なし。 */
  jp: string[];
};

export type ScenesFile = { season: number; scenes: SceneEntry[] };

export type Scene = {
  thread: Thread;
  curated: boolean;
  headline: string;
  lead: string;
  quotes: ThreadComment[];
  take: string | null;
  jp: string[];
  round: Round | null;
  league: League | null;
  gameN: number | null;
  /** 並び順と日付見出しに使う時刻（試合開始・無ければ記事の公開時刻）。 */
  at: string;
  /** 日本時間の日付（YYYY-MM-DD）。 */
  dayJst: string;
  score: { away: string; home: string; as: number; hs: number } | null;
};

const ROUND_BY_SLUG: Record<string, Round> = { wc: 'F', ds: 'D', lcs: 'L', cs: 'L', ws: 'W' };
const ROUND_TAG: Record<Round, string> = { F: 'ワイルドカードシリーズ', D: '地区シリーズ', L: 'リーグ優勝決定シリーズ', W: 'ワールドシリーズ' };

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 日本人選手の表示名（カタログの非ライバル枠）。自動の場面で「日本人が絡む」印を記事のタグから付けるのに使う。 */
const JP_NAMES = new Set(PLAYERS.filter((p) => !p.rival).map((p) => p.nameJa));

export async function getScenesFile(season: number): Promise<ScenesFile | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'postseason-scenes', `${season}.json`), 'utf8')) as ScenesFile;
  } catch {
    return null;
  }
}

function pickQuote(comments: ThreadComment[], q: SceneQuoteRef): ThreadComment | null {
  const author = typeof q === 'string' ? q : q.author;
  const hits = comments.filter((c) => c.author === author && (typeof q === 'string' || norm(c.bodyEn).startsWith(norm(q.en))));
  return hits.length === 1 ? hits[0] : null;
}

/** 記事IDとタグからラウンドと第何戦かを読む（記事 ID は {date}-{away}-vs-{home}-{wc|ds|lcs|ws}-g{n}）。 */
function roundOf(t: Thread): { round: Round | null; n: number | null } {
  const m = t.id.match(/-(wc|ds|lcs|cs|ws)-g(\d+)$/);
  if (m) return { round: ROUND_BY_SLUG[m[1]], n: Number(m[2]) };
  const tags = t.tags ?? [];
  const r = (Object.keys(ROUND_TAG) as Round[]).find((k) => tags.includes(ROUND_TAG[k]));
  return { round: r ?? null, n: null };
}

/** 日本時間の YYYY-MM-DD。 */
export function jstDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** 自動の場面の見出し＝記事タイトルから定型部分（【海外の反応】・対戦カード・ラウンド名）を外したもの。 */
function autoHeadline(t: Thread): string {
  let s = t.title.ja.replace(/【海外の反応】/g, '').trim();
  s = s.replace(/、[^、]*対[^、]*(ワイルドカード(シリーズ)?|地区シリーズ|リーグ優勝決定シリーズ|ワールドシリーズ)\s*第\d+戦$/, '');
  s = s.replace(/\s*(ワイルドカード(シリーズ)?|地区シリーズ|リーグ優勝決定シリーズ|ワールドシリーズ)\s*第\d+戦$/, '');
  return s.trim() || t.title.ja;
}

/** 自動の場面の引用＝フック・ハイライトを先に、票の多い順に3件（長すぎるものは外す＝場面の読み味を保つ）。 */
function autoQuotes(t: Thread): ThreadComment[] {
  const cs = (t.comments ?? []).filter((c) => c.bodyJa && c.bodyEn && c.bodyEn.length <= 220);
  const rank = (c: ThreadComment) => (c.isHook ? 2 : c.isHighlight ? 1 : 0);
  return [...cs].sort((a, b) => rank(b) - rank(a) || b.score - a.score).slice(0, 3);
}

/**
 * その年の名場面（新しい順）。ポストシーズンの試合記事＝ラウンドのタグが付いた MLB 記事（日次記事は除く）。
 * 編集した場面があればそれを、無ければ記事から自動で組む。
 */
export function buildScenes(threads: Thread[], data: PostseasonData, file: ScenesFile | null): Scene[] {
  const season = data.season;
  const curated = new Map((file?.season === season ? file.scenes : []).map((s) => [s.threadId, s]));
  const roundTags = Object.values(ROUND_TAG);
  const games = threads.filter(
    (t) =>
      t.sport === 'mlb' &&
      !t.daily &&
      t.fetchedAt >= `${season}-09-01` &&
      t.fetchedAt < `${season + 1}-01-01` &&
      (curated.has(t.id) || (t.tags ?? []).some((x) => roundTags.includes(x))),
  );

  const scenes: Scene[] = [];
  for (const t of games) {
    const { round, n } = roundOf(t);
    if (!round) continue;
    // 試合の開始時刻＝トーナメント表のデータから、ラウンド・第何戦・両チームで引き当てる。
    let start: string | null = null;
    let league: League | null = null;
    if (t.game && n) {
      for (const s of data.series) {
        if (s.round !== round) continue;
        const g = s.games.find(
          (x) =>
            x.n === n &&
            x.away.id != null &&
            x.home.id != null &&
            teamLabel(x.away.id, false) === t.game!.away.ja &&
            teamLabel(x.home.id, false) === t.game!.home.ja,
        );
        if (g) {
          start = g.tbd ? null : g.start;
          league = s.league;
          break;
        }
      }
    }
    const at = start ?? t.fetchedAt;
    const entry = curated.get(t.id);
    const quotes = entry
      ? entry.quotes.map((q) => pickQuote(t.comments ?? [], q)).filter((c): c is ThreadComment => c != null)
      : autoQuotes(t);
    scenes.push({
      thread: t,
      curated: Boolean(entry),
      headline: entry?.headline ?? autoHeadline(t),
      lead: entry?.lead ?? (t.summaryJa.split('。')[0] ? `${t.summaryJa.split('。')[0]}。` : ''),
      quotes,
      take: entry?.take ?? null,
      jp: entry?.jp ?? (t.tags ?? []).filter((x) => JP_NAMES.has(x)),
      round,
      league,
      gameN: n,
      at,
      dayJst: jstDay(at),
      score: t.game ? { away: t.game.away.ja, home: t.game.home.ja, as: t.game.away.score, hs: t.game.home.score } : null,
    });
  }
  return scenes.sort((a, b) => b.at.localeCompare(a.at));
}

/** 日本時間の日付ごとにまとめる（新しい日が先）。 */
export function scenesByDay(scenes: Scene[]): { day: string; scenes: Scene[] }[] {
  const map = new Map<string, Scene[]>();
  for (const s of scenes) {
    const list = map.get(s.dayJst) ?? [];
    list.push(s);
    map.set(s.dayJst, list);
  }
  return [...map.entries()].map(([day, list]) => ({ day, scenes: list }));
}
