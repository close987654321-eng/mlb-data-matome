import type { MvpRow, MvpBoard } from '@/lib/mvpBoard';
import type { FaqItem } from '@/components/FaqList';
import { ROY_SEASON_END } from '@/lib/royFaq';

/**
 * /mvp の「よくある質問」。画面（FaqList）と JSON-LD の FAQPage を同じ配列から組む。
 *
 * なぜ要るか: MVP系の検索は「mvp いつ発表」「大谷 mvp 何位」「大谷 mvp 投手成績」のように問いの形で来る。
 * 答えの半分はボードの実データ（順位・スコア・首位との差・投手WARの合算）から毎日組み直す。
 * 制度の事実（投票方式・規定打席・日本人の受賞歴）は BBWAA と MLB 公式の公開情報に基づく定型文。
 */

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

function jpStatus(row: MvpRow, board: MvpBoard, en: boolean): string {
  const leader = board.leagues[row.league][0];
  const total = board.leagues[row.league].length;
  const name = en ? row.nameEn : row.nameJa;
  const leaderName = leader ? (en ? leader.nameEn : leader.nameJa) : '';
  const gap = leader ? (leader.score - row.score).toFixed(1) : null;
  const war =
    row.warPitch != null && row.warTotal != null
      ? en
        ? `${row.warTotal.toFixed(1)} WAR (${row.war?.toFixed(1) ?? '—'} as a hitter plus ${row.warPitch.toFixed(1)} as a pitcher)`
        : `WAR${row.warTotal.toFixed(1)}（打者${row.war?.toFixed(1) ?? '—'}＋投手${row.warPitch.toFixed(1)}）`
      : en
        ? `${row.warTotal?.toFixed(1) ?? '—'} WAR`
        : `WAR${row.warTotal?.toFixed(1) ?? '—'}`;
  const line = en
    ? `${row.avg} AVG, ${row.ops} OPS, ${row.hr} HR, ${row.rbi} RBI, ${row.sbs} SB, ${row.wrcPlus ?? '—'} wRC+, ${war}`
    : `打率${row.avg}・OPS${row.ops}・${row.hr}本塁打・${row.rbi}打点・${row.sbs}盗塁・wRC+${row.wrcPlus ?? '—'}・${war}`;
  if (en) {
    return row.rank === 1
      ? `${name} leads the ${row.league} board with a score of ${row.score.toFixed(1)} among ${total} qualified hitters (as of ${asOfLabel(board.asOf, true)}): ${line}.`
      : `${name} is ${row.rank}th of ${total} qualified ${row.league} hitters with a score of ${row.score.toFixed(1)}, ${gap} behind the leader ${leaderName} (as of ${asOfLabel(board.asOf, true)}): ${line}.`;
  }
  return row.rank === 1
    ? `${name}は${asOfLabel(board.asOf, false)}時点で${leagueJa(row.league)}の1位です（スコア${row.score.toFixed(1)}・規定到達${total}人中）。成績は${line}。`
    : `${name}は${asOfLabel(board.asOf, false)}時点で${leagueJa(row.league)}${row.rank}位（規定到達${total}人中）。スコアは${row.score.toFixed(1)}で、首位${leaderName}との差は${gap}。成績は${line}。`;
}

export function buildMvpFaq(board: MvpBoard, en: boolean): FaqItem[] {
  const jpRows = [...board.leagues.NL, ...board.leagues.AL].filter((r) => r.isJp).sort((a, b) => a.rank - b.rank);
  const year = board.season;
  const w = board.weights;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const twoWay = jpRows.find((r) => r.warPitch != null);

  const items: FaqItem[] = [
    {
      q: { ja: 'MLBのMVPは誰がどう選ぶ？', en: 'Who votes for the MLB MVP and how?' },
      a: {
        ja: 'ア・リーグとナ・リーグそれぞれで、全米野球記者協会（BBWAA）の記者が選びます。各球団の担当2名×15球団＝リーグ30人が1位から10位までの選手を記入し、1位14点・2位9点・3位8点、以下7・6・5・4・3・2・1点の合計で決まります。投手も対象で、打者と投手を分けません。',
        en: 'Thirty Baseball Writers’ Association of America voters per league (two per club) rank ten players. A first-place vote is worth 14 points, then 9-8-7-6-5-4-3-2-1. Pitchers are eligible alongside hitters.',
      },
    },
    {
      q: { ja: `${year}年のMVPはいつ決まる？`, en: `When is the ${year} MVP announced?` },
      a: {
        ja: `レギュラーシーズン最終日は${ROY_SEASON_END.ja}で、記者の投票はポストシーズン開幕前に締め切られます。10月のプレーオフでの成績は評価に入りません。受賞者の発表はワールドシリーズ終了後の11月です。`,
        en: `The regular season ends ${ROY_SEASON_END.en}, and ballots are due before the postseason begins, so October does not count. Winners are announced in November after the World Series.`,
      },
    },
    {
      q: { ja: '規定打席とは？このランキングの対象は？', en: 'What is the plate-appearance qualification used here?' },
      a: {
        ja: `規定打席はチームの試合数×3.1打席（シーズン全体で502打席）です。シーズン途中はその時点の試合数で判定するので、このボードでは目安として約${board.qualifyPa}打席に到達した打者だけを対象にしています。到達していない日本人打者は「規定打席に届いていない日本人打者」に別掲します。`,
        en: `3.1 plate appearances per team game, or 502 for a full season. Mid-season the bar is the games played so far, so this board lists only hitters at roughly ${board.qualifyPa} PA or more. Japanese hitters below that line appear in a separate watch section.`,
      },
    },
  ];

  for (const row of jpRows) {
    items.push({
      q: { ja: `${row.nameJa}はMVPレースでいま何位？`, en: `Where does ${row.nameEn} stand in the MVP race?` },
      a: { ja: jpStatus(row, board, false), en: jpStatus(row, board, true) },
    });
  }

  if (twoWay) {
    items.push({
      q: { ja: `${twoWay.nameJa}の投手としての成績はMVPの評価に入る？`, en: `Does ${twoWay.nameEn}’s pitching count toward MVP?` },
      a: {
        ja: `記者の投票に決まった基準はなく、二刀流の投手成績も含めて総合的に判断されます。このボードでは${twoWay.nameJa}の投手WAR${twoWay.warPitch!.toFixed(1)}を打者WAR${twoWay.war?.toFixed(1) ?? '—'}に合算した総合WAR${twoWay.warTotal?.toFixed(1) ?? '—'}で評価し、守備の重み（${pct(w.def)}）を守備に就かない代わりにWARへ振り替えています。`,
        en: `Voters have no fixed formula and weigh two-way pitching as they see fit. On this board ${twoWay.nameEn}’s ${twoWay.warPitch!.toFixed(1)} pitching WAR is added to his ${twoWay.war?.toFixed(1) ?? '—'} hitting WAR for a total of ${twoWay.warTotal?.toFixed(1) ?? '—'}, and the defense weight (${pct(w.def)}) is shifted to WAR since he does not play the field.`,
      },
    });
  }

  items.push(
    {
      q: { ja: '日本人でMVPを獲った選手はいる？', en: 'Has a Japanese player won MVP?' },
      a: {
        ja: 'います。2001年のイチロー（マリナーズ・ア・リーグ、新人王と同時受賞）と、大谷翔平の4回です。大谷は2021年と2023年にエンゼルスでア・リーグMVP、2024年と2025年にドジャースでナ・リーグMVPを受賞し、4回とも30人全員の1位票を集めた満票でした。満票4回は史上初で、通算4回はバリー・ボンズの7回に次ぐ記録です。2022年はアーロン・ジャッジに次ぐ2位でした。',
        en: 'Yes. Ichiro Suzuki (Mariners, 2001 AL, alongside Rookie of the Year) and Shohei Ohtani four times: AL MVP with the Angels in 2021 and 2023, NL MVP with the Dodgers in 2024 and 2025, all four unanimous, a first in MLB history and second only to Barry Bonds’ seven overall. Ohtani finished second to Aaron Judge in 2022.',
      },
    },
    {
      q: { ja: 'このランキングは公式の投票結果や予想投票？', en: 'Is this ranking an official vote or a poll of voters?' },
      a: {
        ja: `いいえ。MLB公式Stats APIとBaseball Savantの成績（公知の数値）から当サイトが毎日自動計算している予測スコアです。同じリーグの規定打者の中での位置を、打撃 wRC+＋xwOBA（${pct(w.batting)}）・本塁打（${pct(w.hr)}）・WAR（${pct(w.war)}）・走塁（${pct(w.run)}）・守備＋位置補正（${pct(w.def)}）の重みで合成しています。打点やチーム成績は入れていません。記者の投票を予測するものではなく、成績にもとづく現在地の目安です。`,
        en: `No. It is our own daily score from public MLB Stats API and Baseball Savant figures: within-league percentiles in wRC+ + xwOBA (${pct(w.batting)}), home runs (${pct(w.hr)}), WAR (${pct(w.war)}), baserunning (${pct(w.run)}) and defense with positional adjustment (${pct(w.def)}). RBI and team record are not part of it. It does not model the writers’ ballots.`,
      },
    },
    {
      q: { ja: '投手がMVPを獲ることはある？', en: 'Can a pitcher win MVP?' },
      a: {
        ja: 'あります。直近では2014年のクレイトン・カーショー（ドジャース）と2011年のジャスティン・バーランダー（タイガース）が、サイ・ヤング賞と同じ年にMVPも受賞しました。このボードは規定打者の順位表なので、投手は二刀流の大谷翔平を除いて載りません。',
        en: 'Yes. Most recently Clayton Kershaw (Dodgers, 2014) and Justin Verlander (Tigers, 2011) won MVP in the same year as the Cy Young. This board ranks qualified hitters, so pitchers do not appear except two-way player Shohei Ohtani.',
      },
    },
  );
  return items;
}
