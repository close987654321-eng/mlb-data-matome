import type { Thread } from '@/types/thread';

/**
 * NPB「next メジャーリーガー」＝MLB挑戦が注目される“まだNPBに居る”選手のカタログ（手キュレーション）。
 * MLB公式 Stats API は NPB を持たないので、選手詳細は軽量版（経歴／MLB注目点／ポスティング見通し／comp）。
 * 今季成績は公知の数値を編集時に手入力する想定（現状は準備中＝数値は載せない）。
 * 新しい注目選手はこの配列に1件足すだけで /prospects と /prospects/[slug] に出る（唯一の正）。
 */
export type NpbProspect = {
  /** kebab-case。URL（/prospects/[slug]）。手動採番で衝突を避ける。 */
  slug: string;
  nameJa: string;
  nameEn: string;
  team: { ja: string; en: string };
  pos: { ja: string; en: string };
  /** 経歴の地の文（実在の事実のみ）。 */
  bio: { ja: string; en: string };
  /** なぜMLBが注目するか（武器・素材）。 */
  mlbWatch: { ja: string; en: string };
  /** ポスティング/FAの見通し（断定しない・公知の範囲で）。 */
  posting: { ja: string; en: string };
  /** タイプの近いMLB選手像（comp）。 */
  comp: { ja: string; en: string };
  /** /player のMLBハブに飛ばせる確かな comp がある時だけ。 */
  compMlbSlug?: string;
  /** 記事タグの表記ゆれ（「タグが解決できる＝ハブが必ずある」担保）。 */
  aliases?: string[];
  /** Wikipedia 等の権威URL（E-E-A-T）。 */
  sameAs?: string[];
  /** 今季成績（公知の数値のみ・編集時に手入力。出典は NPB公式 npb.jp。MLB成績APIは NPB を持たないため自動取得しない）。 */
  season?: {
    asOf: string; // 集計時点（例: "2026-06-29"）
    sourceUrl: string; // 出典（NPB公式の個人成績ページ）
    stats: { ja: string; en: string; value: string }[]; // 見出し指標（5つ程度）
  };
};

export const NPB_PROSPECTS: NpbProspect[] = [
  {
    slug: 'sato-teruaki',
    nameJa: '佐藤輝明',
    nameEn: 'Teruaki Sato',
    team: { ja: '阪神タイガース', en: 'Hanshin Tigers' },
    pos: { ja: '三塁手', en: 'Third baseman' },
    bio: {
      ja: '阪神タイガースの長距離砲。2020年ドラフト1位入団。左打ちのパワーと三塁守備を兼ね備え、本塁打を量産するセ・リーグ屈指のスラッガー。',
      en: 'A left-handed power hitter for the Hanshin Tigers. A 2020 first-round pick, he pairs huge raw power with third-base defense and ranks among the Central League’s premier sluggers.',
    },
    mlbWatch: {
      ja: '左の長打力と三塁守備の両立はMLBでも希少な素材。コンタクトの安定が課題だが、はまった時の打球速度と飛距離はメジャースカウトが好む。',
      en: 'A left-handed power bat that can also defend the hot corner is scarce in MLB. Contact consistency is the question, but his exit velocity and raw pop are tools scouts covet.',
    },
    posting: {
      ja: '海外FA権の取得はまだ先で、当面は球団のポスティング判断次第。今後の成績しだいでMLB挑戦が現実味を帯びる。',
      en: 'Years from international free agency, so any move depends on the club granting a posting. A strong run would put an MLB jump on the table.',
    },
    comp: {
      ja: '長打とパワーで魅せる、左打ちのコーナー・スラッガー型。',
      en: 'A left-handed corner slugger built around power and loud contact.',
    },
    aliases: ['佐藤輝'],
    sameAs: ['https://ja.wikipedia.org/wiki/佐藤輝明'],
    season: {
      asOf: '2026-06-29',
      sourceUrl: 'https://npb.jp/bis/players/41045153.html',
      stats: [
        { ja: '試合', en: 'G', value: '69' },
        { ja: '打率', en: 'AVG', value: '.353' },
        { ja: '本塁打', en: 'HR', value: '16' },
        { ja: '打点', en: 'RBI', value: '49' },
        { ja: 'OPS', en: 'OPS', value: '1.087' },
      ],
    },
  },
  {
    slug: 'ito-hiromi',
    nameJa: '伊藤大海',
    nameEn: 'Hiromi Ito',
    team: { ja: '北海道日本ハムファイターズ', en: 'Hokkaido Nippon-Ham Fighters' },
    pos: { ja: '投手（先発）', en: 'Pitcher (starter)' },
    bio: {
      ja: '日本ハムのエース格右腕。2020年ドラフト1位、東京五輪・WBC代表。強い直球と多彩な変化球、勝負強い投球で先発の柱を担う。',
      en: 'A right-handed ace for the Nippon-Ham Fighters. A 2020 first-rounder and an Olympic and WBC representative, he anchors the rotation with a strong fastball, a deep mix, and competitive mound presence.',
    },
    mlbWatch: {
      ja: '本人もMLB志向を公言。先発として球速・制球・スタミナのバランスが良く、国際舞台での実績もスカウトの評価材料になる。',
      en: 'He has openly voiced his MLB ambitions. As a starter he balances velocity, command and durability, and his international résumé adds to the profile.',
    },
    posting: {
      ja: 'ポスティングでのMLB移籍が継続的に取り沙汰される。球団との合意が前提だが、近い将来の現実的な候補。',
      en: 'A posting move is recurrently discussed. It hinges on the club’s blessing, but he is a realistic near-future candidate.',
    },
    comp: {
      ja: '球速と制球を兼ね備えた、中先発〜先発タイプの右腕。',
      en: 'A mid-rotation right-hander who blends velocity with command.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/伊藤大海'],
    season: {
      asOf: '2026-06-29',
      sourceUrl: 'https://npb.jp/bis/players/51355153.html',
      stats: [
        { ja: '登板', en: 'G', value: '14' },
        { ja: '防御率', en: 'ERA', value: '2.86' },
        { ja: '勝-敗', en: 'W-L', value: '8-3' },
        { ja: '投球回', en: 'IP', value: '94.1' },
        { ja: '奪三振', en: 'SO', value: '88' },
      ],
    },
  },
  {
    slug: 'taira-kaima',
    nameJa: '平良海馬',
    nameEn: 'Kaima Taira',
    team: { ja: '埼玉西武ライオンズ', en: 'Saitama Seibu Lions' },
    pos: { ja: '投手', en: 'Pitcher' },
    bio: {
      ja: '西武の剛腕右腕。沖縄・石垣島出身。球界屈指の快速球を武器に、抑え・先発の双方で実績を残してきたパワーピッチャー。',
      en: 'A power right-hander for the Seibu Lions from Ishigaki, Okinawa. Armed with one of NPB’s hardest fastballs, he has succeeded both as a closer and as a starter.',
    },
    mlbWatch: {
      ja: '球速とアームの強さはMLB級。リリーフでの圧倒的な奪三振力と、先発転向後の対応力の両面でスカウトが注目する。',
      en: 'His velocity and arm strength play at the MLB level. Scouts track both his dominant relief strikeout stuff and his adjustment to a starting role.',
    },
    posting: {
      ja: '海外FA・ポスティングいずれも将来的な可能性として語られる。役割（先発/リリーフ）しだいでMLB評価も変わる注目株。',
      en: 'Both free agency and a posting are floated as future possibilities. His MLB valuation shifts with his role (starter vs. reliever).',
    },
    comp: {
      ja: '剛速球で押す、リリーフ／先発を兼ねるパワーアーム。',
      en: 'A high-octane power arm who can work in relief or start.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/平良海馬'],
    season: {
      asOf: '2026-06-29',
      sourceUrl: 'https://npb.jp/bis/players/31035136.html',
      stats: [
        { ja: '登板', en: 'G', value: '11' },
        { ja: '防御率', en: 'ERA', value: '0.89' },
        { ja: '勝-敗', en: 'W-L', value: '5-1' },
        { ja: '投球回', en: 'IP', value: '71.0' },
        { ja: '奪三振', en: 'SO', value: '66' },
      ],
    },
  },
];

const BY_SLUG = new Map(NPB_PROSPECTS.map((p) => [p.slug, p]));
const BY_JA = new Map<string, NpbProspect>();
for (const p of NPB_PROSPECTS) {
  BY_JA.set(p.nameJa, p);
  for (const a of p.aliases ?? []) BY_JA.set(a, p);
}

export function getNpbProspect(slug: string): NpbProspect | undefined {
  return BY_SLUG.get(slug);
}

/** 日本語名/エイリアス → slug。記事タグ → ハブの内部リンク解決に使う。 */
export function npbProspectSlugByJaName(nameJa: string): string | undefined {
  return BY_JA.get(nameJa)?.slug;
}

/** この選手に触れた記事（タグ一致）。npb 記事が増えたら自動でハブの「海外の反応」束に出る。 */
export function npbThreadsOf(player: NpbProspect, all: Thread[]): Thread[] {
  const names = new Set([player.nameJa, ...(player.aliases ?? [])]);
  return all.filter((t) => (t.tags ?? []).some((tag) => names.has(tag)));
}
