import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * チームLP（/tag/{チーム名}）が読む地区順位表。
 * data/standings.json は scripts/fetch-mlb-stats.mjs standings が書き出す公知の事実
 * （勝敗・勝率・ゲーム差）のみのファイル。サイト本体はこの静的JSONを読むだけで
 * MLB API を叩かない（jp-players-stats.json と同じ posture）。
 */
export type StandingRow = {
  id: number;
  nameJa: string;
  w: number;
  l: number;
  /** 勝率（".598" 形式の文字列＝APIの表記のまま） */
  pct: string;
  /** ゲーム差（首位は "-"） */
  gb: string;
  rank: number;
  /** 連勝/連敗コード（例 "W3"）。取得できなかった回は無い。 */
  streak?: string;
  /** 直近10試合（例 "7-3"）。 */
  last10?: string;
};
export type League = 'AL' | 'NL';
export type DivisionName = 'East' | 'Central' | 'West';
export type StandingsDivision = { league: League; division: DivisionName; teams: StandingRow[] };
export type Standings = { asOf: string; season: number; divisions: StandingsDivision[] };

const FILE = path.join(process.cwd(), 'data', 'standings.json');

let cache: Standings | null = null;

async function load(): Promise<Standings> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8')) as Standings;
  } catch {
    // 未生成でもビルドは通す（チームLPは順位表なしで記事フィードだけ出す）
    cache = { asOf: '', season: 0, divisions: [] };
  }
  return cache;
}

export async function getStandings(): Promise<Standings> {
  return load();
}

/** チームが属する地区の順位表を引く。順位表未生成・未知のチームは null。 */
export async function divisionOfTeam(teamId: number): Promise<StandingsDivision | null> {
  const { divisions } = await load();
  return divisions.find((d) => d.teams.some((t) => t.id === teamId)) ?? null;
}

/** チーム自身の順位行と所属地区。導入文・description の「現在◯地区◯位」用。 */
export async function standingOfTeam(
  teamId: number,
): Promise<{ row: StandingRow; division: StandingsDivision } | null> {
  const division = await divisionOfTeam(teamId);
  const row = division?.teams.find((t) => t.id === teamId);
  return division && row ? { row, division } : null;
}

/** 「ナ・リーグ西地区首位（61勝33敗）」形式の短句（ja）。導入文と description が共用。 */
export function standingPhraseJa(row: StandingRow, division: StandingsDivision): string {
  const rank = row.rank === 1 ? '首位' : `${row.rank}位`;
  return `${divisionLabel(division, 'ja')}${rank}（${row.w}勝${row.l}敗）`;
}

/** 地区の表示ラベル（ja: ナ・リーグ西地区 / en: NL West）。 */
export function divisionLabel(d: StandingsDivision, locale: string): string {
  if (locale === 'en') return `${d.league} ${d.division}`;
  const league = d.league === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';
  const div = { East: '東', Central: '中', West: '西' }[d.division];
  return `${league}${div}地区`;
}
