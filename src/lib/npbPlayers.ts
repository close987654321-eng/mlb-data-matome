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
      ja: 'FanGraphs によれば2025年は防御率2.59・FIP2.49、K-BB率17.8%は規定投球回到達者で5位。Just Baseball はチェンジアップとスプリットを「ダブルプラス級（Stuff+ 164）」と高評価。ESPNはスカウトが左腕ダニー・クーロムになぞらえると伝える。剛速球ではなく完成度で見せる左腕。',
      en: 'Per FanGraphs, he posted a 2.59 ERA and 2.49 FIP in 2025, with a 17.8% K-BB rate that ranked fifth among qualifiers. Just Baseball grades his changeup and splitter as “arguably double-plus” (a 164 Stuff+), and ESPN says scouts liken him to lefty Danny Coulombe. A polish-over-power southpaw.',
    },
    posting: {
      ja: 'ポスティング/FAの公式発表はまだ。西武の先発の柱として続投中。',
      en: 'No posting or move has been announced; he remains a rotation anchor for Seibu.',
    },
    comp: {
      ja: 'チェンジアップ／スプリットと制球で見せる、完成度の高い先発左腕。',
      en: 'A polished left-handed starter who wins with a changeup/splitter and command.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/隅田知一郎'],
    season: {
      asOf: '2026-06-30',
      sourceUrl: 'https://npb.jp/bis/players/21025155.html',
      stats: [
        { ja: '登板', en: 'G', value: '12' },
        { ja: '防御率', en: 'ERA', value: '2.30' },
        { ja: '勝-敗', en: 'W-L', value: '6-4' },
        { ja: '投球回', en: 'IP', value: '90.0' },
        { ja: '奪三振', en: 'SO', value: '87' },
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

/** この選手に触れた記事（タグ一致）。npb 記事が増えたら自動でハブの「海外の反応」束に出る。 */
export function npbThreadsOf(player: NpbProspect, all: Thread[]): Thread[] {
  const names = new Set([player.nameJa, ...(player.aliases ?? [])]);
  return all.filter((t) => (t.tags ?? []).some((tag) => names.has(tag)));
}
