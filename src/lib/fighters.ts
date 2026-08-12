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
    // 次戦は未確定。RIZIN.54 後のマイクで「シェイドゥラエフ×AJ・マッキーの勝者と大晦日ナゴヤドームのメインで」と
    // 要求したが、対戦は正式発表されていない＋左拳の負傷を本人が明かしている（確定情報のみ載せる＝nextFightJa は持たない）。
    accoladeJa:
      '総合格闘家・JAPAN TOP TEAM所属（通称「The Hunter」、20歳で元RIZINフェザー級王者クレベル・コイケを完封し次期挑戦者に）',
    record: { wins: 13, losses: 1, draws: 0, kos: 7, asOf: '2026-08-11' },
    headlineStats: [
      // クレベル撃破時点の年齢（生年月日2006-03-08・当サイト2026-08-06記事で裏取り）
      { value: '20歳', labelJa: '元王者クレベル・コイケを完封した時点の年齢（2026年8月11日）' },
      // 2024年大晦日の元谷友貴戦（プロ唯一の黒星）以降、負けなし。
      { value: '5連勝', labelJa: '2025年5月の高木凌戦からRIZIN.54まで無敗（2026年8月11日時点）' },
    ],
    sameAs: ['https://ja.wikipedia.org/wiki/%E7%A7%8B%E5%85%83%E5%BC%B7%E7%9C%9F'],
    fights: [
      {
        date: '2026-08-11',
        opponentJa: 'クレベル・コイケ',
        opponentEn: 'Kleber Koike Erbst',
        venueJa: 'TOYOTA ARENA TOKYO（RIZIN.54）',
        resultJa: '判定3-0勝ち',
        noteJa:
          'フェザー級次期挑戦者決定戦。元王者の寝技を最後まで切り続けて完封し5連勝。試合後に左拳の負傷を明かした',
      },
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
    // 2026-08-11 RIZIN.54 で上田幹雄を2R KO＝ヘビー級GP決勝進出を機に新設（村山判断＝伸びる前に器を置く）。
    // 記事はまだ2本と薄いので、11/8 決勝までに記事が積まれて LP が厚くなる前提の先行投資。
    slug: 'edpolo-king',
    nameJa: 'エドポロキング',
    nameEn: 'Edpolo King',
    shortJa: ['エドポロ'],
    sport: 'mma',
    // 素材は RIZIN 公式のコメント欄＝日本語主体。海外の反応框は名乗らない（voiceScope の判断基準は型定義参照）。
    voiceScope: 'domestic',
    nextFightJa: {
      labelJa: '11/8スダリオ剛戦（ヘビー級GP決勝）',
      until: '2026-11-08',
      opponentJa: 'スダリオ剛',
      eventJa: 'RIZIN LANDMARK 17 in CHIBA｜LaLa arena TOKYO-BAY',
    },
    accoladeJa:
      '総合格闘家・ROOTS GYM所属（身長204cm、初代Rumbleヘビー級王者。プロMMAは4戦全勝すべてKO/TKO決着）',
    record: { wins: 4, losses: 0, draws: 0, kos: 4, asOf: '2026-08-11' },
    headlineStats: [
      // Wikipedia の公式プロフィール記載値（2001-02-08 生・大阪市生野区出身）。
      { value: '204cm', labelJa: 'RIZINヘビー級で戦う体格（公式プロフィール）' },
      // プロ4戦がすべて1R/2Rのフィニッシュ＝判定に行ったことが一度もない。
      { value: '4戦4勝', labelJa: 'プロMMA全勝・すべてKO/TKO決着（2026年8月11日時点）' },
    ],
    sameAs: ['https://ja.wikipedia.org/wiki/%E3%82%A8%E3%83%89%E3%83%9D%E3%83%AD%E3%82%AD%E3%83%B3%E3%82%B0'],
    fights: [
      {
        date: '2026-08-11',
        opponentJa: '上田幹雄',
        opponentEn: 'Mikio Ueda',
        venueJa: 'TOYOTA ARENA TOKYO（RIZIN.54）',
        resultJa: '2R0分47秒KO勝ち（膝蹴り）',
        noteJa:
          'ヘビー級ジャパンGP準決勝。極真の世界王者を1年半ぶりの実戦で沈め決勝へ。リング上でスダリオ剛に「かかってこんかいコラ」',
      },
      {
        date: '2025-03-30',
        opponentJa: '酒井リョウ',
        opponentEn: 'Ryo Sakai',
        venueJa: 'RIZIN.50',
        resultJa: '2RTKO勝ち',
        noteJa: 'マウントからのパウンドで決着。酒井はこの1年半後、GP準決勝でスダリオ剛にもTKOで敗れている',
      },
      {
        date: '2024-12-31',
        opponentJa: '貴賢神',
        opponentEn: 'Takakento',
        venueJa: 'RIZIN.49',
        resultJa: '1RTKO勝ち',
        noteJa: '相手はスダリオ剛の実弟。スダリオはGP決勝を「弟の雪辱」と位置づけている',
      },
      {
        date: '2024-05-26',
        opponentJa: 'テリー・ワカンダ',
        opponentEn: 'Terry Wakanda',
        venueJa: 'Rumble',
        resultJa: '1RTKO勝ち',
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
  {
    /*
      超RIZIN.5（9/10）メインの2人。RIZIN の外国人トップを opt-in した初のケース。

      voiceScope が 'domestic' なのは実測の結論（2026-08-12）。「外国人選手なら海外の反応框が
      成立する」という見込みで着手したが、素材を数えたら成り立たなかった:
        - 当サイトのシェイドゥラエフ関連3記事は RIZIN 公式YouTubeの**日本語コメント**中心
          （英語原文つきは37件中2件）
        - 決定戦の PFL 公式動画のコメント欄も**キルギス語・ロシア語と日本語**が主で英語は少数
      つまり彼らを語っているのは英語圏ではなく「母国＋日本」。ここで global を名乗ると
      看板と中身がズレる（2026-08-03 村山決定と同じ理由）ので、戦績×次戦框で出す。
      GSC 実測でも需要は「ajマッキー ufc」「シェイドゥラエフ マッキー」＝対戦・戦績クエリ側にある。
    */
    slug: 'razhabali-shaydullaev',
    nameJa: 'ラジャブアリ・シェイドゥラエフ',
    nameEn: 'Razhabali Shaydullaev',
    // 表記ゆれ（コメント欄では「シェイドラエフ」も頻出）。姓だけの言及を拾う。
    shortJa: ['シェイドゥラエフ', 'シェイドラエフ'],
    sport: 'mma',
    voiceScope: 'domestic',
    nextFightJa: {
      labelJa: '9/10マッキー戦',
      until: '2026-09-10',
      opponentJa: 'AJ・マッキー',
      eventJa: '超RIZIN.5 浪速の超復活祭り｜京セラドーム大阪',
      href: '/rizin5',
    },
    accoladeJa: 'RIZINフェザー級王者・キルギス（2025年5月戴冠／RIZIN初のキルギス人選手）',
    record: { wins: 19, losses: 0, draws: 0, kos: 7, asOf: '2026-04-12' },
    headlineStats: [
      // ヒーローは record から「通算戦績19-0」「KO率」を自動で出す。ここに 19-0 を再掲すると
      // 同じ数字が2枠に並ぶので、record から読み取れない値だけを置く。
      // 戴冠2025-05-04 → コレスニック・朝倉未来・久保優太で3度防衛（2026年4月時点）
      { value: '3', labelJa: 'RIZIN王座防衛（2026年4月時点）' },
      // 19戦すべてフィニッシュ決着＝判定までいったことが一度もない（en.wikipedia の戦績表で全戦確認）
      { value: '0', labelJa: '判定決着（19戦すべてフィニッシュ）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E3%83%A9%E3%82%B8%E3%83%A3%E3%83%96%E3%82%A2%E3%83%AA%E3%83%BB%E3%82%B7%E3%82%A7%E3%82%A4%E3%83%89%E3%82%A5%E3%83%A9%E3%82%A8%E3%83%95',
      'https://en.wikipedia.org/wiki/Razhabali_Shaydullaev',
    ],
    fights: [
      {
        date: '2026-04-12',
        opponentJa: '久保優太',
        opponentEn: 'Yuta Kubo',
        venueJa: '福岡（RIZIN LANDMARK 13）',
        resultJa: '1R4分13秒TKO勝ち',
        noteJa: '久保との2度目の対戦で3度目の王座防衛。連勝を19に伸ばした',
      },
      {
        date: '2025-12-31',
        opponentJa: '朝倉未来',
        opponentEn: 'Mikuru Asakura',
        venueJa: 'さいたま（RIZIN 師走の超強者祭り）',
        resultJa: '1R2分54秒TKO勝ち',
        noteJa: '2度目の王座防衛。朝倉未来の挑戦を1Rで退けた大晦日',
      },
      {
        date: '2025-09-28',
        opponentJa: 'ビクター・コレスニック',
        opponentEn: 'Viktor Kolesnik',
        venueJa: '名古屋（RIZIN.51）',
        resultJa: '1R33秒TKO勝ち',
        noteJa: '初防衛戦を33秒で終わらせた',
      },
      {
        date: '2025-05-04',
        opponentJa: 'クレベル・コイケ',
        opponentEn: 'Kleber Koike Erbst',
        venueJa: '東京ドーム（RIZIN OTOKOMATSURI）',
        resultJa: '1R1分2秒KO勝ち',
        noteJa: '王者クレベルを1分2秒で仕留めてRIZINフェザー級王座を戴冠',
      },
      {
        date: '2024-12-31',
        opponentJa: '久保優太',
        opponentEn: 'Yuta Kubo',
        venueJa: 'さいたま（RIZIN.49）',
        resultJa: '2R2分30秒TKO勝ち',
      },
      {
        date: '2024-09-29',
        opponentJa: 'フアン・アーチュレッタ',
        opponentEn: 'Juan Archuleta',
        venueJa: 'さいたま（RIZIN.48）',
        resultJa: '1R3分12秒アームバーで一本勝ち',
      },
      {
        date: '2024-06-09',
        opponentJa: '武田光司',
        opponentEn: 'Koji Takeda',
        venueJa: '東京・国立代々木競技場第一体育館（RIZIN.47）',
        resultJa: '1R4分42秒リアネイキドチョークで一本勝ち',
        noteJa: 'RIZIN初参戦。当時すでに10戦10フィニッシュの無敗だった',
      },
    ],
  },
  {
    slug: 'aj-mckee',
    nameJa: 'AJ・マッキー',
    nameEn: 'A.J. McKee',
    shortJa: ['マッキー'],
    sport: 'mma',
    voiceScope: 'domestic',
    nextFightJa: {
      labelJa: '9/10シェイドゥラエフ戦',
      until: '2026-09-10',
      opponentJa: 'ラジャブアリ・シェイドゥラエフ',
      eventJa: '超RIZIN.5 浪速の超復活祭り｜京セラドーム大阪',
      href: '/rizin5',
    },
    accoladeJa: '元Bellator世界フェザー級王者・米国（2021年フェザー級グランプリ優勝）',
    record: { wins: 25, losses: 2, draws: 0, kos: 6, asOf: '2026-06-27' },
    headlineStats: [
      // デビューから無敗のまま18連勝→2022-04-15 のピットブル再戦で初黒星（en.wikipedia）
      { value: '18-0', labelJa: 'デビューからの連勝（2022年4月に初黒星）' },
      { value: '$1M', labelJa: '2021年ベラトールGP優勝賞金' },
    ],
    sameAs: ['https://en.wikipedia.org/wiki/A._J._McKee'],
    fights: [
      {
        date: '2026-06-27',
        opponentJa: 'サラマト・イスブラエフ',
        opponentEn: 'Salamat Isbulaev',
        venueJa: '米サンディエゴ（PFL San Diego）',
        resultJa: '3-0判定勝ち',
        noteJa: 'PFLで3連勝。この勝利で超RIZIN.5の王座統一戦へ',
      },
      {
        date: '2026-03-20',
        opponentJa: 'アダム・ボリッチ',
        opponentEn: 'Ádám Borics',
        venueJa: 'スペイン・マドリード（PFL Madrid）',
        resultJa: '3-0判定勝ち',
      },
      {
        date: '2025-07-19',
        opponentJa: 'アフメド・マゴメドフ',
        opponentEn: 'Akhmed Magomedov',
        venueJa: '南アフリカ・ケープタウン（PFL Champions Series 2）',
        resultJa: '3-0判定勝ち',
      },
      {
        date: '2024-10-19',
        opponentJa: 'ポール・ヒューズ',
        opponentEn: 'Paul Hughes',
        venueJa: 'サウジアラビア・リヤド（PFL Super Fights: Battle of the Giants）',
        resultJa: '1-2判定負け',
        noteJa: '通算2敗目。ここから3連勝で立て直した',
      },
      {
        date: '2021-07-31',
        opponentJa: 'パトリシオ・ピットブル',
        opponentEn: 'Patrício Pitbull',
        venueJa: '米イングルウッド（Bellator 263）',
        resultJa: '1Rギロチンチョークで一本勝ち',
        noteJa: 'フェザー級グランプリ決勝。王者ピットブルを1Rで極め、王座と賞金100万ドルを獲得',
      },
    ],
  },
  {
    /*
      RIZIN フェザー級を長く支配した柔術家。voiceScope は 'domestic'
      （ブラジル出身だが語られる場は日本＝素材の実態で決める・2026-08-12 の学び）。
      2026-08-11 の秋元強真戦（判定0-3負け）で次戦は未発表なので nextFightJa は持たない。
    */
    slug: 'kleber-koike',
    nameJa: 'クレベル・コイケ',
    nameEn: 'Kleber Koike Erbst',
    shortJa: ['クレベル'],
    sport: 'mma',
    voiceScope: 'domestic',
    accoladeJa: '元RIZINフェザー級王者（2度戴冠）・元KSWフェザー級王者。ボンサイ柔術',
    // 35勝10敗1分＝別に無効試合1（2023-06-24 体重超過）。record に NC の枠が無いので fights の noteJa に書く。
    record: { wins: 35, losses: 10, draws: 1, kos: 2, asOf: '2026-08-11' },
    headlineStats: [
      // 35勝のうち29が一本＝KO2との対比がこの選手の輪郭そのもの（en.wikipedia の決着内訳）
      { value: '29', labelJa: '一本勝ち（35勝中／KOは2）' },
      { value: '2度', labelJa: 'RIZINフェザー級戴冠（2022年・2024年）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E3%82%AF%E3%83%AC%E3%83%99%E3%83%AB%E3%83%BB%E3%82%B3%E3%82%A4%E3%82%B1',
      'https://en.wikipedia.org/wiki/Kleber_Koike_Erbst',
    ],
    fights: [
      {
        date: '2026-08-11',
        opponentJa: '秋元強真',
        opponentEn: 'Kyoma Akimoto',
        venueJa: '東京・トヨタアリーナ東京（RIZIN.54）',
        resultJa: '判定0-3負け',
        noteJa: '20歳の次期挑戦者に3ラウンド完封された。KOではなく判定で押し切られた敗け方が議論を呼んだ',
      },
      {
        date: '2025-12-31',
        opponentJa: 'ヴガール・ケラモフ',
        opponentEn: 'Vugar Karamov',
        venueJa: 'さいたま（RIZIN 師走の超強者祭り）',
        resultJa: '判定3-0勝ち',
        noteJa: '王座陥落と朝倉未来戦の連敗を止めた大晦日',
      },
      {
        date: '2025-07-27',
        opponentJa: '朝倉未来',
        opponentEn: 'Mikuru Asakura',
        venueJa: 'さいたま（超RIZIN.4）',
        resultJa: '判定1-2負け',
        noteJa: '得意の組みを最後まで嫌われ、スプリット判定で落とした',
      },
      {
        date: '2025-05-04',
        opponentJa: 'ラジャブアリ・シェイドゥラエフ',
        opponentEn: 'Razhabali Shaydullaev',
        venueJa: '東京ドーム（RIZIN OTOKOMATSURI）',
        resultJa: '1R1分2秒KO負け',
        noteJa: '無敗の挑戦者に1分2秒で王座を明け渡した',
      },
      {
        date: '2024-12-31',
        opponentJa: '鈴木千裕',
        opponentEn: 'Chihiro Suzuki',
        venueJa: 'さいたま（RIZIN.49）',
        resultJa: '判定3-0勝ち',
        noteJa: '2度目のRIZINフェザー級戴冠。互いに血まみれの3ラウンドで、敗れた鈴木の評価も上がった一戦',
      },
      {
        date: '2024-06-09',
        opponentJa: 'フアン・アーチュレッタ',
        opponentEn: 'Juan Archuleta',
        venueJa: '東京・国立代々木競技場第一体育館（RIZIN.47）',
        resultJa: '1R2分25秒インバーテッドヒールフックで一本勝ち',
      },
      {
        date: '2023-12-31',
        opponentJa: '斎藤裕',
        opponentEn: 'Yutaka Saito',
        venueJa: 'さいたま（RIZIN.45）',
        resultJa: '3R1分22秒ブラボーチョークで一本勝ち',
      },
      {
        date: '2023-06-24',
        opponentJa: '鈴木千裕',
        opponentEn: 'Chihiro Suzuki',
        venueJa: '札幌（RIZIN.43）',
        resultJa: '無効試合（体重超過）',
        noteJa: '計量で体重を落とせずRIZINフェザー級王座を失った。MMA戦績には勝敗として計上されない',
      },
      {
        date: '2022-12-31',
        opponentJa: 'パトリシオ・ピットブル',
        opponentEn: 'Patrício Pitbull',
        venueJa: 'さいたま（Bellator MMA vs. RIZIN）',
        resultJa: '判定0-3負け',
      },
    ],
  },
  {
    slug: 'tyson-fury',
    nameJa: 'タイソン・フューリー',
    nameEn: 'Tyson Fury',
    shortJa: ['フューリー'],
    sport: 'boxing',
    voiceScope: 'global',
    accoladeJa:
      '元統一世界ヘビー級王者「ジプシー・キング」（2024年にウシクへ連敗し無敗記録が途絶える。2026年に現役復帰）',
    record: { wins: 36, losses: 2, draws: 1, kos: 25, asOf: '2026-07-24' },
    headlineStats: [
      // デビューから2024-05-18ウシク戦初黒星まで無敗（34勝1分）。Wikipedia戦績表で裏取り
      { value: '35戦無敗', labelJa: 'デビューから2024年5月のウシク戦初黒星まで（34勝1分）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E3%82%BF%E3%82%A4%E3%82%BD%E3%83%B3%E3%83%BB%E3%83%95%E3%83%A5%E3%83%BC%E3%83%AA%E3%83%BC',
      'https://en.wikipedia.org/wiki/Tyson_Fury',
    ],
    fights: [
      {
        date: '2026-07-24',
        opponentJa: 'マリウシュ・ヴァフ',
        opponentEn: 'Mariusz Wach',
        venueJa: 'パタヤ（タイ・マックス・ムエタイ・スタジアム）',
        resultJa: '7回TKO勝ち',
        noteJa: '非公開興行。2022年12月以来となるストップ勝ち',
      },
      {
        date: '2026-04-11',
        opponentJa: 'アルスランベク・マフムドフ',
        opponentEn: 'Arslanbek Makhmudov',
        venueJa: 'ロンドン（トッテナム・ホットスパー・スタジアム）',
        resultJa: '12回判定勝ち（120-108、120-108、119-109）',
        noteJa: '引退表明を撤回しての復帰第1戦',
      },
      {
        date: '2024-12-21',
        opponentJa: 'オレクサンドル・ウシク',
        opponentEn: 'Oleksandr Usyk',
        venueJa: 'リヤド（サウジアラビア・キングダム・アリーナ）',
        resultJa: '12回判定負け（全会一致116-112）',
        noteJa: '4団体統一王座決定戦の再戦。この敗戦後に一度引退を表明',
      },
      {
        date: '2024-05-18',
        opponentJa: 'オレクサンドル・ウシク',
        opponentEn: 'Oleksandr Usyk',
        venueJa: 'リヤド（サウジアラビア・キングダム・アリーナ）',
        resultJa: '12回判定負け（スプリット115-112、114-113、113-114）',
        noteJa: '4団体統一王座決定戦。プロ初黒星（通算36戦目）',
      },
      {
        date: '2023-10-28',
        opponentJa: 'フランシス・ガヌー',
        opponentEn: 'Francis Ngannou',
        venueJa: 'リヤド（サウジアラビア）',
        resultJa: '10回判定勝ち（スプリット94-95、96-93、95-94）',
        noteJa: '元UFC王者との異種格闘技的クロスオーバー戦。3回にダウンを喫する接戦だった',
      },
    ],
  },
  {
    slug: 'ben-whittaker',
    nameJa: 'ベン・ウィテカー',
    nameEn: 'Ben Whittaker',
    shortJa: ['ウィテカー'],
    sport: 'boxing',
    voiceScope: 'global',
    nextFightJa: {
      labelJa: '10/3コナー・ウォレス戦',
      until: '2026-10-03',
      opponentJa: 'コナー・ウォレス',
      eventJa: 'IBFライトヘビー級 最終挑戦者決定戦｜Utilita Arena Birmingham',
    },
    accoladeJa: 'プロボクシング・ライトヘビー級。2020年東京五輪銀メダリスト（プロは無敗を継続中）',
    record: { wins: 12, losses: 0, draws: 1, kos: 9, asOf: '2026-06-27' },
    headlineStats: [
      // 唯一の非勝利は2024-10-12キャメロン戦のリング外転落による技術ドロー（KO/敗北ではない）
      { value: '12勝0敗1分', labelJa: 'プロ無敗を継続中（唯一の1分はリング外転落による技術ドロー）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E3%83%99%E3%83%B3%E3%82%B8%E3%83%A3%E3%83%9F%E3%83%B3%E3%83%BB%E3%82%A6%E3%82%A3%E3%83%86%E3%82%AB%E3%83%BC',
      'https://en.wikipedia.org/wiki/Benjamin_Whittaker',
    ],
    fights: [
      {
        date: '2026-06-27',
        opponentJa: 'リチャード・リベラ',
        opponentEn: 'Richard Rivera',
        venueJa: 'ブルックリン（バークレイズ・センター）',
        resultJa: '2回TKO勝ち',
        noteJa: '米国デビュー戦',
      },
      {
        date: '2026-04-18',
        opponentJa: 'ブライアン・スアレス',
        opponentEn: 'Braian Suarez',
        venueJa: 'リバプール・アリーナ',
        resultJa: '1回KO勝ち',
      },
      {
        date: '2025-11-29',
        opponentJa: 'ベンジャミン・ガヴァジ',
        opponentEn: 'Benjamin Gavazi',
        venueJa: 'バーミンガム（NEC）',
        resultJa: '1回KO勝ち',
      },
      {
        date: '2025-04-20',
        opponentJa: 'リアム・キャメロン',
        opponentEn: 'Liam Cameron',
        venueJa: 'バーミンガム',
        resultJa: '2回TKO勝ち',
        noteJa: '前戦（技術ドロー）のリベンジマッチ。レフェリーの早期ストップが物議を醸した',
      },
      {
        date: '2024-10-12',
        opponentJa: 'リアム・キャメロン',
        opponentEn: 'Liam Cameron',
        venueJa: 'リヤド（キングダム・アリーナ）',
        resultJa: '5回技術ドロー（両者リング外に転落し続行不能）',
      },
      {
        date: '2024-06-15',
        opponentJa: 'エズラ・アレニェカ',
        opponentEn: 'Ezra Arenyeka',
        venueJa: 'ロンドン（セルハースト・パーク）',
        resultJa: '10回判定勝ち',
      },
    ],
  },
  {
    slug: 'oleksandr-usyk',
    nameJa: 'オレクサンドル・ウシク',
    nameEn: 'Oleksandr Usyk',
    shortJa: ['ウシク'],
    sport: 'boxing',
    voiceScope: 'global',
    accoladeJa:
      '史上初、クルーザー級・ヘビー級の両階級で4団体統一(undisputed)王者。2026年6月に王座を返上（The Ring誌認定のリニアル王者としては現役）',
    record: { wins: 25, losses: 0, draws: 0, kos: 16, asOf: '2026-05-23' },
    headlineStats: [
      // モハメド・アリ以来史上初、4団体統一ヘビー級王者に2度就いた（2024-05フューリー戦・2025-07デュボア再戦）
      { value: '2度目', labelJa: 'アリ以来史上初、4団体統一ヘビー級王者に2度就いた快挙（2024年5月・2025年7月）' },
      { value: '25戦25勝', labelJa: 'プロ入り以来無敗を継続中（2026年5月時点）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E3%82%AA%E3%83%AC%E3%82%AF%E3%82%B5%E3%83%B3%E3%83%89%E3%83%AB%E3%83%BB%E3%82%A6%E3%82%B7%E3%82%AF',
      'https://en.wikipedia.org/wiki/Oleksandr_Usyk',
    ],
    fights: [
      {
        date: '2026-05-23',
        opponentJa: 'リコ・ヴァーホーベン',
        opponentEn: 'Rico Verhoeven',
        venueJa: 'エジプト・ギザ（ピラミッド特設会場）',
        resultJa: '11回TKO勝ち',
        noteJa: '元キックボクシング王者のボクシング参戦。判定・裁定を巡り論争に',
      },
      {
        date: '2025-07-19',
        opponentJa: 'ダニエル・デュボア',
        opponentEn: 'Daniel Dubois',
        venueJa: 'ロンドン（ウェンブリー・スタジアム）',
        resultJa: '5回KO勝ち',
        noteJa: 'アリ以来史上初、2度目の4団体統一ヘビー級王者に',
      },
      {
        date: '2024-12-21',
        opponentJa: 'タイソン・フューリー',
        opponentEn: 'Tyson Fury',
        venueJa: 'リヤド（サウジアラビア・キングダム・アリーナ）',
        resultJa: '12回判定勝ち（全会一致116-112）',
        noteJa: '統一王座防衛',
      },
      {
        date: '2024-05-18',
        opponentJa: 'タイソン・フューリー',
        opponentEn: 'Tyson Fury',
        venueJa: 'リヤド（サウジアラビア・キングダム・アリーナ）',
        resultJa: '12回判定勝ち（スプリット115-112、114-113、113-114）',
        noteJa: '4団体統一・史上初の4団体統一ヘビー級王者に',
      },
      {
        date: '2023-08-26',
        opponentJa: 'ダニエル・デュボア',
        opponentEn: 'Daniel Dubois',
        venueJa: 'ポーランド・ヴロツワフ',
        resultJa: '9回KO勝ち',
        noteJa: 'IBF/WBA/WBO統一王座防衛',
      },
    ],
  },
  {
    slug: 'anthony-joshua',
    nameJa: 'アンソニー・ジョシュア',
    nameEn: 'Anthony Joshua',
    shortJa: ['ジョシュア'],
    sport: 'boxing',
    voiceScope: 'global',
    accoladeJa: '元IBF・WBA(Super)・WBO統一世界ヘビー級王者、2012年ロンドン五輪スーパーヘビー級金メダリスト',
    record: { wins: 30, losses: 4, draws: 0, kos: 27, asOf: '2026-07-25' },
    headlineStats: [
      { value: '金メダル', labelJa: '2012年ロンドン五輪スーパーヘビー級（アマチュア最高峰の実績）' },
      { value: 'KO率90%', labelJa: '通算30勝のうちKO/TKO決着27（約90%）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E3%82%A2%E3%83%B3%E3%82%BD%E3%83%8B%E3%83%BC%E3%83%BB%E3%82%B8%E3%83%A7%E3%82%B7%E3%83%A5%E3%82%A2',
      'https://en.wikipedia.org/wiki/Anthony_Joshua',
    ],
    fights: [
      {
        date: '2026-07-25',
        opponentJa: 'クリスティアン・プレンガ',
        opponentEn: 'Kristian Prenga',
        venueJa: 'サウジアラビア・ジェッダ',
        resultJa: '2回KO勝ち',
        noteJa: '1回に2度のダウンを喫する大ピンチから逆転。前年12月の交通事故で親しい仲間2人を亡くして以来の復帰戦',
      },
      {
        date: '2025-12-19',
        opponentJa: 'ジェイク・ポール',
        opponentEn: 'Jake Paul',
        venueJa: 'マイアミ（Kaseya Center・Netflix中継）',
        resultJa: '6回KO勝ち',
      },
      {
        date: '2024-05-18',
        opponentJa: 'ダニエル・デュボア',
        opponentEn: 'Daniel Dubois',
        venueJa: 'ロンドン（The O2 Arena）',
        resultJa: '5回KO負け',
        noteJa: 'IBF世界王座挑戦で敗退',
      },
      {
        date: '2024-03-08',
        opponentJa: 'フランシス・ンガヌー',
        opponentEn: 'Francis Ngannou',
        venueJa: 'リヤド（サウジアラビア・キングダム・アリーナ）',
        resultJa: '2回KO勝ち',
        noteJa: '元UFC王者を2度ダウンさせての快勝',
      },
    ],
  },
  {
    slug: 'conor-mcgregor',
    nameJa: 'コナー・マクレガー',
    nameEn: 'Conor McGregor',
    shortJa: ['マクレガー'],
    sport: 'mma',
    voiceScope: 'global',
    accoladeJa: 'UFC史上初の2階級同時制覇王者（フェザー級2015年・ライト級2016年）。UFC史上初のアイルランド出身世界王者',
    record: { wins: 22, losses: 7, draws: 0, kos: 19, asOf: '2026-07-11' },
    headlineStats: [
      { value: '2階級制覇', labelJa: 'UFC史上初の2階級同時制覇王者（2016年11月・フェザー級/ライト級）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E3%82%B3%E3%83%8A%E3%83%BC%E3%83%BB%E3%83%9E%E3%82%AF%E3%83%AC%E3%82%AC%E3%83%BC',
      'https://en.wikipedia.org/wiki/Conor_McGregor',
    ],
    fights: [
      {
        date: '2026-07-11',
        opponentJa: 'マックス・ホロウェイ',
        opponentEn: 'Max Holloway',
        venueJa: 'ラスベガス（T-Mobile Arena・UFC 329）',
        resultJa: '1回TKO負け（膝負傷）',
        noteJa: '2021年の負傷以来5年ぶりの復帰戦。開始1分9秒、キック動作で右膝を負傷し試合続行不能に',
      },
      {
        date: '2021-07-10',
        opponentJa: 'ダスティン・ポイリエ',
        opponentEn: 'Dustin Poirier',
        venueJa: 'ラスベガス（T-Mobile Arena・UFC 264）',
        resultJa: '1回TKO負け（脚骨折）',
      },
      {
        date: '2021-01-23',
        opponentJa: 'ダスティン・ポイリエ',
        opponentEn: 'Dustin Poirier',
        venueJa: 'アブダビ（Etihad Arena・UFC 257）',
        resultJa: '2回TKO負け（ドクターストップ）',
      },
      {
        date: '2020-01-18',
        opponentJa: 'ドナルド・セラーニ',
        opponentEn: 'Donald Cerrone',
        venueJa: 'ラスベガス（T-Mobile Arena・UFC 246）',
        resultJa: '1回TKO勝ち',
      },
    ],
  },
  {
    slug: 'jesse-rodriguez',
    nameJa: 'ジェシー・ロドリゲス',
    nameEn: 'Jesse Rodriguez',
    shortJa: ['ロドリゲス'],
    sport: 'boxing',
    voiceScope: 'global',
    accoladeJa:
      'プロボクシング・世界3階級制覇王者「バム」（現WBA世界バンタム級王者、前IBF/WBO世界フライ級統一王者、前WBA/WBC/WBO世界スーパーフライ級統一王者）',
    record: { wins: 24, losses: 0, draws: 0, kos: 17, asOf: '2026-06-13' },
    headlineStats: [
      // リング誌P4Pランキング（井上尚弥が1位・2026年8月時点、日経記事等で裏取り）
      { value: 'PFP4位', labelJa: 'パウンド・フォー・パウンド ランキング（井上尚弥が1位）' },
    ],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E3%82%B8%E3%82%A7%E3%82%B7%E3%83%BC%E3%83%BB%E3%83%AD%E3%83%89%E3%83%AA%E3%82%B2%E3%82%B9',
      'https://en.wikipedia.org/wiki/Jesse_Rodriguez',
    ],
    fights: [
      {
        date: '2026-06-13',
        opponentJa: 'アントニオ・バルガス',
        opponentEn: 'Antonio Vargas',
        venueJa: 'グレンデール（アリゾナ州）',
        resultJa: '6回KO勝ち',
        noteJa: 'WBAバンタム級王座を獲得し3階級制覇王者に。井上尚弥との対戦が現実味を帯びる',
      },
      {
        date: '2025-11-22',
        opponentJa: 'フェルナンド・マルティネス',
        opponentEn: 'Fernando Martinez',
        venueJa: 'リヤド（サウジアラビア・ANBアリーナ）',
        resultJa: '10回KO勝ち',
        noteJa: 'WBA王座を奪いスーパーフライ級で4団体統一（アンディスピューテッド）王者に',
      },
      {
        date: '2024-06-29',
        opponentJa: 'フアン・フランシスコ・エストラーダ',
        opponentEn: 'Juan Francisco Estrada',
        venueJa: 'フェニックス（アリゾナ州・フットプリント・センター）',
        resultJa: '7回KO勝ち',
        noteJa: 'スーパーフライ級統一戦（WBC・The Ring）',
      },
    ],
  },
  {
    slug: 'sean-omalley',
    nameJa: 'ショーン・オマリー',
    nameEn: "Sean O'Malley",
    shortJa: ['オマリー'],
    sport: 'mma',
    voiceScope: 'global',
    accoladeJa: 'UFCバンタム級 元王者（2023年8月〜2024年9月、防衛1回）。2026年8月時点で同級ランキング2位',
    record: { wins: 20, losses: 3, draws: 0, kos: 13, asOf: '2026-06-14' },
    headlineStats: [{ value: '13KO/TKO', labelJa: '通算20勝のうちKO/TKOによる決着数' }],
    sameAs: [
      'https://ja.wikipedia.org/wiki/%E3%82%B7%E3%83%A7%E3%83%BC%E3%83%B3%E3%83%BB%E3%82%AA%E3%83%9E%E3%83%AA%E3%83%BC_(%E6%A0%BC%E9%97%98%E5%AE%B6)',
      "https://en.wikipedia.org/wiki/Sean_O'Malley_(fighter)",
    ],
    fights: [
      {
        date: '2026-06-14',
        opponentJa: 'アイマン・ザハビ',
        opponentEn: 'Aiemann Zahabi',
        venueJa: 'ワシントンD.C.（ホワイトハウス南庭・UFC Freedom 250）',
        resultJa: '2回TKO勝ち',
        noteJa: '建国250周年記念大会。フィニッシュ直後、レフェリーが止めるより先に“敬礼”を決めて話題に',
      },
      {
        date: '2026-01-24',
        opponentJa: 'ソン・ヤドン',
        opponentEn: 'Song Yadong',
        venueJa: 'ラスベガス（UFC 324）',
        resultJa: '判定勝ち（29-28×3）',
      },
      {
        date: '2025-06-07',
        opponentJa: 'メラブ・ドバリシビリ',
        opponentEn: 'Merab Dvalishvili',
        venueJa: 'ニューアーク（UFC 316）',
        resultJa: '3回一本負け（ノースサウスチョーク）',
        noteJa: '王座奪還を懸けた再戦も敗退',
      },
      {
        date: '2024-09-14',
        opponentJa: 'メラブ・ドバリシビリ',
        opponentEn: 'Merab Dvalishvili',
        venueJa: 'ラスベガス（Sphere・UFC 306）',
        resultJa: '判定負け（3-0）',
        noteJa: '王座陥落',
      },
      {
        date: '2023-08-19',
        opponentJa: 'アルジャメイン・スターリング',
        opponentEn: 'Aljamain Sterling',
        venueJa: 'UFC 292',
        resultJa: '2回KO勝ち',
        noteJa: 'バンタム級新王者に',
      },
    ],
  },
];

/** タグ文字列（=正式名）に一致するファイターを返す。LP化の判定に使う。 */
export function getFighterByJaName(nameJa: string): Fighter | undefined {
  return FIGHTERS.find((f) => f.nameJa === nameJa);
}
