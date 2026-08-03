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
   */
  nextFightJa?: { labelJa: string; until: string };
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
    nextFightJa: { labelJa: '9/10ダウトベック戦', until: '2026-09-10' },
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
    nextFightJa: { labelJa: '9/10青木真也戦', until: '2026-09-10' },
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
];

/** タグ文字列（=正式名）に一致するファイターを返す。LP化の判定に使う。 */
export function getFighterByJaName(nameJa: string): Fighter | undefined {
  return FIGHTERS.find((f) => f.nameJa === nameJa);
}
