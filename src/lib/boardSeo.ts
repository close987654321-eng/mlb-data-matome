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

/**
 * レギュラーシーズン最終日（MLB公式日程・現地日付）。3ボード（/roy・/cy-young・/mvp）と FAQ・決まり方の
 * 「最終日は◯月◯日」の唯一の正。年が替わったら見直す（season が合わない年は isSeasonFinal が常に false）。
 */
export const REGULAR_SEASON_END = { season: 2026, iso: '2026-09-27', ja: '9月27日（日）', en: 'Sunday, September 27' };

/**
 * 最終成績が出そろったとみなす日（JST）。最終日の試合（現地夜）は日本時間の翌日昼までに終わり、
 * 夕方以降の CI 実行でボードに入る＝翌々日のボードは確実に最終成績。日次履歴もこの日までで閉じる。
 */
export const SEASON_FINAL_FROM = '2026-09-29';

/**
 * ボードがレギュラーシーズン最終成績で確定しているか。確定後は「◯月◯日時点」「現在トップ」を言わない＝
 * 10月に入っても日付だけ進む説明文は、検索結果で「まだ途中のランキング」に見えて事実ともずれるため
 * （2026-10-06 の点検で /cy-young だけ「9月29日時点」のまま残り、他2ボードと食い違っていた）。
 */
export function isSeasonFinal(season: number | string | undefined, asOf: string | undefined): boolean {
  if (Number(season) !== REGULAR_SEASON_END.season || !asOf) return false;
  return asOf.slice(0, 10) >= SEASON_FINAL_FROM;
}

/**
 * 前年の受賞発表日（BBWAA・MLB Network／米東部時間の夜7時＝日本時間の翌朝9時）。その年の日程が
 * 公表されるまでは「例年この時期」の目安として出す。事実として言えるのは前年の実績だけ＝今年の日付は書かない。
 */
export const PRIOR_AWARD_DATES = {
  year: 2025,
  finalists: { ja: '11月3日', en: 'Nov. 3' },
  roy: { ja: '11月10日', en: 'Nov. 10', jstJa: '11月11日' },
  cy: { ja: '11月12日', en: 'Nov. 12', jstJa: '11月13日' },
  mvp: { ja: '11月13日', en: 'Nov. 13', jstJa: '11月14日' },
} as const;

export type AwardKind = 'roy' | 'cy' | 'mvp';

type AwardDay = { ja: string; en: string; jstJa: string; jstEn: string };
type AwardBlock = {
  /** 受賞者の発表日（米国時間）と日本時間の日付。発表は米東部の夜＝日本では翌日。 */
  date: AwardDay;
  /** 最終候補（各リーグ上位3人・MLB選手ID）。並びは MLB 公式の掲載順（アルファベット順）。 */
  finalists: Record<'AL' | 'NL', number[]>;
  /** 受賞者（MLB選手ID）。発表されたら入れる＝説明文・最終候補欄・FAQ が受賞者の表示に切り替わる。 */
  winners: Partial<Record<'AL' | 'NL', number>>;
};

/**
 * その年の最終候補と受賞発表日（BBWAA）。出典は MLB 公式の発表記事（米国時間11月2日）。
 * 名前の表記はボードの行（カタカナ表）が正＝ここには MLB 選手IDだけを持ち、表示はボードと突き合わせる。
 * 2026-11-07 にボードと照合し、18人全員がボードに載っていることと、3ボード×両リーグの1位6人が
 * 全員最終候補に入っていることを確かめた。年が替わったら year と中身を書き直す
 * （board.season と year が合わない年は、前年実績の文言＝PRIOR_AWARD_DATES に戻る）。
 */
export const AWARD_RESULTS: {
  year: number;
  /** この登録を最後に書き換えた日（JST）。sitemap の lastmod に足す＝最終候補・受賞者を書いた日が鮮度として伝わる。 */
  updatedAt: string;
  finalistsAnnounced: { ja: string; en: string };
  source: { label: string; url: string };
} & Record<AwardKind, AwardBlock> = {
  year: 2026,
  updatedAt: '2026-11-10',
  finalistsAnnounced: { ja: '11月2日', en: 'Nov. 2' },
  source: { label: 'MLB.com', url: 'https://www.mlb.com/news/2026-bbwaa-awards-finalists' },
  roy: {
    date: { ja: '11月9日', en: 'Nov. 9', jstJa: '11月10日', jstEn: 'Nov. 10' },
    // AL: マクゴニグル・メシック・トール／NL: ベンジ・スチュワート・ウェザーホルト
    finalists: { AL: [805808, 800048, 801139], NL: [701807, 701398, 802139] },
    winners: { AL: 805808, NL: 701398 },
  },
  cy: {
    date: { ja: '11月11日', en: 'Nov. 11', jstJa: '11月12日', jstEn: 'Nov. 12' },
    // AL: シース・メシック・シュリットラー／NL: ミシオロウスキー・セール・サンチェス
    finalists: { AL: [656302, 800048, 693645], NL: [694819, 519242, 650911] },
    winners: {},
  },
  mvp: {
    date: { ja: '11月12日', en: 'Nov. 12', jstJa: '11月13日', jstEn: 'Nov. 13' },
    // AL: アルバレス・カミネロ・ウィットJr.／NL: クロウアームストロング・大谷翔平・トゥラング
    finalists: { AL: [670541, 691406, 677951], NL: [691718, 660271, 668930] },
    winners: {},
  },
};

/** そのシーズンの最終候補・発表日が登録済みか（年が合わなければ null＝前年実績の文言に戻す）。 */
export function currentAwards(season: number | string | undefined) {
  return Number(season) === AWARD_RESULTS.year ? AWARD_RESULTS : null;
}

/** 最終候補欄・説明文で使う行の最小形（ボードの行そのもの）。 */
export type FinalistRow = BoardSeoRow & { teamJa?: string; teamEn?: string };

/** 最終候補（または受賞者）の ID をボードの行に引き当てる。ボードに居ない ID は落とす。 */
export function finalistRows(
  kind: AwardKind,
  board: { season: number | string; leagues: { NL: FinalistRow[]; AL: FinalistRow[] } },
  league: 'AL' | 'NL',
): FinalistRow[] {
  const aw = currentAwards(board.season);
  if (!aw) return [];
  const byId = new Map(board.leagues[league].map((r) => [r.id, r]));
  return aw[kind].finalists[league].map((id) => byId.get(id)).filter((r): r is FinalistRow => !!r);
}

/** 受賞者の行（発表前・未登録なら null）。 */
export function winnerRow(
  kind: AwardKind,
  board: { season: number | string; leagues: { NL: FinalistRow[]; AL: FinalistRow[] } },
  league: 'AL' | 'NL',
): FinalistRow | null {
  const id = currentAwards(board.season)?.[kind].winners[league];
  return id ? (board.leagues[league].find((r) => r.id === id) ?? null) : null;
}

/** 両リーグの受賞者が登録済みか（発表の夜に両リーグそろって出る）。 */
export function awardsDecided(
  kind: AwardKind,
  board: { season: number | string; leagues: { NL: FinalistRow[]; AL: FinalistRow[] } },
): boolean {
  return Boolean(winnerRow(kind, board, 'NL') && winnerRow(kind, board, 'AL'));
}

/**
 * 題（meta title）に差す語。最終候補の発表後は「最終候補と」、受賞者の登録後は「受賞者と」。
 * 登録が無い年は空＝従来どおり「◯◯候補 {年} 予測ランキング」。
 */
export function awardTitleWord(
  kind: AwardKind,
  board: { season: number | string; leagues: { NL: FinalistRow[]; AL: FinalistRow[] } },
): string {
  if (!currentAwards(board.season)) return '';
  return awardsDecided(kind, board) ? '受賞者と' : '最終候補と';
}

/** 「いつ発表？」の答え。今年の日程が登録済みならそれを、無ければ前年の実績を言う。 */
export function awardDatePhrase(kind: AwardKind, en: boolean, season: number | string | undefined): string {
  const aw = currentAwards(season);
  if (!aw) return priorAwardDatePhrase(kind, en);
  const d = aw[kind].date;
  return en
    ? `The ${aw.year} finalists (top three in each league) were announced on ${aw.finalistsAnnounced.en}, and the winners are announced on ${d.en} ET (${d.jstEn} in Japan).`
    : `${aw.year}年は${aw.finalistsAnnounced.ja}（米国時間）に各リーグの最終候補（上位3人）が発表され、受賞者の発表は${d.ja}（日本時間${d.jstJa}）です。`;
}

/**
 * 説明文に差す「最終候補は誰か／受賞者は誰か」の一文。登録が無い年は「受賞者の発表は11月。」に戻す。
 * 検索結果のスニペットで「MVP 最終候補」「新人王 発表」にその場で答えるための実データ文。
 */
export function awardsMetaPhrase(
  kind: AwardKind,
  board: { season: number | string; leagues: { NL: FinalistRow[]; AL: FinalistRow[] } },
  en: boolean,
): string {
  const aw = currentAwards(board.season);
  if (!aw) return en ? 'Winners are announced in November.' : '受賞者の発表は11月。';
  const name = (r: FinalistRow) => (en ? r.nameEn : r.nameJa);
  const wNL = winnerRow(kind, board, 'NL');
  const wAL = winnerRow(kind, board, 'AL');
  if (wNL && wAL) {
    return en
      ? `Winners: ${name(wNL)} (NL) and ${name(wAL)} (AL).`
      : `受賞者はナ・リーグが${name(wNL)}、ア・リーグが${name(wAL)}。`;
  }
  const list = (lg: 'AL' | 'NL') => finalistRows(kind, board, lg).map(name);
  const d = aw[kind].date;
  return en
    ? `Finalists: ${list('NL').join(', ')} (NL); ${list('AL').join(', ')} (AL). Winners announced ${d.en} ET.`
    : `最終候補はナ・リーグが${list('NL').join('、')}。ア・リーグは${list('AL').join('、')}。受賞者の発表は${d.ja}（日本時間${d.jstJa}）。`;
}

/** 賞の名前（説明文・FAQ・最終候補欄で同じ語を使う）。 */
export const AWARD_LABEL: Record<AwardKind, { ja: string; en: string }> = {
  roy: { ja: '新人王', en: 'Rookie of the Year' },
  cy: { ja: 'サイ・ヤング賞', en: 'Cy Young' },
  mvp: { ja: 'MVP', en: 'MVP' },
};

/** 最終候補に入った日本人の一文（居なければ「入らなかった」）。最終候補欄と FAQ で同じ文を使う。 */
export function jpFinalistsPhrase(
  kind: AwardKind,
  board: { season: number | string; leagues: { NL: FinalistRow[]; AL: FinalistRow[] } },
  en: boolean,
): string {
  const jp = (['NL', 'AL'] as const).flatMap((lg) => finalistRows(kind, board, lg)).filter((r) => r.isJp);
  if (jp.length) {
    return en
      ? `Japanese finalist${jp.length > 1 ? 's' : ''}: ${jp.map((r) => r.nameEn).join(', ')}.`
      : `日本人では${jp.map((r) => r.nameJa).join('・')}が最終候補に入りました。`;
  }
  return en ? 'No Japanese player is among the finalists.' : '日本人選手は最終候補に入りませんでした。';
}

/**
 * FAQ の「{年}年の◯◯の最終候補は？」。登録が無い年は null（質問ごと出さない）。
 * 答えはボードの順位を添える＝「この表の何位が残ったか」はこのサイトにしか無い情報。
 */
export function finalistsFaqItem(
  kind: AwardKind,
  board: { season: number | string; leagues: { NL: FinalistRow[]; AL: FinalistRow[] } },
): { q: { ja: string; en: string }; a: { ja: string; en: string } } | null {
  const aw = currentAwards(board.season);
  if (!aw) return null;
  const label = AWARD_LABEL[kind];
  const line = (lg: 'AL' | 'NL', en: boolean) =>
    finalistRows(kind, board, lg)
      .map((r) => (en ? `${r.nameEn} (${r.teamEn ?? ''}, No. ${r.rank} here)` : `${r.nameJa}（${r.teamJa ?? ''}・この表で${r.rank}位）`))
      .join(en ? ', ' : '、');
  const wNL = winnerRow(kind, board, 'NL');
  const wAL = winnerRow(kind, board, 'AL');
  const winJa = wNL && wAL ? `受賞者はナ・リーグが${wNL.nameJa}、ア・リーグが${wAL.nameJa}です。` : '';
  const winEn = wNL && wAL ? `The winners are ${wNL.nameEn} (NL) and ${wAL.nameEn} (AL). ` : '';
  // 受賞者の登録後は問いも「受賞者は誰？」に替える（発表の翌日からの検索は「新人王 2026 誰」型になる）。
  const q = wNL && wAL
    ? { ja: `${aw.year}年の${label.ja}は誰が受賞した？`, en: `Who won the ${aw.year} ${label.en}?` }
    : { ja: `${aw.year}年の${label.ja}の最終候補は誰？`, en: `Who are the ${aw.year} ${label.en} finalists?` };
  return {
    q,
    a: {
      ja: `${winJa}${aw.finalistsAnnounced.ja}（米国時間）にMLBが発表した最終候補（各リーグ上位3人）は、ナ・リーグが${line('NL', false)}、ア・リーグが${line('AL', false)}です。${jpFinalistsPhrase(kind, board, false)}${awardDatePhrase(kind, false, board.season).replace(/^.*?受賞者の発表は/, '受賞者の発表は')}`,
      en: `${winEn}MLB announced the finalists (top three per league) on ${aw.finalistsAnnounced.en}. NL: ${line('NL', true)}. AL: ${line('AL', true)}. ${jpFinalistsPhrase(kind, board, true)} Winners are announced on ${aw[kind].date.en} ET.`,
    },
  };
}

/**
 * ボードの更新日（構造化データの dateModified）＝集計日と、最終候補・受賞者を書いた日の新しい方。
 * 確定後は集計日が動かないので、発表週に中身を足しても「9月29日更新」に見えていた（sitemap の lastmod と同じ規則）。
 */
export function boardModified(season: number | string, asOf: string | undefined): string | undefined {
  const dates = [asOf?.slice(0, 10), currentAwards(season)?.updatedAt].filter(Boolean) as string[];
  return dates.length ? [...dates].sort()[dates.length - 1] : undefined;
}

/** 「決まり方」の発表日欄の本文。 */
export function awardGuideDate(kind: AwardKind, en: boolean, season: number | string | undefined): string {
  const aw = currentAwards(season);
  if (!aw) {
    const p = PRIOR_AWARD_DATES;
    return en
      ? `After the World Series (${p.year}: ${p[kind].en} ET).`
      : `ワールドシリーズ終了後に発表（${p.year}年は${p[kind].ja}・日本時間${p[kind].jstJa}の朝）。`;
  }
  const d = aw[kind].date;
  return en
    ? `${aw.year}: finalists announced ${aw.finalistsAnnounced.en}, winners on ${d.en} ET.`
    : `${aw.year}年は${aw.finalistsAnnounced.ja}に最終候補（上位3人）を発表し、受賞者は${d.ja}（日本時間${d.jstJa}）に発表。`;
}

/** 「いつ発表？」の答えに足す一文（前年の実績日）。FAQ と確定表示の注記で同じ文を使う。 */
export function priorAwardDatePhrase(kind: AwardKind, en: boolean): string {
  const p = PRIOR_AWARD_DATES;
  const d = p[kind];
  return en
    ? `In ${p.year}, finalists (top three) were revealed on ${p.finalists.en} and the winners on ${d.en} (7 p.m. ET, the next morning in Japan).`
    : `${p.year}年は${p.finalists.ja}に各賞の最終候補（上位3人）、${d.ja}に受賞者が発表されました（米東部時間の夜7時＝日本時間${d.jstJa}の朝9時）。`;
}

/**
 * 確定後に題字の下へ出す注記。表の順位が「途中経過」ではなく「最終成績での予測」になったことと、
 * 次に何が起きるか（投票は締め切り済み・発表は11月）を先に言い切る。
 */
export function seasonFinalNotice(kind: AwardKind, en: boolean, season?: number | string): string {
  const end = REGULAR_SEASON_END;
  return en
    ? `The regular season ended ${end.en}. This board now reflects final regular-season numbers, and ballots were due before the postseason, so October does not change it. ${awardDatePhrase(kind, true, season)}`
    : `レギュラーシーズンは${end.ja}に全日程を終えました。この表はレギュラーシーズン最終成績での予測で、記者の投票もポストシーズン開幕前に締め切られているため、10月の成績では動きません。${awardDatePhrase(kind, false, season)}`;
}

/** 説明文の括弧書き。確定前は「◯月◯日時点」、確定後は「レギュラーシーズン最終成績」。 */
export function asOfOrFinal(asOf: string | undefined, en: boolean, final: boolean): string {
  if (final) return en ? 'final regular-season numbers' : 'レギュラーシーズン最終成績';
  const day = asOfShort(asOf, en);
  return day ? (en ? `as of ${day}` : `${day}時点`) : '';
}

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
export function leadersPhrase(leaders: BoardLeaders, en: boolean, final = false): string {
  if (!leaders.nl && !leaders.al) return '';
  if (en) {
    const parts = [
      leaders.nl ? `${leaders.nl} ${final ? 'finished first in' : 'leads'} the NL` : null,
      leaders.al ? `${leaders.al} the AL` : null,
    ].filter(Boolean);
    return `${parts.join(', ')}.`;
  }
  const parts = [
    leaders.nl ? `ナ・リーグは${leaders.nl}` : null,
    leaders.al ? `ア・リーグは${leaders.al}` : null,
  ].filter(Boolean);
  // 確定後に「現在トップ」は言わない（10月に入ってもレースが続いているように読めるため）。
  return `${parts.join('、')}${final ? 'が1位でシーズンを終えた。' : 'が現在トップ。'}`;
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
