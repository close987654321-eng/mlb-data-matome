import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Locale } from './i18n';

/**
 * NEXT MLB 選手LP（/prospects/[slug]）が読む NPB 成績。
 *
 * 正は `data/npb-prospects-stats.json`＝`scripts/fetch-npb-stats.mjs` が NPB公式（npb.jp）から
 * 取得して書き出す静的JSON。**サイト本体は npb.jp を叩かない**（jp-players-stats.json と同じ posture）。
 *
 * なぜカタログ（npbPlayers.ts）から分けたか: 成績は手入力だったため 2026-06-29 の数値が 09-13 まで
 * 据え置かれ、ポスティング報道で読者が最も来る時期に「3か月前の成績」を出していた。数値を機械に、
 * 編集判断（評価・報道・FAQ）を人に、と担当を割った。
 */

/** 投手の年度別1行（NPB公式の列そのまま。数値は文字列＝公式の表記を崩さない）。 */
export type NpbPitchingRow = {
  year: string; team: string; g: string; w: string; l: string; sv: string; hld: string;
  ip: string; h: string; hr: string; bb: string; so: string; er: string; era: string;
};
/** 打者の年度別1行（同上）。 */
export type NpbBattingRow = {
  year: string; team: string; g: string; pa: string; ab: string; h: string; hr: string;
  rbi: string; sb: string; bb: string; so: string; avg: string; slg: string; obp: string;
};
export type NpbRank = {
  ja: string; en: string; league: 'CL' | 'PL'; rank: number; value: string; url: string;
};
export type NpbPlayerStats = {
  npbId: string;
  sourceUrl: string;
  kind: 'pitching' | 'batting';
  profile: Record<string, string>;
  career: (NpbPitchingRow | NpbBattingRow)[];
  season: Record<string, string> | null;
  ranks: NpbRank[];
};
export type NpbStats = {
  /** 取得日（JST）。CI の「今日はもう取った」ゲートが読む値で、画面には出さない。 */
  npbFetchedAt?: string;
  /** NPB公式リーダーズの「◯月◯日現在」＝画面に出す集計時点。 */
  asOf: string;
  season: number;
  players: Record<string, NpbPlayerStats>;
};

const FILE = path.join(process.cwd(), 'data', 'npb-prospects-stats.json');
let cache: NpbStats | null = null;

async function load(): Promise<NpbStats> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as NpbStats;
  } catch {
    // 未生成でもビルドは通す（LPは成績ブロックを出さずに他のセクションだけ描く）
    cache = { asOf: '', season: 0, players: {} };
  }
  return cache;
}

export async function getNpbStats(): Promise<NpbStats> {
  return load();
}

export async function getNpbPlayerStats(slug: string): Promise<NpbPlayerStats | null> {
  return (await load()).players[slug] ?? null;
}

/** 見出しに出す5指標（投手＝登板/防御率/勝敗/投球回/奪三振、打者＝試合/打率/本塁打/打点/OPS）。 */
export function headlineStats(
  s: NpbPlayerStats,
  locale: Locale,
): { label: string; value: string }[] {
  const row = s.season;
  if (!row) return [];
  const en = locale === 'en';
  if (s.kind === 'pitching') {
    return [
      { label: en ? 'G' : '登板', value: row['登板'] ?? '' },
      { label: en ? 'ERA' : '防御率', value: row['防御率'] ?? '' },
      { label: en ? 'W-L' : '勝-敗', value: `${row['勝利'] ?? ''}-${row['敗北'] ?? ''}` },
      { label: en ? 'IP' : '投球回', value: row['投球回'] ?? '' },
      { label: en ? 'SO' : '奪三振', value: row['三振'] ?? '' },
    ].filter((x) => x.value && x.value !== '-');
  }
  return [
    { label: en ? 'G' : '試合', value: row['試合'] ?? '' },
    { label: en ? 'AVG' : '打率', value: row['打率'] ?? '' },
    { label: en ? 'HR' : '本塁打', value: row['本塁打'] ?? '' },
    { label: en ? 'RBI' : '打点', value: row['打点'] ?? '' },
    { label: 'OPS', value: ops(row) },
  ].filter((x) => x.value && x.value !== '-');
}

/**
 * OPS は NPB公式が持たないので出塁率＋長打率から出す（定義そのままの足し算＝独自の推計ではない）。
 * 片方でも欠けたら空を返す＝無い数字を作らない。
 */
function ops(row: Record<string, string>): string {
  const obp = Number(row['出塁率']);
  const slg = Number(row['長打率']);
  if (!Number.isFinite(obp) || !Number.isFinite(slg) || !row['出塁率'] || !row['長打率']) return '';
  return (obp + slg).toFixed(3).replace(/^0/, '');
}

/** リーグ内トップ3の部門だけ（「いま何を獲りにいっているか」）。 */
export function topRanks(s: NpbPlayerStats, limit = 6): NpbRank[] {
  return s.ranks
    .filter((r) => r.rank <= 3)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

const LEAGUE_JA = { CL: 'セ・リーグ', PL: 'パ・リーグ' } as const;
const LEAGUE_EN = { CL: 'the Central League', PL: 'the Pacific League' } as const;

/**
 * LP の H1 直下に置く「今季の地の文」。数値は実在値だけを使い、無い値は文ごと落とす（捏造しない）。
 * 狙いは MLB 側の選手ハブ（playerLede）と同じ＝数値表だけの薄いページにせず、選手ごとに違う散文で
 * 「{選手名} 成績」「{選手名} 防御率」まで面を広げる。
 */
export function prospectLede(
  name: string,
  teamName: string,
  s: NpbPlayerStats,
  locale: Locale,
): string {
  const row = s.season;
  if (!row) return '';
  const en = locale === 'en';
  const year = row['年度'];
  const tops = topRanks(s, 3);
  const league = s.ranks[0]?.league;

  if (!en) {
    const out: string[] = [];
    if (s.kind === 'pitching') {
      const bits = [
        row['登板'] && `${row['登板']}登板`,
        row['勝利'] && row['敗北'] && `${row['勝利']}勝${row['敗北']}敗`,
        row['防御率'] && `防御率${row['防御率']}`,
        row['投球回'] && `${row['投球回']}回`,
        row['三振'] && `${row['三振']}奪三振`,
      ].filter(Boolean);
      out.push(`${name}は${year}年、${teamName}で${bits.join('・')}。`);
    } else {
      const bits = [
        row['試合'] && `${row['試合']}試合`,
        row['打率'] && `打率${row['打率']}`,
        row['本塁打'] && `${row['本塁打']}本塁打`,
        row['打点'] && `${row['打点']}打点`,
        ops(row) && `OPS${ops(row)}`,
      ].filter(Boolean);
      out.push(`${name}は${year}年、${teamName}で${bits.join('・')}。`);
    }
    if (tops.length && league) {
      const titles = tops.map((r) => `${r.ja}${r.rank}位`).join('・');
      out.push(`${LEAGUE_JA[league]}では${titles}につけている。`);
    }
    return out.join('');
  }

  const out: string[] = [];
  if (s.kind === 'pitching') {
    const bits = [
      row['勝利'] && row['敗北'] && `${row['勝利']}-${row['敗北']}`,
      row['防御率'] && `a ${row['防御率']} ERA`,
      row['投球回'] && `${row['投球回']} innings`,
      row['三振'] && `${row['三振']} strikeouts`,
    ].filter(Boolean);
    out.push(`${name} is ${bits.join(', ')} for the ${teamName} in ${year}.`);
  } else {
    const bits = [
      row['打率'] && `hitting ${row['打率']}`,
      row['本塁打'] && `${row['本塁打']} homers`,
      row['打点'] && `${row['打点']} RBI`,
      ops(row) && `a ${ops(row)} OPS`,
    ].filter(Boolean);
    out.push(`${name} is ${bits.join(', ')} for the ${teamName} in ${year}.`);
  }
  if (tops.length && league) {
    const titles = tops.map((r) => `${ordinal(r.rank)} in ${r.en}`).join(', ');
    out.push(`He ranks ${titles} in ${LEAGUE_EN[league]}.`);
  }
  return out.join(' ');
}

function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}
