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
  /** 肩書き（例「S・バンタム級4団体統一王者」）。タイトル変動時に手動更新 */
  accoladeJa: string;
  /** 通算戦績。asOf は最終試合日＝「いつ時点の数字か」を必ず出す */
  record: { wins: number; losses: number; draws: number; kos: number; asOf: string };
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
    accoladeJa: 'プロボクシング・S・バンタム級4団体統一王者（WBA・WBC・IBF・WBO）',
    record: { wins: 33, losses: 0, draws: 0, kos: 27, asOf: '2026-05-02' },
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
];

/** タグ文字列（=正式名）に一致するファイターを返す。LP化の判定に使う。 */
export function getFighterByJaName(nameJa: string): Fighter | undefined {
  return FIGHTERS.find((f) => f.nameJa === nameJa);
}
