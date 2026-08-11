/**
 * 予測ボード（/cy-young・/mvp）の検索向け文言を、ボードの実データから組み立てる唯一の正。
 * 思想は gameSeo.ts と同じ＝「検索で実際に打たれる言葉」と「いま誰が有力か」をタイトル・
 * 説明文の前に出す。値は静的JSON（CIが毎日更新）の再表示だけで、順位も名前も捏造しない。
 *
 * なぜ「候補」なのか: GSC実測（2026-08-11・直近28日）で /cy-young に着地する約80クエリの
 * ほとんどが「サイヤング候補」「サイヤング賞候補 2026」型なのに、ページ側の語彙は「予測」
 * だけで候補という語をどこにも持っていなかった。唯一6位に入っている「ア・リーグ サイヤング候補」
 * だけが CTR 10.6%（他は9〜10位でCTRほぼ0）＝上位化すればクリックになることは実証済み。
 */

/** ボード行のうち SEO 文言に使う最小形（CyRow / MvpRow の共通部分）。 */
export type BoardSeoRow = {
  /** MLB選手ID＝詳細ページ（/cy-young/{id}・/mvp/{id}）のパス。 */
  id: number;
  rank: number;
  nameJa: string;
  nameEn: string;
  league: 'AL' | 'NL';
  isJp: boolean;
};

export type BoardSeoData = { leagues: { NL: BoardSeoRow[]; AL: BoardSeoRow[] } };

export type BoardLeaders = {
  /** 各リーグの現在1位の表示名（ロケール済み）。 */
  nl: string | null;
  al: string | null;
  /** 日本人の最上位（両リーグ通し）。日本人が規定に届いていないボードでは null。 */
  jp: { name: string; rank: number; league: 'AL' | 'NL' } | null;
};

/** リーグの日本語表記。説明文と見出しで同じ語を使う（検索の表記に合わせる）。 */
export function leagueJa(league: 'AL' | 'NL'): string {
  return league === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';
}

export function boardLeaders(board: BoardSeoData, en: boolean): BoardLeaders {
  const name = (r: BoardSeoRow | undefined) => (r ? (en ? r.nameEn : r.nameJa) : null);
  const jpRow = [...board.leagues.NL, ...board.leagues.AL]
    .filter((r) => r.isJp)
    .sort((a, b) => a.rank - b.rank)[0];
  return {
    nl: name(board.leagues.NL[0]),
    al: name(board.leagues.AL[0]),
    jp: jpRow ? { name: name(jpRow)!, rank: jpRow.rank, league: jpRow.league } : null,
  };
}

/**
 * 「いま誰が有力か」の一文。検索結果のスニペットでクエリ（＝候補は誰？）にその場で答えるための
 * 実データ文で、CIが毎日ボードを更新するたびに文面が変わる＝鮮度シグナルも兼ねる。
 */
export function leadersPhrase(leaders: BoardLeaders, en: boolean): string {
  if (!leaders.nl && !leaders.al) return '';
  if (en) {
    const parts = [
      leaders.nl ? `${leaders.nl} leads the NL` : null,
      leaders.al ? `${leaders.al} the AL` : null,
    ].filter(Boolean);
    return `${parts.join(', ')}.`;
  }
  const parts = [
    leaders.nl ? `ナ・リーグは${leaders.nl}` : null,
    leaders.al ? `ア・リーグは${leaders.al}` : null,
  ].filter(Boolean);
  return `${parts.join('、')}が現在トップ。`;
}

/**
 * 日本人最上位の一文（「山本由伸はナ・リーグ8位」）。日本人が圏内にいない時は空文字。
 * その日本人がすでに leadersPhrase で首位として名前が出ている場合も空にする＝
 * 「ナ・リーグは大谷翔平が現在トップ。大谷翔平はナ・リーグ1位。」の二度言いを避ける。
 */
export function jpRankPhrase(leaders: BoardLeaders, en: boolean): string {
  const jp = leaders.jp;
  if (!jp) return '';
  if (jp.name === leaders.nl || jp.name === leaders.al) return '';
  return en
    ? `${jp.name} is ${jp.rank}${ordinalSuffix(jp.rank)} in the ${jp.league}.`
    : `${jp.name}は${leagueJa(jp.league)}${jp.rank}位。`;
}

/**
 * 説明文に差す日付（"2026-08-11 02:10" → ja:"8月11日" / en:"Aug 11"）。
 * スニペットの文字数は貴重なので、年は本文の「{year}年」と重複させず月日だけにする。
 */
export function asOfShort(asOf: string | undefined, en: boolean): string {
  const m = asOf?.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return '';
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!en) return `${month}月${day}日`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[month - 1]} ${day}`;
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

/**
 * ランキングの構造化データ（ItemList）。「サイヤング賞 ランキング／順位」型のクエリに対して、
 * ページが実際に順位表であることを機械可読で示す。出すのは実在の行だけ（上位10件）。
 */
export function boardItemList(
  board: BoardSeoData,
  en: boolean,
  urlOf: (row: BoardSeoRow) => string,
  nameOfList: string,
) {
  const rows = (['NL', 'AL'] as const).flatMap((lg) => board.leagues[lg].slice(0, 10));
  return {
    '@type': 'ItemList',
    name: nameOfList,
    numberOfItems: rows.length,
    itemListElement: rows.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${leagueLabel(r.league, en)} ${r.rank}. ${en ? r.nameEn : r.nameJa}`,
      url: urlOf(r),
    })),
  };
}

function leagueLabel(league: 'AL' | 'NL', en: boolean): string {
  return en ? league : leagueJa(league);
}
