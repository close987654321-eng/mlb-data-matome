import type { CyRow, CyYoungBoard } from '@/lib/cyYoungBoard';
import type { FaqItem } from '@/components/FaqList';
import { ROY_SEASON_END } from '@/lib/royFaq';

/**
 * /cy-young の「よくある質問」。画面（FaqList）と JSON-LD の FAQPage を同じ配列から組む。
 *
 * なぜ要るか: サイ・ヤング系の検索は「サイヤング賞 いつ」「山本由伸 サイヤング 何位」「大谷 サイヤング 規定」の
 * ように問いの形で来る。答えの半分はボードの実データ（順位・スコア・首位との差・規定までの回数）から
 * 毎日組み直す＝鮮度シグナルも兼ねる。制度の事実（投票方式・規定投球回・歴代の日本人の順位）は
 * BBWAA と MLB 公式の公開情報に基づく定型文。ここで新しい主張はしない。
 */

/** 規定未達のためボードに載っていない日本人先発の現在地（ページ側が snapshot から組む）。 */
export type CyOutsider = {
  nameJa: string;
  nameEn: string;
  gs: number;
  ipDisp: string;
  era: string;
  ipGap: number; // 規定（qualifyIp）まであと約N回
};

function asOfLabel(asOf: string, en: boolean): string {
  const m = asOf.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return asOf;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!en) return `${month}月${day}日`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[month - 1]} ${day}`;
}

function leagueJa(lg: 'AL' | 'NL') {
  return lg === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';
}

function jpStatus(row: CyRow, board: CyYoungBoard, en: boolean): string {
  const leader = board.leagues[row.league][0];
  const total = board.leagues[row.league].length;
  const name = en ? row.nameEn : row.nameJa;
  const leaderName = leader ? (en ? leader.nameEn : leader.nameJa) : '';
  const gap = leader ? (leader.score - row.score).toFixed(1) : null;
  const line = en
    ? `${row.w}-${row.l}, ${row.era} ERA, ${row.ipDisp} IP, ${row.so} K, ${row.whip} WHIP`
    : `${row.w}勝${row.l}敗・防御率${row.era}・${row.ipDisp}回・${row.so}奪三振・WHIP${row.whip}`;
  if (en) {
    return row.rank === 1
      ? `${name} leads the ${row.league} board with a score of ${row.score.toFixed(1)} among ${total} qualified starters (as of ${asOfLabel(board.asOf, true)}): ${line}.`
      : `${name} is ${row.rank}th of ${total} qualified ${row.league} starters with a score of ${row.score.toFixed(1)}, ${gap} behind the leader ${leaderName} (as of ${asOfLabel(board.asOf, true)}): ${line}.`;
  }
  return row.rank === 1
    ? `${name}は${asOfLabel(board.asOf, false)}時点で${leagueJa(row.league)}の1位です（スコア${row.score.toFixed(1)}・規定到達${total}人中）。成績は${line}。`
    : `${name}は${asOfLabel(board.asOf, false)}時点で${leagueJa(row.league)}${row.rank}位（規定到達${total}人中）。スコアは${row.score.toFixed(1)}で、首位${leaderName}との差は${gap}。成績は${line}。`;
}

export function buildCyFaq(board: CyYoungBoard, en: boolean, outsiders: CyOutsider[] = []): FaqItem[] {
  const jpRows = [...board.leagues.NL, ...board.leagues.AL].filter((r) => r.isJp).sort((a, b) => a.rank - b.rank);
  const year = board.season;
  const w = board.weights;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const items: FaqItem[] = [
    {
      q: { ja: 'サイ・ヤング賞とはどんな賞？誰が選ぶ？', en: 'What is the Cy Young Award and who votes?' },
      a: {
        ja: 'ア・リーグとナ・リーグそれぞれで、その年もっとも優れた投手に贈られる賞です。選ぶのは全米野球記者協会（BBWAA）の記者で、各球団の担当2名×15球団＝リーグ30人が1位から5位までの投手を記入し、1位7点・2位4点・3位3点・4位2点・5位1点の合計で決まります。先発と救援の区別はありません。',
        en: 'One award per league for the best pitcher. Thirty Baseball Writers’ Association of America voters per league (two per club) rank five pitchers, scored 7-4-3-2-1. Starters and relievers are eligible alike.',
      },
    },
    {
      q: { ja: `${year}年のサイ・ヤング賞はいつ決まる？`, en: `When is the ${year} Cy Young Award announced?` },
      a: {
        ja: `レギュラーシーズン最終日は${ROY_SEASON_END.ja}で、記者の投票はポストシーズン開幕前に締め切られます。10月のプレーオフでの投球は評価に入りません。受賞者の発表はワールドシリーズ終了後の11月です。`,
        en: `The regular season ends ${ROY_SEASON_END.en}, and ballots are due before the postseason begins, so October starts do not count. Winners are announced in November after the World Series.`,
      },
    },
    {
      q: { ja: '規定投球回とは？このランキングの対象は？', en: 'What is the innings qualification used here?' },
      a: {
        ja: `規定投球回はチームの試合数×1回（シーズン全体で162回）です。シーズン途中はその時点の試合数で判定するので、このボードでは目安として約${board.qualifyIp}回に到達した先発だけを対象にしています。到達していない投手は下の「規定投球回に届いていない日本人先発」に別掲します。`,
        en: `One inning per team game, or 162 for a full season. Mid-season the bar is the games played so far, so this board lists only starters at roughly ${board.qualifyIp} IP or more. Japanese starters below that line appear in a separate watch section.`,
      },
    },
  ];

  for (const row of jpRows) {
    items.push({
      q: { ja: `${row.nameJa}はサイ・ヤング賞レースでいま何位？`, en: `Where does ${row.nameEn} stand in the Cy Young race?` },
      a: { ja: jpStatus(row, board, false), en: jpStatus(row, board, true) },
    });
  }

  for (const o of outsiders) {
    items.push({
      q: { ja: `${o.nameJa}がサイ・ヤング賞候補の表に入っていないのはなぜ？`, en: `Why isn’t ${o.nameEn} on the Cy Young board?` },
      a: {
        ja: `規定投球回に届いていないためです。${o.nameJa}は${asOfLabel(board.asOf, false)}時点で${o.gs}先発・${o.ipDisp}回（防御率${o.era}）で、このボードの目安（約${board.qualifyIp}回）まであと約${o.ipGap}回足りません。投票する記者は規定に縛られないので候補に挙がること自体は妨げられませんが、当サイトの順位表は規定到達者だけを比べています。`,
        en: `He hasn’t reached the innings qualification. As of ${asOfLabel(board.asOf, true)} ${o.nameEn} has ${o.ipDisp} IP over ${o.gs} starts (${o.era} ERA), about ${o.ipGap} IP short of this board’s ~${board.qualifyIp} IP line. Voters aren’t bound by that line, but our table compares qualified starters only.`,
      },
    });
  }

  items.push(
    {
      q: { ja: '日本人でサイ・ヤング賞を獲った投手はいる？', en: 'Has a Japanese pitcher ever won the Cy Young?' },
      a: {
        ja: 'まだいません。最高順位は2位で、ダルビッシュ有が2013年（ア・リーグ、レンジャーズ）と2020年（ナ・リーグ、カブス）の2回記録しています。3位は2013年の岩隈久志（マリナーズ）と2025年の山本由伸（ドジャース）。4位は野茂英雄（1995年・1996年）、松坂大輔（2008年）、大谷翔平（2022年）で、今永昇太は2024年に5位に入りました。',
        en: 'Not yet. The best finish is second: Yu Darvish in 2013 (AL, Rangers) and 2020 (NL, Cubs). Hisashi Iwakuma (2013) and Yoshinobu Yamamoto (2025) finished third; Hideo Nomo (1995, 1996), Daisuke Matsuzaka (2008) and Shohei Ohtani (2022) fourth; Shota Imanaga fifth in 2024.',
      },
    },
    {
      q: { ja: 'このランキングは公式の投票結果や予想投票？', en: 'Is this ranking an official vote or a poll of voters?' },
      a: {
        ja: `いいえ。MLB公式Stats APIとBaseball Savantの成績（公知の数値）から当サイトが毎日自動計算している予測スコアです。同じリーグの規定投手の中での位置を、ERA＋xERA（${pct(w.prevention)}）・K-BB%（${pct(w.kbb)}）・投球回（${pct(w.ip)}）・WHIP（${pct(w.whip)}）・HR/9（${pct(w.hr9)}）の重みで合成しています。勝ち数は入れていません。記者の投票を予測するものではなく、成績にもとづく現在地の目安です。`,
        en: `No. It is our own daily score from public MLB Stats API and Baseball Savant figures: within-league percentiles in ERA + xERA (${pct(w.prevention)}), K-BB% (${pct(w.kbb)}), innings (${pct(w.ip)}), WHIP (${pct(w.whip)}) and HR/9 (${pct(w.hr9)}). Wins are not part of it. It does not model the writers’ ballots.`,
      },
    },
    {
      q: { ja: 'サイ・ヤング賞とMVPを同じ年に獲った投手はいる？', en: 'Has a pitcher won the Cy Young and MVP in the same year?' },
      a: {
        ja: 'います。直近では2014年のクレイトン・カーショー（ドジャース）と2011年のジャスティン・バーランダー（タイガース）が同じ年にサイ・ヤング賞とMVPを受賞しました。投手がMVPを獲るのは珍しく、サイ・ヤング賞の投票では打撃成績は考慮されません。',
        en: 'Yes. Most recently Clayton Kershaw (Dodgers, 2014) and Justin Verlander (Tigers, 2011) won both in the same season. Pitcher MVPs are rare, and hitting does not factor into Cy Young voting.',
      },
    },
  );
  return items;
}
