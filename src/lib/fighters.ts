import type { Sport } from './sports';

/**
 * 格闘技（ボクシング・MMA）のタグLP対象ファイターのカタログ＝唯一の正。
 *
 * MLB の players.ts は snapshot（毎時CI）で成績が動く前提の作りだが、格闘技は
 * 試合が数ヶ月に1度＝戦績・肩書きは「試合ごとに手動更新」で十分正確に保てる。
 * よって静的カタログとして持ち、数値はすべて公式リザルトで裏取りした実測値のみ
 * （捏造しない＝CLAUDE.md §4.4）。試合が終わったら record / fights / asOf を更新する。
 *
 * opt-in 制: 記事が十分あり「{選手名} 海外の反応」クエリを狙うファイターだけ載せる
 * （全タグ一律LP化で薄いページを量産しない＝tagHub と同じ思想）。
 */
export type FighterFight = {
  /** 試合日（現地・YYYY-MM-DD） */
  date: string;
  opponentJa: string;
  opponentEn: string;
  /** 記事マッチ用タグ（サイト内の表記が opponentJa と違う場合のみ指定） */
  tag?: string;
  venueJa: string;
  /** 結果（例「3-0判定勝ち（116-112、116-112、115-113）」）。公式スコアのみ */
  resultJa: string;
  /** 一言メモ（防衛回数・番狂わせ等。裏取りした事実のみ） */
  noteJa?: string;
};

export type Fighter = {
  slug: string;
  nameJa: string;
  nameEn: string;
  /** 姓・名の単独表記。コメント本文の「井上」「尚弥」を拾うため（players.ts の shortJa と同じ役割）。 */
  shortJa?: string[];
  sport: Sport;
  /**
   * LPの框の出し分け（2026-08-03 村山判断）。海外の反応框が実態に合うのは井上・中谷のみ＝
   * global。国内中心に語られるファイター（RIZIN勢など）は domestic＝「ファンの声で読む
   * キャリア観測」框にし、title・見出しから「海外」を外す。看板と中身のズレは CTR と
   * 滞在の両方で検索に殺されるため、素材の実態（引用が日本語コメント中心か）で決める。
   */
  voiceScope: 'global' | 'domestic';
  /**
   * 次戦（確定情報のみ・裏取り必須）。domestic の title/description の前方に
   * 「次戦・{labelJa}」として出す。until（JSTの試合日）を過ぎるとビルド時に自動で消える
   * ＝journalNext と同じ賞味期限方式。試合が終わったら fights[] に結果を足してこれを更新。
   *
   * opponentJa / eventJa / href は「次の試合」一覧（UpcomingFights）とLPヒーローの
   * 次戦バッジが使う。href はサイト内のイベントハブ（/rizin5 等）＝ファイターLPと
   * イベントハブを相互に結ぶ配線で、until を過ぎれば両方まとめて自動で消える。
   */
  nextFightJa?: {
    labelJa: string;
    until: string;
    /** 対戦相手（一覧の「vs ◯◯」に出す。無ければ labelJa で代替） */
    opponentJa?: string;
    /** 大会名｜会場（公式発表の表記） */
    eventJa?: string;
    /** サイト内のイベントハブへのパス（無い大会は持たない） */
    href?: string;
  };
  /** 肩書き（例「S・バンタム級4団体統一王者」）。タイトル変動時に手動更新 */
  accoladeJa: string;
  /** 通算戦績。asOf は最終試合日＝「いつ時点の数字か」を必ず出す */
  record: { wins: number; losses: number; draws: number; kos: number; asOf: string };
  /**
   * LP上部のヒーロー（FighterNow）に大きく出す実測ハイライト数値。record から自動で出る
   * 通算戦績・KO率以外で見出しにしたい数字（世界戦連勝・P4P順位など）を、裏取りした値だけ
   * 手動で足す（時点や出典はラベルに含めて曖昧さを残さない）。
   */
  headlineStats?: { value: string; labelJa: string }[];
  /** Knowledge Graph 束ね用（Wikipedia 等） */
  sameAs: string[];
  /** 新しい順。LPの「主要試合と海外の反応」タイムラインに出す */
  fights: FighterFight[];
};

export const FIGHTERS: Fighter[] = [
  {
    slug: 'naoya-inoue',
    nameJa: '井上尚弥',
    nameEn: 'Naoya Inoue',
    shortJa: ['井上', '尚弥'],
    sport: 'boxing',
    voiceScope: 'global',
    accoladeJa: 'プロボクシング・S・バンタム級4団体統一王者（WBA・WBC・IBF・WBO）',
    record: { wins: 33, losses: 0, draws: 0, kos: 27, asOf: '2026-05-02' },
    headlineStats: [
      // 世界タイトル戦通算＝28勝無敗23KO（中谷戦終了時点・当サイト2026-06-10記事で裏取り）
      { value: '28-0', labelJa: '世界タイトル戦（23KO）' },
      // リング誌P4P1位＝中谷戦2日後の返り咲き（当サイト2026-05-04記事で裏取り）
      { value: '1位', labelJa: 'リング誌P4P（2026年5月返り咲き）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E4%BA%95%E4%B8%8A%E5%B0%9A%E5%BC%A5',
      'https://en.wikipedia.org/wiki/Naoya_Inoue',
    ],
    fights: [
      {
        date: '2026-05-02',
        opponentJa: '中谷潤人',
        opponentEn: 'Junto Nakatani',
        venueJa: '東京ドーム',
        resultJa: '3-0判定勝ち（116-112、116-112、115-113）',
        noteJa: '観衆5万5000人の日本ボクシング史上最大の一戦。4団体王座7度目の防衛で中谷を初黒星に',
      },
      {
        date: '2025-12-27',
        opponentJa: 'デビッド・ピカソ',
        opponentEn: 'Alan David Picasso',
        venueJa: 'リヤド（サウジアラビア）',
        resultJa: '3-0判定勝ち（120-108、119-109、117-111）',
        noteJa: '暦年4戦目＝リング誌王座の年4度防衛は1983年のラリー・ホームズ以来42年ぶり',
      },
      {
        date: '2025-09-14',
        opponentJa: 'MJ・アフマダリエフ',
        opponentEn: 'Murodjon Akhmadaliev',
        tag: 'MJアフマダリエフ',
        venueJa: '名古屋・IGアリーナ',
        resultJa: '3-0判定勝ち（117-111、118-110、118-110）',
        noteJa: '4団体王座5度目の防衛',
      },
      {
        date: '2025-05-04',
        opponentJa: 'ラモン・カルデナス',
        opponentEn: 'Ramon Cardenas',
        venueJa: 'ラスベガス',
        resultJa: '8回TKO勝ち',
        noteJa: '2回にダウンを喫してからの逆転KO',
      },
    ],
  },
  {
    slug: 'junto-nakatani',
    nameJa: '中谷潤人',
    nameEn: 'Junto Nakatani',
    shortJa: ['中谷', '潤人'],
    sport: 'boxing',
    voiceScope: 'global',
    accoladeJa: 'プロボクシング・3階級制覇王者（前WBC世界バンタム級王者）',
    record: { wins: 32, losses: 1, draws: 0, kos: 24, asOf: '2026-05-02' },
    headlineStats: [
      // リング誌P4P＝井上戦後に6位から7位へ後退も歴代トップ10キープ（2026-05-05付各紙報道で裏取り）
      { value: '7位', labelJa: 'リング誌P4P（2026年5月・井上戦後もトップ10キープ）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E4%B8%AD%E8%B0%B7%E6%BD%A4%E4%BA%BA',
      'https://en.wikipedia.org/wiki/Junto_Nakatani',
    ],
    fights: [
      {
        date: '2026-05-02',
        opponentJa: '井上尚弥',
        opponentEn: 'Naoya Inoue',
        venueJa: '東京ドーム',
        resultJa: '0-3判定負け（112-116、112-116、113-115）',
        noteJa: 'プロ初黒星。それでも現地の評価はむしろ上昇（詳細は編集部ノート）',
      },
      {
        date: '2025-12-27',
        opponentJa: 'セバスティアン・ヘルナンデス',
        opponentEn: 'Sebastian Hernandez',
        venueJa: 'リヤド（サウジアラビア）',
        resultJa: '3-0判定勝ち（115-113、115-113、118-110）',
        noteJa: 'S・バンタム級転級初戦。年間最高試合候補と呼ばれた死闘',
      },
    ],
  },
  {
    slug: 'ren-hiramoto',
    nameJa: '平本蓮',
    nameEn: 'Ren Hiramoto',
    shortJa: ['平本', '蓮'],
    sport: 'mma',
    voiceScope: 'domestic',
    nextFightJa: {
      labelJa: '9/10ダウトベック戦',
      until: '2026-09-10',
      opponentJa: 'カルシャガ・ダウトベック',
      eventJa: '超RIZIN.5 浪速の超復活祭り｜京セラドーム大阪',
      href: '/rizin5',
    },
    accoladeJa: '総合格闘家・剛毅會（元キックボクサー、K-1甲子園2014優勝）',
    record: { wins: 4, losses: 3, draws: 0, kos: 1, asOf: '2024-07-28' },
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E5%B9%B3%E6%9C%AC%E8%93%AE',
      'https://en.wikipedia.org/wiki/Ren_Hiramoto',
    ],
    fights: [
      {
        date: '2026-05-10',
        opponentJa: '皇治',
        opponentEn: 'Kouzi',
        venueJa: '神戸・GLION ARENA KOBE（RIZIN.53）',
        resultJa: '引き分け（ボクシングルール特別試合・3分3R・10オンス）',
        noteJa: 'MMA戦績には含まれない特別試合。1年10ヶ月ぶりの実戦で決着つかず',
      },
      {
        date: '2024-07-28',
        opponentJa: '朝倉未来',
        opponentEn: 'Mikuru Asakura',
        venueJa: 'さいたまスーパーアリーナ（超RIZIN.3）',
        resultJa: '1R2分18秒TKO勝ち',
        noteJa: 'MMA唯一のフィニッシュ勝利。直後にドーピング疑惑が浮上（検査結果は陰性）',
      },
      {
        date: '2023-12-31',
        opponentJa: 'YA-MAN',
        opponentEn: 'YA-MAN',
        venueJa: 'さいたまスーパーアリーナ（RIZIN.45）',
        resultJa: '3-0判定勝ち',
        noteJa: '大晦日の打撃戦。両者が互いの打たれ強さを称え合った',
      },
      {
        date: '2023-04-29',
        opponentJa: '斎藤裕',
        opponentEn: 'Yutaka Saito',
        venueJa: '東京・国立代々木競技場第一体育館（RIZIN LANDMARK 5）',
        resultJa: '1-2判定負け',
        noteJa: '初代RIZINフェザー級王者に完封され、当時の3連敗中だった斎藤を復活させた一戦',
      },
      {
        date: '2022-11-06',
        opponentJa: '弥益ドミネーター聡志',
        opponentEn: 'Satoshi "Dominator" Yamasu',
        venueJa: '名古屋・ドルフィンズアリーナ（RIZIN LANDMARK 4）',
        resultJa: '3-0判定勝ち',
        noteJa: '70kg契約。連敗中の格上を相手に挙げた2勝目',
      },
      {
        date: '2022-07-02',
        opponentJa: '鈴木博昭',
        opponentEn: 'Hiroaki Suzuki',
        venueJa: '沖縄アリーナ（RIZIN.36）',
        resultJa: '2-1判定勝ち',
        noteJa: 'MMA初勝利',
      },
      {
        date: '2022-03-06',
        opponentJa: '鈴木千裕',
        opponentEn: 'Chihiro Suzuki',
        venueJa: '非公開スタジオ（東京・RIZIN LANDMARK vol.2）',
        resultJa: '0-3判定負け',
        noteJa: 'MMA転向2連敗目',
      },
      {
        date: '2020-12-31',
        opponentJa: '萩原京平',
        opponentEn: 'Kyohei Hagiwara',
        venueJa: 'さいたまスーパーアリーナ（RIZIN.26）',
        resultJa: '2R TKO負け',
        noteJa: 'MMAデビュー戦',
      },
    ],
  },
  {
    slug: 'mikuru-asakura',
    nameJa: '朝倉未来',
    nameEn: 'Mikuru Asakura',
    sport: 'mma',
    voiceScope: 'domestic',
    nextFightJa: {
      labelJa: '9/10青木真也戦',
      until: '2026-09-10',
      opponentJa: '青木真也',
      eventJa: '超RIZIN.5 浪速の超復活祭り｜京セラドーム大阪',
      href: '/rizin5',
    },
    accoladeJa: '総合格闘家・JAPAN TOP TEAM（RIZINフェザー級王座決定戦に3度挑戦も未勝利）',
    record: { wins: 19, losses: 6, draws: 0, kos: 9, asOf: '2025-12-31' },
    headlineStats: [
      // 2020(斎藤裕)・2023(ケラモフ)・2025(シェイドゥラエフ)の3度とも王座決定戦で敗退（fights参照）
      { value: '0勝3敗', labelJa: 'RIZINフェザー級王座決定戦（2020・2023・2025年大晦日）' },
      // 2025-12-31シェイドゥラエフ戦から2026-09-10青木戦まで＝253日（rizin5.tsのfeudJaと同一の裏取り値）
      { value: '253日ぶり', labelJa: '前回の敗戦からの復帰戦（9/10青木真也戦時点）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E6%9C%9D%E5%80%89%E6%9C%AA%E6%9D%A5',
      'https://en.wikipedia.org/wiki/Mikuru_Asakura',
    ],
    fights: [
      {
        date: '2025-12-31',
        opponentJa: 'ラジャブアリ・シェイドゥラエフ',
        opponentEn: 'Razhabali Shaidulloev',
        venueJa: 'さいたまスーパーアリーナ（RIZIN師走の超強者祭り）',
        resultJa: '1R2分54秒TKO負け',
        noteJa: 'RIZINフェザー級王座決定戦。3度目の王座挑戦も届かず、担架で運ばれた',
      },
      {
        date: '2025-07-27',
        opponentJa: 'クレベル・コイケ',
        opponentEn: 'Kleber Koike Erbst',
        venueJa: 'さいたまスーパーアリーナ（超RIZIN.4 真夏の喧嘩祭り）',
        resultJa: '2-1判定勝ち',
        noteJa: '2021年に一本負けを喫した相手への4年越しの雪辱',
      },
      {
        date: '2025-05-04',
        opponentJa: '鈴木千裕',
        opponentEn: 'Chihiro Suzuki',
        venueJa: '東京ドーム（RIZIN男祭り）',
        resultJa: '3R1分57秒TKO勝ち（ドクターストップ）',
      },
      {
        date: '2024-07-28',
        opponentJa: '平本蓮',
        opponentEn: 'Ren Hiramoto',
        venueJa: 'さいたまスーパーアリーナ（超RIZIN.3）',
        resultJa: '1R2分18秒KO負け',
        noteJa: '何年も挑発を重ねた相手にわずか1ラウンドで敗れる。海外にも波及した一戦',
      },
      {
        date: '2023-07-30',
        opponentJa: 'ヴガール・ケラモフ',
        opponentEn: 'Vugar Karamov',
        venueJa: 'さいたまスーパーアリーナ（超RIZIN.2）',
        resultJa: '1R2分41秒一本負け（リアネイキドチョーク）',
        noteJa: 'RIZINフェザー級王座決定戦。2度目の王座挑戦も一本負け',
      },
      {
        date: '2020-11-21',
        opponentJa: '斎藤裕',
        opponentEn: 'Yutaka Saito',
        venueJa: '大阪城ホール（RIZIN.25）',
        resultJa: '0-3判定負け',
        noteJa: 'RIZIN初代フェザー級王座決定戦。初めての王座挑戦',
      },
    ],
  },
  {
    slug: 'tenshin-nasukawa',
    nameJa: '那須川天心',
    nameEn: 'Tenshin Nasukawa',
    shortJa: ['那須川', '天心'],
    sport: 'boxing',
    voiceScope: 'domestic',
    nextFightJa: {
      labelJa: '9/27井上拓真戦',
      until: '2026-09-27',
      opponentJa: '井上拓真',
      eventJa: 'Prime Video Boxing 16｜TOYOTA ARENA TOKYO',
    },
    accoladeJa: 'プロボクシング・WBC世界バンタム級ランキング1位（元WBOアジアパシフィックバンタム級王者）',
    record: { wins: 8, losses: 1, draws: 0, kos: 3, asOf: '2026-04-11' },
    headlineStats: [
      // キックボクシング時代の通算戦績（2022-06-19 THE MATCH 2022引退時点）
      { value: '42-0', labelJa: 'キックボクシング時代の無敗記録（28KO・2022年引退）' },
      // 2026年8月時点のWBC世界バンタム級ランキング（9/27再戦の前提となる序列）
      { value: 'WBC1位', labelJa: '世界バンタム級ランキング（2026年8月時点）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E9%82%A3%E9%A0%88%E5%B7%9D%E5%A4%A9%E5%BF%83',
      'https://en.wikipedia.org/wiki/Tenshin_Nasukawa',
    ],
    fights: [
      {
        date: '2026-04-11',
        opponentJa: 'ファン・フランシスコ・エストラーダ',
        opponentEn: 'Juan Francisco Estrada',
        venueJa: '両国国技館（WBC世界バンタム級挑戦者決定戦）',
        resultJa: '9回終了時TKO勝ち（相手棄権）',
        noteJa: '元2階級制覇王者をボディで攻略。井上拓真への再挑戦権を獲得',
      },
      {
        date: '2025-11-24',
        opponentJa: '井上拓真',
        opponentEn: 'Takuma Inoue',
        venueJa: 'TOYOTA ARENA TOKYO（WBC世界バンタム級王座決定戦）',
        resultJa: '0-3判定負け（112-116、112-116、111-117）',
        noteJa: 'プロボクシング初黒星。10ヶ月後の9/27に再戦が決定',
      },
      {
        date: '2024-10-14',
        opponentJa: 'ジェルウィン・アシロ',
        opponentEn: 'Gerwin Asilo',
        venueJa: '有明アリーナ（WBOアジアパシフィックバンタム級王座決定戦）',
        resultJa: '3-0判定勝ち',
        noteJa: '空位だった王座を獲得。2025年4月に世界挑戦へ専念するため返上',
      },
      {
        date: '2023-04-08',
        opponentJa: '与那覇勇気',
        opponentEn: 'Yuki Yonaha',
        venueJa: '有明アリーナ',
        resultJa: '3-0判定勝ち',
        noteJa: 'プロボクシングデビュー戦',
      },
      {
        date: '2018-12-31',
        opponentJa: 'フロイド・メイウェザー',
        opponentEn: 'Floyd Mayweather',
        venueJa: 'さいたまスーパーアリーナ（RIZIN.14）',
        resultJa: '1R2分19秒TKO負け（3度のダウン）',
        noteJa: 'エキシビションマッチ。プロボクシングの通算戦績には含まれない',
      },
    ],
  },
  {
    slug: 'kai-asakura',
    nameJa: '朝倉海',
    nameEn: 'Kai Asakura',
    shortJa: ['朝倉海'],
    sport: 'mma',
    voiceScope: 'domestic',
    nextFightJa: {
      labelJa: '8/29チロン戦',
      until: '2026-08-29',
      opponentJa: 'アオリ・チロン',
      eventJa: 'UFCファイトナイト上海｜上海インドアスタジアム',
    },
    accoladeJa: '総合格闘家・JAPAN TOP TEAM所属（元RIZINバンタム級王者・第3代/第6代）',
    record: { wins: 22, losses: 6, draws: 0, kos: 14, asOf: '2026-05-30' },
    headlineStats: [
      // 通算22勝のうちKO/TKO決着数（sherdog記録・2026-05-30時点で裏取り）
      { value: '14KO', labelJa: '通算22勝のうちKO/TKO決着数' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E6%9C%9D%E5%80%89%E6%B5%B7',
      'https://en.wikipedia.org/wiki/Kai_Asakura',
    ],
    fights: [
      {
        date: '2026-05-30',
        opponentJa: 'キャメロン・スマザーマン',
        opponentEn: 'Cameron Smotherman',
        venueJa: '中国・マカオ（UFCファイトナイト）',
        resultJa: '1RTKO勝ち',
        noteJa: 'バンタム級に戻しての一戦でUFC初勝利。開始2連敗からの反撃',
      },
      {
        date: '2025-08-16',
        opponentJa: 'ティム・エリオット',
        opponentEn: 'Tim Elliott',
        venueJa: '米シカゴ（UFC 319）',
        resultJa: '2R4分39秒ギロチンチョークで負け',
        noteJa: 'フライ級でのUFC2連敗目',
      },
      {
        date: '2024-12-07',
        opponentJa: 'アレックス・パントージャ',
        opponentEn: 'Alexandre Pantoja',
        venueJa: '米ラスベガス（UFC 310）',
        resultJa: '2R2分5秒リアネイキッドチョークで負け',
        noteJa: 'UFC参戦初戦でいきなりフライ級王座に挑戦。デビュー戦での世界王座挑戦は史上初',
      },
      {
        date: '2023-12-31',
        opponentJa: 'フアン・アーチュレッタ',
        opponentEn: 'Juan Archuleta',
        venueJa: 'さいたまスーパーアリーナ（RIZIN.45）',
        resultJa: '2RTKO勝ち（膝蹴りからのパウンド）',
        noteJa: 'レッドカードスタートの特殊ルール。バンタム級王座に返り咲き第6代王者に',
      },
      {
        date: '2020-08-10',
        opponentJa: '扇久保博正',
        opponentEn: 'Hiromasa Ougikubo',
        venueJa: 'ぴあアリーナMM（RIZIN.23）',
        resultJa: '1R4分31秒TKO勝ち',
        noteJa: '空位のバンタム級王座決定戦。第3代RIZINバンタム級王者に',
      },
      {
        date: '2019-12-31',
        opponentJa: '堀口恭司',
        opponentEn: 'Kyoji Horiguchi',
        venueJa: 'さいたまスーパーアリーナ（RIZIN.26）',
        resultJa: 'KO負け',
        noteJa: '前年8月の借りを返された「リベンジKO」',
      },
      {
        date: '2019-08-18',
        opponentJa: '堀口恭司',
        opponentEn: 'Kyoji Horiguchi',
        venueJa: 'さいたまスーパーアリーナ（RIZIN.18）',
        resultJa: 'KO勝ち',
        noteJa: '当時無敗だった堀口を沈めた、RIZIN史上最大の番狂わせと呼ばれる一戦',
      },
    ],
  },
  {
    slug: 'kyoma-akimoto',
    nameJa: '秋元強真',
    nameEn: 'Kyoma Akimoto',
    shortJa: ['秋元', '強真'],
    sport: 'mma',
    voiceScope: 'domestic',
    nextFightJa: {
      labelJa: '8/11クレベル・コイケ戦',
      until: '2026-08-11',
      opponentJa: 'クレベル・コイケ',
      eventJa: 'RIZIN.54｜TOYOTA ARENA TOKYO',
    },
    accoladeJa:
      '総合格闘家・JAPAN TOP TEAM所属（通称「The Hunter」、19歳で元Bellatorバンタム級王者パッチー・ミックスをTKO撃破）',
    record: { wins: 12, losses: 1, draws: 0, kos: 7, asOf: '2026-03-07' },
    headlineStats: [
      // パッチー・ミックス撃破時点の年齢（生年月日2006-03-08・当サイト2026-08-06記事で裏取り）
      { value: '19歳', labelJa: 'パッチー・ミックス撃破時点の年齢（2026年3月時点）' },
      // RIZIN.54メインの勝者にシェイドゥラエフの王座挑戦権が懸かる（ゴング格闘技等の事前報道で裏取り）
      { value: '王座挑戦権', labelJa: '8/11クレベル・コイケ戦の勝者がシェイドゥラエフの王座に挑戦（RIZIN.54）' },
    ],
    sameAs: ['https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E5%BC%B7%E7%9C%9F'],
    fights: [
      {
        date: '2026-03-07',
        opponentJa: 'パッチー・ミックス',
        opponentEn: 'Patchy Mix',
        venueJa: '有明アリーナ（RIZIN.52）',
        resultJa: '2R0分37秒TKO勝ち',
        noteJa: '元Bellatorバンタム級王者を撃破。「この先の10年、RIZINを背負う」と宣言',
      },
      {
        date: '2025-12-31',
        opponentJa: '新居すぐる',
        opponentEn: 'Suguru Nii',
        venueJa: 'さいたまスーパーアリーナ（RIZIN 師走の超強者祭り）',
        resultJa: '1R3分45秒TKO勝ち（膝蹴り）',
      },
      {
        date: '2025-11-03',
        opponentJa: '萩原京平',
        opponentEn: 'Kyohei Hagiwara',
        venueJa: '神戸・GLION ARENA KOBE（RIZIN LANDMARK 12 in KOBE）',
        resultJa: '2R3分52秒TKO勝ち',
        noteJa: '超RIZIN.4以降のSNS上の因縁対決。19歳での最年少メイン抜擢',
      },
      {
        date: '2025-07-27',
        opponentJa: '赤田功輝',
        opponentEn: 'Koki Akada',
        venueJa: 'さいたまスーパーアリーナ（超RIZIN.4 真夏の喧嘩祭り）',
        resultJa: '1R2分57秒一本勝ち（リアネイキッドチョーク）',
      },
      {
        date: '2025-05-04',
        opponentJa: '高木凌',
        opponentEn: 'Ryo Takagi',
        venueJa: '東京ドーム（RIZIN男祭り）',
        resultJa: '判定3-0勝ち',
        noteJa: 'プロ初黒星からの復活戦',
      },
      {
        date: '2024-12-31',
        opponentJa: '元谷友貴',
        opponentEn: 'Tomoki Motoya',
        venueJa: 'さいたまスーパーアリーナ（RIZIN DECADE）',
        resultJa: '判定0-3負け',
        noteJa: 'バンタム級王座挑戦者決定戦。プロ唯一の黒星',
      },
      {
        date: '2024-11-17',
        opponentJa: '鈴木博昭',
        opponentEn: 'Hiroaki Suzuki',
        venueJa: 'ポートメッセなごや（RIZIN LANDMARK 10 in NAGOYA）',
        resultJa: '判定3-0勝ち',
      },
      {
        date: '2024-09-29',
        opponentJa: '金太郎',
        opponentEn: 'Kintaro',
        venueJa: 'さいたまスーパーアリーナ（RIZIN.48）',
        resultJa: '1R3分16秒TKO勝ち（バックからの膝連打）',
        noteJa: '18歳・5戦全勝でのRIZINデビュー戦。朝倉海がセコンドに',
      },
      {
        date: '2024-05-17',
        opponentJa: 'アラン・ヒロ・ヤマニハ',
        opponentEn: 'Alan "Hiro" Yamaniha',
        venueJa: '格闘代理戦争',
        resultJa: '2R0分56秒TKO勝ち',
      },
      {
        date: '2023-11-11',
        opponentJa: '田口崇貴',
        opponentEn: 'Takaki Taguchi',
        venueJa: 'DEEP 116 IMPACT',
        resultJa: '1R0分44秒TKO勝ち',
      },
      {
        date: '2023-07-02',
        opponentJa: '朝比奈龍希',
        opponentEn: 'Ryuki Asahina',
        venueJa: 'DEEP 114 IMPACT',
        resultJa: '1R4分08秒一本勝ち',
      },
      {
        date: '2023-02-11',
        opponentJa: '高柳京之介',
        opponentEn: 'Kyonosuke Takayanagi',
        venueJa: 'DEEP 112 IMPACT',
        resultJa: '1R3分16秒TKO勝ち',
      },
      {
        date: '2022-06-26',
        opponentJa: '宮川日向',
        opponentEn: 'Hinata Miyagawa',
        venueJa: 'Gladiator',
        resultJa: '判定3-0勝ち',
        noteJa: 'プロデビュー戦',
      },
    ],
  },
  {
    slug: 'mona-kimura',
    nameJa: '木村萌那',
    nameEn: 'Mona Kimura',
    shortJa: ['木村', '萌那'],
    sport: 'mma',
    voiceScope: 'global',
    nextFightJa: {
      labelJa: '9/12マリン・ニコル戦',
      until: '2026-09-12',
      opponentJa: 'マリン・ニコル',
      eventJa: 'Krush EX｜国立代々木競技場第二体育館',
    },
    accoladeJa: '女子キックボクサー・K-1ジム目黒TEAM TIGER所属（通称「リアル春麗」、Krush/K-1参戦4戦4勝）',
    record: { wins: 4, losses: 0, draws: 0, kos: 2, asOf: '2026-04-11' },
    headlineStats: [
      { value: '4戦4勝', labelJa: 'Krush/K-1参戦後の戦績（2026年4月時点・2KO）' },
      // K-1公式プレスリリース（2026年4月）が発表した「リアル春麗」動画のバズ数
      { value: '約3000万', labelJa: '「リアル春麗」動画の公開1週間の推定バズ数（K-1公式発表）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E6%9C%A8%E6%9D%91%E8%90%8C%E9%82%A3',
      'https://en.wikipedia.org/wiki/Mona_Kimura',
    ],
    fights: [
      {
        date: '2026-04-11',
        opponentJa: 'チェ・ウンジ',
        opponentEn: 'Eunji Choi',
        venueJa: '国立代々木競技場第二体育館（K-1 GENKI 2026）',
        resultJa: '判定3-0勝ち',
        noteJa: 'K-1初陣。海外ファンから「リアル春麗」と称される',
      },
      {
        date: '2025-06-27',
        opponentJa: '小澤聡子',
        opponentEn: 'Satoko Ozawa',
        venueJa: '東京・後楽園ホール（Krush.177）',
        resultJa: '2R1分8秒TKO勝ち',
        noteJa: 'キックボクシング転向後3連勝目',
      },
      {
        date: '2025-01-26',
        opponentJa: 'Yuka☆',
        opponentEn: 'Yuka',
        tag: 'Yuka',
        venueJa: '東京・後楽園ホール（Krush.170）',
        resultJa: '判定3-0勝ち（30-27×3）',
        noteJa: '転向2連勝目。公開半年後も海外で語り継がれる一戦に',
      },
      {
        date: '2024-11-16',
        opponentJa: '荻原愛',
        opponentEn: 'Ai Ogihara',
        venueJa: '東京・後楽園ホール（Krush.167）',
        resultJa: '1R1分30秒KO勝ち',
        noteJa: 'キックボクシングプロデビュー戦',
      },
    ],
  },
  {
    slug: 'daichi-tomizawa',
    nameJa: '冨澤大智',
    nameEn: 'Daichi Tomizawa',
    shortJa: ['冨澤', '大智'],
    sport: 'mma',
    voiceScope: 'domestic',
    accoladeJa:
      "総合格闘家・FIGHTER'S FLOW所属（BreakingDown出身、通称「闘神」。膝蹴りを武器にRIZIN参戦）",
    record: { wins: 3, losses: 2, draws: 0, kos: 2, asOf: '2026-06-06' },
    sameAs: ['https://ja.wikipedia.org/wiki/%E5%86%A8%E6%BE%A4%E5%A4%A7%E6%99%BA'],
    fights: [
      {
        date: '2026-06-06',
        opponentJa: '加藤瑠偉',
        opponentEn: 'Rui Kato',
        venueJa: '仙台・ゼビオアリーナ仙台（RIZIN LANDMARK 14 in SENDAI）',
        resultJa: '1R4分37秒TKO勝ち（グラウンドパンチ）',
        noteJa: '篠塚戦の敗北からの再起戦。RIZIN東北初開催のカード',
      },
      {
        date: '2025-12-31',
        opponentJa: '篠塚辰樹',
        opponentEn: 'Tatsuki Shinotsuka',
        venueJa: 'さいたまスーパーアリーナ（RIZIN 師走の超強者祭り）',
        resultJa: '2R3分22秒TKO負け（グラウンドパンチ）',
      },
      {
        date: '2025-09-28',
        opponentJa: '平本丈',
        opponentEn: 'Joe Hiramoto',
        venueJa: '愛知・IGアリーナ（RIZIN.51）',
        resultJa: '判定2-1勝ち',
        noteJa: '1Rのチョークを耐え抜いての逆転勝ち',
      },
      {
        date: '2025-05-04',
        opponentJa: '山本アーセン',
        opponentEn: 'Arsen Yamamoto',
        venueJa: '東京ドーム（RIZIN男祭り）',
        resultJa: '2R1分24秒一本負け',
      },
      {
        date: '2024-12-31',
        opponentJa: '三浦孝太',
        opponentEn: 'Kota Miura',
        venueJa: 'さいたまスーパーアリーナ（RIZIN DECADE）',
        resultJa: '1R1分53秒KO勝ち',
      },
      {
        date: '2023-12-31',
        opponentJa: '篠塚辰樹',
        opponentEn: 'Tatsuki Shinotsuka',
        venueJa: 'さいたまスーパーアリーナ（RIZIN.45）',
        resultJa: '判定0-3負け',
        noteJa:
          'キックボクシングルール・60kg契約。MMA戦績には含まれない一戦。試合中の頭部接触で篠塚が支える場面が反響を呼んだ',
      },
    ],
  },
];

/** タグ文字列（=正式名）に一致するファイターを返す。LP化の判定に使う。 */
export function getFighterByJaName(nameJa: string): Fighter | undefined {
  return FIGHTERS.find((f) => f.nameJa === nameJa);
}
