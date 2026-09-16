import type { RoyBoard, RoyRow } from '@/lib/royBoard';

/**
 * /roy の「よくある質問」。画面（ProspectFaq と同じ <details> 列）と JSON-LD の FAQPage を**同じ配列**から組む。
 *
 * なぜ要るか: 新人王系の検索は「新人王 いつ発表」「新人王 資格」「村上 新人王 何位」のように問いの形で来る。
 * 表と地の文に同じ事実があっても、問いと答えが1対1で並んでいないと会話型検索・AIの回答に拾われない。
 * 答えの半分はボードの実データから毎日組み直す（順位・スコア・首位との差）＝鮮度シグナルも兼ねる。
 *
 * 制度の事実（資格・投票・発表時期・歴代）は MLB 公式 glossary と BBWAA の公開情報に基づく定型文。
 * ここで新しい主張はしない＝出典の無い断定を FAQ の形で残さない。
 */
export type RoyFaqItem = { q: { ja: string; en: string }; a: { ja: string; en: string } };

/** 2026年レギュラーシーズン最終日（MLB公式日程）。表示用の定数＝年が替わったら見直す。 */
export const ROY_SEASON_END = { ja: '9月27日（日）', en: 'Sunday, September 27' };

function leagueJa(lg: 'AL' | 'NL') {
  return lg === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';
}

/** "2026-09-16 17:39" → ja "9月16日" / en "Sep 16"。FAQ の答えに生のスタンプを出さない。 */
function asOfLabel(asOf: string, en: boolean): string {
  const m = asOf.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return asOf;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!en) return `${month}月${day}日`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[month - 1]} ${day}`;
}

function jpStatus(row: RoyRow, board: RoyBoard, en: boolean): string {
  const leader = board.leagues[row.league][0];
  const gap = leader ? (leader.score - row.score).toFixed(1) : null;
  const total = board.leagues[row.league].length;
  const name = en ? row.nameEn : row.nameJa;
  const leaderName = leader ? (en ? leader.nameEn : leader.nameJa) : '';
  if (en) {
    return row.rank === 1
      ? `${name} leads the ${row.league} board with a score of ${row.score.toFixed(1)} among ${total} listed rookies (as of ${asOfLabel(board.asOf, true)}).`
      : `${name} is ${row.rank}th of ${total} listed ${row.league} rookies with a score of ${row.score.toFixed(1)}, ${gap} behind the leader ${leaderName} (as of ${asOfLabel(board.asOf, true)}).`;
  }
  return row.rank === 1
    ? `${name}は${asOfLabel(board.asOf, false)}時点で${leagueJa(row.league)}の1位です（スコア${row.score.toFixed(1)}・表に載る${total}人中）。`
    : `${name}は${asOfLabel(board.asOf, false)}時点で${leagueJa(row.league)}${row.rank}位（表に載る${total}人中）。スコアは${row.score.toFixed(1)}で、首位${leaderName}との差は${gap}です。`;
}

function whyLow(row: RoyRow, board: RoyBoard, en: boolean): string {
  const name = en ? row.nameEn : row.nameJa;
  const p = row.pct;
  if (row.role === 'pit') {
    const detail = en
      ? `${row.ipDisp ?? '—'} IP, ${row.era ?? '—'} ERA, ${row.fip ?? '—'} FIP and ${row.war ?? '—'} WAR`
      : `${row.ipDisp ?? '—'}回・防御率${row.era ?? '—'}・FIP${row.fip ?? '—'}・WAR${row.war ?? '—'}`;
    return en
      ? `${name} is ranked ${row.rank}th in the ${row.league} because the score is a within-league percentile blend: ${detail} put him at the ${p.war}th percentile in WAR among all ${row.league} rookies, the ${p.role}th in FIP and the ${p.volume}th in innings among rookie pitchers (weights ${Math.round(board.weights.war * 100)}/${Math.round(board.weights.role * 100)}/${Math.round(board.weights.volume * 100)}%). Every start moves all three.`
      : `${name}が${leagueJa(row.league)}${row.rank}位なのは、スコアがリーグ内の相対評価だからです。${detail}は、${leagueJa(row.league)}の新人全体でWARが上位${100 - p.war}%、新人投手の中でFIPが上位${100 - p.role}%・投球回が上位${100 - p.volume}%の位置にあり、これを${Math.round(board.weights.war * 100)}／${Math.round(board.weights.role * 100)}／${Math.round(board.weights.volume * 100)}%で合成しています。登板するごとに3つとも動きます。`;
  }
  const detail = en
    ? `${row.pa} PA, ${row.hr} HR, ${row.avg ?? '—'} AVG, ${row.ops ?? '—'} OPS, ${row.wrcPlus ?? '—'} wRC+ and ${row.war ?? '—'} WAR`
    : `${row.pa}打席・${row.hr}本塁打・打率${row.avg ?? '—'}・OPS${row.ops ?? '—'}・wRC+${row.wrcPlus ?? '—'}・WAR${row.war ?? '—'}`;
  return en
    ? `${name} sits ${row.rank}th in the ${row.league}: ${detail} translate to the ${p.war}th percentile in WAR among all ${row.league} rookies, the ${p.role}th in wRC+ and the ${p.volume}th in plate appearances among rookie hitters.`
    : `${name}が${leagueJa(row.league)}${row.rank}位なのは、${detail}が、${leagueJa(row.league)}の新人全体でWAR上位${100 - p.war}%、新人野手の中でwRC+上位${100 - p.role}%・打席数上位${100 - p.volume}%の位置にあるからです。`;
}

export function buildRoyFaq(board: RoyBoard, en: boolean): RoyFaqItem[] {
  const jpRows = [...board.leagues.AL, ...board.leagues.NL].filter((r) => r.isJp).sort((a, b) => a.rank - b.rank);
  const jpBats = jpRows.filter((r) => r.role === 'bat');
  const jpPits = jpRows.filter((r) => r.role === 'pit');
  const year = board.season;

  const items: RoyFaqItem[] = [
    {
      q: { ja: 'MLBの新人王とはどんな賞？', en: 'What is the MLB Rookie of the Year award?' },
      a: {
        ja: 'ア・リーグとナ・リーグそれぞれで、その年もっとも活躍した新人に贈られる賞です（正式名はジャッキー・ロビンソン賞）。野手と投手の区別はなく、1つの賞を新人全員で争います。選ぶのは全米野球記者協会（BBWAA）の記者で、各球団の担当2名×15球団＝リーグ30人が1位から3位までを記入し、1位5点・2位3点・3位1点の合計で決まります。',
        en: 'One award per league (officially the Jackie Robinson Award) for the best first-year player. Hitters and pitchers compete for the same trophy. It is voted on by the Baseball Writers’ Association of America: two writers per club, 30 per league, each ranking three rookies with 5-3-1 points.',
      },
    },
    {
      q: { ja: '新人王の資格（ルーキー扱い）の条件は？', en: 'Who is eligible as a rookie?' },
      a: {
        ja: '前年までのメジャーでの実績が「130打数未満」「50投球回未満」「アクティブロースター登録45日未満」のすべてに収まっている選手です。日本のプロ野球など海外リーグでの実績は問われません。このボードのルーキー判定はMLB公式のルーキー区分（Stats APIのrookiesプール）に従っており、村上宗隆・岡本和真・今井達也もその区分に含まれています。',
        en: 'A player who, entering the season, has fewer than 130 at-bats, fewer than 50 innings pitched and fewer than 45 days on an active roster in the majors. Experience in NPB or other leagues does not count against eligibility. This board uses MLB’s official rookie pool, which includes Munetaka Murakami, Kazuma Okamoto and Tatsuya Imai.',
      },
    },
    {
      q: { ja: '日本のプロ野球で実績のある選手も新人王になれる？', en: 'Can an NPB veteran win Rookie of the Year?' },
      a: {
        ja: 'なれます。MLBの新人王はメジャーでの実績だけで判定するので、NPBで何年プレーしていても対象です。実際に野茂英雄（1995年）、佐々木主浩（2000年）、イチロー（2001年）、大谷翔平（2018年）の4人がNPBを経て新人王を受賞しています。イチローは同じ年にMVPも受賞しました。村上宗隆は2019年にNPBのセ・リーグ新人王も獲っており、受賞すれば日米両方で新人王ということになります。',
        en: 'Yes. Only major-league service counts, so NPB veterans are eligible. Four have won: Hideo Nomo (1995), Kazuhiro Sasaki (2000), Ichiro Suzuki (2001, who also won MVP that year) and Shohei Ohtani (2018). Munetaka Murakami was NPB’s Central League Rookie of the Year in 2019, so a win would make him a rookie of the year in both leagues.',
      },
    },
    {
      q: { ja: `${year}年の新人王はいつ決まる？`, en: `When is the ${year} Rookie of the Year announced?` },
      a: {
        ja: `レギュラーシーズン最終日は${ROY_SEASON_END.ja}で、記者の投票はポストシーズン開幕前に締め切られます。つまり10月のプレーオフの成績は考慮されません。受賞者の発表はワールドシリーズ終了後の11月です。`,
        en: `The regular season ends ${ROY_SEASON_END.en}, and ballots are due before the postseason starts, so October performance does not count. Winners are announced in November after the World Series.`,
      },
    },
  ];

  for (const row of jpBats) {
    items.push({
      q: {
        ja: `${row.nameJa}は新人王レースでいま何位？`,
        en: `Where does ${row.nameEn} stand in the Rookie of the Year race?`,
      },
      a: { ja: jpStatus(row, board, false), en: jpStatus(row, board, true) },
    });
  }
  for (const row of jpPits) {
    items.push({
      q: {
        ja: `${row.nameJa}の順位が低いのはなぜ？`,
        en: `Why is ${row.nameEn} ranked low on this board?`,
      },
      a: { ja: whyLow(row, board, false), en: whyLow(row, board, true) },
    });
  }

  items.push(
    {
      q: { ja: 'このランキングは公式の投票結果や予想投票？', en: 'Is this ranking an official vote or a poll of voters?' },
      a: {
        ja: `いいえ。MLB公式Stats APIの成績（公知の数値）から当サイトが毎日自動計算している予測スコアです。WAR（${Math.round(board.weights.war * 100)}%）をリーグの新人全体で、役割ごとの中身（${Math.round(board.weights.role * 100)}%＝野手はwRC+・投手はFIP）と出場量（${Math.round(board.weights.volume * 100)}%＝打席数・投球回）を野手・投手それぞれの母集団の中でパーセンタイル化し、合成しています。記者の投票を予測するものではなく、成績にもとづく現在地の目安です。`,
        en: `No. It is our own daily score computed from public MLB Stats API figures: WAR (${Math.round(board.weights.war * 100)}%) ranked across all rookies in the league, plus role quality (${Math.round(board.weights.role * 100)}%: wRC+ for hitters, FIP for pitchers) and playing time (${Math.round(board.weights.volume * 100)}%: PA or IP) ranked within each role. It does not model the writers’ ballots.`,
      },
    },
    {
      q: { ja: '新人王とMVPを同じ年に獲った選手はいる？', en: 'Has anyone won Rookie of the Year and MVP in the same season?' },
      a: {
        ja: 'います。1975年のフレッド・リン（レッドソックス）と2001年のイチロー（マリナーズ）の2人です。イチローは打率.350・242安打・56盗塁でア・リーグの新人王とMVPを同時に受賞しました。',
        en: 'Yes, twice: Fred Lynn (Red Sox, 1975) and Ichiro Suzuki (Mariners, 2001). Ichiro hit .350 with 242 hits and 56 steals to take both AL awards.',
      },
    },
  );
  return items;
}
