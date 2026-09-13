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
  /**
   * ポスティング/MLB挑戦の「現在地」（報道ベース・断定しない）。
   *
   * なぜ別フィールドか: `posting` は通年で置ける一般論の見通しだが、オフが近づくと読者の検索は
   * 「{選手名} ポスティング」「{選手名} メジャー どこ」＝**いつ・どこが・誰が報じたか**に変わる。
   * 一般論の1段落では答えられないので、日付つきの報道時系列と関心球団を構造で持つ。
   * 書けるのは**実在の報道に書かれた事実だけ**（出典URL必須・§4.4）。憶測・予想は書かない。
   */
  postingWatch?: {
    /** expected=有力と報じられた / rumored=取り沙汰されている / watch=公式な動きはまだ無い */
    level: 'expected' | 'rumored' | 'watch';
    /** 更新日（JST）。古いまま置かない＝鮮度がそのまま信頼になる面。 */
    asOf: string;
    /** 現在地の1〜2文（LPの見出し直下・meta description にも効く）。 */
    headline: { ja: string; en: string };
    /** 関心が「報じられた」球団だけ（推測で足さない）。 */
    suitors?: { ja: string; en: string }[];
    /** 報道の時系列（新しい順）。source は実在URL・sourceName は媒体名。 */
    timeline: { date: string; ja: string; en: string; source: string; sourceName: string }[];
  };
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
      ja: '左の長打力と三塁守備の両立はMLBでも希少な素材。2026年は打率.321・35本塁打・92打点でセ・リーグ三冠のいずれもトップ争いに立ち、OPSは1.029。2026年WBCでは5試合で打球速度100マイル超を3本記録した。一方でMLB側の評価が割れるのは守備で、「三塁に残れるかは疑問、行き先は一塁では」と見るスカウトもいる。',
      en: 'A left-handed power bat that can also defend the hot corner is scarce in MLB. In 2026 he is in the hunt for the Central League triple crown (.321, 35 HR, 92 RBI, 1.029 OPS), and he produced three batted balls over 100 mph in five games at the 2026 WBC. Where evaluators split is defense: some question whether he sticks at third base in MLB and see first base as the landing spot.',
    },
    posting: {
      ja: '今オフのポスティングが有力視されている。ポスティング後の交渉期間は45日間だが、現行労使協定が12月1日に切れるため、各球団はそれまでに決着させたい事情がある。ただしポスティングは球団の権利で、阪神が容認するかは確定していない＝国内では「簡単に許せる状況なのか疑問が残る」という見方も出ている。',
      en: 'A posting this offseason is widely expected. Teams get a 45-day negotiating window once he is posted, but with the current CBA expiring on December 1, clubs have reason to get a deal done before then. The caveat: posting is the club\u2019s call, and Hanshin has not committed \u2014 some in Japan question whether the Tigers are in a position to let him go.',
    },
    postingWatch: {
      level: 'expected',
      asOf: '2026-09-13',
      headline: {
        ja: '今オフ、11月中旬にもポスティング申請の見込み。メッツ・ヤンキース・ドジャース・フィリーズの関心が報じられ、メッツのデビッド・スターンズ編成本部長は来日して視察した。',
        en: 'Expected to be posted as soon as mid-November. The Mets, Yankees, Dodgers and Phillies have all been linked, and Mets baseball boss David Stearns scouted him in person in Japan.',
      },
      suitors: [
        { ja: 'メッツ', en: 'Mets' },
        { ja: 'ヤンキース', en: 'Yankees' },
        { ja: 'ドジャース', en: 'Dodgers' },
        { ja: 'フィリーズ', en: 'Phillies' },
      ],
      timeline: [
        {
          date: '2026-09-03',
          ja: 'MLB公式サイトが「メッツら複数球団が関心」と報道。スターンズ編成本部長が来日して阪神の試合を視察し、その試合で佐藤は32号を放った。',
          en: 'MLB.com reports multiple clubs are interested. Mets baseball boss David Stearns attended a Tigers game in Japan, where Sato hit his 32nd homer.',
          source: 'https://www.mlb.com/news/mets-reportedly-interested-in-npb-star-teruaki-sato',
          sourceName: 'MLB.com',
        },
        {
          date: '2026-08-29',
          ja: '国内では慎重な見方も。野球評論家の新井宏昌氏は「ポスティングはあくまで球団の権利です。阪神が今、佐藤のメジャー移籍を簡単に許せる状況なのかというと、疑問が残ります」と指摘した。',
          en: 'A more cautious read from Japan: analyst Hiroaki Arai noted that posting is the club\u2019s right, and questioned whether Hanshin is in a position to simply let Sato leave.',
          source: 'https://full-count.jp/2026/08/29/post2009308/',
          sourceName: 'Full-Count',
        },
        {
          date: '2026-08-16',
          ja: 'ニューヨーク・ポストのジョン・ヘイマン記者が、メッツ・ヤンキース・ドジャース・フィリーズの関心を報道。ポスティングは「11月中旬ごろ」、12月1日のロックアウトで交渉が止まる前に決める必要がある、とも伝えた。',
          en: 'Jon Heyman of the New York Post reports interest from the Mets, Yankees, Dodgers and Phillies, with a posting expected "mid-November or so" and negotiations freezing at the December 1 lockout.',
          source: 'https://www.mlbtraderumors.com/2026/08/mets-yankees-dodgers-phillies-interested-in-teruaki-sato.html',
          sourceName: 'MLB Trade Rumors',
        },
        {
          date: '2026-03-14',
          ja: 'MLB Trade Rumors が ESPN のホルヘ・カスティーヨ記者の情報として、伊藤大海と佐藤輝明が来オフにポスティングされる見込みだと伝えた。比較対象に挙げられたのはライアン・オハーン。',
          en: 'MLB Trade Rumors, citing ESPN\u2019s Jorge Castillo, reports that Hiromi Itoh and Teruaki Sato are expected to be posted next winter. Sato\u2019s listed comp: Ryan O\u2019Hearn.',
          source: 'https://www.mlbtraderumors.com/2026/03/hiromi-itoh-teruaki-sato-expected-to-be-posted-for-mlb-teams-next-winter.html',
          sourceName: 'MLB Trade Rumors',
        },
      ],
    },
    comp: {
      ja: '長打とパワーで魅せる、左打ちのコーナー・スラッガー型。MLBTR が挙げた比較対象はライアン・オハーン。',
      en: 'A left-handed corner slugger built around power and loud contact. MLBTR\u2019s listed comp is Ryan O\u2019Hearn.',
    },
    aliases: ['佐藤輝'],
    sameAs: ['https://ja.wikipedia.org/wiki/佐藤輝明', 'https://www.mlbtraderumors.com/players/teruaki-sato'],
    season: {
      asOf: '2026-09-13',
      sourceUrl: 'https://npb.jp/bis/players/41045153.html',
      stats: [
        { ja: '試合', en: 'G', value: '124' },
        { ja: '打率', en: 'AVG', value: '.321' },
        { ja: '本塁打', en: 'HR', value: '35' },
        { ja: '打点', en: 'RBI', value: '92' },
        { ja: 'OPS', en: 'OPS', value: '1.029' },
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
      ja: '球速とアームの強さはMLB級。ESPN のジェフ・パッサン記者は直球が平均95.6マイル（約154km/h）で100マイルに届くとし、今オフのFA投手ではタリク・スクーバルに次ぐ2番手になりうると評した。身長5フィート8インチ（約173cm）・220ポンド（約100kg）という体格は現地でも話題で、MLB Trade Rumors は「消火栓の形に鍛え上げられた」と描写した。2026年は先発で防御率1.36（132回）。',
      en: 'Velocity and arm strength that play in MLB. ESPN\u2019s Jeff Passan notes a fastball averaging 95.6 mph that has touched 100, and rates him a candidate to be the second-best free agent starter available this winter behind Tarik Skubal. His 5-foot-8, 220-pound frame is a talking point abroad \u2014 one write-up described him as "forged in the shape of a fire hydrant." In 2026 he has a 1.36 ERA over 132 innings as a starter.',
    },
    posting: {
      ja: '今オフのポスティングが有力視されている。2027年を終えると9年で海外FA権を得てポスティングの対象外になるため、西武にとっては譲渡金を得られる最後の機会にあたる。交渉は12月1日の労使協定切れ（ロックアウト見込み）より前に決着する見通し。',
      en: 'A posting this offseason is widely expected. He reaches nine professional seasons after 2027 \u2014 at which point he would be a full free agent and no longer postable \u2014 so this winter is Seibu\u2019s last chance to collect a posting fee. Negotiations are expected to close before the CBA expires on December 1.',
    },
    postingWatch: {
      level: 'expected',
      asOf: '2026-09-13',
      headline: {
        ja: '今オフ、11月上旬にもポスティング申請の見込み（ESPN・ジェフ・パッサン記者）。直近の登板には15球団超が評価担当を送り込んでいる。',
        en: 'Expected to be posted as soon as early November, per ESPN\u2019s Jeff Passan. More than 15 MLB clubs have sent evaluators to his recent starts.',
      },
      suitors: [
        { ja: 'メッツ', en: 'Mets' },
        { ja: 'ブルージェイズ', en: 'Blue Jays' },
        { ja: 'ヤンキース', en: 'Yankees' },
        { ja: 'パドレス', en: 'Padres' },
        { ja: 'ホワイトソックス', en: 'White Sox' },
        { ja: 'カブス', en: 'Cubs' },
        { ja: 'エンゼルス', en: 'Angels' },
        { ja: 'マリナーズ', en: 'Mariners' },
        { ja: 'レンジャーズ', en: 'Rangers' },
      ],
      timeline: [
        {
          date: '2026-09-10',
          ja: 'MLB Trade Rumors が ESPN のジェフ・パッサン記者の情報として「11月上旬にもポスティングの見込み」と報道。15球団超が視察し、直球は平均95.6マイル・最速100マイル。今オフのFA投手ではスクーバルに次ぐ2番手になりうると評された。',
          en: 'MLB Trade Rumors, citing ESPN\u2019s Jeff Passan, reports a posting expected in early November. More than 15 clubs have scouted him; his fastball averages 95.6 mph and has touched 100, and Passan rates him a possible No. 2 free agent starter behind Skubal.',
          source: 'https://www.mlbtraderumors.com/2026/09/kaima-taira-expected-to-be-posted-for-mlb-teams-this-offseason.html',
          sourceName: 'MLB Trade Rumors',
        },
        {
          date: '2025-11-26',
          ja: '日本経済新聞が、平良が3億円で契約更改し先発へ再転向する方針と報道。米挑戦については「早く行けるなら」という本人の言葉を見出しに立てた。',
          en: 'Nikkei reports he re-signed for 300 million yen and would move back to the rotation, with its headline quoting him on an MLB move: "if I can go soon."',
          source: 'https://www.nikkei.com/article/DGXZQOKC267OR0W5A121C2000000/',
          sourceName: '日本経済新聞',
        },
      ],
    },
    comp: {
      ja: '剛速球で押す、リリーフ／先発を兼ねるパワーアーム。キャリアの大半はリリーフで、先発をフルシーズン務めたのは2023年と2026年のみ。',
      en: 'A high-octane power arm who can work in relief or start. Most of his career has come in relief \u2014 2023 and 2026 are his only full seasons in a rotation.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/平良海馬', 'https://www.mlbtraderumors.com/players/kaima-taira'],
    season: {
      asOf: '2026-09-13',
      sourceUrl: 'https://npb.jp/bis/players/31035136.html',
      stats: [
        { ja: '登板', en: 'G', value: '21' },
        { ja: '防御率', en: 'ERA', value: '1.36' },
        { ja: '勝-敗', en: 'W-L', value: '11-4' },
        { ja: '投球回', en: 'IP', value: '132.0' },
        { ja: '奪三振', en: 'SO', value: '124' },
      ],
    },
  },
  {
    slug: 'takahashi-hiroto',
    nameJa: '髙橋宏斗',
    nameEn: 'Hiroto Takahashi',
    team: { ja: '中日ドラゴンズ', en: 'Chunichi Dragons' },
    pos: { ja: '投手（先発）', en: 'Pitcher (starter)' },
    bio: {
      ja: '中日ドラゴンズのエース格右腕。2002年生まれ、2020年ドラフト1位。2023年WBC優勝メンバー。150キロ台後半の直球とスプリットで三振を奪う、世代屈指の先発右腕。',
      en: 'A right-handed ace for the Chunichi Dragons. Born in 2002 and a 2020 first-round pick, he was part of Japan’s 2023 WBC-winning squad. He misses bats with a high-90s mph fastball and a sharp splitter, and is one of the best starters of his generation.',
    },
    mlbWatch: {
      ja: '海外メディアは「まだMLBに居ない中で最高クラスの投手」「日本人先発で屈指の伸びしろ」と評する。2024年は防御率1.38とリーグ最高クラスで圧巻だったが2025年は不振と波もある。山本由伸とオフに合同自主トレを組む間柄で、ドジャースの関心も取り沙汰される。',
      en: 'Overseas outlets call him maybe the best NPB pitcher who hasn’t joined MLB yet, with one of the highest ceilings of any Japanese starter. He was dominant in 2024 (a league-best 1.38 ERA) but uneven in 2025. He trains with Yoshinobu Yamamoto in the offseason, and Dodgers interest has been floated.',
    },
    posting: {
      ja: 'ポスティングやFAでの移籍が2026〜2027年オフに取り沙汰される。正式な公表はまだなく、今後の安定感が鍵。',
      en: 'A move via the posting system or free agency is discussed for the 2026–27 offseason. Nothing is official yet; regaining consistency is the key.',
    },
    comp: {
      ja: '山本由伸と重ねられることが多い世代の先発右腕。ミッチ・ケラー型との見方も。',
      en: 'Often likened to Yoshinobu Yamamoto among his generation of starters; some see a Mitch Keller profile.',
    },
    aliases: ['高橋宏斗'],
    sameAs: ['https://ja.wikipedia.org/wiki/髙橋宏斗'],
    season: {
      asOf: '2026-06-29',
      sourceUrl: 'https://npb.jp/bis/players/61265153.html',
      stats: [
        { ja: '登板', en: 'G', value: '9' },
        { ja: '防御率', en: 'ERA', value: '4.86' },
        { ja: '勝-敗', en: 'W-L', value: '1-6' },
        { ja: '投球回', en: 'IP', value: '53.2' },
        { ja: '奪三振', en: 'SO', value: '58' },
      ],
    },
  },
  {
    slug: 'maki-shugo',
    nameJa: '牧秀悟',
    nameEn: 'Shugo Maki',
    team: { ja: '横浜DeNAベイスターズ', en: 'Yokohama DeNA BayStars' },
    pos: { ja: '二塁手', en: 'Second baseman' },
    bio: {
      ja: '横浜DeNAの主軸内野手。2020年ドラフト2位、2023年WBC優勝メンバー。通算打率.295・三振の少なさとパワーを両立する右の二塁手。2024年はチームの26年ぶり日本一に貢献した。',
      en: 'A middle-of-the-order infielder for the Yokohama DeNA BayStars. A 2020 second-round pick and 2023 WBC champion, the right-handed second baseman pairs contact and pop (a .295 career average). He helped DeNA to its first Japan Series title in 26 years in 2024.',
    },
    mlbWatch: {
      ja: '海外スカウトは「NPBで最も総合力の高い打者の一人」と評価。卓越したバットコントロール（三振率15%未満）が武器で、2026年はwRC+165と打ちまくる。一方で四球が極端に少なく（5シーズン中3年で6%未満）、メジャーの精緻な投球への対応が課題。比較対象はジェフ・マクニールや全盛期ダニエル・マーフィー。',
      en: 'Scouts call him one of the most well-rounded bats in NPB. Elite bat-to-ball skills (a sub-15% strikeout rate) are his calling card, and he has raked to a 165 wRC+ in 2026. The question is a very low walk rate (under 6% in three of five seasons) against big-league pitching. Comps range from Jeff McNeil to prime Daniel Murphy.',
    },
    posting: {
      ja: '年齢・実績・本人の意思から「早ければ来オフにも渡米しうる最有力候補の一人」と海外メディア。ポスティング/FAは2027年オフが現実的な機会。',
      en: 'With his age, track record and stated interest, overseas outlets call him one of the most realistic candidates to make the jump as soon as next offseason; 2027 is the realistic window.',
    },
    comp: {
      ja: 'バット・ファーストの内野手としてジェフ・マクニール／全盛期ダニエル・マーフィー型。',
      en: 'A bat-first infielder in the Jeff McNeil / prime Daniel Murphy mold.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/牧秀悟'],
    season: {
      asOf: '2026-06-29',
      sourceUrl: 'https://npb.jp/bis/players/13115153.html',
      stats: [
        { ja: '試合', en: 'G', value: '36' },
        { ja: '打率', en: 'AVG', value: '.299' },
        { ja: '本塁打', en: 'HR', value: '6' },
        { ja: '打点', en: 'RBI', value: '25' },
        { ja: 'OPS', en: 'OPS', value: '.863' },
      ],
    },
  },
  {
    slug: 'morishita-shota',
    nameJa: '森下翔太',
    nameEn: 'Shota Morishita',
    team: { ja: '阪神タイガース', en: 'Hanshin Tigers' },
    pos: { ja: '外野手', en: 'Outfielder' },
    bio: {
      ja: '阪神タイガースの右の中軸外野手。2022年ドラフト1位。勝負強い打撃と長打力で、若くしてクリーンアップを担う。2026年は打率3割・17本塁打とブレイク中。',
      en: 'A right-handed middle-of-the-order outfielder for the Hanshin Tigers and a 2022 first-round pick. Clutch hitting and power have him batting cleanup early in his career; he is breaking out in 2026 (.300 with 17 homers).',
    },
    mlbWatch: {
      ja: '2026年はOPS.952と打棒爆発、特に左投手に滅法強い（前年は対左でwRC+181）。海外でも名前が挙がり始めたが、MLB挑戦の具体的な動きはまだなく、現状は「当面は日本に残る」との見立て。今後の積み上げ次第で評価が上がるタイプ。',
      en: 'He is mashing in 2026 (a .952 OPS), with big damage against lefties (a 181 wRC+ vs. LHP the prior year). His name is starting to come up abroad, but there is no concrete MLB move yet — evaluators currently file him under “likely to stay in Japan.” A profile whose stock can rise with more production.',
    },
    posting: {
      ja: 'ポスティング等の公表は無し。MLB挑戦が具体化するのはこれから。',
      en: 'No posting or move has been announced; any MLB push is still down the road.',
    },
    comp: {
      ja: 'ヒットとパワーはあるが守備価値は限定的、というマット・ヴィアリング型との見方。',
      en: 'Seen by some as a Matt Vierling type — hit and power, with limited defensive value.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/森下翔太'],
    season: {
      asOf: '2026-06-29',
      sourceUrl: 'https://npb.jp/bis/players/43145157.html',
      stats: [
        { ja: '試合', en: 'G', value: '69' },
        { ja: '打率', en: 'AVG', value: '.300' },
        { ja: '本塁打', en: 'HR', value: '17' },
        { ja: '打点', en: 'RBI', value: '43' },
        { ja: 'OPS', en: 'OPS', value: '.952' },
      ],
    },
  },
  {
    slug: 'murakami-shoki',
    nameJa: '村上頌樹',
    nameEn: 'Shoki Murakami',
    team: { ja: '阪神タイガース', en: 'Hanshin Tigers' },
    pos: { ja: '投手（先発）', en: 'Pitcher (starter)' },
    bio: {
      ja: '阪神タイガースの先発右腕。兵庫県南あわじ市出身、智辯学園高では2019年センバツ優勝のエース。2023年に投手として史上3人目（セ・リーグ初）の新人王＆MVP同時受賞。抜群の制球が持ち味。※ヤクルトの長距離砲・村上宗隆とは別人。',
      en: 'A right-handed starter for the Hanshin Tigers. From Minami-Awaji, Hyogo, he was the ace of Chiben Gakuen’s 2019 national championship team. In 2023 he became just the third player ever — a Central League first — to win Rookie of the Year and MVP in the same season. Pinpoint command is his calling card. (Not to be confused with slugger Munetaka Murakami.)',
    },
    mlbWatch: {
      ja: '2026年は防御率2.13・WHIP0.89と安定感が際立つ制球派右腕。剛速球ではなく完成度で勝負するタイプで、MLBではミドルローテーション級と見られる。海外での言及はまだ限定的。',
      en: 'A command right-hander posting a 2.13 ERA and 0.89 WHIP in 2026. He wins with polish rather than power, projecting as a mid-rotation arm in MLB. Overseas coverage is still limited.',
    },
    posting: {
      ja: '2027年オフのポスティングが見込まれるが公式発表はまだ。国際FA資格の取得は今後。',
      en: 'A 2027-offseason posting is anticipated but not announced; international free agency comes later.',
    },
    comp: {
      ja: '制球で投げる完成度の高いミドルローテーション右腕。',
      en: 'A polished, command-first mid-rotation right-hander.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/村上頌樹'],
    season: {
      asOf: '2026-06-30',
      sourceUrl: 'https://npb.jp/bis/players/13315153.html',
      stats: [
        { ja: '登板', en: 'G', value: '14' },
        { ja: '防御率', en: 'ERA', value: '2.13' },
        { ja: '勝-敗', en: 'W-L', value: '6-5' },
        { ja: '投球回', en: 'IP', value: '97.1' },
        { ja: '奪三振', en: 'SO', value: '81' },
      ],
    },
  },
  {
    slug: 'saiki-hiroto',
    nameJa: '才木浩人',
    nameEn: 'Hiroto Saiki',
    team: { ja: '阪神タイガース', en: 'Hanshin Tigers' },
    pos: { ja: '投手（先発）', en: 'Pitcher (starter)' },
    bio: {
      ja: '阪神タイガースの先発右腕。1998年生まれ、189cmの本格派。2016年ドラフト3位。2020年にトミー・ジョン手術を受け、2022年に約3年ぶりの実戦復帰を果たすと、2025年には防御率1.55でセ・リーグ最優秀防御率を獲得した。150キロ台後半の直球と鋭いスプリットが武器。',
      en: 'A right-handed starter for the Hanshin Tigers. Born in 1998 and standing 189 cm, the 2016 third-round pick underwent Tommy John surgery in 2020, returned in 2022 after nearly three years out, and won the 2025 Central League ERA title (1.55). A high-90s mph fastball and a sharp splitter are his weapons.',
    },
    mlbWatch: {
      ja: '海外の評価も高い。ドジャースのデーブ・ロバーツ監督は東京ドームの試合で大谷・フリーマンらから7奪三振した才木を「メジャー級の球質」と絶賛。ジャイアンツの編成トップ、バスター・ポージーも来日視察したと報じられた。MLB.comは「阪神がポスティングを認めていれば、最も引く手あまたのFA投手の一人になったはず」と評した。',
      en: 'He is highly regarded abroad. After he struck out seven — including Ohtani and Freeman — in a Tokyo Dome game, Dodgers manager Dave Roberts called his stuff "major-league." Giants baseball boss Buster Posey reportedly traveled to Japan to scout him, and MLB.com wrote he would have been "one of the most sought-after free-agent pitchers had Hanshin agreed to post him."',
    },
    posting: {
      ja: '2025年オフにポスティングを申請したが、球団が主力先発の同時流出を避けるため不承認とした。MLB志向は公言しており、将来的な挑戦の可能性は高い。',
      en: 'He filed for posting after the 2025 season, but the club declined it to avoid losing two rotation arms at once. He has stated his MLB ambitions, and a future move looks likely.',
    },
    comp: {
      ja: '150キロ台後半の直球とスプリットで押す、MLBミドルローテーション級の本格派右腕。',
      en: 'A power right-hander with a high-90s fastball and splitter, projecting as an MLB mid-rotation starter.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/才木浩人'],
    season: {
      asOf: '2026-06-30',
      sourceUrl: 'https://npb.jp/bis/players/41745134.html',
      stats: [
        { ja: '登板', en: 'G', value: '14' },
        { ja: '防御率', en: 'ERA', value: '3.06' },
        { ja: '勝-敗', en: 'W-L', value: '5-4' },
        { ja: '投球回', en: 'IP', value: '82.1' },
        { ja: '奪三振', en: 'SO', value: '105' },
      ],
    },
  },
  {
    slug: 'sumida-chihiro',
    nameJa: '隅田知一郎',
    nameEn: 'Chihiro Sumida',
    team: { ja: '埼玉西武ライオンズ', en: 'Saitama Seibu Lions' },
    pos: { ja: '投手（先発・左腕）', en: 'Pitcher (LHP starter)' },
    bio: {
      ja: '埼玉西武ライオンズの先発左腕。制球と変化球で勝負するタイプで、2025年は防御率2.65・159回2/3を投げる働き。チェンジアップとスプリットは海外で「ダブルプラス級」と評される。',
      en: 'A left-handed starter for the Saitama Seibu Lions. A command-and-secondaries pitcher, he threw 159⅔ innings with a 2.65 ERA in 2025. His changeup and splitter are rated abroad as “arguably double-plus” pitches.',
    },
    mlbWatch: {
      ja: '2026年は防御率2.21・159回で143奪三振に対し与四球はわずか21＝K/BBは6.8に達し、自己最高の年になっている。FanGraphs によれば2025年も防御率2.59・FIP2.49で、K-BB率17.8%は規定投球回到達者の5位。Just Baseball はチェンジアップとスプリットを「ダブルプラス級（Stuff+ 164）」と評価し、直球の平均球速も自己最速の91.9マイルまで上げたと伝える。ESPN はスカウトが左腕ダニー・クーロムになぞらえると報じた。剛速球ではなく完成度で見せる左腕。',
      en: 'In 2026 he has a 2.21 ERA with 143 strikeouts against just 21 walks in 159 innings \u2014 a 6.8 K/BB and the best year of his career. FanGraphs had him at a 2.59 ERA and 2.49 FIP in 2025, with a 17.8% K-BB rate that ranked fifth among qualifiers. Just Baseball grades his changeup and splitter as "arguably double-plus" (a 164 Stuff+) and notes he pushed his average fastball to a career-best 91.9 mph. ESPN says scouts liken him to lefty Danny Coulombe. A polish-over-power southpaw.',
    },
    posting: {
      ja: 'ポスティング/FAの公式発表はまだ無く、西武の先発の柱として続投中。2022年ドラフト1位入団で海外FA権の取得はまだ先＝MLB挑戦は球団のポスティング判断しだいになる。',
      en: 'No posting or move has been announced; he remains a rotation anchor for Seibu. As a 2022 first-round pick he is years from international free agency, so an MLB move would depend on the club granting a posting.',
    },
    postingWatch: {
      level: 'watch',
      asOf: '2026-09-13',
      headline: {
        ja: 'ポスティングの公式な動きはまだ無い。ただ西武は今井達也がアストロズへ移り、平良海馬も今オフの流出が見込まれる＝先発の柱として残るのが隅田で、海外メディアは2026年WBC特集で「MLBの次のスターになりうる」と紹介している。',
        en: 'No posting has been announced. But Seibu has already lost Tatsuya Imai to the Astros and expects to lose Kaima Taira this winter \u2014 leaving Sumida as the rotation anchor, and overseas outlets have flagged him as a potential next MLB star in their 2026 WBC previews.',
      },
      timeline: [
        {
          date: '2026-09-10',
          ja: 'チームメートの平良海馬について「11月上旬にもポスティングの見込み」と報道（ESPN・パッサン記者／MLB Trade Rumors 経由）。西武からの投手流出はこれで3年続きとなる見通しで、隅田の去就にも視線が集まる。',
          en: 'Teammate Kaima Taira is reported as expected to be posted in early November (ESPN\u2019s Jeff Passan, via MLB Trade Rumors), which would make it three straight winters of Seibu pitchers drawing MLB interest.',
          source: 'https://www.mlbtraderumors.com/2026/09/kaima-taira-expected-to-be-posted-for-mlb-teams-this-offseason.html',
          sourceName: 'MLB Trade Rumors',
        },
        {
          date: '2026-01-04',
          ja: '同僚の髙橋光成がMLB3球団からオファーを受けたが西武残留を決断。オプトアウト条項付きの複数年契約で、来オフはFAとして市場に戻れる。',
          en: 'Teammate Kona Takahashi turned down offers from three MLB clubs and re-signed with Seibu on a multi-year deal with an opt-out that lets him return to the market as a free agent next offseason.',
          source: 'https://www.mlb.jp/2026/01/04/85920/',
          sourceName: 'MLB.jp',
        },
        {
          date: '2026-03-14',
          ja: 'ESPN が2026年WBCの特集で、隅田を「MLBの次のスターになりうる日本代表」の一人として紹介。前年159回2/3を投げて防御率2.65、スカウトの比較対象はダニー・クーロムとした。',
          en: 'ESPN features Sumida in its 2026 WBC piece on Team Japan players who could be MLB\u2019s next stars, citing his 2.65 ERA over 159\u2153 innings the prior season and a scouting comp to Danny Coulombe.',
          source: 'https://www.espn.com/mlb/story/_/id/48185225/mlb-2026-wbc-world-baseball-classic-japan-future-stars',
          sourceName: 'ESPN',
        },
      ],
    },
    comp: {
      ja: 'チェンジアップ／スプリットと制球で見せる、完成度の高い先発左腕。ESPN が伝えるスカウトの比較対象はダニー・クーロム。',
      en: 'A polished left-handed starter who wins with a changeup/splitter and command. The scouting comp reported by ESPN is Danny Coulombe.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/隅田知一郎', 'https://www.fangraphs.com/players/chihiro-sumida/sa3063941/stats/pitching'],
    season: {
      asOf: '2026-09-13',
      sourceUrl: 'https://npb.jp/bis/players/21025155.html',
      stats: [
        { ja: '登板', en: 'G', value: '22' },
        { ja: '防御率', en: 'ERA', value: '2.21' },
        { ja: '勝-敗', en: 'W-L', value: '9-7' },
        { ja: '投球回', en: 'IP', value: '159.0' },
        { ja: '奪三振', en: 'SO', value: '143' },
      ],
    },
  },
  {
    slug: 'sotani-ryuhei',
    nameJa: '曽谷龍平',
    nameEn: 'Ryuhei Sotani',
    team: { ja: 'オリックス・バファローズ', en: 'Orix Buffaloes' },
    pos: { ja: '投手（先発・左腕）', en: 'Pitcher (LHP starter)' },
    bio: {
      ja: 'オリックス・バファローズの先発左腕。2000年生まれ、白鷗大から2022年ドラフト1位。2026年WBC日本代表。低〜中速の直球と鋭いスウィーパーで左打者を封じる、山本由伸の後継と目される左腕。',
      en: 'A left-handed starter for the Orix Buffaloes. Born in 2000 and a 2022 first-round pick out of Hakuoh University, he was named to Japan’s 2026 WBC roster. He shuts down lefties with a low-to-mid-90s fastball and a sharp sweeper, and is seen as an heir to Yoshinobu Yamamoto.',
    },
    mlbWatch: {
      ja: 'Just Baseball は「4.01の防御率は見かけほど悪くなく、FIP・SIERAはともに2.93。打球運と守備に恵まれなかっただけ」と指摘。右打者用の球種が課題だが、左打者は速球とスウィーパーで支配し続けるとみる。EssentiallySports は山本由伸の“精神的後継者”と位置づけ、WBC2026選出で海外の認知も高まった。',
      en: 'Just Baseball notes his 4.01 ERA masked much better underlying numbers (a 2.93 FIP and 2.93 SIERA) hurt by poor batted-ball luck and defense; he needs a pitch for righties but keeps dominating lefties. EssentiallySports frames him as a “spiritual successor to Yoshinobu Yamamoto,” and his 2026 WBC selection has raised his overseas profile.',
    },
    posting: {
      ja: 'ポスティング/FAの公式な見通しはまだ。WBC2026での活躍が評価を押し上げる可能性。',
      en: 'No posting or free-agency timetable yet; a strong 2026 WBC could lift his stock.',
    },
    comp: {
      ja: '速球とスウィーパーで左を封じる、山本由伸型を目指す先発左腕。',
      en: 'A left-handed starter in the mold Orix hopes will succeed Yoshinobu Yamamoto, living off a fastball-sweeper mix.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/曽谷龍平'],
    season: {
      asOf: '2026-06-30',
      sourceUrl: 'https://npb.jp/bis/players/81985157.html',
      stats: [
        { ja: '登板', en: 'G', value: '8' },
        { ja: '防御率', en: 'ERA', value: '3.08' },
        { ja: '勝-敗', en: 'W-L', value: '4-3' },
        { ja: '投球回', en: 'IP', value: '49.2' },
        { ja: '奪三振', en: 'SO', value: '45' },
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

/**
 * 記事の主役の注目株（タグを先頭から見て最初に一致したもの）。
 * MLB 記事の `primaryPlayerOf` にあたる役で、記事パンくずに /prospects の選手LPを挟むのに使う
 * ＝NPB 選手は players.ts に居ないため primaryPlayerOf が効かず、記事→LP が片方向のままだった。
 */
export function npbProspectOf(tags: string[] | undefined): NpbProspect | undefined {
  for (const tag of tags ?? []) {
    const p = BY_JA.get(tag);
    if (p) return p;
  }
  return undefined;
}

/** この選手に触れた記事（タグ一致）。npb 記事が増えたら自動でハブの「海外の反応」束に出る。 */
export function npbThreadsOf(player: NpbProspect, all: Thread[]): Thread[] {
  const names = new Set([player.nameJa, ...(player.aliases ?? [])]);
  return all.filter((t) => (t.tags ?? []).some((tag) => names.has(tag)));
}
