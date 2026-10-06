import { allComments } from '@/lib/daily';
import { gameDateOf } from '@/lib/gameSeo';
import { getTeamById } from '@/lib/teams';
import { ROUND_ORDER, roundName, type PostseasonData, type Round, type SeriesGame } from '@/lib/postseason';
import type { Thread, ThreadComment } from '@/types/thread';

/**
 * チームLPの「ポストシーズンの戦い」欄が読むデータ。
 *
 * なぜ要るか（2026-10-06 村山）: ポストシーズンに入ってホワイトソックスLPへの流入が跳ねたが、LPは
 * レギュラーシーズンの作り（地区順位の「いま」＋1試合1件の声のタイムライン）のままだった。
 * 「ホワイトソックス 海外の反応」で来た人が知りたいのは、勝ち上がりの現在地・次の試合・各試合の
 * 流れと、現地ファンがどう沸いたか。それを1か所で読めるようにする。
 *
 * 組み立てるのは事実の再配置だけ:
 *  - シリーズ・勝敗・日程 … data/postseason.json（CI が毎時更新する公知の事実）
 *  - 各試合の記事・得点経過・成績 … 記事 JSON（ポストシーズンは全試合を個別記事にする＝jp-games）
 *  - 現地の声 … 記事に載せた実在コメントの抜粋（並びは記事の順＝会話の流れのまま）
 */

export type PsGame = {
  round: Round;
  n: number;
  /** 試合日（JST）。記事の series.date と同じ基準。 */
  date: string;
  home: boolean;
  score: number;
  oppScore: number;
  win: boolean;
  oppId: number;
  /** この試合終了時点のシリーズの勝敗（自軍視点） */
  wins: number;
  losses: number;
  bestOf: number;
  /** その試合の個別記事（まだ無ければ null＝結果だけ出す） */
  thread: Thread | null;
};

export type PsRound = {
  round: Round;
  bestOf: number;
  oppId: number | null;
  wins: number;
  losses: number;
  /** won=突破 / lost=敗退 / live=進行中 / upcoming=未開始 */
  state: 'won' | 'lost' | 'live' | 'upcoming';
  /** 新しい試合が先 */
  games: PsGame[];
};

export type TeamPsRun = {
  season: number;
  /** ポストシーズンの開幕日（現地）。これ以降に書き直された編集部ノートだけを欄の先頭に置く判定に使う */
  postStart: string | null;
  teamId: number;
  /** 新しいラウンドが先 */
  rounds: PsRound[];
  totalW: number;
  totalL: number;
  /** 次の試合（決まっていれば） */
  next: { round: Round; game: SeriesGame; home: boolean; oppId: number | null } | null;
  /** 導入文・meta description に使う現在地の一文（ja / en） */
  statusJa: string;
  statusEn: string;
  champion: boolean;
};

/** UTC の開始時刻 → 日本時間の日付（YYYY-MM-DD）。 */
function jstDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
  return parts; // en-CA は YYYY-MM-DD
}

const PS_ID = /-(?:wc|ds|cs|ws)-g(\d+)$/;

/** その試合の個別記事。日付（JST）・両チーム・スコアの一致で引く（ラウンド接尾辞の id を優先）。 */
function articleOf(threads: Thread[], date: string, awayJa: string, homeJa: string, as: number, hs: number): Thread | null {
  const hits = threads.filter((t) => {
    const g = t.game;
    if (!g || t.daily) return false;
    return (
      gameDateOf(t) === date &&
      g.away.ja === awayJa &&
      g.home.ja === homeJa &&
      g.away.score === as &&
      g.home.score === hs
    );
  });
  return hits.find((t) => PS_ID.test(t.id)) ?? hits[0] ?? null;
}

function teamJa(id: number | null | undefined): string {
  return getTeamById(id)?.nameJa ?? '';
}

function teamEn(id: number | null | undefined): string {
  return getTeamById(id)?.info.nameEn ?? '';
}

/**
 * そのチームのポストシーズン（今年の枠に居なければ null）。前年のアーカイブを表示している期間
 * （9月1日の切り替え前）は postseason.json の season が今季と違う＝呼び出し側で弾く。
 */
export function teamPostseasonRun(data: PostseasonData, teamId: number, threads: Thread[]): TeamPsRun | null {
  if (data.phase === 'race') return null;
  const mine = data.series.filter((s) => s.top.id === teamId || s.bottom.id === teamId);
  if (mine.length === 0) return null;

  const rounds: PsRound[] = [];
  let totalW = 0;
  let totalL = 0;
  let next: TeamPsRun['next'] = null;

  for (const s of [...mine].sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round))) {
    const me = s.top.id === teamId ? s.top : s.bottom;
    const opp = me === s.top ? s.bottom : s.top;
    let w = 0;
    let l = 0;
    const games: PsGame[] = [];
    for (const g of [...s.games].sort((a, b) => (a.n ?? 0) - (b.n ?? 0))) {
      if (g.state !== 'Final' || g.away.score == null || g.home.score == null || g.away.id == null || g.home.id == null) {
        continue;
      }
      const home = g.home.id === teamId;
      const score = home ? g.home.score : g.away.score;
      const oppScore = home ? g.away.score : g.home.score;
      const win = score > oppScore;
      if (win) w++;
      else l++;
      const date = jstDate(g.start);
      games.push({
        round: s.round,
        n: g.n ?? games.length + 1,
        date,
        home,
        score,
        oppScore,
        win,
        oppId: (home ? g.away.id : g.home.id)!,
        wins: w,
        losses: l,
        bestOf: s.bestOf,
        thread: articleOf(threads, date, teamJa(g.away.id), teamJa(g.home.id), g.away.score, g.home.score),
      });
    }
    totalW += w;
    totalL += l;
    const state: PsRound['state'] =
      s.winnerId === teamId ? 'won' : s.winnerId ? 'lost' : games.length ? 'live' : 'upcoming';
    rounds.push({ round: s.round, bestOf: s.bestOf, oppId: opp.id, wins: w, losses: l, state, games: games.reverse() });
    if (!s.winnerId) {
      // 決着前のシリーズの次の試合。「必要なら」の試合も、そこまで来ていれば次の試合＝順に最初の未実施を取る。
      const g = [...s.games]
        .sort((a, b) => (a.n ?? 0) - (b.n ?? 0))
        .find((x) => x.state !== 'Final');
      if (g) next = { round: s.round, game: g, home: g.home.id === teamId, oppId: opp.id };
    }
  }

  const latest = rounds.at(-1)!;
  const champion = latest.round === 'W' && latest.state === 'won';
  const rj = roundName(latest.round, false);
  const re = roundName(latest.round, true);
  const oppJ = teamJa(latest.oppId);
  const oppE = teamEn(latest.oppId);
  const totalJa = `ポストシーズン通算${totalW}勝${totalL}敗`;
  const totalEn = `${totalW}-${totalL} this postseason`;
  let statusJa: string;
  let statusEn: string;
  if (champion) {
    statusJa = `${data.season}年のワールドシリーズを制した（${totalJa}）。`;
    statusEn = `Won the ${data.season} World Series (${totalEn}).`;
  } else if (latest.state === 'lost') {
    statusJa = `${data.season}年のポストシーズンは${rj}で${oppJ}に敗れた（${totalJa}）。`;
    statusEn = `Eliminated by the ${oppE} in the ${re} (${totalEn}).`;
  } else if (latest.state === 'won') {
    const nextRound = ROUND_ORDER[ROUND_ORDER.indexOf(latest.round) + 1];
    statusJa = `${rj}を${latest.wins}勝${latest.losses}敗で突破し、${nextRound ? roundName(nextRound, false) : '次のラウンド'}へ進んだ（${totalJa}）。`;
    statusEn = `Won the ${re} ${latest.wins}-${latest.losses} (${totalEn}).`;
  } else if (latest.state === 'upcoming') {
    const prev = rounds.at(-2);
    statusJa = prev
      ? `${roundName(prev.round, false)}を${prev.wins}勝${prev.losses}敗で突破し、${rj}で${oppJ}と対戦する。`
      : `${rj}で${oppJ}と対戦する。`;
    statusEn = `Facing the ${oppE} in the ${re}.`;
  } else {
    const lead = latest.wins > latest.losses;
    const tied = latest.wins === latest.losses;
    const need = Math.ceil(latest.bestOf / 2);
    const left = need - latest.wins;
    statusJa = tied
      ? `${rj}で${oppJ}と${latest.wins}勝${latest.losses}敗のタイ（${totalJa}）。`
      : lead
        ? `${rj}で${oppJ}に${latest.wins}勝${latest.losses}敗とリードし、突破まであと${left}勝（${totalJa}）。`
        : `${rj}で${oppJ}に${latest.wins}勝${latest.losses}敗（${totalJa}）。`;
    statusEn = tied
      ? `Tied ${latest.wins}-${latest.losses} with the ${oppE} in the ${re} (${totalEn}).`
      : `${lead ? 'Lead' : 'Trail'} the ${oppE} ${latest.wins}-${latest.losses} in the ${re} (${totalEn}).`;
  }

  return {
    season: data.season,
    postStart: data.dates.postStart,
    teamId,
    rounds: rounds.reverse(),
    totalW,
    totalL,
    next,
    statusJa,
    statusEn,
    champion,
  };
}

// ───────────────────────────────────────────── 現地の声（流れが追える抜粋）

/** チームLPの試合カードに出す声の数（フックは別）。村山「5コメント以上」。 */
export const PS_VOICES_PER_GAME = 6;

/** 一言レス（「あと1勝！」等）を弾く最小文字数。TagVoices・タイムラインと同じ規約。 */
const MIN_BODY = 16;

function usable(c: ThreadComment, en: boolean): boolean {
  const body = en ? c.bodyEn || c.bodyJa : c.bodyJa;
  return (body ?? '').trim().length >= MIN_BODY;
}

/**
 * 記事から「流れが追える」抜粋を選ぶ。フック（記事冒頭の看板）＋本文を count 区間に割って各区間の
 * 代表1件（ハイライト＞票数）を、**記事の並び順のまま**返す。
 *
 * 記事のコメント列は編集で「試合の山場→歓声→歴史→次戦→オチ」の会話順に並べてある（matome R1）。
 * 票数の上位だけを抜くと序盤の歓声ばかりになるので、区間ごとに拾って流れの全体を見せる。
 * 返信（「うまいこと言うなｗ」）は親が無いと意味が通らないので、短文を落とす規約で自然に外れる。
 * 記事末尾のオチは返信であることが多い＝LP では拾わず、記事で読んでもらう。
 */
export function flowVoices(thread: Thread, count: number, en = false): { hook: ThreadComment | null; voices: ThreadComment[] } {
  const all = allComments(thread);
  const hook = all.find((c) => c.isHook) ?? null;
  // 英語圏の声がある記事では日本語コメント（bodyEn が空＝日本の視聴者の書き込み）を抜粋に入れない。
  // この欄は「海外の反応」＝記事本文では日本からの声援も流れの一部として残すが、LP の数件には向かない。
  const overseas = all.some((c) => c.bodyEn);
  const rest = all.filter((c) => c !== hook && usable(c, en) && (!overseas || c.bodyEn));
  if (rest.length <= count) return { hook, voices: rest };
  const picks: ThreadComment[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * rest.length) / count);
    const to = Math.floor(((i + 1) * rest.length) / count);
    const seg = rest.slice(from, to);
    const best = seg.reduce((a, b) => {
      const sa = (a.isHighlight ? 1e6 : 0) + a.score;
      const sb = (b.isHighlight ? 1e6 : 0) + b.score;
      return sb > sa ? b : a;
    });
    picks.push(best);
  }
  return { hook, voices: picks };
}

// ───────────────────────────────────────────── 日本人選手の成績

/** 「4打数1安打 1本塁打 2打点 1四球 2三振」→ 数値。打者の書式でなければ null（投手の行など）。 */
function parseBatting(today: string): { ab: number; h: number; hr: number; rbi: number; bb: number; so: number } | null {
  const m = today.match(/(\d+)打数(\d+)安打/);
  if (!m) return null;
  const num = (re: RegExp) => Number(today.match(re)?.[1] ?? 0);
  return {
    ab: Number(m[1]),
    h: Number(m[2]),
    hr: num(/(\d+)本塁打/),
    rbi: num(/(\d+)打点/),
    bb: num(/(\d+)四球/),
    so: num(/(\d+)三振/),
  };
}

/**
 * 日本人選手のポストシーズン通算（打者のみ）。各試合記事の成績ボックス（その試合の公式成績）を
 * 足し上げるだけ。**終わった試合すべてに記事があるときだけ**出す＝1試合でも欠けると通算が嘘になる。
 */
export function jpPostseasonTotals(run: TeamPsRun, names: string[]): { player: string; games: number; line: string; lineEn: string }[] {
  const games = run.rounds.flatMap((r) => r.games);
  if (games.length === 0 || games.some((g) => !g.thread)) return [];
  const out: { player: string; games: number; line: string; lineEn: string }[] = [];
  for (const name of names) {
    let g = 0;
    const t = { ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, so: 0 };
    let ok = true;
    for (const game of games) {
      const row = game.thread!.stats?.find((s) => s.player === name);
      if (!row?.today) continue;
      const b = parseBatting(row.today);
      if (!b) {
        ok = false;
        break;
      }
      g++;
      t.ab += b.ab;
      t.h += b.h;
      t.hr += b.hr;
      t.rbi += b.rbi;
      t.bb += b.bb;
      t.so += b.so;
    }
    if (!ok || g === 0) continue;
    const avg = t.ab > 0 ? (t.h / t.ab).toFixed(3).replace(/^0/, '') : '-';
    const parts = [`${t.ab}打数${t.h}安打（打率${avg}）`];
    if (t.hr) parts.push(`${t.hr}本塁打`);
    parts.push(`${t.rbi}打点`);
    if (t.bb) parts.push(`${t.bb}四球`);
    parts.push(`${t.so}三振`);
    out.push({
      player: name,
      games: g,
      line: parts.join(' '),
      lineEn: `${t.h}-for-${t.ab} (${avg}), ${t.hr} HR, ${t.rbi} RBI, ${t.bb} BB, ${t.so} K`,
    });
  }
  return out;
}

/** LP の他のブロック（声ピックアップ・タイムライン）と同じ声を2度出さないための鍵。 */
export function voiceKey(c: ThreadComment): string {
  return `${c.author}|${c.bodyEn || c.bodyJa}`;
}
