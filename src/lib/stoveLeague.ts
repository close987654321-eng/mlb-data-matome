import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Thread, ThreadComment } from '@/types/thread';
import type { FaqItem } from '@/components/FaqList';
import { getPostseason, getPostseasonArchive } from './postseason';
import { getTeamById } from './teams';

/**
 * ストーブリーグ（/stove-league）＝MLBのオフシーズンの恒久ハブ。URLに年号を入れない（/postseason と同じ型）。
 *
 * なぜ要るか: 11月〜2月はMLBの試合が無く、jp-games / jp-daily の燃料が止まる。一方で検索は
 * 「鈴木誠也 FA」「今永 移籍先」「MLB FA ランキング」「MLB ロックアウト」に移る＝試合ハイライトより
 * 競合が薄く、しかも日本の読者が一番知りたいのは「日本人がどこへ行くのか」。その受け皿をここに1枚置く。
 *
 * 担当の割り方（NEXT MLB と同じ）:
 * - **編集判断**＝誰を載せるか・状況・報道の時系列・ひと言 … `data/stove-league.json`（人が書く・出典URL必須）
 * - **数値と動き**＝今季成績・FA宣言・どこと契約したか … `data/stove-league-stats.json`
 *   （`scripts/fetch-stove-stats.mjs` が statsapi から取る）
 * - **海外の反応**＝記事のタグ（STOVE_TAGS）で自動的に集まる。ここで新しい引用は作らない。
 * サイト本体は API を叩かない（静的JSONを読むだけ）。
 */

type Bi = { ja: string; en: string };
type Sourced = Bi & { source: string; sourceName: string };

/** 市場に出る道筋。読者の疑問が違う（FA＝どこへ行くか／オプトアウト＝出るのか残るのか／ポスティング＝球団が認めるか）。 */
export type StoveRoute = 'fa' | 'opt-out' | 'club-option' | 'posting';

/**
 * 決着。契約の年数・金額は statsapi に無いので、報道を見て人が書く（出典必須）。
 * stayed＝オプトアウトせず残留／signed＝新天地と契約／re-signed＝同じ球団と再契約。
 */
export type StoveOutcome = Sourced & {
  kind: 'signed' | 're-signed' | 'stayed' | 'retired';
  date: string;
  team?: Bi;
};

/** 日本人選手の「今オフの現在地」。表示は PostingWatch（NEXT MLB と共用）に渡す形に揃える。 */
export type JpStove = {
  slug: string;
  route: StoveRoute;
  asOf: string;
  headline: Bi;
  window?: Bi;
  suitors?: Bi[];
  marketValue?: Sourced[];
  timeline: (Sourced & { date: string })[];
  outcome?: StoveOutcome;
};

export type BoardRow = {
  /** MLB.com のFAランキングの順位（ranking.date 時点）。 */
  rank: number;
  mlbId?: number;
  nameEn: string;
  /** NPB 選手など、カタカナ表・カタログで引けない人だけ持つ。 */
  nameJa?: string;
  jpSlug?: string;
  prospectSlug?: string;
  pos: Bi;
  /** statsapi に居ない NPB 選手の所属。MLB 組は成績JSONの球団IDから引く。 */
  team?: Bi;
  route: StoveRoute;
  note: Bi;
  outcome?: StoveOutcome;
};

export type StoveDate = {
  key: string;
  /**
   * 固定日（**日本時間**）。サイトの日付は JST に揃える規約（matome R9）＝現地の締め切りは
   * 日本時間に直して書く（例: 現地12月1日午後11時59分 → 12月2日午後1時59分）。
   */
  date?: string;
  end?: string;
  /** ワールドシリーズ終了（現地の最終戦の日）から N 日後。決着前は日付が決まらない。 */
  afterWs?: number;
  /** 現地の締め切り時刻が日本時間で翌日になるぶんの日数（夕方 ET の締め切り＝JST の翌朝）。 */
  jstShift?: number;
  /** 日本時間の時刻。分かっているものだけ。 */
  time?: Bi;
  /** その日が日本人選手にとって何の日か。日程表で日本の読者が読み飛ばさないための一言。 */
  jp?: Bi;
  ja: string;
  en: string;
  source: string;
  sourceName: string;
};

export type StoveCatalog = {
  season: number;
  /** 中身（報道・状況）を最後に書き換えた日（JST）。 */
  asOf: string;
  /**
   * 毎朝の定期実行（stove-daily）が報道を確認した日。動きが無い日は中身を変えずにこれだけ進める＝
   * 「更新日」を毎日進めて新しく見せることはしない（更新と確認を分けて出す）。
   */
  checkedAt?: string;
  /** この日を過ぎたら選手LPの title をオフ仕様から戻す（ハブ自体はアーカイブとして残す）。 */
  activeUntil: string;
  ranking: { name: string; nameEn: string; url: string; date: string };
  qualifyingOffer: { amountJa: string; amountEn: string; source: string; sourceName: string };
  dates: StoveDate[];
  japanese: JpStove[];
  board: BoardRow[];
};

export type StoveHitting = { g: number; pa: number; avg: string; hr: number; rbi: number; sb: number; obp: string; ops: string };
export type StovePitching = {
  g: number; gs: number; w: number; l: number; sv: number; ip: string; era: string; so: number; bb: number; whip: string;
};
export type StoveMove = { date: string; type: string; toTeamId: number | null; fromTeamId: number | null; desc: string };
export type StovePlayerStats = {
  name: string;
  birthDate?: string;
  age?: number;
  pos?: string;
  teamIds: number[];
  lastTeamId: number | null;
  hitting: StoveHitting | null;
  pitching: StovePitching | null;
  moves: StoveMove[];
};
export type StoveStats = { asOf: string; season: number; movesFrom: string; players: Record<string, StovePlayerStats> };

const DATA_DIR = path.join(process.cwd(), 'data');
let catCache: StoveCatalog | null | undefined;
let statsCache: StoveStats | undefined;

export async function getStoveLeague(): Promise<StoveCatalog | null> {
  if (catCache !== undefined) return catCache;
  try {
    catCache = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'stove-league.json'), 'utf8')) as StoveCatalog;
  } catch {
    catCache = null; // 無ければハブは 404・選手LPのブロックも出ない
  }
  return catCache;
}

export async function getStoveStats(): Promise<StoveStats> {
  if (statsCache) return statsCache;
  try {
    statsCache = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'stove-league-stats.json'), 'utf8')) as StoveStats;
  } catch {
    statsCache = { asOf: '', season: 0, movesFrom: '', players: {} };
  }
  return statsCache;
}

export async function getJpStove(slug: string): Promise<JpStove | null> {
  const cat = await getStoveLeague();
  return cat?.japanese.find((j) => j.slug === slug) ?? null;
}

/** 選手LPの title をオフ仕様にしてよい期間か（JST の今日で判定）。 */
export function stoveActive(cat: StoveCatalog, today = jstToday()): boolean {
  return today <= cat.activeUntil;
}

export function jstToday(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// ───────────────────────────────────────────── 日程

/**
 * ワールドシリーズの最終戦の日付（ET）。決着前は null。
 * FA解禁・QO期限はここから数える＝決着した瞬間に日程表の「WS終了の5日後」が実日付に変わる。
 */
export async function worldSeriesEnd(season: number): Promise<string | null> {
  const cur = await getPostseason();
  const data =
    cur?.season === season ? cur : (await getPostseasonArchive()).find((a) => a.season === season) ?? null;
  if (!data?.champion) return null;
  const ws = data.series.find((s) => s.round === 'W');
  const finals = (ws?.games ?? []).filter((g) => g.state === 'Final').map((g) => g.etDate).sort();
  return finals.at(-1) ?? null;
}

export type WsState = {
  done: boolean;
  lead?: { ja: string; en: string; wins: number };
  trail?: { ja: string; en: string; wins: number };
  /** 次の試合（JST の日付）。決着後は無し。 */
  next?: { n: number | null; jst: string };
};

/**
 * ワールドシリーズの現在地。「FA いつから」で来た人には、決着前は「あと何勝で決まるか」が答えになる。
 * 値は postseason.json（毎時CI）の再表示だけ。
 */
export async function worldSeriesState(season: number): Promise<WsState | null> {
  const cur = await getPostseason();
  if (!cur || cur.season !== season) return null;
  const ws = cur.series.find((s) => s.round === 'W');
  if (!ws?.top?.id || !ws.bottom?.id) return null;
  const [a, b] = (ws.top.wins ?? 0) >= (ws.bottom.wins ?? 0) ? [ws.top, ws.bottom] : [ws.bottom, ws.top];
  const label = (x: typeof a) => {
    const t = getTeamById(x.id);
    return { ja: x.nameJa ?? t?.nameJa ?? '', en: t?.info.nameEn ?? '', wins: x.wins ?? 0 };
  };
  const upcoming = ws.games.find((g) => g.state !== 'Final');
  return {
    done: Boolean(cur.champion),
    lead: label(a),
    trail: label(b),
    next:
      !cur.champion && upcoming?.start
        ? { n: upcoming.n, jst: new Date(new Date(upcoming.start).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10) }
        : undefined,
  };
}

export { fmtDate } from './format';

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type ResolvedDate = StoveDate & { on: string | null; past: boolean };

/** 日程を実日付（JST）に解決して日付順に並べる。WS決着前の相対日は on=null のまま。 */
export function resolveDates(cat: StoveCatalog, wsEnd: string | null, today = jstToday()): ResolvedDate[] {
  const rows = cat.dates.map((d) => {
    const on =
      d.date ?? (wsEnd && d.afterWs != null ? addDays(wsEnd, d.afterWs + (d.jstShift ?? 0)) : null);
    const last = d.end ?? on;
    return { ...d, on, past: last ? last < today : false };
  });
  // 決着前の相対日は、例年の最遅（10月31日決着）で仮置きして並べる＝GM会議との前後が大きく崩れない。
  const key = (r: ResolvedDate) => r.on ?? addDays(`${cat.season}-10-31`, r.afterWs ?? 0);
  return rows.sort((a, b) => key(a).localeCompare(key(b)));
}

// ───────────────────────────────────────────── 海外の反応

/**
 * ハブに集める記事のタグ。オフの話題（FA・オプトアウト・ポスティング）を語っている記事だけ。
 * ポスティングは NEXT MLB と共有＝佐藤輝明の容認記事は /prospects にも /stove-league にも並ぶ。
 */
export const STOVE_TAGS = ['ストーブリーグ', 'FA', 'オプトアウト', 'ポスティング', 'ロックアウト'] as const;

export function stoveThreads(threads: Thread[], season: number): Thread[] {
  const from = `${season}-09-29`;
  const until = `${season + 1}-03-31`;
  return threads
    .filter((t) => t.fetchedAt >= from && t.fetchedAt < until)
    .filter((t) => (t.tags ?? []).some((tag) => (STOVE_TAGS as readonly string[]).includes(tag)))
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
}

/**
 * FA一覧の外国人選手の行き先。選手LPが無いので、その選手を語ったオフの記事があればそこへ送る
 * （無ければリンクしない＝行き止まりのタグLPには送らない）。タグはカタカナの姓だけのことが多い
 * （「タリク・スクーバル」の記事のタグは「スクーバル」）ので、フルネームと姓の両方で引く。
 */
export function articleFor(threads: Thread[], labelJa: string): Thread | null {
  const keys = [labelJa, labelJa.split('・').at(-1) ?? labelJa];
  return threads.find((t) => (t.tags ?? []).some((tag) => keys.includes(tag))) ?? null;
}

/** その選手の名前タグが付いたオフ記事から、いちばん前に出したい1件（フック＞ハイライト）を拾う。 */
export function voiceFor(
  threads: Thread[],
  nameJa: string,
): { thread: Thread; comment: ThreadComment } | null {
  for (const t of threads) {
    if (!(t.tags ?? []).includes(nameJa)) continue;
    const c = t.comments?.find((x) => x.isHook) ?? t.comments?.find((x) => x.isHighlight) ?? t.comments?.[0];
    if (c) return { thread: t, comment: c };
  }
  return null;
}

// ───────────────────────────────────────────── 表記

export const ROUTE_LABEL: Record<StoveRoute, Bi> = {
  fa: { ja: 'FA', en: 'Free agent' },
  'opt-out': { ja: 'オプトアウト権', en: 'Opt-out' },
  'club-option': { ja: '球団オプション', en: 'Club option' },
  posting: { ja: 'ポスティング', en: 'Posting' },
};

export const OUTCOME_LABEL: Record<StoveOutcome['kind'], Bi> = {
  signed: { ja: '契約', en: 'Signed' },
  're-signed': { ja: '再契約', en: 'Re-signed' },
  stayed: { ja: '残留', en: 'Stayed' },
  retired: { ja: '引退', en: 'Retired' },
};

/** 表の成績1行（数値はすべて statsapi の値＝ここで計算しない）。 */
export function statLine(s: StovePlayerStats | undefined, en: boolean): string {
  if (!s) return '';
  if (s.pitching) {
    const p = s.pitching;
    const role = p.gs > 0 ? (en ? `${p.gs} GS` : `${p.gs}先発`) : en ? `${p.g} G` : `${p.g}登板`;
    const extra = p.gs === 0 && p.sv > 0 ? (en ? `, ${p.sv} SV` : `・${p.sv}セーブ`) : '';
    return en
      ? `${role}, ${p.era} ERA, ${p.ip} IP, ${p.so} K${extra}`
      : `${role}・防御率${p.era}・${p.ip}回・${p.so}奪三振${extra}`;
  }
  if (s.hitting) {
    const h = s.hitting;
    return en
      ? `${h.avg}, ${h.hr} HR, ${h.ops} OPS${h.sb >= 15 ? `, ${h.sb} SB` : ''}`
      : `打率${h.avg}・${h.hr}本塁打・OPS${h.ops}${h.sb >= 15 ? `・${h.sb}盗塁` : ''}`;
  }
  return '';
}

/** statsapi の動きのうち「新しい球団と契約した」ものだけ（FA宣言やトレード前の移動は除く）。 */
export function latestSigning(s: StovePlayerStats | undefined): StoveMove | null {
  const signed = (s?.moves ?? []).filter((m) => m.type === 'Signed as Free Agent' || m.type === 'Signed');
  return signed.at(-1) ?? null;
}

function teamBi(id: number | null | undefined): Bi | undefined {
  const t = getTeamById(id);
  return t ? { ja: t.nameJa, en: t.info.nameEn } : undefined;
}

/** 2026年の所属（移籍順）。NPB 組は data に書いた球団名。 */
export function teamPath(row: { team?: Bi }, s: StovePlayerStats | undefined): Bi | undefined {
  if (row.team) return row.team;
  const teams = (s?.teamIds ?? []).map(teamBi).filter((t): t is Bi => Boolean(t));
  if (!teams.length) return undefined;
  return { ja: teams.map((t) => t.ja).join(' → '), en: teams.map((t) => t.en).join(' → ') };
}

/**
 * いまの状況。人が書いた決着（outcome）＞ statsapi の契約記録 ＞ オプトアウト行使（FA宣言）＞ 道筋、の順。
 * statsapi の記録だけで「契約」を出すのは球団名まで＝年数・金額は報道を見て人が outcome に書くまで出さない。
 */
export function rowStatus(
  route: StoveRoute,
  outcome: StoveOutcome | undefined,
  s: StovePlayerStats | undefined,
  /** FA解禁（ワールドシリーズ決着の翌日）を過ぎたか。前は「FA予定」と出す＝まだFAではないものをFAと書かない。 */
  faOpen = true,
): { label: Bi; done: boolean; team?: Bi; terms?: Sourced } {
  if (outcome) return { label: OUTCOME_LABEL[outcome.kind], done: true, team: outcome.team, terms: outcome };
  const sign = latestSigning(s);
  if (sign?.toTeamId) {
    const same = sign.toTeamId === s?.lastTeamId;
    return { label: OUTCOME_LABEL[same ? 're-signed' : 'signed'], done: true, team: teamBi(sign.toTeamId) };
  }
  if (route === 'opt-out' && s?.moves.some((m) => m.type === 'Declared Free Agency')) {
    return { label: { ja: 'オプトアウトしてFA', en: 'Opted out' }, done: false };
  }
  if (route === 'fa' && !faOpen) return { label: { ja: 'FA予定', en: 'Pending FA' }, done: false };
  return { label: ROUTE_LABEL[route], done: false };
}

// ───────────────────────────────────────────── FAQ（画面と FAQPage JSON-LD が同じ配列を使う）

/**
 * 答えはこのページに載っている事実の言い換えだけ（制度は出典つきの日程・QO額、選手は data の状況）。
 * 日本人の顔ぶれは japanese[] から毎回組み直す＝決着した選手が出たら答えも変わる。
 */
export function buildStoveFaq(
  cat: StoveCatalog,
  names: Record<string, Bi>,
  wsEnd: string | null,
  npbPosting: Bi[],
): FaqItem[] {
  const jp = (route: StoveRoute) => cat.japanese.filter((j) => j.route === route && !j.outcome);
  const list = (rows: JpStove[], en: boolean) =>
    rows.map((r) => (en ? names[r.slug]?.en : names[r.slug]?.ja) ?? r.slug).join(en ? ', ' : '・');
  const fa = jp('fa');
  const opt = jp('opt-out');
  const offseason = `${cat.season}-${String((cat.season + 1) % 100).padStart(2, '0')}`;
  const faOpen = wsEnd ? addDays(wsEnd, 1) : null;
  const md = (iso: string) => `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日`;
  const mdEn = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

  const items: FaqItem[] = [
    {
      q: { ja: `${offseason}年のオフにFAになる日本人選手は誰？`, en: `Which Japanese players are free agents this ${offseason} offseason?` },
      a: {
        ja: `契約が終わってFAになるのは${list(fa, false)}。${opt.length ? `${list(opt, false)}は契約を途中で破棄できるオプトアウト権を持ち、ワールドシリーズ終了から5日以内に市場に出るか決める。` : ''}${npbPosting.length ? `NPBからは${npbPosting.map((n) => n.ja).join('・')}がポスティングなどでMLB挑戦を目指している。` : ''}`,
        en: `Players whose contracts are up: ${list(fa, true)}.${opt.length ? ` ${list(opt, true)} hold opt-outs and must decide within five days of the World Series.` : ''}${npbPosting.length ? ` From NPB, ${npbPosting.map((n) => n.en).join(', ')} are pursuing MLB moves.` : ''}`,
      },
    },
    {
      q: { ja: 'MLBのFAはいつから始まる？', en: 'When does MLB free agency start?' },
      a: {
        ja: `ワールドシリーズ終了の翌日に選手がFAになる。最初の5日間は元の球団としか契約できず、5日後からは全球団と契約できる。${faOpen ? `今オフはワールドシリーズが現地${md(wsEnd!)}に終わったので、FAは${md(faOpen)}から。` : ''}`,
        en: `Players become free agents the day after the World Series. For the first five days they can sign only with their former club; after that, any team can sign them.${faOpen ? ` This year the World Series ended on ${mdEn(wsEnd!)}, so free agency opened on ${mdEn(faOpen)}.` : ''}`,
      },
    },
    {
      q: { ja: 'クオリファイング・オファー（QO）とは？', en: 'What is a qualifying offer?' },
      a: {
        ja: `FAになる選手に元の球団が出せる1年契約の提示。今オフの金額は${cat.qualifyingOffer.amountJa}。選手は10日以内に受けるか決め、断って他球団と契約すると、その球団はドラフト指名権を失い、元の球団は補償の指名権を得る。シーズン途中に移籍してきた選手や、一度QOを受けたことがある選手には出せない。`,
        en: `A one-year offer a club can make to its departing free agent. This winter it is worth ${cat.qualifyingOffer.amountEn}. The player has ten days to accept; if he declines and signs elsewhere, the signing club forfeits a draft pick and the old club gets one. Players traded midseason or who have accepted a QO before cannot receive one.`,
      },
    },
    {
      q: { ja: '今永昇太にQOが付かないのはなぜ？', en: 'Why can’t Shota Imanaga get a qualifying offer?' },
      a: {
        ja: '昨オフにカブスのQOを受け入れて1年契約で残留したため。QOを一度受けた選手には二度目を出せないので、今永を獲った球団はドラフト指名権を失わない。',
        en: 'He accepted the Cubs’ qualifying offer last winter, and a player who has accepted one cannot receive another, so signing him costs a club no draft pick.',
      },
    },
    {
      q: { ja: 'オプトアウトとは？', en: 'What is an opt-out?' },
      a: {
        ja: `複数年契約の途中で、選手が残りの契約を破棄してFAになれる権利。判断の期限はワールドシリーズ終了から5日後。${opt.length ? `日本人では${list(opt, false)}が今オフに権利を持つ。` : ''}`,
        en: `A player’s right to walk away from the rest of a multi-year deal and become a free agent. The decision is due five days after the World Series.${opt.length ? ` ${list(opt, true)} hold one this winter.` : ''}`,
      },
    },
    {
      q: { ja: '12月にロックアウトになるとFA交渉はどうなる？', en: 'What happens to free agency if there is a lockout in December?' },
      a: {
        ja: '現行の労使協定は現地時間12月1日（日本時間12月2日午後）に期限を迎え、新しい協定がなければそのままロックアウトに入る見込み。その間は契約もトレードも止まり、球団と選手は連絡も取れない。前回は2021年12月2日から2022年3月10日まで続き、直前の11月末に大型契約が相次いだ。',
        en: 'The current CBA expires on December 1 (ET), and a lockout is expected from December 2 without a new deal. Signings and trades freeze and clubs cannot contact players. The last one ran from December 2, 2021 to March 10, 2022, and a flurry of big deals came right before it.',
      },
    },
    {
      q: { ja: 'ポスティングとFAの違いは？', en: 'How is posting different from free agency?' },
      a: {
        ja: 'FAは選手本人が自由に球団を選べる。ポスティングはNPBの球団が認めて初めて申請でき、MLB球団との交渉期間は45日間、契約した球団はNPBの球団に譲渡金を払う。期間内にまとまらなければ元の球団に戻る。',
        en: 'A free agent chooses freely. A posted NPB player needs his club’s approval, gets a 45-day window to negotiate, and the signing team pays a release fee to his NPB club; if no deal is reached he returns to Japan.',
      },
    },
  ];
  return items;
}
