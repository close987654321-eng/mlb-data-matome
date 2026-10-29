import type { Thread } from '@/types/thread';

/**
 * NPB「next メジャーリーガー」＝MLB挑戦が注目される“まだNPBに居る”選手のカタログ（手キュレーション）。
 * MLB公式 Stats API は NPB を持たないので、選手詳細は軽量版（経歴／MLB注目点／ポスティング見通し／comp）。
 * 新しい注目選手はこの配列に1件足すだけで /prospects と /prospects/[slug] に出る（唯一の正）。
 *
 * 数値の担当分け（2026-09-16 から）:
 * - **成績はここに書かない**。年度別・今季・リーグ内順位は `data/npb-prospects-stats.json`
 *   （`scripts/fetch-npb-stats.mjs` が NPB公式から取得）を `src/lib/npbStats.ts` 経由で読む。
 *   手入力だった `season` は6月末の数値が9月まで据え置かれる事故を起こしたので `npbId` に置き換えた。
 * - ここに書くのは**編集判断が要るもの**だけ＝経歴・評価・ポスティング報道・想定市場規模・FAQ。
 */
export type NpbProspect = {
  /** kebab-case。URL（/prospects/[slug]）。手動採番で衝突を避ける。 */
  slug: string;
  nameJa: string;
  nameEn: string;
  /** NPB公式（npb.jp/bis/players/{id}.html）の選手ID。成績取得の鍵＝これが無いと数値が載らない。 */
  npbId: string;
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
    /**
     * MLBへ渡る道筋。ポスティングと海外FAは**読者の疑問が違う**（前者は「球団が認めるか」、
     * 後者は「本人が決めるだけ」）ので、同じ看板に混ぜない。
     * - posting … 球団の承認が要る（9年の出場登録日数に届いていない選手）
     * - intl-fa … 海外FA権を取得済み＝本人の意思だけで市場に出られる
     */
    route: 'posting' | 'intl-fa';
    /** 申請・交渉の予定（報じられた範囲だけ）。「いつ動くのか」に answer box で答える枠。 */
    window?: { ja: string; en: string };
    /** 関心が「報じられた」球団だけ（推測で足さない）。 */
    suitors?: { ja: string; en: string }[];
    /**
     * 想定される契約規模。**自分で予想しない**＝記者・媒体が出した数字だけを、誰が言ったかごと持つ。
     * 「{選手名} 年俸」「{選手名} 契約」はオフの頭クエリで、憶測を書けば即その面の信頼を失う。
     */
    marketValue?: { ja: string; en: string; source: string; sourceName: string }[];
    /** 報道の時系列（新しい順）。source は実在URL・sourceName は媒体名。 */
    timeline: { date: string; ja: string; en: string; source: string; sourceName: string }[];
  };
  /**
   * 海外での評価を「強み／懸念」の対で持つ。地の文（mlbWatch）1本だと長所と不安が溶けて読めないが、
   * 読者の検索は「{選手名} 守備 不安」「{選手名} 課題」と割れている。媒体名を必ず添える（伝聞の出所を示す）。
   */
  scouting?: {
    strengths: { ja: string; en: string; sourceName?: string }[];
    concerns: { ja: string; en: string; sourceName?: string }[];
  };
  /**
   * 契約・資格まわりの事実（入団年・FA権・年俸）。「なぜ今オフなのか」はここでしか答えられない
   * ＝平良が今オフなのは2027年で9年に届きポスティング対象外になるから、髙橋光成が今オフなのは
   * 5月に海外FA権を取ったから、という具合に理由が選手ごとに違う。
   */
  contract?: {
    /** 入団年・ドラフト順位（NPB公式のプロフィール表記に合わせる）。 */
    debut: { ja: string; en: string };
    /** 海外FA権の現在地（取得済みか、いつ届くか）。報じられた事実だけ。 */
    fa: { ja: string; en: string };
    /** 今季の推定年俸（報道ベース）。出典必須。 */
    salary?: { ja: string; en: string; source: string; sourceName: string };
  };
  /**
   * よくある質問（AEO）。答えは**このページに載っている事実の言い換え**だけ＝ここで新しい主張をしない。
   * 「{選手名} いつメジャー」「{選手名} どこの球団」は会話型の検索で拾われる形なので、その形のまま持つ。
   */
  faq?: { q: { ja: string; en: string }; a: { ja: string; en: string } }[];
};

export const NPB_PROSPECTS: NpbProspect[] = [
  {
    slug: 'sato-teruaki',
    nameJa: '佐藤輝明',
    nameEn: 'Teruaki Sato',
    npbId: '41045153',
    team: { ja: '阪神タイガース', en: 'Hanshin Tigers' },
    pos: { ja: '三塁手', en: 'Third baseman' },
    bio: {
      ja: '阪神タイガースの長距離砲。2020年ドラフト1位入団。左打ちのパワーと三塁守備を兼ね備え、本塁打を量産するセ・リーグ屈指のスラッガー。',
      en: 'A left-handed power hitter for the Hanshin Tigers. A 2020 first-round pick, he pairs huge raw power with third-base defense and ranks among the Central League’s premier sluggers.',
    },
    mlbWatch: {
      ja: '左の長打力と三塁守備の両立はMLBでも希少な素材。2026年は打率・本塁打・打点の3部門でセ・リーグ1位となり、三冠王に輝いた。2026年WBCでは5試合で打球速度100マイル超を3本記録した。一方でMLB側の評価が割れるのは守備で、「三塁に残れるかは疑問、行き先は一塁では」と見るスカウトもいる。',
      en: 'A left-handed power bat that can also defend the hot corner is scarce in MLB. In 2026 he led the Central League in average, homers and RBI to win the triple crown, and he produced three batted balls over 100 mph in five games at the 2026 WBC. Where evaluators split is defense: some question whether he sticks at third base in MLB and see first base as the landing spot.',
    },
    posting: {
      ja: '阪神は2026年10月19日、ポスティングによるMLB移籍の容認を発表した。申請後の交渉期間は45日間だが、現行労使協定が12月1日に切れるとロックアウトで交渉が凍結されるため、各球団はそれまでに決着させたい事情がある。2026年1月の契約更改では代理人が求めた容認の文書化に球団が応じていなかったが、シーズン後に総合的に判断したと説明している。',
      en: 'On October 19, 2026, Hanshin announced it will post him for MLB clubs. Teams get a 45-day negotiating window once he is posted, but with the current CBA expiring on December 1 and a lockout freezing talks, clubs have reason to get a deal done before then. Hanshin had declined his agent\u2019s request for a written commitment in January 2026 contract talks, and said it reached the decision after weighing everything at season\u2019s end.',
    },
    postingWatch: {
      level: 'expected',
      asOf: '2026-10-26',
      headline: {
        ja: '阪神が10月19日にポスティング容認を発表した。申請は11月1日から可能で、正式な申請は日本シリーズの終了後になる見込み。メッツ・ヤンキース・ドジャース・フィリーズ・ブルージェイズの関心が報じられている。',
        en: 'Hanshin announced on October 19 that it will post him. Filings open on November 1, and the formal posting is expected after the Japan Series. The Mets, Yankees, Dodgers, Phillies and Blue Jays have all been linked.',
      },
      route: 'posting',
      window: {
        ja: '阪神は10月19日に容認を発表し、11月1日から申請できる。NPBの申請受付は12月15日までで、MLB Trade Rumors によれば正式な申請は日本シリーズの終了後になる。申請後の交渉期間は45日間で、期間内に契約しなければ2027年は阪神に戻る。12月1日に労使協定が切れてロックアウトに入れば交渉は凍結され、ESPNのジェフ・パッサン記者は佐藤・平良海馬・伊藤大海の3人とも12月1日より前に契約するとみていた。',
        en: 'Hanshin announced its approval on October 19, and filings open on November 1. NPB accepts postings through December 15, and MLB Trade Rumors says the formal posting will come after the Japan Series. The negotiating window then runs 45 days; if he does not sign, he returns to Hanshin for 2027. A lockout starting when the CBA expires on December 1 would freeze talks, and ESPN\u2019s Jeff Passan had expected Sato, Kaima Taira and Hiromi Itoh all to sign before that date.',
      },
      marketValue: [
        {
          ja: '直近の相場としてMLB Trade Rumorsが挙げるのは鈴木誠也のカブス5年8500万ドル。ポスティングの譲渡金は保証額の最初の2500万ドルに20%、次の2500万ドルに17.5%、5000万ドル超の部分に15%がかかる。',
          en: 'MLB Trade Rumors cites Seiya Suzuki\u2019s five-year, $85MM deal with the Cubs as a reference point. The release fee runs 20% of the first $25MM of guaranteed money, 17.5% of the next $25MM and 15% of anything above $50MM.',
          source: 'https://www.mlbtraderumors.com/2026/09/kaima-taira-expected-to-be-posted-for-mlb-teams-this-offseason.html',
          sourceName: 'MLB Trade Rumors',
        },
        {
          ja: '2025年オフに海を渡った打者の実額は、岡本和真がブルージェイズと4年総額6000万ドル（約94億円・契約ボーナス500万ドル込み、オプトアウトなし）、村上宗隆がホワイトソックスと2年総額3400万ドル（約53億6000万円）。',
          en: 'The bats who crossed over a year earlier landed here: Kazuma Okamoto signed four years and $60MM with the Blue Jays (including a $5MM signing bonus, no opt-outs), and Munetaka Murakami two years and $34MM with the White Sox.',
          source: 'https://www.chunichi.co.jp/article/1187969',
          sourceName: '中日スポーツ',
        },
      ],
      suitors: [
        { ja: 'メッツ', en: 'Mets' },
        { ja: 'ヤンキース', en: 'Yankees' },
        { ja: 'ドジャース', en: 'Dodgers' },
        { ja: 'フィリーズ', en: 'Phillies' },
        { ja: 'ブルージェイズ', en: 'Blue Jays' },
      ],
      timeline: [
        {
          date: '2026-10-19',
          ja: '阪神がポスティングによるMLB移籍の容認を発表した。嶌村聡球団本部長は「選手の強い要望だけで容認するということはない」としたうえで、2年連続のタイトル獲得や、村上宗隆・岡本和真の活躍でNPBの水準が海外でも証明されつつあることを挙げ、総合的な判断だと説明した。申請手続きは11月1日から。',
          en: 'Hanshin announced it will post him. Club executive Satoshi Shimamura said the club does not approve a posting on a player’s strong wishes alone, pointing to Sato’s back-to-back title seasons and to Munetaka Murakami and Kazuma Okamoto proving NPB’s level abroad as reasons for a decision made on the whole picture. Filings open on November 1.',
          source: 'https://www.daily.co.jp/tigers/2026/10/19/0020945650.shtml',
          sourceName: 'デイリースポーツ',
        },
        {
          date: '2026-10-19',
          ja: 'MLB Trade Rumors は、容認の時点で少なくとも5球団が関心を示していると伝えた。正式なポスティングは日本シリーズの終了後で、45日以内に契約しなければ2027年は阪神に戻る。12月1日からロックアウトに入った場合、明けた後に残りの交渉期間が約3週間あるとした。',
          en: 'MLB Trade Rumors reports at least five clubs had shown interest by the time of the announcement. The formal posting comes after the Japan Series, and if he does not sign within 45 days he returns to Hanshin for 2027. If a lockout begins December 1, roughly three weeks of his window would remain once it ends.',
          source: 'https://www.mlbtraderumors.com/2026/10/hanshin-tigers-agree-to-post-teruaki-sato.html',
          sourceName: 'MLB Trade Rumors',
        },
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
    scouting: {
      strengths: [
        { ja: '打撃はMLBでも通用するというのが現地の一致した見立て。MLB球団関係者は「打撃に関してはメジャーで十分に通用します」と語り、1年目から村上宗隆と同等の30本塁打級を打てるとみる。', en: 'The bat is the consensus. An MLB official said his hitting will play in the majors, projecting Munetaka Murakami\u2019s level of power \u2014 30-plus homers \u2014 right away.', sourceName: 'J-CASTニュース' },
        { ja: '本塁打の出にくい甲子園を本拠地にしながら長打を量産している点が、現地の分析スレでも繰り返し持ち出される。', en: 'He piles up extra-base hits while calling Koshien home, a park that suppresses homers \u2014 a point raised again and again in overseas analysis threads.' },
        { ja: '2026年WBCでは5試合で打球速度100マイル超を3本記録した。', en: 'At the 2026 WBC he produced three batted balls over 100 mph in five games.' },
        { ja: '米CBSスポーツは、村上宗隆より身体能力が高く、外野も現実的な選択肢になると評した。', en: 'CBS Sports judged him more athletic than Munetaka Murakami, making the outfield a viable option.', sourceName: 'CBS Sports' },
      ],
      concerns: [
        { ja: '三塁に残れるかどうか。MLB Trade Rumors は「三塁で通用するかは疑問」というスカウトの見方を伝え、最終的な守備位置は一塁になりうるとした。', en: 'Whether he sticks at third base. MLB Trade Rumors relays scouts calling him "questionable" there, with first base as the likely landing spot.', sourceName: 'MLB Trade Rumors' },
        { ja: '国内でも守備が論点。MLB球団関係者は「問題は守備ですね」として三塁からの送球の不安定さを挙げ、外野への転向もありうるとみる。', en: 'The same worry in Japan: an MLB official flagged his throwing from third as unreliable and floated a move to the outfield.', sourceName: 'J-CASTニュース' },
        { ja: '三振の多さはキャリアを通じての課題で、現地の議論でも「教科書どおりのパワーヒッター」と評される。', en: 'Strikeouts have been a career-long issue; overseas discussion files him as a textbook power hitter.' },
        { ja: '米CBSスポーツはコンタクト率66%（MLB平均77%）を挙げ、長く三塁を守るタイプではないとみる。', en: 'CBS Sports cites a 66% contact rate against the 77% MLB average and does not see him as a long-term third baseman.', sourceName: 'CBS Sports' },
      ],
    },
    contract: {
      debut: { ja: '2020年ドラフト1位（近畿大）。2021年から一軍でプレーしている。', en: 'A 2020 first-round pick out of Kindai University who has been in the top team since 2021.' },
      fa: { ja: '海外FA権に必要な9年の出場登録日数には届いていないため、ポスティングでの移籍になる。阪神は2026年10月19日に容認を発表した。', en: 'He is short of the nine years of service needed for international free agency, so his route is a posting. Hanshin announced its approval on October 19, 2026.' },
      salary: {
        ja: '2026年は推定4.5億円プラス出来高、総額5億円規模の単年契約。更改は1月30日までずれ込み、代理人が今オフのポスティング容認を文書で確約するよう求めたが、球団からの確約は得られなかった。',
        en: 'He signed a one-year deal for an estimated ¥450MM plus incentives (around ¥500MM total) on January 30, 2026. Talks dragged that late because his agent sought a written commitment to post him this winter, which the club did not give.',
        source: 'https://www.nikkei.com/article/DGXZQODH3127C0R30C26A1000000/',
        sourceName: '日本経済新聞',
      },
    },
    faq: [
      {
        q: { ja: '佐藤輝明はいつメジャーに行く？', en: 'When will Teruaki Sato go to MLB?' },
        a: { ja: '阪神は10月19日にポスティング容認を発表した。NPBの申請受付は11月1日からで、正式な申請は日本シリーズの終了後の見込み。申請後の交渉期間は45日間だが、12月1日に労使協定が切れてロックアウトに入れば交渉は凍結され、45日以内に契約しなければ2027年は阪神に戻る。', en: 'Hanshin announced on October 19 that it will post him. NPB filings open on November 1, and the formal posting is expected after the Japan Series. The window runs 45 days but freezes if a lockout begins when the CBA expires on December 1, and if he does not sign within it he returns to Hanshin for 2027.' },
      },
      {
        q: { ja: '佐藤輝明に興味を示しているMLB球団は？', en: 'Which MLB clubs are interested in Teruaki Sato?' },
        a: { ja: 'ニューヨーク・ポストのジョン・ヘイマン記者がメッツ・ヤンキース・ドジャース・フィリーズの関心を報じ、容認の時点でMLB Trade Rumors は少なくとも5球団が関心を示していると伝えた（ブルージェイズの名前も挙がっている）。メッツのデビッド・スターンズ編成本部長は来日して阪神の試合を視察している。', en: 'Jon Heyman of the New York Post has linked the Mets, Yankees, Dodgers and Phillies, and by the time of the announcement MLB Trade Rumors counted at least five interested clubs, the Blue Jays among them. Mets baseball boss David Stearns scouted a Tigers game in person in Japan.' },
      },
      {
        q: { ja: '阪神はポスティングを認めたの？', en: 'Has Hanshin agreed to post him?' },
        a: { ja: '認めた。阪神は2026年10月19日、嶌村聡球団本部長の会見でポスティングによるMLB移籍の容認を発表した。1月の契約更改では代理人が求めた容認の文書化に応じていなかったが、2年連続のタイトル獲得などを踏まえて総合的に判断したと説明している。', en: 'Yes. Club executive Satoshi Shimamura announced on October 19, 2026 that Hanshin will post him. The club had declined his agent\u2019s request for a written commitment in January, and said it decided on the whole picture, including his back-to-back title seasons.' },
      },
      {
        q: { ja: 'MLBではどのポジションを守る？', en: 'What position would he play in MLB?' },
        a: { ja: 'NPBでは三塁。MLBのスカウトは三塁に残れるか疑問視しており、一塁や外野への転向を想定する声がある。', en: 'He plays third base in NPB. MLB scouts question whether he stays there, and see first base or the outfield as possible destinations.' },
      },
      {
        q: { ja: '契約規模はどれくらいになる？', en: 'How big a contract could he get?' },
        a: { ja: '目安になるのは直近に海を渡った打者の実額で、岡本和真のブルージェイズ4年6000万ドル、村上宗隆のホワイトソックス2年3400万ドル、鈴木誠也のカブス5年8500万ドル。米CBSスポーツは、佐藤は村上の契約を上回りうると書いた。', en: 'The nearest yardsticks are the actual deals of recent NPB bats: Kazuma Okamoto\u2019s four years and $60MM with the Blue Jays, Munetaka Murakami\u2019s two years and $34MM with the White Sox, and Seiya Suzuki\u2019s five years and $85MM with the Cubs. CBS Sports wrote that Sato could command more than Murakami.' },
      },
    ],
  },
  {
    slug: 'ito-hiromi',
    nameJa: '伊藤大海',
    nameEn: 'Hiromi Ito',
    npbId: '51355153',
    team: { ja: '北海道日本ハムファイターズ', en: 'Hokkaido Nippon-Ham Fighters' },
    pos: { ja: '投手（先発）', en: 'Pitcher (starter)' },
    bio: {
      ja: '日本ハムのエース格右腕。2020年ドラフト1位、東京五輪・WBC代表。強い直球と多彩な変化球、勝負強い投球で先発の柱を担う。',
      en: 'A right-handed ace for the Nippon-Ham Fighters. A 2020 first-rounder and an Olympic and WBC representative, he anchors the rotation with a strong fastball, a deep mix, and competitive mound presence.',
    },
    mlbWatch: {
      ja: '本人もMLB志向を公言してきた右腕。球種は7つで直球は最速96マイル（約154km/h）、通算828回で防御率2.87・奪三振率21.7%に対し与四球率6.2%と、三振と制球を同時に成立させている点をMLB Trade Rumors が評価する。ESPNのホルヘ・カスティーヨ記者が挙げた比較対象はソニー・グレイ。東京五輪と2023年WBCの代表という国際舞台での実績も材料になる。一方、2026年は防御率が3点台に乗り、現地でも「全盛期を過ぎたのでは」という声とセットで語られている。',
      en: 'A right-hander who has long been open about wanting MLB. MLB Trade Rumors credits a seven-pitch mix with a fastball up to 96 mph and, over 828 career innings, a 2.87 ERA pairing a 21.7% strikeout rate with a 6.2% walk rate. ESPN\u2019s Jorge Castillo names Sonny Gray as the comp, and his Olympic and 2023 WBC appearances add to the résumé. The counterweight: his ERA climbed above 3.00 in 2026, and overseas discussion now pairs his name with the question of whether his prime has passed.',
    },
    posting: {
      ja: 'ポスティングでのMLB移籍を本人が熟考している。日本ハムは本人が望めば容認する方針と報じられており、決断は本人に委ねられている。',
      en: 'He is weighing a posting move. Nippon-Ham is reported to be ready to approve it if he commits, leaving the decision in his hands.',
    },
    postingWatch: {
      level: 'expected',
      asOf: '2026-10-26',
      headline: {
        ja: 'ポスティングでのMLB挑戦を本人が熟考しており、10月中に決断する意向（10月23日）。日本ハムは本人が移籍の意向を固めれば容認する方針と報じられ、代理人を通じて球団にメジャー挑戦の意思を伝えたとも報じられた。',
        en: 'He is weighing a posting and plans to decide by the end of October (October 23). Nippon-Ham is reported to approve a move if he commits, and he has reportedly told the club of his MLB ambition through his agent.',
      },
      route: 'posting',
      window: {
        ja: '本人は10月中に決断する意向。申請する場合、NPBの受付は11月1日から12月15日まで。申請後の交渉期間は45日間で、12月1日に労使協定が切れてロックアウトに入れば凍結される。ESPNのジェフ・パッサン記者は佐藤輝明・平良海馬とともに11月上旬の申請を見込んでいた。',
        en: 'He plans to decide by the end of October. If posted, NPB accepts filings from November 1 through December 15. The 45-day window freezes if a lockout begins when the CBA expires on December 1. ESPN\u2019s Jeff Passan had expected him to be posted in early November along with Teruaki Sato and Kaima Taira.',
      },
      marketValue: [
        {
          ja: 'MLB Trade Rumors は通算828回で防御率2.87、奪三振率21.7%、与四球率6.2%という数字を挙げ、直近の相場として鈴木誠也のカブス5年8500万ドルに触れた。譲渡金は保証額の最初の2500万ドルに20%、次の2500万ドルに17.5%、5000万ドル超に15%。',
          en: 'MLB Trade Rumors lists a 2.87 ERA with a 21.7% strikeout rate and 6.2% walk rate over 828 career innings, and points to Seiya Suzuki\u2019s five-year, $85MM Cubs deal as a reference. The release fee is 20% of the first $25MM, 17.5% of the next $25MM and 15% above $50MM.',
          source: 'https://www.mlbtraderumors.com/2026/03/hiromi-itoh-teruaki-sato-expected-to-be-posted-for-mlb-teams-next-winter.html',
          sourceName: 'MLB Trade Rumors',
        },
      ],
      suitors: [{ ja: 'ジャイアンツ', en: 'Giants' }],
      timeline: [
        {
          date: '2026-10-23',
          ja: 'ポスティングでMLB移籍を目指すかどうかを今月中に決断する意向を示し、「人生で一番の悩み。どっちもやりたいことではある。後悔しないように選びたい」と語った。日本ハムは伊藤がメジャー移籍の意向を固めれば容認する方針。',
          en: 'He said he would decide by the end of October whether to pursue a posting, calling it the hardest choice of his life and saying he wants to choose without regrets. Nippon-Ham plans to approve a move if he commits.',
          source: 'https://www.jiji.com/jc/article?k=2026102300969&g=spo',
          sourceName: '時事通信',
        },
        {
          date: '2026-10-17',
          ja: 'スポーツ報知が、伊藤が今オフのポスティングでのMLB挑戦を検討していると報道。代理人を通じて球団にメジャー挑戦の意思を伝えており、ポストシーズン終了後に正式な話し合いが行われる見込みとした。',
          en: 'Sports Hochi reports he is considering an MLB move via the posting system this winter, has told the club of his intentions through his agent, and is expected to hold formal talks with Nippon-Ham after the postseason.',
          source: 'https://pacificleague.com/news/amp/10056109',
          sourceName: 'パ・リーグ.com（スポーツ報知）',
        },
        {
          date: '2026-10-17',
          ja: 'サンフランシスコ・クロニクル紙が、ジャイアンツは平良海馬と伊藤をすでに調査していると報じた（FanSidedが紹介）。',
          en: 'The San Francisco Chronicle reported that the Giants have already looked into Kaima Taira and Itoh, as relayed by FanSided.',
          source: 'https://fansided.com/mlb/sf-giants-free-agent-target-is-buster-posey-s-last-chance-to-catch-the-dodgers',
          sourceName: 'FanSided',
        },
        {
          date: '2026-09-10',
          ja: 'MLB Trade Rumors が ESPN のジェフ・パッサン記者の情報として、佐藤輝明・平良海馬とともに伊藤も11月上旬にポスティングされる見込みだと伝えた。3人とも12月1日のロックアウト前に契約するとの見立て。',
          en: 'MLB Trade Rumors, citing ESPN\u2019s Jeff Passan, reports that Itoh \u2014 along with Teruaki Sato and Kaima Taira \u2014 is expected to be posted in early November, with all three projected to sign before the December 1 lockout.',
          source: 'https://www.mlbtraderumors.com/2026/09/kaima-taira-expected-to-be-posted-for-mlb-teams-this-offseason.html',
          sourceName: 'MLB Trade Rumors',
        },
        {
          date: '2026-03-14',
          ja: 'MLB Trade Rumors が ESPN のホルヘ・カスティーヨ記者の情報として、伊藤と佐藤輝明が来オフにポスティングされる見込みだと報道。ア・リーグの評価担当は「小柄だが耐久性の実績がある。MLBでも三振を取り続け、与四球は少ないままだろう」と評し、比較対象にソニー・グレイを挙げた。',
          en: 'MLB Trade Rumors, citing ESPN\u2019s Jorge Castillo, reports that Itoh and Teruaki Sato are expected to be posted next winter. An AL evaluator called him "smallish" but with a "proven track record of durability," expecting him to keep missing bats while walking almost no one. The listed comp: Sonny Gray.',
          source: 'https://www.mlbtraderumors.com/2026/03/hiromi-itoh-teruaki-sato-expected-to-be-posted-for-mlb-teams-next-winter.html',
          sourceName: 'MLB Trade Rumors',
        },
        {
          date: '2026-03-14',
          ja: 'Full-Count が ESPN の報道として、伊藤と佐藤輝明が今オフにMLB移籍する可能性を伝えた。伊藤は2025年に14勝・195奪三振・防御率2.52。勝利数は2年連続、奪三振はリーグ最多で、沢村賞を初受賞している。',
          en: 'Full-Count relays ESPN\u2019s reporting that Itoh and Sato could move to MLB this offseason. Itoh went 14-8 with 195 strikeouts and a 2.52 ERA in 2025, leading the league in wins and strikeouts and winning his first Sawamura Award.',
          source: 'https://full-count.jp/2026/03/14/post1920470/',
          sourceName: 'Full-Count',
        },
      ],
    },
    comp: {
      ja: '球速と制球を兼ね備えた、中先発〜先発タイプの右腕。',
      en: 'A mid-rotation right-hander who blends velocity with command.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/伊藤大海'],
    scouting: {
      strengths: [
        { ja: '球種は7つで、直球は最速96マイル（約154km/h）。通算828回で防御率2.87、奪三振率21.7%に対し与四球率6.2%と、三振と制球を両立している。', en: 'A seven-pitch mix with a fastball up to 96 mph. Over 828 career innings he has a 2.87 ERA with a 21.7% strikeout rate against a 6.2% walk rate.', sourceName: 'MLB Trade Rumors' },
        { ja: 'ア・リーグの評価担当は「小柄だが耐久性の実績がある。MLBでも三振を取り続け、与四球は少ないままだろう」と評した。比較対象はソニー・グレイ。', en: 'An AL evaluator called him smallish but with a proven track record of durability, expecting him to keep missing bats and walking almost no one. The comp: Sonny Gray.', sourceName: 'MLB Trade Rumors' },
        { ja: '2025年は14勝・195奪三振・防御率2.52でリーグ最多勝と最多奪三振を獲得し、沢村賞を初受賞した。最多勝は2年連続。', en: 'In 2025 he went 14-8 with 195 strikeouts and a 2.52 ERA, leading the league in wins for a second straight year and in strikeouts, and taking his first Sawamura Award.', sourceName: 'Full-Count' },
      ],
      concerns: [
        { ja: '身長5フィート9インチ（約176cm）という体格が、現地では留保材料として挙げられている。', en: 'His 5-foot-9 frame is a caveat raised abroad.', sourceName: 'MLB Trade Rumors' },
        { ja: '2026年は防御率が3点台に乗り、現地の議論では「全盛期を過ぎたのでは」「直球に球速が無いぶん、多くの球団では5番手扱いになる」という見方が出ている。', en: 'His ERA rose above 3.00 in 2026, and overseas discussion now asks whether his prime has passed, with some projecting him as a fifth starter because the fastball lacks velocity.', sourceName: 'r/NPB' },
        { ja: 'MLBの西地区球団のスカウトは投球スタイルをダルビッシュ有に重ねつつ「気になるのが勤続疲労ですね」と指摘し、今季は直球の平均球速が150キロに届いていないとした。規定投球回は6年連続で、今季の投球回はリーグ最多だった。', en: 'A scout from a West-division MLB club likened his style to Yu Darvish but flagged accumulated wear, noting his average fastball dipped below 150 kph this season. He has qualified for the ERA title six straight years and led the league in innings this season.', sourceName: 'AERA DIGITAL' },
      ],
    },
    contract: {
      debut: { ja: '2020年ドラフト1位（苫小牧駒沢大）。2021年から先発ローテーションに入り、東京五輪と2023年WBCの代表に選ばれた。', en: 'A 2020 first-round pick out of Tomakomai Komazawa University who joined the rotation in 2021 and represented Japan at the Tokyo Olympics and the 2023 WBC.' },
      fa: { ja: '海外FA権に必要な9年には届いていない。今オフに動くには日本ハムがポスティングを認める必要があり、球団は本人が望めば容認する方針と報じられている。', en: 'He is short of the nine years needed for international free agency, so a move this winter requires Nippon-Ham to post him; the club is reported to be ready to do so if he commits.' },
      salary: {
        ja: '2025年12月の契約更改で1億2000万円増の3億4000万円。入団6年目での3億円台到達は、2010年のダルビッシュ有に並ぶ球団最速となった。',
        en: 'He signed for ¥340MM in December 2025, a ¥120MM raise. Reaching ¥300MM in his sixth year matched Yu Darvish\u2019s 2010 mark as the fastest in franchise history.',
        source: 'https://www.hokkaido-np.co.jp/article/1247148/',
        sourceName: '北海道新聞',
      },
    },
    faq: [
      {
        q: { ja: '伊藤大海は今オフにメジャー移籍する？', en: 'Will Hiromi Itoh move to MLB this offseason?' },
        a: { ja: '本人は10月23日、ポスティングでMLB移籍を目指すかどうかを今月中に決めると話し、「人生で一番の悩み」と語った。日本ハムは本人が移籍の意向を固めれば容認する方針と報じられている。', en: 'On October 23 he said he would decide by month\u2019s end whether to pursue a posting, calling it the hardest decision of his life. Nippon-Ham is reported to approve a move if he commits.' },
      },
      {
        q: { ja: 'MLBでの比較対象は？', en: 'What is his MLB comp?' },
        a: { ja: 'ESPNのホルヘ・カスティーヨ記者が挙げた比較対象はソニー・グレイ。小柄でも多彩な球種と制球で長く先発を張るタイプ、という見立て。', en: 'ESPN\u2019s Jorge Castillo named Sonny Gray: a smaller starter who lasts on a deep mix and command.' },
      },
      {
        q: { ja: '2025年はどんな成績だった？', en: 'What did he do in 2025?' },
        a: { ja: '14勝8敗、195奪三振、防御率2.52。最多勝は2年連続、最多奪三振と沢村賞は初受賞だった。', en: 'He went 14-8 with 195 strikeouts and a 2.52 ERA, leading the league in wins for a second straight season and taking the strikeout title and the Sawamura Award for the first time.' },
      },
    ],
  },
  {
    slug: 'taira-kaima',
    nameJa: '平良海馬',
    nameEn: 'Kaima Taira',
    npbId: '31035136',
    team: { ja: '埼玉西武ライオンズ', en: 'Saitama Seibu Lions' },
    pos: { ja: '投手', en: 'Pitcher' },
    bio: {
      ja: '西武の剛腕右腕。沖縄・石垣島出身。球界屈指の快速球を武器に、抑え・先発の双方で実績を残してきたパワーピッチャー。',
      en: 'A power right-hander for the Seibu Lions from Ishigaki, Okinawa. Armed with one of NPB’s hardest fastballs, he has succeeded both as a closer and as a starter.',
    },
    mlbWatch: {
      ja: '球速とアームの強さはMLB級。ESPN のジェフ・パッサン記者は直球が平均95.6マイル（約154km/h）で100マイルに届くとし、今オフのFA投手ではタリク・スクーバルに次ぐ2番手になりうると評した。身長5フィート8インチ（約173cm）・220ポンド（約100kg）という体格は現地でも話題で、MLB Trade Rumors は「消火栓の形に鍛え上げられた」と描写した。2026年は先発に回り、パ・リーグの防御率1位でシーズンを終えた。',
      en: 'Velocity and arm strength that play in MLB. ESPN\u2019s Jeff Passan notes a fastball averaging 95.6 mph that has touched 100, and rates him a candidate to be the second-best free agent starter available this winter behind Tarik Skubal. His 5-foot-8, 220-pound frame is a talking point abroad \u2014 one write-up described him as "forged in the shape of a fire hydrant." In 2026 he moved into the rotation and finished as the Pacific League ERA leader.',
    },
    posting: {
      ja: '今オフのポスティングを本人が希望し、代理人が西武と交渉している。2027年を終えると9年で海外FA権を得てポスティングの対象外になるため、西武にとっては譲渡金を得られる最後の機会にあたる。交渉は12月1日の労使協定切れ（ロックアウト見込み）より前に決着すると見られていた。',
      en: 'He wants to be posted this winter, and his agent is negotiating with Seibu. He reaches nine professional seasons after 2027 \u2014 at which point he would be a full free agent and no longer postable \u2014 so this winter is Seibu\u2019s last chance to collect a posting fee. A deal had been expected before the CBA expires on December 1.',
    },
    postingWatch: {
      level: 'expected',
      asOf: '2026-10-29',
      headline: {
        ja: 'ポスティングでのMLB移籍を希望し、代理人が西武と交渉している。広池浩司球団本部長は10月26日、「少しずつ話はまとまりつつある」と話した。本人は「最終決定は球団」としており、西武の正式な容認発表はまだない。',
        en: 'He wants to be posted, and his agent is negotiating with Seibu. On October 26 club executive Koji Hiroike said things are gradually coming together. Taira has said the final call is the club\u2019s, and Seibu has made no formal announcement yet.',
      },
      route: 'posting',
      window: {
        ja: '代理人が西武と交渉中で、正式な容認発表はまだない。容認されれば、NPBの申請受付は11月1日から12月15日まで。ESPNのジェフ・パッサン記者は11月上旬の申請を見込んでいた。申請後の交渉期間は45日間で、12月1日に労使協定が切れてロックアウトに入れば凍結される。',
        en: 'His agent is negotiating with Seibu, and there is no formal approval yet. If approved, NPB accepts filings from November 1 through December 15; ESPN\u2019s Jeff Passan had expected an early-November posting. The 45-day window freezes if a lockout begins when the CBA expires on December 1.',
      },
      marketValue: [
        {
          ja: '東スポWEBは米球界関係者の見立てとして、年平均2000万〜2500万ドル・5〜6年の契約を想定し、条件次第で総額1億5000万ドル（約237億円）規模に達すると報じた。今季複数回視察したスカウトは、先発の3〜4番手として1年あたり2000万ドル規模のオファーになるとみる。',
          en: 'Tokyo Sports, citing people in the MLB industry, pegs a likely deal at $20MM–$25MM a year over five to six years, reaching about $150MM total depending on terms. A scout who watched him several times this season expects offers in the $20MM-a-year range as a No. 3 or 4 starter.',
          source: 'https://www.tokyo-sports.co.jp/articles/-/406389',
          sourceName: '東スポWEB',
        },
        {
          ja: 'パッサン記者が今オフのFA先発でスクーバルに次ぐ2番手と評価したことを受け、Full-Countは「1億ドル（約154億円）以上は確実」との見立てを伝えた。',
          en: 'After Passan rated him a possible No. 2 free agent starter behind Tarik Skubal, Full-Count reported the read that a deal north of $100MM is all but assured.',
          source: 'https://full-count.jp/2026/09/12/post2015158/',
          sourceName: 'Full-Count',
        },
        {
          ja: 'ポスティングの譲渡金は保証額の最初の2500万ドルに20%、次の2500万ドルに17.5%、5000万ドル超の部分に15%。西武にとっては譲渡金を得られる最後の機会にあたる。',
          en: 'The release fee is 20% of the first $25MM of guaranteed money, 17.5% of the next $25MM and 15% above $50MM. For Seibu this winter is the last chance to collect one.',
          source: 'https://www.mlbtraderumors.com/2026/09/kaima-taira-expected-to-be-posted-for-mlb-teams-this-offseason.html',
          sourceName: 'MLB Trade Rumors',
        },
      ],
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
        { ja: 'ジャイアンツ', en: 'Giants' },
      ],
      timeline: [
        {
          date: '2026-10-26',
          ja: '西武の広池浩司球団本部長が交渉の現状を説明した。「代理人とは何度も話しています。平良本人とは今のところ話す予定はないですけども、最後決まったときにはどこかで話そうと思っている」「少しずつ話はまとまりつつあるというところ」と述べた。',
          en: 'Seibu executive Koji Hiroike said the club has spoken with Taira’s agent many times, has no plans to meet Taira himself until a final decision, and that things are gradually coming together.',
          source: 'https://news.yahoo.co.jp/articles/70efb9bc9f642bd3900aa7afd36ef113ca892981',
          sourceName: 'スポーツ報知',
        },
        {
          date: '2026-10-20',
          ja: '代理人が球団と交渉を進めていると本人が明かした。「最終決定は球団」としたうえで、メジャーでは先発で投げたいと話し、「世界最高の選手がそろうところでプレーしたい」と語った。',
          en: 'He said his agent is negotiating with the club and that the final decision rests with Seibu. He added that he wants to start in the majors and to play where the world’s best players are.',
          source: 'https://kumanichi.com/articles/2048559',
          sourceName: '熊本日日新聞（共同通信）',
        },
        {
          date: '2026-10-17',
          ja: 'サンフランシスコ・クロニクル紙が、ジャイアンツは平良と伊藤大海をすでに調査していると報じた（FanSidedが紹介）。',
          en: 'The San Francisco Chronicle reported that the Giants have already looked into Taira and Hiromi Itoh, as relayed by FanSided.',
          source: 'https://fansided.com/mlb/sf-giants-free-agent-target-is-buster-posey-s-last-chance-to-catch-the-dodgers',
          sourceName: 'FanSided',
        },
        {
          date: '2026-10-12',
          ja: '西武の広池浩司球団本部長が、平良と話し合いの場を持つ考えを示した。「上を目指すのは理解できるが、代わりのいない選手なので複雑。しっかりと折り合いを付けたい」と述べた。',
          en: 'Seibu executive Koji Hiroike said the club would sit down with Taira: he understands the ambition, but Taira is irreplaceable, which makes it complicated, and the club wants to reach a proper understanding.',
          source: 'https://kumanichi.com/articles/2045842',
          sourceName: '熊本日日新聞（共同通信）',
        },
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
    scouting: {
      strengths: [
        { ja: '直球は平均95.6マイル（約153.8km/h）で最速100マイル（約161km/h）。ESPNのジェフ・パッサン記者は今オフのFA先発でタリク・スクーバルに次ぐ2番手になりうると評した。', en: 'The fastball averages 95.6 mph and has touched 100. ESPN\u2019s Jeff Passan rates him a candidate to be the second-best free agent starter available behind Tarik Skubal.', sourceName: 'ESPN' },
        { ja: '球種は8つ。打者が的を絞れない球種構成が評価されている。', en: 'He throws eight pitches, a mix evaluators credit with keeping hitters from settling on anything.', sourceName: 'MLB Trade Rumors' },
        { ja: '173cmながらリリースポイントまでの距離が200cmを超える。ナ・リーグのスカウトは「10センチ違うと打者が感じる体感速度も5キロ違うと言われている」と話し、155km/hが160km/h級に見えると評した。', en: 'Despite standing 173 cm he releases the ball more than 200 cm down the mound. An NL scout said every 10 cm of extension is worth about 5 kph of perceived velocity, making his 155 kph play like 160.', sourceName: '東スポWEB' },
        { ja: '2026年はパ・リーグの防御率1位でシーズンを終えた。シーズン中はパ・リーグ.comが、1958年に西鉄の稲尾和久が記録したリーグ記録（1.06）の更新に触れるほどだった。', en: 'He finished 2026 as the Pacific League ERA leader; during the season Pacific League.com even floated the chance of breaking Kazuhisa Inao\u2019s 1.06 league record from 1958.', sourceName: 'パ・リーグ.com' },
      ],
      concerns: [
        { ja: '173cm・99kgという体格。パッサン記者は「消火栓の形に鍛え上げられた」と描写し、FanGraphsは「捕手のような」と表現した。MLBのスカウトは背が低すぎる投手や角ばった体型を避けるよう教えられてきた、とFull-Countは書いている。', en: 'The build. Passan described him as "forged in the shape of a fire hydrant," and FanGraphs called it "catcherly." Full-Count notes MLB scouts are trained to steer clear of pitchers who are too short or too blocky.', sourceName: 'ESPN / FanGraphs' },
        { ja: '2024年に前腕の張りを抱え、2025年はリリーフに戻っている。先発をフルシーズン務めたのは2023年と2026年だけで、耐久性は未知数とされる。', en: 'Forearm tightness in 2024 sent him back to the bullpen in 2025. He has started a full season only in 2023 and 2026, leaving durability an open question.', sourceName: 'MLB Trade Rumors' },
      ],
    },
    contract: {
      debut: { ja: '2017年ドラフト4位（八重山商工高）。2019年から一軍でプレーし、抑えと先発の双方で実績を残してきた。', en: 'A 2017 fourth-round pick out of Yaeyama Shoko High School, in the top team since 2019, with a track record both closing and starting.' },
      fa: { ja: '2027年シーズンを終えると9年に達して海外FA権を得るため、ポスティングの対象ではなくなる。西武にとって今オフは譲渡金を得られる最後の機会にあたる。', en: 'After the 2027 season he reaches nine years and international free agency, at which point he is no longer postable. This winter is Seibu\u2019s last chance to collect a release fee.' },
      salary: {
        ja: '2025年11月の契約更改で3億円。日本経済新聞は、米挑戦について本人が「早く行けるなら」と語ったことを見出しに立てた。',
        en: 'He signed for ¥300MM in November 2025. Nikkei headlined his own words about a move to MLB: if he can go soon.',
        source: 'https://www.nikkei.com/article/DGXZQOKC267OR0W5A121C2000000/',
        sourceName: '日本経済新聞',
      },
    },
    faq: [
      {
        q: { ja: '平良海馬はいつポスティングされる？', en: 'When will Kaima Taira be posted?' },
        a: { ja: '本人がポスティングでの移籍を希望し、代理人が西武と交渉している（10月20日）。西武の正式な容認発表はまだない。容認されればNPBの申請受付は11月1日から12月15日までで、ESPNのジェフ・パッサン記者は11月上旬の申請を見込んでいた。', en: 'He wants to be posted and his agent is negotiating with Seibu (October 20), but the club has not announced a decision. If approved, NPB accepts filings from November 1 through December 15; ESPN\u2019s Jeff Passan had expected an early-November posting.' },
      },
      {
        q: { ja: 'なぜ今オフなの？', en: 'Why this offseason?' },
        a: { ja: '2027年シーズンを終えると9年に達して海外FA権を得るため、ポスティングの対象外になる。西武が譲渡金を受け取れるのは今オフが最後になる。', en: 'After 2027 he reaches nine years of service and international free agency, so he can no longer be posted. This winter is the last one in which Seibu can receive a release fee.' },
      },
      {
        q: { ja: 'どの球団が視察している？', en: 'Which clubs have scouted him?' },
        a: { ja: 'MLB Trade Rumors によれば15球団超が評価担当を送り込み、メッツ・ブルージェイズ・ヤンキース・パドレス・ホワイトソックス・カブス・エンゼルス・マリナーズ・レンジャーズの名前が挙がっている。10月にはサンフランシスコ・クロニクル紙が、ジャイアンツも平良と伊藤大海を調査済みだと報じた。', en: 'MLB Trade Rumors reports more than 15 clubs have sent evaluators, naming the Mets, Blue Jays, Yankees, Padres, White Sox, Cubs, Angels, Mariners and Rangers. In October the San Francisco Chronicle reported the Giants had also looked into Taira and Hiromi Itoh.' },
      },
      {
        q: { ja: '契約規模はどれくらい？', en: 'How big a contract could he get?' },
        a: { ja: 'Full-Count は、今オフのFA先発で2番手と評価されるなら1億ドル（約154億円）以上は確実との見立てを伝えた。ポスティングの譲渡金はこれとは別に球団へ支払われる。', en: 'Full-Count reported the read that a deal above $100MM is all but assured if he is graded the second-best free agent starter. The posting fee is paid to Seibu on top of that.' },
      },
    ],
  },
  {
    slug: 'takahashi-kona',
    nameJa: '髙橋光成',
    nameEn: 'Kona Takahashi',
    npbId: '71075130',
    team: { ja: '埼玉西武ライオンズ', en: 'Saitama Seibu Lions' },
    pos: { ja: '投手（先発）', en: 'Pitcher (starter)' },
    bio: {
      ja: '埼玉西武ライオンズの先発右腕。群馬・前橋育英高で夏の甲子園優勝投手となり、2014年ドラフト1位で入団。190cm・105kgの大型右腕で、2022年に12勝・防御率2.20を挙げた。プロ12年でローテーションを支え続けている。',
      en: 'A right-handed starter for the Saitama Seibu Lions. He won the summer Koshien title as an ace at Maebashi Ikuei High School in Gunma and was Seibu\u2019s 2014 first-round pick. Listed at 190 cm and 105 kg, he went 12-8 with a 2.20 ERA in 2022 and has anchored the rotation across a dozen pro seasons.',
    },
    mlbWatch: {
      ja: '2025年オフに西武がポスティングを申請し、MLB3球団から契約のオファーを受けた実績がある。そのときは残留を選んだが、2026年5月10日に海外FA権を取得＝今度は球団の承認なしに自分の意思で市場へ出られる立場になった。今オフのNPB勢では、ポスティング組と並ぶもう一つの入口にあたる。',
      en: 'Seibu posted him after the 2025 season and he drew contract offers from three MLB clubs before deciding to stay. On May 10, 2026 he acquired international free agent rights \u2014 meaning he no longer needs the club\u2019s blessing to reach the market. Among this winter\u2019s NPB names, he is the other doorway alongside the posting candidates.',
    },
    posting: {
      ja: 'ポスティングではなく海外FAでの移籍になる。2025年オフの残留時に結んだ複数年契約にはオプトアウト条項が含まれており、今オフに再びメジャー移籍を目指せる形になっていた。10月20日に海外FA権の有資格者として公示され、行使するかどうかは本人が決める。西武は残留交渉の方針。',
      en: 'His route is international free agency, not a posting. The multi-year deal he signed when he stayed in the 2025-26 offseason carried an opt-out designed to let him try MLB again this winter. He was listed as eligible on October 20; whether to exercise the right is his call, and Seibu plans to try to keep him.',
    },
    postingWatch: {
      level: 'rumored',
      asOf: '2026-10-26',
      headline: {
        ja: '10月20日に海外FA権の有資格者として公示された。日刊スポーツは今オフもMLB移籍を模索する考えだと報じ（MLB Trade Rumors経由）、西武は「条件はしっかり出していく」と残留交渉の方針。本人は「いい選択をする準備をしたい」と話している。',
        en: 'He was listed as eligible for international free agency on October 20. Nikkan Sports reports he is inclined to explore MLB again (via MLB Trade Rumors), while Seibu plans to make a firm offer to keep him. He says he wants to be ready to make a good choice.',
      },
      route: 'intl-fa',
      window: {
        ja: '権利の行使は今オフのFA市場が開いてから。海外FAはポスティングと違い45日の交渉期限が無く、譲渡金も発生しないが、12月1日に労使協定が切れてロックアウトに入ればFA市場そのものが凍結される。',
        en: 'Any move comes once this winter\u2019s free agent market opens. International free agency has no 45-day clock and no release fee, unlike a posting, but the market itself freezes if the CBA expires and the lockout starts on December 1.',
      },
      timeline: [
        {
          date: '2026-10-20',
          ja: '海外FA権の有資格者として公示された。選択肢が多いことを踏まえ、本人は「いい選択をする準備をしたい」と語った。',
          en: 'He was listed as eligible for international free agency and, with many options open, said he wants to be ready to make a good choice.',
          source: 'https://kumanichi.com/articles/2048559',
          sourceName: '熊本日日新聞（共同通信）',
        },
        {
          date: '2026-10-15',
          ja: 'MLB Trade Rumors が、髙橋は今冬に海外FA権を行使できると伝えた（MLB.comのマイケル・クレア記者）。日刊スポーツは2年連続でMLB移籍を模索する考えだと報じた。2026年は22先発で防御率2.54。スカウトの一人はリリーフ向きと見ており、大型契約は見込みにくいとした。',
          en: 'MLB Trade Rumors, citing MLB.com’s Michael Clair, reports he is eligible for international free agency this winter, and Nikkan Sports says he is inclined to explore MLB for a second straight year. He posted a 2.54 ERA over 22 starts in 2026; one scout sees him as a reliever, and MLBTR does not expect a big contract.',
          source: 'https://www.mlbtraderumors.com/2026/10/kona-takahashi-could-explore-mlb-opportunities-this-offseason.html',
          sourceName: 'MLB Trade Rumors',
        },
        {
          date: '2026-10-12',
          ja: '西武が髙橋と残留交渉を行う方針を示した。広池浩司球団本部長は「チームに残ってほしい。条件はしっかり出していく」と述べた。',
          en: 'Seibu said it will negotiate to keep him. Club executive Koji Hiroike said the club wants him to stay and will make a firm offer.',
          source: 'https://kumanichi.com/articles/2045842',
          sourceName: '熊本日日新聞（共同通信）',
        },
        {
          date: '2026-09-05',
          ja: '前日の登板を3回で緊急降板し、出場選手登録を抹消された。9勝・防御率2.69とチームの2位を支えてきた右腕で、シーズン終盤の状態が今オフの評価にも関わる。',
          en: 'He was pulled after three innings and removed from the active roster. At 9-6 with a 2.69 ERA he had been holding up a second-place club, and how he finishes the season bears on his market this winter.',
          source: 'https://full-count.jp/2026/09/05/post2012732/',
          sourceName: 'Full-Count',
        },
        {
          date: '2026-05-10',
          ja: '西武が髙橋光成の海外FA権取得を発表。本人は「このたび海外FA権を取得いたしました。（中略）まずは目の前のシーズンに集中し、チームの勝利に貢献できるよう、全力でプレーしてまいります」とコメントした。',
          en: 'Seibu announced that Takahashi had qualified for international free agency. In his statement he thanked fans and the organization and said his focus was on the season in front of him and on helping the team win.',
          source: 'https://full-count.jp/2026/05/10/post1958305/',
          sourceName: 'Full-Count',
        },
        {
          date: '2026-01-04',
          ja: '西武が残留を発表。ポスティングでMLB3球団からオファーを受けたが、メジャー挑戦を断念した。オプトアウト条項つきの複数年契約で、今季中に海外FA権を取得して来オフ再び市場に出られる形になった。',
          en: 'Seibu announced he would stay. He had offers from three MLB clubs during his posting window but passed on the move, re-signing on a multi-year deal with an opt-out that let him qualify for international free agency during 2026 and return to the market this winter.',
          source: 'https://full-count.jp/2026/01/04/post1886177/',
          sourceName: 'Full-Count',
        },
        {
          date: '2025-11-21',
          ja: '西武がポスティングシステムを申請し、MLB全30球団へ通知された。交渉期限は米国東部時間2025年11月21日午前8時から2026年1月4日午後5時までの45日間。',
          en: 'Seibu filed his posting and all 30 MLB clubs were notified, opening a negotiating window that ran from November 21, 2025 to January 4, 2026 (ET).',
          source: 'https://www.seibulions.jp/news/detail/202500625061.html',
          sourceName: '埼玉西武ライオンズ公式',
        },
      ],
    },
    scouting: {
      strengths: [
        { ja: '190cm・105kgの体格から投げ下ろす本格派。2022年は12勝・防御率2.20、2023年も防御率2.21と、パ・リーグの先発として長く計算されてきた。', en: 'A big-bodied power arm at 190 cm and 105 kg. He went 12-8 with a 2.20 ERA in 2022 and followed with a 2.21 in 2023, a dependable Pacific League starter for years.' },
        { ja: '2025年オフのポスティングでMLB3球団から実際にオファーが出ている＝評価は言葉ではなく金額で示された。', en: 'Three MLB clubs put actual contract offers on the table during his 2025-26 posting window, so the market has already priced him.', sourceName: 'MLB.jp' },
        { ja: '前橋育英高で夏の甲子園優勝投手。プロ12年で通算77勝を積み上げている。', en: 'He won the summer Koshien title in high school and has piled up 77 wins across 12 pro seasons.', sourceName: 'Full-Count' },
        { ja: '2026年は22先発で防御率2.54。奪三振率20.7%はキャリア最高で、ゴロ率58.5%も自己最高だった。シンカーを増やし、カーブを減らしている。', en: 'In 2026 he posted a 2.54 ERA over 22 starts with a career-best 20.7% strikeout rate and a career-high 58.5% ground-ball rate, leaning more on his sinker and less on his curveball.', sourceName: 'MLB Trade Rumors' },
      ],
      concerns: [
        { ja: '2024年は15登板で0勝11敗・防御率3.87と大きく崩れた年があり、年ごとの波が評価の留保材料になる。', en: 'He bottomed out in 2024 at 0-11 with a 3.87 ERA over 15 starts, and that year-to-year variance is the caveat evaluators carry.' },
        { ja: '海外FAでの移籍は球団に譲渡金が入らないため、西武には引き留める動機がある。実際に球団は残留交渉の方針を示した。', en: 'An international free agent move brings Seibu no release fee, so the club has reason to keep him, and it has said it will negotiate to do so.' },
        { ja: 'MLB.comのマイケル・クレア記者が伝えたスカウトの一人はリリーフ向きと見ており、MLB Trade Rumors は大型契約は見込みにくいとした。', en: 'A scout cited by MLB.com\u2019s Michael Clair sees him as a better fit in relief, and MLB Trade Rumors does not expect a large contract.', sourceName: 'MLB Trade Rumors' },
      ],
    },
    contract: {
      debut: { ja: '2014年ドラフト1位（前橋育英高）。2015年に一軍デビューし、2019年に初の10勝を挙げた。', en: 'A 2014 first-round pick out of Maebashi Ikuei High School. He debuted in 2015 and won 10 games for the first time in 2019.' },
      fa: { ja: '2026年5月10日に海外FA権を取得し、10月20日に有資格者として公示された。ポスティングと違い、行使すれば球団の承認なしに市場へ出られる。', en: 'He qualified for international free agency on May 10, 2026 and was listed as eligible on October 20. Unlike a posting, exercising it puts him on the market without the club\u2019s consent.' },
    },
    faq: [
      {
        q: { ja: '髙橋光成は今オフメジャーに行く？', en: 'Will Kona Takahashi go to MLB this offseason?' },
        a: { ja: '海外FA権は5月に取得済みで、10月20日に有資格者として公示された。行使すれば球団の承認なしに市場へ出られる。日刊スポーツは今オフもMLB移籍を模索する考えだと報じ、西武は残留交渉の方針。本人は「いい選択をする準備をしたい」と話している。前回（2025年オフ）はポスティングで3球団からオファーを受けたうえで残留を選んだ。', en: 'He has held international free agent rights since May and was listed as eligible on October 20, so he can reach the market without the club\u2019s consent. Nikkan Sports reports he is inclined to explore MLB again, while Seibu plans to try to keep him; he says he wants to be ready to make a good choice. Last winter he was posted, drew three offers and chose to stay.' },
      },
      {
        q: { ja: 'ポスティングと海外FAは何が違う？', en: 'How does international free agency differ from a posting?' },
        a: { ja: 'ポスティングは球団が申請して初めて成立し、契約するとMLB球団から日本の球団へ譲渡金が支払われ、交渉期間は45日に限られる。海外FAは9年の出場登録日数で本人が得る権利で、球団の承認も譲渡金も交渉期限もない。', en: 'A posting only happens if the club files it: the MLB club then pays a release fee to the Japanese club, and negotiations are capped at 45 days. International free agency is a right the player earns with nine years of service, with no club approval, no release fee and no clock.' },
      },
      {
        q: { ja: 'なぜ2025年オフは残留したの？', en: 'Why did he stay after the 2025 season?' },
        a: { ja: 'MLB3球団からオファーを受けたが西武残留を決断し、オプトアウト条項つきの複数年契約を結んだ。今季中に海外FA権を取得して来オフに再挑戦できる設計になっていた。', en: 'He had offers from three MLB clubs but re-signed with Seibu on a multi-year deal with an opt-out, a structure that let him qualify for international free agency during 2026 and try again this winter.' },
      },
    ],
    comp: {
      ja: '大型の体格から投げ下ろす、イニングを食うパ・リーグの先発右腕。',
      en: 'A big-framed right-hander who eats innings at the front of a Pacific League rotation.',
    },
    aliases: ['高橋光成'],
    sameAs: ['https://ja.wikipedia.org/wiki/髙橋光成'],
  },
  {
    slug: 'takahashi-hiroto',
    nameJa: '髙橋宏斗',
    nameEn: 'Hiroto Takahashi',
    npbId: '61265153',
    team: { ja: '中日ドラゴンズ', en: 'Chunichi Dragons' },
    pos: { ja: '投手（先発）', en: 'Pitcher (starter)' },
    bio: {
      ja: '中日ドラゴンズのエース格右腕。2002年生まれ、2020年ドラフト1位。2023年WBC優勝メンバー。150キロ台後半の直球とスプリットで三振を奪う、世代屈指の先発右腕。',
      en: 'A right-handed ace for the Chunichi Dragons. Born in 2002 and a 2020 first-round pick, he was part of Japan’s 2023 WBC-winning squad. He misses bats with a high-90s mph fastball and a sharp splitter, and is one of the best starters of his generation.',
    },
    mlbWatch: {
      ja: '海外メディアは「まだMLBに居ない中で最高クラスの投手」「日本人先発で屈指の伸びしろ」と評する。2024年は防御率1.38とリーグ最高クラスで圧巻だったが、2025年は不振。2026年も5月に一時登録を抹消されたが立て直し、防御率2.62でシーズンを終えた（規定投球回には届かず）。山本由伸とオフに合同自主トレを組む間柄で、ドジャースの関心も取り沙汰される。',
      en: 'Overseas outlets call him maybe the best NPB pitcher who hasn\u2019t joined MLB yet, with one of the highest ceilings of any Japanese starter. He was dominant in 2024 (a league-best 1.38 ERA) but uneven in 2025. In 2026 he was briefly sent down in May, then rebuilt his season to finish with a 2.62 ERA (short of qualifying). He trains with Yoshinobu Yamamoto in the offseason, and Dodgers interest has been floated.',
    },
    posting: {
      ja: 'ポスティングやFAでの移籍が取り沙汰されてきたが、2026年オフの具体的な動きは報じられていない。正式な公表はなく、安定感を取り戻せるかが鍵。',
      en: 'A move via posting or free agency has been floated, but nothing concrete has been reported for the 2026-27 offseason. Nothing is official; regaining consistency is the key.',
    },
    comp: {
      ja: '山本由伸と重ねられることが多い世代の先発右腕。ミッチ・ケラー型との見方も。',
      en: 'Often likened to Yoshinobu Yamamoto among his generation of starters; some see a Mitch Keller profile.',
    },
    aliases: ['高橋宏斗'],
    sameAs: ['https://ja.wikipedia.org/wiki/髙橋宏斗'],
    contract: {
      debut: { ja: '2020年ドラフト1位（中京大中京高）。2022年から先発ローテーションに入り、2023年WBCの優勝メンバー。', en: 'A 2020 first-round pick out of Chukyodai Chukyo High School who joined the rotation in 2022 and was part of Japan\u2019s 2023 WBC-winning squad.' },
      fa: { ja: '海外FA権の取得はまだ先。MLB挑戦にはポスティングを中日が認める必要がある。', en: 'International free agency is still some way off; an MLB move would need Chunichi to post him.' },
    },
    faq: [
      {
        q: { ja: '髙橋宏斗はいつメジャーに行く？', en: 'When will Hiroto Takahashi go to MLB?' },
        a: { ja: 'ポスティングやFAでの移籍が取り沙汰されてはいるが、正式な発表はなく、2026年オフの具体的な動きも報じられていない。2026年は5月に防御率が6.85まで悪化して登録を抹消された時期があり、その後立て直して防御率2.62でシーズンを終えた。安定感を取り戻せるかが鍵になる。', en: 'A move via posting or free agency gets discussed, but nothing is official and nothing concrete has been reported this winter. He was optioned down in 2026 after his May ERA ballooned to 6.85, then rebuilt his season to finish at 2.62. Regaining consistency is the key.' },
      },
    ],
  },
  {
    slug: 'maki-shugo',
    nameJa: '牧秀悟',
    nameEn: 'Shugo Maki',
    npbId: '13115153',
    team: { ja: '横浜DeNAベイスターズ', en: 'Yokohama DeNA BayStars' },
    pos: { ja: '二塁手', en: 'Second baseman' },
    bio: {
      ja: '横浜DeNAの主軸内野手。2020年ドラフト2位、2023年WBC優勝メンバー。通算打率.295・三振の少なさとパワーを両立する右の二塁手。2024年はチームの26年ぶり日本一に貢献した。',
      en: 'A middle-of-the-order infielder for the Yokohama DeNA BayStars. A 2020 second-round pick and 2023 WBC champion, the right-handed second baseman pairs contact and pop (a .295 career average). He helped DeNA to its first Japan Series title in 26 years in 2024.',
    },
    mlbWatch: {
      ja: '海外スカウトは「NPBで最も総合力の高い打者の一人」と評価。卓越したバットコントロール（三振率15%未満）が武器で、2026年は108試合で30本塁打、長打率はセ・リーグ2位だった。一方で四球が極端に少なく（5シーズン中3年で6%未満）、メジャーの精緻な投球への対応が課題。比較対象はジェフ・マクニールや全盛期ダニエル・マーフィー。',
      en: 'Scouts call him one of the most well-rounded bats in NPB. Elite bat-to-ball skills (a sub-15% strikeout rate) are his calling card, and in 2026 he hit 30 homers in 108 games, ranking second in the Central League in slugging. The question is a very low walk rate (under 6% in three of five seasons) against big-league pitching. Comps range from Jeff McNeil to prime Daniel Murphy.',
    },
    posting: {
      ja: '年齢・実績・本人の意思から、海外メディアは早期の渡米候補の一人に挙げてきた。2025年12月に将来的なメジャー挑戦の意向を球団に伝えたが、2026年オフの具体的な動きは報じられていない。ポスティング/FAは2027年オフが現実的な機会とみられる。',
      en: 'With his age, track record and stated interest, overseas outlets have called him one of the likelier candidates to make the jump. He told DeNA in December 2025 that he wants to try MLB some day, but nothing concrete has been reported for the 2026-27 offseason; 2027 looks like the realistic window.',
    },
    comp: {
      ja: 'バット・ファーストの内野手としてジェフ・マクニール／全盛期ダニエル・マーフィー型。',
      en: 'A bat-first infielder in the Jeff McNeil / prime Daniel Murphy mold.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/牧秀悟'],
    contract: {
      debut: { ja: '2020年ドラフト2位（中央大）。2021年から主軸を打ち、2023年WBCの優勝メンバー。2024年はチームの26年ぶり日本一に貢献した。', en: 'A 2020 second-round pick out of Chuo University who has hit in the middle of the order since 2021, won the 2023 WBC and helped DeNA to its first Japan Series title in 26 years in 2024.' },
      fa: { ja: '海外FA権はまだ先。MLB挑戦にはポスティングをDeNAが認める必要がある。', en: 'International free agency is still ahead of him, so an MLB move would need DeNA to post him.' },
      salary: {
        ja: '2025年12月の契約更改で現状維持の2億5000万円。この席で将来的なメジャー挑戦の意向を球団に伝え、「やってみたいなって気持ち」と語った。2025年は8月の左手手術もあり自己最少の93試合だった。',
        en: 'He re-signed at ¥250MM in December 2025 and used the meeting to tell the club he wants to try MLB some day. Left-hand surgery in August limited him to a career-low 93 games in 2025.',
        source: 'https://www.chunichi.co.jp/article/1179903',
        sourceName: '中日スポーツ',
      },
    },
    faq: [
      {
        q: { ja: '牧秀悟はメジャー挑戦を表明している？', en: 'Has Shugo Maki said he wants to go to MLB?' },
        a: { ja: '2025年12月の契約更改で、将来的なメジャー挑戦の意向を球団に伝えたと報じられている。「やってみたいなって気持ち」と語った一方、まずはリーグ優勝に全力を注ぐとしていた。2026年オフのポスティングの具体的な動きは報じられていない。', en: 'He told the club during December 2025 contract talks that he would like to try it some day, while saying his focus was on winning the pennant first. Nothing concrete on a posting has been reported this winter.' },
      },
    ],
  },
  {
    slug: 'morishita-shota',
    nameJa: '森下翔太',
    nameEn: 'Shota Morishita',
    npbId: '43145157',
    team: { ja: '阪神タイガース', en: 'Hanshin Tigers' },
    pos: { ja: '外野手', en: 'Outfielder' },
    bio: {
      ja: '阪神タイガースの右の中軸外野手。2022年ドラフト1位。勝負強い打撃と長打力で、若くしてクリーンアップを担う。2026年はキャリア最多の35本塁打で、本塁打王の佐藤輝明に次ぐセ・リーグ2位。出塁率はリーグ1位だった。',
      en: 'A right-handed middle-of-the-order outfielder for the Hanshin Tigers and a 2022 first-round pick. Clutch hitting and power have him batting cleanup early in his career. He broke out in 2026 with a career-high 35 homers, second in the Central League behind home run champion Teruaki Sato, and led the league in on-base percentage.',
    },
    mlbWatch: {
      ja: '2026年は打棒が爆発し、特に左投手に滅法強い（前年は対左でwRC+181）。デイリースポーツによれば、すでに代理人事務所（菅野智之・佐藤輝明と同じVCスポーツグループ）と契約し、将来的なポスティングでのMLB挑戦に向けて準備を進めている。積み上げ次第で評価が上がるタイプ。',
      en: 'He broke out in 2026 and does real damage against lefties (a 181 wRC+ vs. LHP the prior year). Daily Sports reports he has already signed with an agency \u2014 VC Sports Group, which also represents Tomoyuki Sugano and Teruaki Sato \u2014 and is preparing for an eventual MLB move via the posting system. A profile whose stock can rise with more production.',
    },
    posting: {
      ja: 'ポスティングの公表はない。代理人事務所と契約済みで、早ければ今オフにも球団へ意向を伝える可能性があると報じられている。球団幹部は「常に誰であろうと、クローズすることはない」としている。',
      en: 'No posting has been announced. He has signed with an agency and could tell the club of his intentions as soon as this winter, per reports; a front-office figure said the club never closes the door on anyone.',
    },
    postingWatch: {
      level: 'watch',
      asOf: '2026-10-29',
      headline: {
        ja: 'ポスティングの公式な動きはまだない。デイリースポーツは10月、すでに代理人事務所と契約し、早ければ今オフにも球団へ意向を伝える可能性があると報じた。',
        en: 'No posting has been announced. Daily Sports reported in October that he has already signed with an agency and could tell the club of his intentions as soon as this winter.',
      },
      route: 'posting',
      window: {
        ja: '早ければ今オフにも球団へ意向を伝える可能性があると報じられている（デイリースポーツ）。海外FA権の取得はまだ先で、MLB挑戦には阪神がポスティングを認める必要がある。',
        en: 'He could tell the club of his intentions as soon as this winter, per Daily Sports. He is years from international free agency, so an MLB move needs Hanshin to post him.',
      },
      timeline: [
        {
          date: '2026-10-18',
          ja: 'デイリースポーツが、森下がすでに代理人事務所（菅野智之・佐藤輝明と同じVCスポーツグループ）と契約し、将来的なポスティングでのメジャー挑戦に向けて準備を進めていると報道。早ければ今オフにも球団へ意向を伝える可能性があるとした。球団幹部は「常に誰であろうと、クローズすることはない」と話した。',
          en: 'Daily Sports reports Morishita has already signed with VC Sports Group — the agency of Tomoyuki Sugano and Teruaki Sato — and is preparing for an eventual MLB move via the posting system, possibly telling the club as soon as this winter. A front-office figure said the club never closes the door on anyone.',
          source: 'https://www.daily.co.jp/tigers/2026/10/18/0020941104.shtml',
          sourceName: 'デイリースポーツ',
        },
      ],
    },
    comp: {
      ja: 'ヒットとパワーはあるが守備価値は限定的、というマット・ヴィアリング型との見方。',
      en: 'Seen by some as a Matt Vierling type — hit and power, with limited defensive value.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/森下翔太'],
    contract: {
      debut: { ja: '2022年ドラフト1位（中央大）。2023年から一軍でプレーし、若くしてクリーンアップを担う。', en: 'A 2022 first-round pick out of Chuo University, in the top team since 2023 and batting cleanup early in his career.' },
      fa: { ja: '海外FA権の取得はまだ先。代理人事務所とは契約済みで、MLB挑戦には阪神がポスティングを認める必要がある。', en: 'International free agency is a long way off. He has signed with an agency, but an MLB move would need Hanshin to post him.' },
    },
    faq: [
      {
        q: { ja: '森下翔太はメジャーに行く？', en: 'Is Shota Morishita headed to MLB?' },
        a: { ja: 'ポスティングや移籍の公表はない。ただしデイリースポーツは、すでに代理人事務所と契約し、早ければ今オフにも球団へ意向を伝える可能性があると報じた。2026年はキャリア最多の35本塁打で、本塁打王の佐藤輝明に次ぐリーグ2位だった。', en: 'No posting has been announced, but Daily Sports reports he has signed with an agency and could tell the club of his intentions as soon as this winter. In 2026 he hit a career-high 35 homers, second in the league behind home run champion Teruaki Sato.' },
      },
    ],
  },
  {
    slug: 'murakami-shoki',
    nameJa: '村上頌樹',
    nameEn: 'Shoki Murakami',
    npbId: '13315153',
    team: { ja: '阪神タイガース', en: 'Hanshin Tigers' },
    pos: { ja: '投手（先発）', en: 'Pitcher (starter)' },
    bio: {
      ja: '阪神タイガースの先発右腕。兵庫県南あわじ市出身、智辯学園高では2019年センバツ優勝のエース。2023年に投手として史上3人目（セ・リーグ初）の新人王＆MVP同時受賞。抜群の制球が持ち味。※ヤクルトの長距離砲・村上宗隆とは別人。',
      en: 'A right-handed starter for the Hanshin Tigers. From Minami-Awaji, Hyogo, he was the ace of Chiben Gakuen’s 2019 national championship team. In 2023 he became just the third player ever — a Central League first — to win Rookie of the Year and MVP in the same season. Pinpoint command is his calling card. (Not to be confused with slugger Munetaka Murakami.)',
    },
    mlbWatch: {
      ja: '2026年はセ・リーグの防御率1位でシーズンを終えた制球派右腕。剛速球ではなく完成度で勝負するタイプで、MLBではミドルローテーション級と見られる。海外での言及はまだ限定的。',
      en: 'A command right-hander who finished 2026 as the Central League ERA leader. He wins with polish rather than power, projecting as a mid-rotation arm in MLB. Overseas coverage is still limited.',
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
    contract: {
      debut: { ja: '2020年ドラフト5位（東洋大）。2023年に投手として史上3人目、セ・リーグでは初の新人王とMVP同時受賞。', en: 'A 2020 fifth-round pick out of Toyo University. In 2023 he became the third pitcher ever, and the first in the Central League, to win Rookie of the Year and MVP in the same season.' },
      fa: { ja: '海外FA権の取得はまだ先。MLB挑戦にはポスティングを阪神が認める必要がある。', en: 'International free agency is still ahead; an MLB move would need Hanshin to post him.' },
    },
    faq: [
      {
        q: { ja: '村上頌樹はヤクルトの村上宗隆と同じ人？', en: 'Is Shoki Murakami the same person as Munetaka Murakami?' },
        a: { ja: '別人。村上頌樹は阪神の先発右腕で、2026年はセ・リーグの防御率1位でシーズンを終えた。村上宗隆はヤクルトからホワイトソックスへ移った長距離砲。', en: 'No. Shoki Murakami is a right-handed starter for Hanshin who finished 2026 as the Central League ERA leader. Munetaka Murakami is the slugger who moved from the Swallows to the White Sox.' },
      },
      {
        q: { ja: 'メジャー挑戦の話はある？', en: 'Is there MLB interest?' },
        a: { ja: '正式な発表はない。海外での言及もまだ限定的で、剛速球ではなく完成度で勝負するタイプとしてミドルローテーション級と見られている。', en: 'Nothing official, and overseas coverage is still limited. He projects as a mid-rotation arm who wins with polish rather than power.' },
      },
    ],
  },
  {
    slug: 'saiki-hiroto',
    nameJa: '才木浩人',
    nameEn: 'Hiroto Saiki',
    npbId: '41745134',
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
      ja: '2025年オフにポスティングを申請したが、球団が主力先発の同時流出を避けるため不承認とした。2026年オフも本人が直訴したが、球団の方針は変わらず、来季も阪神でプレーする見込みと報じられている。MLB志向は公言している。',
      en: 'He asked to be posted after the 2025 season, but the club declined to avoid losing two rotation arms at once. He renewed the request after 2026, but the club\u2019s stance is reported to be unchanged and he is expected to stay with Hanshin next season. He has been open about his MLB ambitions.',
    },
    postingWatch: {
      level: 'watch',
      asOf: '2026-10-29',
      headline: {
        ja: '今オフも本人が球団にポスティングを直訴したが、阪神の方針は昨年から変わっておらず、来季も残留の見込み（スポニチ、10月18日）。2026年は175奪三振でセ・リーグ最多奪三振のタイトルを獲得した。',
        en: 'He again asked Hanshin to post him this winter, but the club\u2019s stance is reported unchanged and he is expected to stay for 2027 (Sponichi, October 18). He won the 2026 Central League strikeout title with 175.',
      },
      route: 'posting',
      window: {
        ja: '阪神は今オフもポスティングを認めない方針と報じられている（スポニチ）。昨オフは球団が「今年に関しては認めない」と通達していた。',
        en: 'Hanshin is reported to be declining a posting again this winter (Sponichi). Last winter the club told him it would not allow it that year.',
      },
      timeline: [
        {
          date: '2026-10-18',
          ja: 'スポニチが、才木が今オフもポスティングでのメジャー移籍を球団に直訴する考えだと報道。2024年12月の契約更改で初めてメジャー挑戦の希望を口にし、昨オフは球団から「今年に関しては認めない」と通達されていた。球団の方針は昨年から変わっておらず、来季も阪神でプレーする可能性が高いとした。',
          en: 'Sponichi reports Saiki will again ask the club to post him this winter. He first voiced his MLB hopes in December 2024 contract talks and was told last winter that it would not be allowed that year. The club’s stance has not changed, and he is likely to play for Hanshin next season.',
          source: 'https://topics.smt.docomo.ne.jp/article/sponichi/sports/sponichi-spngoo-20261018-0044',
          sourceName: 'スポニチアネックス',
        },
        {
          date: '2026-01-13',
          ja: '東スポWEBは、才木のポスティングが認められなかった背景に、先発のジョン・デュプランティエとの残留交渉が早々に難航したことがあると報じた。主力先発を同時に2枚失えば戦えない、という判断だったという。才木と佐藤輝明を同時に送り出す可能性については、球団幹部が強く否定したとも伝えている。',
          en: 'Tokyo Sports reports that the refusal traced back to stalled talks with starter John Duplantier: the club decided it could not compete after losing two rotation pieces at once. A front-office figure also flatly rejected the idea of posting Saiki and Teruaki Sato in the same winter.',
          source: 'https://www.tokyo-sports.co.jp/articles/-/373531',
          sourceName: '東スポWEB',
        },
        {
          date: '2025-11-09',
          ja: '球団が「今オフのポスティングは認めない」と公表したあと、才木が初めて取材に応じた。「ポスティングは基本的に球団の権利だと思うので、その辺はこっちから話すことはないかなと思います」と語り、来季へ向けては「もちろん準備してます」と答えた。',
          en: 'Speaking for the first time after the club announced it would not post him, Saiki said posting is fundamentally the club\u2019s right and not something for him to comment on, adding that he is of course preparing for next season.',
          source: 'https://www.daily.co.jp/tigers/2025/11/09/0019684922.shtml',
          sourceName: 'デイリースポーツ',
        },
      ],
    },
    comp: {
      ja: '150キロ台後半の直球とスプリットで押す、MLBミドルローテーション級の本格派右腕。',
      en: 'A power right-hander with a high-90s fastball and splitter, projecting as an MLB mid-rotation starter.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/才木浩人'],
    scouting: {
      strengths: [
        { ja: 'ドジャースのデーブ・ロバーツ監督は、東京ドームの試合で大谷翔平・フリーマンらから7奪三振した才木の球質を「メジャー級」と評した。', en: 'After he struck out seven \u2014 Shohei Ohtani and Freddie Freeman among them \u2014 in a Tokyo Dome game, Dodgers manager Dave Roberts called his stuff major-league.' },
        { ja: 'MLB.com は「阪神がポスティングを認めていれば、最も引く手あまたのFA投手の一人になったはず」と書いた。', en: 'MLB.com wrote he would have been one of the most sought-after free agent pitchers had Hanshin agreed to post him.', sourceName: 'MLB.com' },
        { ja: '2026年は175奪三振でセ・リーグ最多奪三振のタイトルを獲得した。150キロ台後半の直球と鋭いスプリットが武器。', en: 'He won the 2026 Central League strikeout title with 175, working off a high-90s fastball and a sharp splitter.' },
      ],
      concerns: [
        { ja: '2020年にトミー・ジョン手術を受け、実戦復帰まで約3年を要した経緯がある。', en: 'He underwent Tommy John surgery in 2020 and needed nearly three years to return to game action.' },
        { ja: '最大の不確定要素は実力ではなく球団の判断。2025年オフは申請自体が認められず、2026年オフも認めない方針と報じられている。', en: 'The biggest variable is not the arm but the club: his request to be posted was refused outright after the 2025 season, and Hanshin is reported to be holding that line again after 2026.' },
      ],
    },
    contract: {
      debut: { ja: '2016年ドラフト3位（須磨翔風高）。2022年に実戦復帰し、2025年にセ・リーグ最優秀防御率を獲得した。', en: 'A 2016 third-round pick out of Suma Shofu High School who returned to game action in 2022 and won the 2025 Central League ERA title.' },
      fa: { ja: '海外FA権の取得はまだ先。今オフに動くにはポスティングを阪神が認める必要がある。', en: 'International free agency is still years away, so any move this winter depends on Hanshin agreeing to post him.' },
    },
    faq: [
      {
        q: { ja: 'なぜ才木浩人はメジャーに行けなかった？', en: 'Why did Hiroto Saiki not get to MLB?' },
        a: { ja: '2025年オフ、本人がポスティングを希望したが阪神が認めなかった。東スポWEBは、先発のジョン・デュプランティエとの残留交渉が難航しており、主力先発を同時に2枚失えば戦えないという判断だったと報じている。', en: 'He asked to be posted after the 2025 season and Hanshin said no. Tokyo Sports reports the club had stalled talks with starter John Duplantier and decided it could not lose two rotation arms at once.' },
      },
      {
        q: { ja: '次にチャンスがあるのはいつ？', en: 'When is his next chance?' },
        a: { ja: '今オフも本人が直訴したが、阪神の方針は昨年から変わらず、来季も阪神でプレーする見込みと報じられている。ポスティングは球団の権利のため、判断は引き続き阪神に委ねられる。', en: 'He asked again this winter, but Hanshin\u2019s stance is reported unchanged and he is expected to play for the Tigers next season. Posting is the club\u2019s right, so the decision stays with Hanshin.' },
      },
    ],
  },
  {
    slug: 'sumida-chihiro',
    nameJa: '隅田知一郎',
    nameEn: 'Chihiro Sumida',
    npbId: '21025155',
    team: { ja: '埼玉西武ライオンズ', en: 'Saitama Seibu Lions' },
    pos: { ja: '投手（先発・左腕）', en: 'Pitcher (LHP starter)' },
    bio: {
      ja: '埼玉西武ライオンズの先発左腕。制球と変化球で勝負するタイプで、2025年は防御率2.65・159回2/3を投げる働き。チェンジアップとスプリットは海外で「ダブルプラス級」と評される。',
      en: 'A left-handed starter for the Saitama Seibu Lions. A command-and-secondaries pitcher, he threw 159⅔ innings with a 2.65 ERA in 2025. His changeup and splitter are rated abroad as “arguably double-plus” pitches.',
    },
    mlbWatch: {
      ja: '2026年は与四球の少なさが際立ち、148奪三振に対して与四球は21と、奪三振が与四球の7倍を超えた。防御率2.27はパ・リーグ2位。FanGraphs によれば2025年も防御率2.59・FIP2.49で、K-BB率17.8%は規定投球回到達者の5位。Just Baseball はチェンジアップとスプリットを「ダブルプラス級（Stuff+ 164）」と評価し、直球の平均球速も自己最速の91.9マイルまで上げたと伝える。ESPN はスカウトが左腕ダニー・クーロムになぞらえると報じた。剛速球ではなく完成度で見せる左腕。',
      en: 'In 2026 he struck out 148 against just 21 walks \u2014 better than seven to one \u2014 and his 2.27 ERA ranked second in the Pacific League. FanGraphs had him at a 2.59 ERA and 2.49 FIP in 2025, with a 17.8% K-BB rate that ranked fifth among qualifiers. Just Baseball grades his changeup and splitter as "arguably double-plus" (a 164 Stuff+) and notes he pushed his average fastball to a career-best 91.9 mph. ESPN says scouts liken him to lefty Danny Coulombe. A polish-over-power southpaw.',
    },
    posting: {
      ja: 'ポスティング/FAの公式発表はまだ無く、西武の先発の柱として続投中。2022年ドラフト1位入団で海外FA権の取得はまだ先＝MLB挑戦は球団のポスティング判断しだいになる。',
      en: 'No posting or move has been announced; he remains a rotation anchor for Seibu. As a 2022 first-round pick he is years from international free agency, so an MLB move would depend on the club granting a posting.',
    },
    postingWatch: {
      level: 'watch',
      asOf: '2026-10-29',
      headline: {
        ja: 'ポスティングの公式な動きはまだ無い。ただ西武は今井達也がアストロズへ移り、今オフは平良海馬がポスティングを希望して代理人が交渉中、髙橋光成も海外FA権を持つ＝先発の柱として残るのが隅田で、海外メディアは2026年WBC特集で「MLBの次のスターになりうる」と紹介している。',
        en: 'No posting has been announced. But Seibu has already lost Tatsuya Imai to the Astros, Kaima Taira is seeking a posting this winter with his agent in talks with the club, and Kona Takahashi holds international free agent rights \u2014 leaving Sumida as the rotation anchor, and overseas outlets have flagged him as a potential next MLB star in their 2026 WBC previews.',
      },
      route: 'posting',
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
          ja: '同僚の髙橋光成がMLB3球団からオファーを受けたが西武残留を決断。オプトアウト条項付きの複数年契約で、来オフはFAとして市場に戻れる（実際に2026年5月、海外FA権を取得した）。',
          en: 'Teammate Kona Takahashi turned down offers from three MLB clubs and re-signed with Seibu on a multi-year deal with an opt-out that lets him return to the market as a free agent next offseason \u2014 and he duly qualified for international free agency in May 2026.',
          source: 'https://full-count.jp/2026/01/04/post1886177/',
          sourceName: 'Full-Count',
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
    contract: {
      debut: { ja: '2021年ドラフト1位（西日本工大）。2022年から先発ローテーションに入った。', en: 'A 2021 first-round pick out of Nishinippon Institute of Technology who joined the rotation in 2022.' },
      fa: { ja: '海外FA権の取得はまだ先。MLB挑戦にはポスティングを西武が認める必要がある。', en: 'International free agency is still years away, so an MLB move depends on Seibu posting him.' },
    },
    faq: [
      {
        q: { ja: '隅田知一郎はポスティングされる？', en: 'Will Chihiro Sumida be posted?' },
        a: { ja: '公式な動きはない。西武は今井達也がアストロズへ移り、今オフは平良海馬がポスティングを希望し、髙橋光成も海外FA権を持つため、先発の柱として残るのが隅田という構図になっている。', en: 'Nothing has been announced. With Tatsuya Imai gone to the Astros, Kaima Taira seeking a posting this winter and Kona Takahashi holding international free agent rights, Sumida is the arm Seibu keeps at the front of the rotation.' },
      },
      {
        q: { ja: '海外での評価は？', en: 'How is he rated abroad?' },
        a: { ja: 'Just Baseball はチェンジアップとスプリットを「ダブルプラス級」（Stuff+ 164）と評価し、ESPN はスカウトが左腕ダニー・クーロムになぞらえると伝えた。', en: 'Just Baseball grades his changeup and splitter as arguably double-plus (a 164 Stuff+), and ESPN says scouts liken him to lefty Danny Coulombe.' },
      },
    ],
  },
  {
    slug: 'sotani-ryuhei',
    nameJa: '曽谷龍平',
    nameEn: 'Ryuhei Sotani',
    npbId: '81985157',
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
      ja: 'ポスティング/FAの公式な見通しはまだない。2026年は14登板にとどまった。',
      en: 'No posting or free-agency timetable yet; he made only 14 appearances in 2026.',
    },
    comp: {
      ja: '速球とスウィーパーで左を封じる、山本由伸型を目指す先発左腕。',
      en: 'A left-handed starter in the mold Orix hopes will succeed Yoshinobu Yamamoto, living off a fastball-sweeper mix.',
    },
    sameAs: ['https://ja.wikipedia.org/wiki/曽谷龍平'],
    contract: {
      debut: { ja: '2022年ドラフト1位（白鴎大）。2023年から一軍で投げ、2026年WBCの日本代表に選ばれた。', en: 'A 2022 first-round pick out of Hakuoh University who reached the top team in 2023 and was named to Japan\u2019s 2026 WBC roster.' },
      fa: { ja: '海外FA権の取得はまだ先。MLB挑戦の具体的な動きもない。', en: 'International free agency is a long way off, and no MLB move is in motion.' },
    },
    faq: [
      {
        q: { ja: '曽谷龍平のメジャー挑戦は？', en: 'What about a move to MLB for Ryuhei Sotani?' },
        a: { ja: 'ポスティングやFAの公表はまだない。2026年WBCの日本代表入りで海外の認知が上がっており、Just Baseball は防御率ほど内容は悪くないと指摘している。', en: 'No posting or free agency timetable has been announced. His 2026 WBC selection has raised his profile abroad, and Just Baseball notes his underlying numbers are far better than his ERA.' },
      },
    ],
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

/**
 * LP 末尾の「ほかの注目選手」の並び。全員を機械順で並べると、今オフ動く選手のLPから
 * 「まだ動きの無い選手」へ先に送ってしまう。読者の次の疑問は「今オフ誰が出るのか」と
 * 「同じ球団の他の選手はどうなのか」なので、その2つを先に出す。
 */
export function prospectRelated(self: NpbProspect): NpbProspect[] {
  const score = (p: NpbProspect): number => {
    let s = 0;
    if (p.postingWatch?.level === 'expected') s += 4;
    else if (p.postingWatch?.level === 'rumored') s += 2;
    if (p.team.ja === self.team.ja) s += 3;
    return s;
  };
  return NPB_PROSPECTS.filter((p) => p.slug !== self.slug).sort((a, b) => score(b) - score(a));
}

/**
 * 今オフ動く可能性が報じられている選手（expected → rumored の順）。
 * /prospects ハブの比較表と meta 文言が使う。「今オフ誰が出るのか」に名簿全体ではなくこの並びで答える。
 */
export function prospectsOnTheMove(): NpbProspect[] {
  const rank = { expected: 0, rumored: 1, watch: 2 } as const;
  return NPB_PROSPECTS.filter(
    (p) => p.postingWatch && p.postingWatch.level !== 'watch',
  ).sort((a, b) => rank[a.postingWatch!.level] - rank[b.postingWatch!.level]);
}
