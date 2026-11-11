import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPlayer, getPlayerByMlbId } from './players';
import { playerLabel } from './playerNames';
import { getTeamById } from './teams';
import { prospectsOnTheMove } from './npbPlayers';
import {
  faStatus,
  getStoveLeague,
  getStoveStats,
  stoveActive,
  worldSeriesEnd,
  offseasonLabel,
  type StoveCatalog,
  type StoveStats,
} from './stoveLeague';

/**
 * 移籍情報（/stove-league/moves）と球団LPのオフの欄の読み手。
 *
 * 元データは `data/stove-moves.json`＝scripts/fetch-stove-moves.mjs が MLB公式の取引記録から3時間ごとに作る
 * （人は触らない）。ここは行を日本語に組み立てるだけで、新しい事実は作らない。
 * 契約の年数・金額は取引記録に無いので、FA一覧の outcome（人が出典つきで書いたもの）がある選手だけ添える。
 */

export type MoveKind = 'signing' | 'trade' | 'waiver' | 'released' | 'retired' | 'fa';

export type RawMove = {
  id: string;
  kind: MoveKind;
  /** 米東部の日付（取引記録の日付）。 */
  date: string;
  playerId?: number;
  nameEn?: string;
  fromTeamId?: number | null;
  toTeamId?: number | null;
  minor?: boolean;
  /** MLB公式の記録の文（英語）。 */
  desc: string;
  /** トレードだけ: 動いた選手と関わった球団。 */
  players?: { id: number; nameEn: string; fromTeamId: number | null; toTeamId: number | null }[];
  teamIds?: number[];
  /** 3＝日本人／2＝FA注目30人か今季成績が大物の水準／1＝それ以外。 */
  tier: number;
};

export type MovesFile = {
  asOf: string;
  season: number;
  /** 記録を拾い始めた日（FA解禁の日・米東部）。 */
  from: string;
  players: Record<string, { nameEn: string; pos: string | null; big: boolean }>;
  moves: RawMove[];
};

let cache: MovesFile | null | undefined;

export async function getStoveMoves(): Promise<MovesFile | null> {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'stove-moves.json'), 'utf8')) as MovesFile;
  } catch {
    cache = null; // 無ければページは 404・球団LPの欄も出ない
  }
  return cache;
}

/** 画面に出す1行（クライアントの絞り込みに渡すので、文字列まで組んでおく）。 */
export type MoveRow = {
  id: string;
  kind: Exclude<MoveKind, 'fa'>;
  date: string;
  /** 「カブスが◯◯と契約」のように組んだ1文。 */
  text: string;
  /** 関わった選手（選手LPがあればリンク）。 */
  players: { name: string; href?: string }[];
  /** 絞り込み用。関わった球団のID。 */
  teamIds: number[];
  minor: boolean;
  tier: number;
  japanese: boolean;
  /** 契約の中身（FA一覧の outcome から。出典つき）。 */
  terms?: { text: string; source: string; sourceName: string };
  /** MLB公式の記録の文（英語のまま）。 */
  desc: string;
};

export type MoveDay = {
  date: string;
  /** 主な動き（トレード・メジャー契約・注目選手の動き）。 */
  main: MoveRow[];
  /** そのほか（マイナー契約・ウェーバー・自由契約）。 */
  other: MoveRow[];
  /** この日にFAになった人数と、そのうちの注目選手。 */
  fa?: { count: number; notable: { name: string; href?: string }[] };
};

const teamName = (id: number | null | undefined, en: boolean): string => {
  const t = getTeamById(id);
  return t ? (en ? t.info.nameEn : t.nameJa) : '';
};

/** 主な動きか（トレード・マイナー契約でない契約・注目選手の動き）。それ以外は日ごとに畳む。 */
const isMain = (m: RawMove) => m.kind === 'trade' || (m.kind === 'signing' && !m.minor) || m.tier >= 2;

async function nameOf(nameEn: string, id: number, locale: string): Promise<{ name: string; href?: string }> {
  const l = await playerLabel(nameEn, { locale, mlbId: id });
  return { name: l.label, href: l.slug ? `/player/${l.slug}` : undefined };
}

async function toRow(m: RawMove, file: MovesFile, cat: StoveCatalog | null, locale: string): Promise<MoveRow> {
  const en = locale === 'en';
  if (m.kind === 'trade') {
    const ps = await Promise.all((m.players ?? []).map((p) => nameOf(p.nameEn, p.id, locale)));
    const teams = (m.teamIds ?? []).map((id) => teamName(id, en)).filter(Boolean);
    const moved = (m.players ?? [])
      .map((p, i) => `${ps[i].name}（${en ? 'to ' : ''}${teamName(p.toTeamId, en)}${en ? '' : 'へ'}）`)
      .join(en ? ', ' : '、');
    // 金銭・後日指名の相手は選手の行が無い＝公式の説明文から拾う（訳を作らず、ある・ないだけ見る）。
    const cash = /for cash/i.test(m.desc);
    const ptbnl = /player to be named/i.test(m.desc);
    const extra = [cash ? (en ? 'cash' : '金銭') : '', ptbnl ? (en ? 'a player to be named later' : '後日指名の選手') : '']
      .filter(Boolean)
      .join(en ? ' and ' : '・');
    return {
      id: m.id,
      kind: 'trade',
      date: m.date,
      text: en
        ? `Trade between the ${teams.join(' and the ')}: ${moved}${extra ? ` (plus ${extra})` : ''}`
        : `${teams.join('と')}がトレード：${moved}${extra ? `（交換相手に${extra}）` : ''}`,
      players: ps,
      teamIds: m.teamIds ?? [],
      minor: false,
      tier: m.tier,
      japanese: (m.players ?? []).some((p) => isJapanese(p.id)),
      desc: m.desc,
    };
  }
  const p = await nameOf(m.nameEn ?? '', m.playerId ?? 0, locale);
  const from = teamName(m.fromTeamId, en);
  const to = teamName(m.toTeamId, en);
  // 同じ球団からFAになって同じ球団と契約＝再契約（取引記録の2件を突き合わせるだけ）。
  const resigned =
    m.kind === 'signing' &&
    file.moves.some((x) => x.kind === 'fa' && x.playerId === m.playerId && x.fromTeamId && x.fromTeamId === m.toTeamId);
  const text = (() => {
    switch (m.kind) {
      case 'signing':
        return en
          ? `${to} ${resigned ? 're-signed' : 'signed'} ${p.name}${m.minor ? ' to a minor league deal' : ''}`
          : `${to}が${p.name}と${m.minor ? 'マイナー契約' : resigned ? '再契約' : '契約'}`;
      case 'waiver':
        return en ? `${to} claimed ${p.name} off waivers from the ${from}` : `${to}が${p.name}をウェーバーで獲得（${from}から）`;
      case 'released':
        return en ? `${from} released ${p.name}` : `${from}が${p.name}を自由契約に`;
      default:
        return en ? `${p.name} retired${from ? ` (${from})` : ''}` : `${p.name}が引退${from ? `（${from}）` : ''}`;
    }
  })();
  // 契約の中身は FA一覧に人が書いた決着（出典つき）がある選手だけ。
  const out = m.kind === 'signing' ? cat?.board.find((b) => b.mlbId === m.playerId)?.outcome : undefined;
  return {
    id: m.id,
    kind: m.kind as MoveRow['kind'],
    date: m.date,
    text,
    players: [p],
    teamIds: [m.fromTeamId, m.toTeamId].filter((x): x is number => typeof x === 'number'),
    minor: Boolean(m.minor),
    tier: m.tier,
    japanese: isJapanese(m.playerId),
    terms: out ? { text: en ? out.en : out.ja, source: out.source, sourceName: out.sourceName } : undefined,
    desc: m.desc,
  };
}

/** カタログ（players.ts）の日本人選手か。比較用に載せている外国人（rival）は数えない。 */
function isJapanese(id?: number): boolean {
  if (!id) return false;
  const p = getPlayerByMlbId(id);
  return Boolean(p && !p.rival);
}

/** 日付ごとに「主な動き／そのほか／この日FAになった選手」へ分ける（新しい日が上）。 */
export async function buildMoveDays(file: MovesFile, cat: StoveCatalog | null, locale: string): Promise<MoveDay[]> {
  const byDate = new Map<string, RawMove[]>();
  for (const m of file.moves) {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date)!.push(m);
  }
  const days: MoveDay[] = [];
  for (const [date, list] of [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const acts = list.filter((m) => m.kind !== 'fa');
    const rows = await Promise.all(acts.map((m) => toRow(m, file, cat, locale)));
    const main = rows.filter((_, i) => isMain(acts[i]));
    const other = rows.filter((_, i) => !isMain(acts[i]));
    const fas = list.filter((m) => m.kind === 'fa');
    const notable = await Promise.all(
      fas
        .filter((m) => m.tier >= 2)
        .sort((a, b) => b.tier - a.tier)
        .slice(0, 14)
        .map((m) => nameOf(m.nameEn ?? '', m.playerId ?? 0, locale)),
    );
    days.push({ date, main, other, fa: fas.length ? { count: fas.length, notable } : undefined });
  }
  return days;
}

/** 件数（題の下の1文と説明文に使う）。すべて data からの数え上げ。 */
export function moveCounts(file: MovesFile) {
  const n = (k: MoveKind) => file.moves.filter((m) => m.kind === k).length;
  return {
    signings: n('signing'),
    majorSignings: file.moves.filter((m) => m.kind === 'signing' && !m.minor).length,
    trades: n('trade'),
    waivers: n('waiver'),
    released: n('released'),
    fa: n('fa'),
  };
}

/** 絞り込みに出す球団（記録に出てきた球団だけ・日本語名の順）。 */
export function moveTeams(file: MovesFile, en: boolean): { id: number; name: string }[] {
  const ids = new Set<number>();
  for (const m of file.moves) {
    if (m.kind === 'fa') continue;
    for (const id of [m.fromTeamId, m.toTeamId, ...(m.teamIds ?? [])]) if (typeof id === 'number') ids.add(id);
  }
  return [...ids]
    .map((id) => ({ id, name: teamName(id, en) }))
    .filter((t) => t.name)
    .sort((a, b) => a.name.localeCompare(b.name, en ? 'en' : 'ja'));
}

// ───────────────────────────────────────────── 球団LPの「オフの欄」

export type TeamOffseasonData = {
  /** 加入（契約・トレードで獲得・ウェーバーで獲得）。 */
  in: MoveRow[];
  /** 退団（トレードで放出・ウェーバーで移籍・自由契約・引退）。 */
  out: MoveRow[];
  /** この球団からFAになった選手（注目選手を先に）と人数。 */
  fa: { count: number; names: { name: string; href?: string; tier: number }[] };
  asOf: string;
};

/**
 * 1球団ぶんの今オフの出入り。行は移籍情報と同じ data の並べ替えだけ。
 * トレードは両方の球団に出る（獲った選手がいれば加入、出した選手がいれば退団）。
 */
export async function teamOffseason(
  teamId: number,
  file: MovesFile,
  cat: StoveCatalog | null,
  locale: string,
): Promise<TeamOffseasonData> {
  const mine = file.moves.filter(
    (m) => m.kind !== 'fa' && (m.fromTeamId === teamId || m.toTeamId === teamId || (m.teamIds ?? []).includes(teamId)),
  );
  const rows = await Promise.all(mine.map((m) => toRow(m, file, cat, locale)));
  const inRows: MoveRow[] = [];
  const outRows: MoveRow[] = [];
  mine.forEach((m, i) => {
    if (m.kind === 'trade') {
      if ((m.players ?? []).some((p) => p.toTeamId === teamId)) inRows.push(rows[i]);
      if ((m.players ?? []).some((p) => p.fromTeamId === teamId)) outRows.push(rows[i]);
      return;
    }
    if (m.toTeamId === teamId) inRows.push(rows[i]);
    else outRows.push(rows[i]);
  });
  // FAになって他球団と契約した選手も退団に数える。取引記録の「契約」の行は元の球団を持たない
  // （fromTeam が空）＝この球団のFA宣言と、同じ選手の他球団との契約を突き合わせて組む。
  const en = locale === 'en';
  const leftIds = new Set(file.moves.filter((m) => m.kind === 'fa' && m.fromTeamId === teamId).map((m) => m.playerId));
  const gone = file.moves.filter(
    (m) => m.kind === 'signing' && m.toTeamId !== teamId && m.playerId != null && leftIds.has(m.playerId),
  );
  for (const m of gone) {
    const row = await toRow(m, file, cat, locale);
    const to = teamName(m.toTeamId, en);
    const who = row.players[0]?.name ?? m.nameEn ?? '';
    outRows.push({
      ...row,
      id: `${row.id}-left`,
      text: en
        ? `${who} left as a free agent and signed with the ${to}${m.minor ? ' (minor league deal)' : ''}`
        : `${who}がFAで${to}へ移籍${m.minor ? '（マイナー契約）' : ''}`,
    });
  }
  outRows.sort((a, b) => b.date.localeCompare(a.date));
  const fas = file.moves.filter((m) => m.kind === 'fa' && m.fromTeamId === teamId).sort((a, b) => b.tier - a.tier);
  const names = await Promise.all(
    fas.map(async (m) => ({ ...(await nameOf(m.nameEn ?? '', m.playerId ?? 0, locale)), tier: m.tier })),
  );
  return { in: inRows, out: outRows, fa: { count: fas.length, names }, asOf: file.asOf };
}


/** 球団LPの「オフの欄」のうち、FA一覧・去就の data から引くぶん（FAになった主力と、関心が報じられた選手）。 */
export type TeamStoveSide = {
  /** この球団からFAになった、FA注目ランキングの選手（順位順）。 */
  fas: { name: string; href?: string; rank: number; label: { ja: string; en: string }; done: boolean; team?: { ja: string; en: string } }[];
  /** この球団の関心が報じられている選手（日本人の去就・ポスティング・FA一覧の suitors を逆引き）。 */
  linked: { name: string; href: string }[];
};

export async function teamStoveSide(opts: {
  teamId: number;
  teamNameJa: string;
  cat: StoveCatalog;
  stats: StoveStats;
  locale: string;
  faOpen: boolean;
}): Promise<TeamStoveSide> {
  const { teamId, teamNameJa, cat, stats, locale, faOpen } = opts;
  const en = locale === 'en';
  const fas = await Promise.all(
    cat.board
      .filter((b) => b.mlbId && stats.players[String(b.mlbId)]?.lastTeamId === teamId)
      .map(async (b) => {
        const st = faStatus(b, stats.players[String(b.mlbId)], faOpen);
        const n = await nameOf(b.nameEn, b.mlbId!, locale);
        // 予想契約（他社の数字）はここには出さない＝出どころを添えられる FA一覧のページだけに置く。
        return { ...n, rank: b.rank, label: st.label, done: st.done, team: st.team };
      }),
  );
  const linked: { name: string; href: string }[] = [];
  const hit = (s?: { ja: string }[]) => Boolean(s?.some((x) => x.ja === teamNameJa));
  for (const j of cat.japanese) {
    if (j.outcome || !hit(j.suitors)) continue;
    const p = getPlayer(j.slug);
    if (p) linked.push({ name: en ? p.nameEn : p.nameJa, href: `/player/${p.slug}` });
  }
  for (const j of cat.stars ?? []) {
    if (j.outcome || !hit(j.suitors)) continue;
    const p = getPlayer(j.slug);
    if (p) linked.push({ name: en ? p.nameEn : p.nameJa, href: `/player/${p.slug}` });
  }
  for (const p of prospectsOnTheMove()) {
    if (p.postingWatch?.steps?.signed || !hit(p.postingWatch?.suitors)) continue;
    linked.push({ name: en ? p.nameEn : p.nameJa, href: `/prospects/${p.slug}` });
  }
  for (const b of cat.board) {
    if (b.jpSlug || b.prospectSlug || b.outcome || !hit(b.suitors)) continue;
    if (cat.stars?.some((s) => getPlayer(s.slug)?.mlbId === b.mlbId)) continue; // stars[] で出した選手を重ねない
    const n = await nameOf(b.nameEn, b.mlbId ?? 0, locale);
    linked.push({ name: n.name, href: n.href ?? '/stove-league/fa' });
  }
  return { fas: fas.sort((a, b) => a.rank - b.rank), linked };
}

/** 球団LPのオフの欄ひとつぶん（画面と説明文が同じ値を使う）。 */
export type TeamOffseasonBlock = { data: TeamOffseasonData; side: TeamStoveSide; off: string };

/**
 * 球団LPに出すオフの欄を組む。オフの期間外（activeUntil を過ぎた）・FA解禁前（WS決着前）・
 * 取引記録がまだ無い・その球団に出すものが1つも無い、のどれかなら null＝欄ごと出さない。
 */
export async function teamOffseasonBlock(teamId: number, teamNameJa: string, locale: string): Promise<TeamOffseasonBlock | null> {
  const [cat, file] = await Promise.all([getStoveLeague(), getStoveMoves()]);
  if (!cat || !file || file.season !== cat.season || !stoveActive(cat)) return null;
  const [stats, wsEnd] = await Promise.all([getStoveStats(), worldSeriesEnd(cat.season)]);
  if (!wsEnd) return null;
  const [data, side] = await Promise.all([
    teamOffseason(teamId, file, cat, locale),
    teamStoveSide({ teamId, teamNameJa, cat, stats, locale, faOpen: true }),
  ]);
  if (data.in.length + data.out.length + data.fa.count + side.fas.length + side.linked.length === 0) return null;
  return { data, side, off: offseasonLabel(cat.season) };
}

/** 検索結果の説明文に入れる、補強の現在地の1文（数は取引記録からの数え上げだけ）。 */
export function teamOffseasonSentenceJa(b: TeamOffseasonBlock): string {
  const fa = b.data.fa.count ? `、FAになった選手は${b.data.fa.count}人` : '';
  // 出入りがまだ無い球団に「加入0件・退団0件」と並べない（検索結果の説明文に出る）。
  const moves =
    b.data.in.length + b.data.out.length === 0
      ? '加入・退団ともまだ動きなし'
      : `加入${b.data.in.length}件・退団${b.data.out.length}件`;
  return `${b.off}オフの補強は${moves}${fa}。`;
}
