import type { FaqItem } from '@/components/FaqList';

/**
 * オフの用語（/stove-league/guide）＝制度そのものの説明を1か所だけに置く。
 *
 * なぜ要るか: 「クオリファイングオファーとは」「オプトアウトとは」「ノンテンダーとは」は毎年オフに打たれる
 * 定義の検索で、FA一覧や選手LPの文中に散らした説明では受けられない。用語ごとにページを割ると薄いページが
 * 増えるので、1ページに見出しを立てて並べ、定義の下に**今年の実例**（data の再表示）を置く。
 * ポスティングは /prospects（postingSystem.ts）、ロックアウトは /stove-league/lockout が正＝ここでは送るだけ。
 *
 * 書いてよいのは MLB公式の用語集（mlb.com/glossary）に書かれている決まりだけ。数字（日数・金額・割合）は
 * 用語集の値をそのまま持ち、年で変わるもの（QOの額・各期限の日付）は stove-league.json から引く。
 * 労使協定が替わると決まりも変わりうる＝新しい協定がまとまったら用語集を読み直して書き直す。
 */

type Bi = { ja: string; en: string };

export type GuideTermId = 'fa' | 'qo' | 'option' | 'non-tender' | 'arbitration' | 'rule5' | 'cbt';

export type GuideTerm = {
  id: GuideTermId;
  /** 見出し（検索で打たれる表記をそのまま）。 */
  title: Bi;
  /** FAQ の問い（「◯◯とは？」）。 */
  question: Bi;
  /** 1〜2文の定義。見出しの直下と FAQ の答えに使う。 */
  summary: Bi;
  /** 決まりの要点（用語集に書かれていることだけ）。 */
  points: Bi[];
  source: string;
  sourceName: string;
};

const G = 'https://www.mlb.com/glossary/transactions';
const SRC = { ja: 'MLB公式（用語集）', en: 'MLB.com Glossary' };

export const GUIDE_TERMS: GuideTerm[] = [
  {
    id: 'fa',
    title: { ja: 'FA（フリーエージェント）の仕組み', en: 'Free agency' },
    question: { ja: 'MLBのFA（フリーエージェント）とは？', en: 'What is free agency in MLB?' },
    summary: {
      ja: 'どの球団とも自由に契約できる立場のこと。メジャーの登録日数（サービスタイム）が6年に達した選手は、そのシーズンの終わりにFAになれる。',
      en: 'The right to sign with any club. A player who reaches six years of Major League service time can become a free agent at the end of that season.',
    },
    points: [
      {
        ja: 'サービスタイムは、26人枠かメジャーの負傷者リストに入っていた日数で数える。1シーズンは187日あり、172日に達すると1年ぶんになる',
        en: 'Service time accrues for each day on the 26-man roster or the Major League injured list; a season has 187 days, and 172 days count as one year',
      },
      {
        ja: 'FAの選手は、どの球団とも、合意した条件で契約できる',
        en: 'A free agent may sign with any club for any terms the two sides agree to',
      },
      {
        ja: '6年に満たない選手が契約した場合は、契約の年数に関係なく、6年に達するまでその球団が保有権を持つ',
        en: 'A player with fewer than six years who signs remains under that club’s control until he reaches six years, even if the contract is shorter',
      },
      {
        ja: '球団から自由契約（リリース）にされた選手も、サービスタイムに関係なくFAになり、すぐにどの球団とも契約できる',
        en: 'A player released by his club also becomes a free agent regardless of service time and may sign anywhere immediately',
      },
    ],
    source: `${G}/free-agency`,
    sourceName: SRC.ja,
  },
  {
    id: 'qo',
    title: { ja: 'クオリファイング・オファー（QO）', en: 'Qualifying offer (QO)' },
    question: { ja: 'クオリファイング・オファー（QO）とは？', en: 'What is a qualifying offer?' },
    summary: {
      ja: 'FAになる自軍の選手に、球団が出せる1年契約の提示。選手が断って他球団と契約すると、元の球団はドラフト指名権の補償を受け、獲得した球団は指名権を失う。',
      en: 'A one-year offer a club can make to its own departing free agent. If the player declines and signs elsewhere, his former club receives a compensatory draft pick and the signing club gives up picks.',
    },
    points: [
      {
        ja: '金額は、年俸の高い上位125人の平均。毎年決め直される',
        en: 'The amount is the mean salary of MLB’s 125 highest-paid players, reset every year',
      },
      {
        ja: '提示できるのは、過去に一度もQOを受けたことがなく、そのシーズンを通してその球団に在籍した選手だけ（シーズン途中に加入した選手は対象外）',
        en: 'Only a player who has never received a QO and spent the entire season with the club is eligible (in-season acquisitions are not)',
      },
      {
        ja: '受諾すると、その金額の1年契約で元の球団に残る。断るとFA市場に出る。回答までのあいだ、他球団と交渉して市場価値を確かめられる',
        en: 'Accepting means a one-year deal at that amount with the same club; declining sends the player to the open market. He may talk with other clubs while deciding',
      },
      {
        ja: '断った選手と契約した球団は、ドラフトの指名権を1つ以上失う（1巡目の最上位の指名権は守られる）。ぜいたく税を払った球団は2番目と5番目に高い指名権と、国際ボーナス枠100万ドルを失う',
        en: 'A club that signs a player who declined loses one or more draft picks (its highest first-round pick is exempt). Luxury-tax payors lose their second- and fifth-highest picks and $1 million of international bonus pool money',
      },
      {
        ja: '元の球団が受け取る補償の指名権は、球団の区分（ぜいたく税を払った球団・収益分配を受ける球団・それ以外）と、選手の新しい契約が5000万ドル以上かどうかで順位が変わる',
        en: 'The former club’s compensatory pick depends on its category (luxury-tax payor, revenue-sharing recipient, or other) and whether the new contract is worth at least $50 million',
      },
    ],
    source: `${G}/qualifying-offer`,
    sourceName: SRC.ja,
  },
  {
    id: 'option',
    title: { ja: 'オプトアウト・選手オプション・球団オプション', en: 'Opt-outs, player options and club options' },
    question: { ja: 'オプトアウト（選手オプション）とは？', en: 'What is an opt-out or player option?' },
    summary: {
      ja: '契約に付いた「選べる年」を、選手か球団のどちらが決めるかの違い。選手オプションは選手が決め、破棄すればFAになる。球団オプションは球団が決める。このサイトでは、選手が契約の残りを破棄してFAになる権利をオプトアウトと書いている。',
      en: 'Optional contract years differ by who decides. A player option is the player’s call, and rejecting it makes him a free agent; a club option is the club’s call. On this site, “opt-out” means a player’s right to void the rest of his contract and become a free agent.',
    },
    points: [
      {
        ja: '選手オプション：選手の判断で使える契約年（複数年のこともある）。行使すればその年俸が保証され、破棄すればFA市場に出られる',
        en: 'Player option: an optional year (sometimes several) applied at the player’s discretion. Exercising it locks in that salary; rejecting it lets him test free agency',
      },
      {
        ja: '球団オプション：契約の最後に付く、球団の判断で保証できる年。行使すれば、選手はその金額で翌年の契約が決まる',
        en: 'Club option: an optional year at the end of a contract that the club may guarantee. If exercised, the player is signed for the next season at that value',
      },
      {
        ja: '球団オプションには多くの場合バイアウト（破棄の際に払う金額）が付く。球団が破棄すると、多くの場合その選手はFAになる',
        en: 'Club options usually carry a buyout. If the club declines, in most cases the player becomes a free agent',
      },
    ],
    source: `${G}/player-option`,
    sourceName: SRC.ja,
  },
  {
    id: 'non-tender',
    title: { ja: 'ノンテンダー', en: 'Non-tender' },
    question: { ja: 'ノンテンダーとは？', en: 'What does non-tender mean?' },
    summary: {
      ja: '球団が、保有権のある選手に来季の契約を提示しないこと。提示されなかった選手は、その時点でFAになる。',
      en: 'When a club declines to offer a contract for the coming season to a player it controls. The player immediately becomes a free agent.',
    },
    points: [
      {
        ja: '対象は、40人枠に入っていて、FAに必要な6年のサービスタイムに達しておらず、来季の契約をまだ結んでいない選手',
        en: 'It applies to players on the 40-man roster who are under club control (short of six years of service time) and unsigned for the coming season',
      },
      {
        ja: '年俸調停で上がる年俸が働きに見合わないと球団が判断したときや、40人枠を空けたいときに起きる',
        en: 'Clubs non-tender players when the arbitration raise would exceed their on-field value, or simply to clear a 40-man roster spot',
      },
      {
        ja: '期限は毎年11月、感謝祭の前の最後の金曜日（2022〜26年の労使協定）',
        en: 'The deadline is the last Friday before Thanksgiving each November (2022-26 CBA)',
      },
    ],
    source: `${G}/non-tendered`,
    sourceName: SRC.ja,
  },
  {
    id: 'arbitration',
    title: { ja: '年俸調停', en: 'Salary arbitration' },
    question: { ja: 'MLBの年俸調停とは？', en: 'What is salary arbitration?' },
    summary: {
      ja: 'FAになる前の選手の来季の年俸を決める手続き。サービスタイムが3年に達すると権利を得て、6年に達するまで毎オフ対象になる。',
      en: 'The offseason process that sets salaries for players not yet eligible for free agency. Players qualify at three years of service time and remain eligible each winter until six.',
    },
    points: [
      {
        ja: '2年以上3年未満でも、サービスタイムが上位22%に入り、前のシーズンに86日以上の登録がある選手は権利を得る（スーパー2）',
        en: 'Players with two to three years can also qualify as “Super Two” if they rank in the top 22 percent in service time in that group and had at least 86 days the previous season',
      },
      {
        ja: '期限（例年1月中旬）までに合意できなければ、球団と選手がそれぞれ希望額を出し合う',
        en: 'If there is no agreement by a deadline (typically mid-January), the club and player exchange salary figures',
      },
      {
        ja: '聴聞会（例年2月）までに合意できなければ、調停人のパネルが球団と選手のどちらかの金額を選ぶ（あいだの金額にはならない）',
        en: 'If still unsettled by the hearing (typically February), a panel picks either the player’s or the club’s figure, never one in between',
      },
    ],
    source: `${G}/salary-arbitration`,
    sourceName: SRC.ja,
  },
  {
    id: 'rule5',
    title: { ja: 'ルール5ドラフト', en: 'Rule 5 Draft' },
    question: { ja: 'ルール5ドラフトとは？', en: 'What is the Rule 5 Draft?' },
    summary: {
      ja: '毎年12月に行われる、他球団の40人枠に入っていない選手を指名できるドラフト。指名した選手は、翌シーズンを通して26人枠に置かなければならない。',
      en: 'A draft held each December in which clubs can select certain players left off other clubs’ 40-man rosters. A selected player must stay on the 26-man roster the following season.',
    },
    points: [
      {
        ja: '18歳以下で契約した選手は5シーズン以内、19歳以上で契約した選手は4シーズン以内に40人枠に入れないと、指名の対象になる',
        en: 'Players signed at 18 or younger must be added to the 40-man roster within five seasons, and those signed at 19 or older within four, or they become eligible',
      },
      {
        ja: '指名は前のシーズンの成績の逆順。指名した球団は、元の球団に10万ドルを払う',
        en: 'Clubs pick in reverse order of the previous season’s standings and pay $100,000 to the player’s former club',
      },
      {
        ja: '26人枠から外すにはウェーバーにかける必要があり、獲得する球団が無ければ、元の球団に5万ドルで戻すことを申し出なければならない',
        en: 'To remove him from the 26-man roster the club must place him on waivers, and if he clears, offer him back to his original club for $50,000',
      },
      {
        ja: '負傷者リストに入れることはできるが、90日以上は出場できる状態で登録されている必要がある',
        en: 'He can go on the injured list but must be active for at least 90 days',
      },
    ],
    source: `${G}/rule-5-draft`,
    sourceName: SRC.ja,
  },
  {
    id: 'cbt',
    title: { ja: 'ぜいたく税（競争均衡税）', en: 'Luxury tax (Competitive Balance Tax)' },
    question: { ja: 'MLBのぜいたく税とは？', en: 'What is the luxury tax in MLB?' },
    summary: {
      ja: '年俸総額が決められた基準額を超えた球団に、超えた分に対してかかる税。超えた年が続くほど税率が上がる。年俸総額に上限を設けるサラリーキャップとは別の仕組み。',
      en: 'A tax on each dollar a club’s payroll exceeds a set threshold, with rates rising for consecutive years over. It is a different mechanism from a salary cap, which would limit payroll outright.',
    },
    points: [
      {
        ja: '年俸総額は、40人枠の選手の契約の年平均額と、選手の福利厚生費の合計で計算する',
        en: 'Payroll is calculated from the average annual value of each contract on the 40-man roster plus player benefits',
      },
      {
        ja: '税率は、超えた1年目が20%、2年連続が30%、3年連続以上が50%。基準額を下回る年があると1年目の扱いに戻る',
        en: 'The rate is 20 percent in the first year over, 30 percent in the second straight year and 50 percent in the third or later; dipping under resets it',
      },
      {
        ja: '基準額を2000万ドル以上超えると追加の税率がかかる（2000万〜4000万ドル：12%／4000万〜6000万ドル：1年目42.5%・連続した年は45%／6000万ドル以上：60%）',
        en: 'Surcharges apply from $20 million over: 12 percent ($20-40 million), 42.5 percent in the first year and 45 percent in consecutive years ($40-60 million), and 60 percent ($60 million or more)',
      },
      {
        ja: '4000万ドル以上超えた球団は、次のドラフトで最上位の指名権が10番下がる（指名権が全体6位以内なら、2番目に高い指名権が下がる）',
        en: 'Clubs $40 million or more over have their highest pick in the next draft moved back 10 places (their second-highest if that pick is in the top six)',
      },
    ],
    source: `${G}/competitive-balance-tax`,
    sourceName: SRC.ja,
  },
];

/** ぜいたく税の基準額（2022〜26年の労使協定・百万ドル）。出典は用語集のぜいたく税の項。 */
export const CBT_THRESHOLDS: { year: number; usdM: number }[] = [
  { year: 2022, usdM: 230 },
  { year: 2023, usdM: 233 },
  { year: 2024, usdM: 237 },
  { year: 2025, usdM: 241 },
  { year: 2026, usdM: 244 },
];

export function guideSourceName(en: boolean): string {
  return en ? SRC.en : SRC.ja;
}

/**
 * FAQ（画面と FAQPage が同じ配列）。答えは各用語の定義＋今年の実例の1文（呼び出し側が data から組んで渡す）。
 * 実例が無い用語は定義だけ＝ここで事実を足さない。
 */
export function buildGuideFaq(extra: Partial<Record<GuideTermId, Bi>>): FaqItem[] {
  return GUIDE_TERMS.map((t) => {
    const x = extra[t.id];
    return {
      q: t.question,
      a: { ja: `${t.summary.ja}${x ? x.ja : ''}`, en: `${t.summary.en}${x ? ` ${x.en}` : ''}` },
    };
  });
}
