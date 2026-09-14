import { RIZIN5 } from './rizin5';

/**
 * 格闘技イベントレジストリ＝大会カレンダー・アーカイブの唯一の正。
 *
 * /mma ポータルの「次の大会」「大会スケジュール・アーカイブ」と、大会ごとのイベントページ
 * （/rizin-landmark16 等のトップ階層フラット URL）はすべてここから生成する。
 * /rizin5 で実証した「開催前から1URLを育てる」イベント観測ハブの量産版（2026-08-12 村山さん合意:
 * RIZIN先行・BDは次大会で1本実験・/mmaポータル＋フラットURL。経緯は
 * _local/strategy/2026-08-12-rizin-search-plan.md と mma-portal 戦略メモ）。
 *
 * ⚠️ 事実整合ルール（rizin5.ts と同じ・CLAUDE.md §4.4）:
 * - 載せてよいのは公式発表・信頼できる報道で裏取りした事実だけ。未発表は「未発表」と書く。
 * - 対戦カード・結果は公式発表/公式リザルト由来のみ。推測で埋めない。
 * - 各エントリの出典はコメントに残す（次に更新する人が照合できるように）。
 *
 * 階級（tier）:
 * - festival … 超RIZIN・大晦日級の祭り。手組みの特設ハブ（因縁×引用×俺ボイス）を別途持つ。
 * - standard … 月イチRIZIN・LANDMARK・BD等。このレジストリのデータだけで
 *              イベントページ（EventHubPage）が立つ軽量型。
 *
 * 新しい大会の足し方:
 * 1. ここにエントリを追加（出典コメント必須）
 * 2. ページを立てるなら src/app/[locale]/{slug}/page.tsx に3行スタブ（createEventRoute）
 * 3. 記事側は matchTags のタグを付ければ「この大会の記事」に自動で並ぶ
 * 会期後: エントリは消さない＝年表がアーカイブになる。結果まとめ記事が出たら archiveHref を張る。
 */

/** 主催団体。イベントページの框（ラベル・視聴導線）を切り替える単位。 */
export type FightOrg = 'rizin' | 'breakingdown';

export const ORG_LABEL: Record<FightOrg, string> = {
  rizin: 'RIZIN',
  breakingdown: 'BreakingDown',
};

export type EventCard = {
  order: number;
  /** 対戦（例「スダリオ剛 vs エドポロキング」）。公式発表由来のみ */
  matchJa: string;
  /** 階級・ルール・位置づけの補足（裏取り済みのみ） */
  noteJa?: string;
  /**
   * 「第◯試合」以外の呼び名（例「オープニングファイト1」）。BD はオープニングファイトを
   * 本戦の番号と別系統で数えるので、order は並び順だけに使い、表示はこちらで上書きする。
   */
  labelJa?: string;
  /**
   * 出場者が確定していないカード（トーナメント決勝の「◯試合の勝者」など）。
   * JSON-LD の competitor から外す＝実在しない人名を構造化データに出さないため。
   */
  competitorsTbd?: boolean;
};

/** チケットの実売情報（JSON-LD offers 用）。公式販売ページで裏取りした値のみ。 */
export type EventTicketOffer = {
  url: string;
  lowPrice: number;
  highPrice: number;
  validFrom?: string;
};

/**
 * 席種ごとの価格（公式販売ページの表をそのまま持つ）。
 * 「{大会名} チケット」は対戦カードに次ぐ実測クエリ（BD21 は28日で約250表示）で、
 * 地の文の一段落より表のほうが正面から答えられる。値は公式表記のみ・推測で埋めない。
 */
export type EventTicketTier = {
  nameJa: string;
  /**
   * 割引価格（円）。何の割引かは大会・時期で変わる（早割先行 → 会期直前はアプリ割など）ので、
   * 列の見出しは tierDiscountLabelJa で切り替える。設定が無い席種は省く。
   */
  discountJpy?: number;
  /** 通常価格（円） */
  regularJpy?: number;
  /** 学割（円）。設定のある席種だけ */
  studentJpy?: number;
};

export type FightEvent = {
  /** イベントページの URL スラッグ（トップ階層フラット。hub=false のうちは未使用） */
  slug: string;
  org: FightOrg;
  /** 正式名称（公式表記） */
  nameJa: string;
  /** 年表・一覧用の短い名前 */
  shortJa: string;
  /**
   * 検索クエリの表記が公式表記と別体系のときの併記（例: BreakingDown 21 →「ブレイキングダウン21」）。
   * メタタイトル・説明文に（）で併記して日本語クエリに正面から当てる。H1 は公式表記のまま。
   */
  queryAliasJa?: string;
  /** 開催日（JST） */
  date: string;
  /** 「2026年10月3日（土）」表記 */
  dateLabelJa: string;
  venueJa?: string;
  cityJa?: string;
  /** 専用ページ（/{slug}）を持つか。festival は特設ハブ（hubPath）へ */
  hub: boolean;
  /** hub=true のときのリンク先（festival の特設ハブは /rizin5 のような専用実装） */
  hubPath?: string;
  tier: 'festival' | 'standard';
  /** この大会の反応記事を束ねるタグ（記事の tags と一致で自動紐付け） */
  matchTags?: string[];
  /** ページを持たない過去大会の年表リンク先（結果まとめ記事など） */
  archiveHref?: string;
  /** イベントページの導入（事実のみ。俺ボイスの地の文は festival の特設ハブ側に書く） */
  leadJa?: string;
  /** 発表済みの対戦カード（standard ページ用） */
  cards?: EventCard[];
  /**
   * カードが未発表のあいだに出す説明（裏取り済みのみ）。
   * 「対戦カード」で来た読者がいちばん知りたいのは、無いという事実ではなく**なぜまだ無いのか**。
   * 汎用の cardsTbd 文言だけだと、その問いに答えないまま離脱する（BD21 は本命クエリで平均8.9位）。
   */
  cardsNoteJa?: string;
  /** チケット情報（裏取り済みのみ） */
  ticketsJa?: string;
  /** 席種ごとの価格表（公式販売ページ由来のみ） */
  ticketTiers?: EventTicketTier[];
  /** 席種表の割引列の見出し（既定は「早割」）。会期が近づいて割引の種類が変わったら差し替える */
  tierDiscountLabelJa?: string;
  ticketOffer?: EventTicketOffer;
  /** 会場・アクセス（「{会場名} {大会名}」「{開催地} 〜」クエリ用。裏取り済みのみ） */
  accessJa?: string;
  /** 視聴方法（裏取り済みのみ。未発表なら未発表と書く） */
  watchJa?: string;
  /** 公式サイト等の一次情報リンク（送客＝引用元への還元） */
  officialUrl?: string;
  /** サイト内の関連ページ（観測ページ・特集など）。イベントページの下部に出す */
  relatedJa?: { labelJa: string; href: string }[];
  /** ページ内容の最終更新日（dateModified・sitemap lastmod） */
  updatedAt: string;
};

export const EVENTS: FightEvent[] = [
  {
    // 出典: ゴング格闘技（gonkaku.jp/articles/24362）＋自サイトの結果まとめ記事（公式リザルト準拠）。
    slug: 'rizin54',
    org: 'rizin',
    nameJa: 'RIZIN.54',
    shortJa: 'RIZIN.54',
    date: '2026-08-11',
    dateLabelJa: '2026年8月11日（火・祝）',
    venueJa: 'TOYOTA ARENA TOKYO',
    cityJa: '東京',
    hub: false,
    tier: 'standard',
    matchTags: ['RIZIN.54'],
    // 結果まとめ記事が「rizin54 結果」クエリの受け皿（柱B の roundup タイトル規則）。
    // 共食い防止のため専用ページは立てず、年表からここへ送る。
    archiveHref: '/mma/2026-08-12-rizin54-results-roundup',
    updatedAt: '2026-08-12',
  },
  {
    // 超RIZIN.5 のメタは rizin5.ts（特設ハブの唯一の正）から導出＝二重管理しない。
    slug: 'rizin5',
    org: 'rizin',
    nameJa: RIZIN5.nameJa,
    shortJa: '超RIZIN.5',
    date: RIZIN5.eventDate,
    dateLabelJa: RIZIN5.dateLabelJa,
    venueJa: RIZIN5.venueJa,
    cityJa: '大阪',
    hub: RIZIN5.enabled,
    hubPath: '/rizin5',
    tier: 'festival',
    matchTags: [...RIZIN5.matchTags],
    updatedAt: RIZIN5.updatedAt,
  },
  {
    // 出典: BreakingDown 公式サイト（breakingdown.jp・2026-09-14 再参照）＋ BreakingDown 株式会社の
    // プレスリリース（PR TIMES・2026-09-06「北海道初上陸！CREATOR'ZZ presents BreakingDown21対戦
    // カード発表！」）＋ イープラス公演ページ（eplus.jp/breakingdown21）。
    // - 対戦カード: 2026-09-06 に朝倉未来チャンネルで**全35試合が試合順つきで**正式発表された
    //   （それまでの「随時発表」は解消）。試合順と階級・ルールはゴング格闘技の大会ページ
    //   （gonkaku.jp/events/JsWzOMZRBM）の一覧、対戦者名の表記は公式カード画像（上記リリース添付）に
    //   合わせた。両者で食い違ったオープニングファイト1の「大輝」は公式画像の表記を採用。
    // - 時刻: リリースの「11:00開場／11:45オープニングファイト／12:45開演（第1試合開始）」を採用。
    //   イープラス・ゴング格闘技の公演情報は発売当初の「開演12:00」のままなので、新しい公式発表を取る。
    // - 席種価格: 早割先行は終了し、公式サイトの表は「通常／アプリ割／学割」に変わっている（値は公式表記）。
    slug: 'breakingdown21',
    org: 'breakingdown',
    nameJa: 'BreakingDown 21',
    shortJa: 'BreakingDown21',
    queryAliasJa: 'ブレイキングダウン21',
    date: '2026-09-19',
    dateLabelJa: '2026年9月19日（土）',
    venueJa: '真駒内セキスイハイムアイスアリーナ',
    cityJa: '北海道・札幌',
    hub: true,
    tier: 'standard',
    matchTags: ['ブレイキングダウン21', 'BreakingDown'],
    leadJa:
      '朝倉未来がCEOを務めるBreakingDownの第21回大会。BreakingDownの北海道進出は今大会が初で、会場は札幌・真駒内セキスイハイムアイスアリーナ。対戦カードは2026年9月6日に全35試合（オープニングファイト4試合＋第1〜第31試合）が試合順つきで発表された。メインイベントは第31試合のバンタム級王座決定トーナメント決勝で、第8試合と第9試合の勝者が同じ日のうちに王座を争う。',
    cardsNoteJa:
      'BreakingDownのカードは記者会見ではなくオーディションの中で動く。この大会も朝倉未来チャンネルで公開されたBD21オーディションvol.1〜5で対戦が組まれ、2026年9月6日に全35試合が試合順ごと発表された。第8・第9試合が第3代バンタム級王者を決めるワンデートーナメントの準決勝で、その勝者同士が第31試合＝メインイベントの決勝でぶつかる。第30試合は王者・龍志に挑戦者ドラゴンが挑むフライ級タイトルマッチ。どの回で誰が誰に噛み付いてこのカードになったかは、下の「オーディションで何が起きたか」に動画つきでまとめた。',
    cards: [
      { order: -4, labelJa: 'オープニングファイト1', matchJa: '田村陸 vs 大輝', noteJa: 'フェザー級ワンマッチ／キックルール・64kg以下' },
      { order: -3, labelJa: 'オープニングファイト2', matchJa: '佐々木大斗 vs 須藤龍揮', noteJa: 'バンタム級ワンマッチ／キックルール・59kg以下' },
      { order: -2, labelJa: 'オープニングファイト3', matchJa: 'きくっち vs 菊池竜二', noteJa: 'フェザー級ワンマッチ／キックルール・65kg以下' },
      { order: -1, labelJa: 'オープニングファイト4', matchJa: 'KE-TA vs なおちか', noteJa: 'フェザー級ワンマッチ／キックルール・64kg以下' },
      { order: 1, matchJa: '愛恋 vs しゃち', noteJa: 'フェザー級ワンマッチ／キックルール・63kg以下' },
      { order: 2, matchJa: 'Golden Gaijin vs ソルジャー沖田', noteJa: 'ミドル級ワンマッチ／キックルール・82kg以下' },
      { order: 3, matchJa: '大悟 vs 龍之介', noteJa: 'ウェルター級ワンマッチ／MMAルール・75kg以下' },
      { order: 4, matchJa: 'なぎ vs 平野翔空', noteJa: 'バンタム級ワンマッチ／キックルール・61kg以下' },
      { order: 5, matchJa: 'みつたか vs 狂犬', noteJa: 'フェザー級ワンマッチ／キックルール・66kg以下' },
      { order: 6, matchJa: 'ぷろたん vs 井上力斗', noteJa: 'ライト級ワンマッチ／キックルール・68kg以下' },
      { order: 7, matchJa: 'レオ vs せーや', noteJa: 'バンタム級ワンマッチ／ベアナックルキックルール・58kg以下' },
      { order: 8, matchJa: 'よーでぃー vs 井原良太郎', noteJa: 'バンタム級王座決定トーナメント準決勝／キックルール・61kg以下' },
      { order: 9, matchJa: '三河拳士 vs リキ', noteJa: 'バンタム級王座決定トーナメント準決勝／キックルール・61kg以下' },
      { order: 10, matchJa: 'ハルク福沢 vs Dozer', noteJa: '無差別級ワンマッチ／キックルール' },
      { order: 11, matchJa: '小林大希 vs 関谷勇次郎', noteJa: 'バンタム級ワンマッチ／キックルール・61kg以下' },
      { order: 12, matchJa: 'パンチ齋藤 vs 虎之介', noteJa: '無差別級ワンマッチ／ベアナックルMMAルール' },
      { order: 13, matchJa: '無敗の村長 vs しょーた', noteJa: 'ミドル級ワンマッチ／キックルール・78kg以下' },
      { order: 14, matchJa: 'TAKUMI vs TETSU', noteJa: 'フェザー級ワンマッチ／キックルール・66kg以下' },
      { order: 15, matchJa: 'カウアン・オカモト vs としぞう', noteJa: 'フェザー級ワンマッチ／キックルール・63kg以下' },
      { order: 16, matchJa: 'アンディ南野 vs アウトレイジ森脇', noteJa: 'ライトヘビー級ワンマッチ／ベアナックルキックルール・90kg以下' },
      { order: 17, matchJa: '平石光一 vs 涼太', noteJa: 'ライト級ワンマッチ／キックルール・70kg以下' },
      { order: 18, matchJa: '七原嘉輝 vs そうし', noteJa: 'ウェルター級ワンマッチ／キックルール・73kg以下' },
      { order: 19, matchJa: '金剛駿 vs KK我流', noteJa: 'ライト級ワンマッチ／キックルール・70kg以下' },
      { order: 20, matchJa: '森 vs シェンロン', noteJa: 'フェザー級ワンマッチ／ベアナックルボクシングルール・65kg以下' },
      { order: 21, matchJa: '尾田優也 vs sakkki', noteJa: 'ライト級ワンマッチ／キックルール・67kg以下' },
      { order: 22, matchJa: 'ズールaka殺人トトロ vs 赤パンニキ', noteJa: '無差別級ワンマッチ／キックルール' },
      { order: 23, matchJa: '藤井啓輔 vs Jerio San Pierre', noteJa: 'ウェルター級ワンマッチ／キックルール・77kg以下' },
      { order: 24, matchJa: '竜 vs ダイスケ', noteJa: 'ウェルター級ワンマッチ／MMAルール・76kg以下' },
      { order: 25, matchJa: '西島恭平 vs 野田蒼', noteJa: 'バンタム級ワンマッチ／キックルール・57.5kg以下' },
      { order: 26, matchJa: 'エリー vs 蛇鬼将矢', noteJa: 'ウェルター級ワンマッチ／MMAルール・75kg以下' },
      { order: 27, matchJa: '黒柳禅 vs 佐々木大', noteJa: 'ライト級ワンマッチ／MMAルール・71kg以下' },
      { order: 28, matchJa: 'SATORU vs メカ君', noteJa: '無差別級ワンマッチ／ベアナックルボクシングルール' },
      { order: 29, matchJa: 'ヒロ三河 vs 溝口勇児', noteJa: 'ミドル級ワンマッチ／キックルール・84kg以下' },
      { order: 30, matchJa: 'ドラゴン vs 龍志', noteJa: 'フライ級タイトルマッチ／キックルール・56.5kg以下（王者・龍志に挑戦者ドラゴン）' },
      {
        order: 31,
        matchJa: '第8試合の勝者 vs 第9試合の勝者',
        noteJa: 'バンタム級王座決定トーナメント決勝戦／キックルール（メインイベント）',
        competitorsTbd: true,
      },
    ],
    ticketsJa:
      '会場チケットは早割先行が終了し、いまは一般発売のみ。イープラスでの受付は2026年9月18日（金）23:59まで（先着）。席種は10段階で、最安はB席（通常7,000円／アプリ割6,300円／学割5,000円）、最高はSVIP席の最前列（通常550,000円／アプリ割495,000円）。公式アプリ経由で買うと各席10%引きになるアプリ割があり、学割はA席とB席のみ。全席共通の来場特典は、公式サイトでは9月14日時点でも「近日公開予定」のまま。',
    ticketTiers: [
      { nameJa: 'SVIP席【最前列席】', discountJpy: 495_000, regularJpy: 550_000 },
      { nameJa: 'SVIP席【2列目席】', discountJpy: 270_000, regularJpy: 300_000 },
      { nameJa: 'VVIP席', discountJpy: 180_000, regularJpy: 200_000 },
      { nameJa: 'VIP席【花道席】', discountJpy: 90_000, regularJpy: 100_000 },
      { nameJa: 'VIP席', discountJpy: 72_000, regularJpy: 80_000 },
      { nameJa: 'SS席', discountJpy: 22_500, regularJpy: 25_000 },
      { nameJa: 'S席【アリーナ席】', discountJpy: 13_500, regularJpy: 15_000 },
      { nameJa: 'S席【スタンド席】', discountJpy: 15_300, regularJpy: 17_000 },
      { nameJa: 'A席', discountJpy: 10_800, regularJpy: 12_000, studentJpy: 10_000 },
      { nameJa: 'B席', discountJpy: 6_300, regularJpy: 7_000, studentJpy: 5_000 },
    ],
    tierDiscountLabelJa: 'アプリ割',
    ticketOffer: {
      url: 'https://breakingdown.jp/',
      lowPrice: 5000,
      highPrice: 550000,
      validFrom: '2026-07-27T18:00:00+09:00',
    },
    accessJa:
      '会場の真駒内セキスイハイムアイスアリーナは札幌市南区にある屋内アイスアリーナで、1972年札幌オリンピックの会場として建てられた施設。BreakingDownが北海道で大会を開くのは今回が初めて。当日は11:00開場、11:45にオープニングファイト開始、12:45に開演（第1試合開始）。',
    watchJa:
      '全試合が公式配信プラットフォーム「BreakingDown LIVE」で独占PPV生中継される。PPVチケットの価格は、公式アプリ経由のアプリ割が新規会員は前売2,680円／当日3,480円、既存会員は前売3,040円／当日3,840円、アプリを使わない通常チケットが前売3,700円／当日4,500円（いずれも公式サイトの表記）。視聴はスマートフォン・タブレット・パソコン・テレビに対応する。',
    officialUrl: 'https://breakingdown.jp/',
    relatedJa: [
      { labelJa: 'BreakingDownオーディション全史（歴代の再生数・人気コメントのデータ観測）', href: '/breakingdown-audition' },
    ],
    updatedAt: '2026-09-14',
  },
  {
    // 出典: RIZIN 公式の大会情報ページ（jp.rizinff.com/_ct/17852438・2026-08-17 参照）＝会場正式名称・
    // 開場開始時刻・対戦カード3試合・チケット販売スケジュール／席種価格はすべて公式表記の転記。
    // 開催発表は 2026-07-18 LANDMARK.15 広島（ゴング格闘技 gonkaku.jp/articles/24362）。
    slug: 'rizin-landmark16',
    org: 'rizin',
    nameJa: 'RIZIN LANDMARK.16 in NAGASAKI',
    shortJa: 'LANDMARK.16 長崎',
    date: '2026-10-03',
    dateLabelJa: '2026年10月3日（土）',
    venueJa: '長崎スタジアムシティ HAPPINESS ARENA',
    cityJa: '長崎',
    hub: true,
    tier: 'standard',
    matchTags: ['RIZIN LANDMARK.16'],
    leadJa:
      'RIZINの長崎初上陸となるLANDMARKシリーズ第16弾。2026年7月18日のRIZIN LANDMARK.15 in HIROSHIMAで開催が発表され、公式サイトの大会情報ページには第1弾の対戦カード3試合とチケット情報が掲載されている（2026年8月17日時点）。開場12:00／開始14:00（いずれも予定）。追加カードは発表され次第このページに追記していく。',
    cards: [
      { order: 1, matchJa: '堀江圭功 vs 宇佐美正パトリック', noteJa: 'RIZIN MMAルール 5分3R（71.0kg）' },
      { order: 2, matchJa: 'ビクター・コレスニック vs 松嶋こよみ', noteJa: 'RIZIN MMAルール 5分3R（66.0kg）' },
      { order: 3, matchJa: '芦澤竜誠 vs 井上聖矢', noteJa: 'RIZIN MMAルール 5分3R（61.0kg）' },
    ],
    ticketsJa:
      'ファンクラブ先着先行は8月17日（月）12:00〜8月19日（水）18:00（強者ノ巣／RIZIN 100 CLUB）、オフィシャルサイト先行は8月21日（金）12:00〜18:00、イープラス最速抽選先行は8月22日（土）12:00〜8月25日（火）18:00、一般発売は8月30日（日）10:00から（イープラス／チケットぴあ／ローソンチケット・電子チケットのみ）。席種はVVIP席275,000円（特典付・1列目・イープラス限定）／VIP席110,000円（特典付）／SRS席33,000円／S席22,000円／A席11,000円（全席指定・税込）。',
    ticketOffer: {
      url: 'https://jp.rizinff.com/_ct/17852438',
      lowPrice: 11_000,
      highPrice: 275_000,
      validFrom: '2026-08-30T10:00:00+09:00',
    },
    watchJa:
      '配信の詳細は未発表（公式は「決定次第、RIZINFFオフィシャルサイトよりご案内」）。RIZINは2026年8月にABEMAが公式メディアパートナーとなり、榊原CEOは「9月からABEMAさんだけでPPVを配信」と話している（超RIZIN.5の販路発表時）。本大会の配信形態・価格が発表され次第ここを更新する。',
    officialUrl: 'https://jp.rizinff.com/_ct/17852438',
    updatedAt: '2026-08-17',
  },
  {
    // 出典: ゴング格闘技（gonkaku.jp/articles/24362）。千葉初開催。
    // ヘビー級JGP決勝（スダリオ剛 vs エドポロキング）は RIZIN.54 の公式リザルト
    // （自サイト結果まとめ記事 2026-08-12-rizin54-results-roundup で裏取り）で確定した組み合わせ。
    slug: 'rizin-landmark17',
    org: 'rizin',
    nameJa: 'RIZIN LANDMARK.17 in CHIBA',
    shortJa: 'LANDMARK.17 千葉',
    date: '2026-11-08',
    dateLabelJa: '2026年11月8日（日）',
    venueJa: 'LaLa arena TOKYO-BAY',
    cityJa: '千葉',
    hub: false,
    tier: 'standard',
    matchTags: ['RIZIN LANDMARK.17'],
    cards: [
      {
        order: 1,
        matchJa: 'スダリオ剛 vs エドポロキング',
        noteJa: 'ヘビー級ジャパングランプリ決勝（RIZIN.54で両者が決勝進出）',
      },
    ],
    updatedAt: '2026-08-12',
  },
  {
    // 出典: RIZIN 公式「今年の大晦日は名古屋で開催！2026年 年間スケジュール」
    // （jp.rizinff.com/_ct/17813466・2026-08-24 参照）＝開催日・会場・公式の仮称「大晦日 名古屋大会（仮）」。
    // 会場が動いた理由（さいたまスーパーアリーナが年明けから改修に入る）と「RIZINのバンテリン開催は
    // 団体11年目で初」「大みそか興行は15年から毎年さいたまスーパーアリーナが会場だった」は中日スポーツ
    // （chunichi.co.jp/article/1187100）。2025年大晦日が「11回目」だったことは下の年表の出典と同じ。
    // ⚠️ 正式名称・対戦カードは未発表。発表が出るまで（仮）表記のまま・カードは書かない。
    slug: 'rizin-newyear2026',
    org: 'rizin',
    nameJa: 'RIZIN 大晦日 2026 名古屋大会（仮）',
    shortJa: 'RIZIN 大晦日 2026',
    date: '2026-12-31',
    dateLabelJa: '2026年12月31日（木）',
    venueJa: 'バンテリンドーム ナゴヤ',
    cityJa: '名古屋',
    hub: true,
    tier: 'festival',
    matchTags: ['RIZIN 大晦日 2026'],
    leadJa:
      '2015年から11回続いた大晦日RIZINが、初めてさいたまスーパーアリーナを離れる。2026年の大晦日はバンテリンドーム ナゴヤ＝12回目にして初の名古屋開催で、RIZINがバンテリンドームを使うのは団体11年目で初めて。会場が動いたのは、さいたまスーパーアリーナが年明けから大規模改修に入るため（中日スポーツ）。大会の正式名称・対戦カードはいずれも未発表で、公式サイトの年間スケジュールでの表記は「大晦日 名古屋大会（仮）」（2026年8月24日時点）。発表が出るたびにこのページへ追記していく。',
    watchJa:
      '配信・PPVの詳細は未発表。RIZINは2026年8月にABEMAが公式メディアパートナーとなり、榊原CEOは超RIZIN.5の販路発表時に「9月からABEMAさんだけでPPVを配信」と話している。本大会の配信形態・価格が発表され次第ここを更新する。',
    officialUrl: 'https://jp.rizinff.com/_ct/17813466',
    updatedAt: '2026-08-24',
  },

  /* -------------------------------------------------------------- 歴代の大晦日（年表アーカイブ）
   * ページは持たない（hub: false）＝/mma ポータルの年表に並ぶだけ。サイト開設（2026-06）より前の
   * 大会なので反応記事は無いが、「RIZIN 大晦日 歴代」で来た読者に12年ぶんの背骨を見せ、2026年大会の
   * ページに「12回目」という文脈を与えるために置く。結果まとめ記事を後から書いたら archiveHref を張る。
   *
   * 出典: 日本語版 Wikipedia「RIZIN FIGHTING FEDERATION」の大会一覧（2026-08-24 参照）で年・正式名称・
   * 会場を取り、2020〜2024年ぶんは ユーウォッチ（u-watch.jp/column/sports/rizin-taikai-jyouhou/）の
   * 一覧と、2025年ぶんは Wikipedia「RIZIN 師走の超強者祭り」（「11回目を迎えた大晦日大会」・入場者
   * 45,043人）と突き合わせて一致を確認した。会場が11回すべてさいたまスーパーアリーナだったことは
   * 中日スポーツの記述とも一致する。冠スポンサー表記（Yogibo presents 等）は年表では省く。
   * 12月29日開催の年末大会（2015年・2017年）は大晦日大会ではないので入れない。
   * ------------------------------------------------------------------------------------------- */
  {
    slug: 'rizin-newyear2015',
    org: 'rizin',
    nameJa: 'RIZIN FIGHTING WORLD GRAND-PRIX 2015 IZAの舞',
    shortJa: '大晦日2015',
    date: '2015-12-31',
    dateLabelJa: '2015年12月31日（木）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2016',
    org: 'rizin',
    nameJa: 'RIZIN FIGHTING WORLD GRAND-PRIX 2016 無差別級トーナメント FINAL ROUND',
    shortJa: '大晦日2016',
    date: '2016-12-31',
    dateLabelJa: '2016年12月31日（土）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2017',
    org: 'rizin',
    nameJa: 'RIZIN FIGHTING WORLD GRAND-PRIX 2017 Final ROUND',
    shortJa: '大晦日2017',
    date: '2017-12-31',
    dateLabelJa: '2017年12月31日（日）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2018',
    org: 'rizin',
    nameJa: 'RIZIN.14',
    shortJa: '大晦日2018',
    date: '2018-12-31',
    dateLabelJa: '2018年12月31日（月）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2019',
    org: 'rizin',
    nameJa: 'RIZIN.20',
    shortJa: '大晦日2019',
    date: '2019-12-31',
    dateLabelJa: '2019年12月31日（火）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2020',
    org: 'rizin',
    nameJa: 'RIZIN.26',
    shortJa: '大晦日2020',
    date: '2020-12-31',
    dateLabelJa: '2020年12月31日（木）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2021',
    org: 'rizin',
    nameJa: 'RIZIN.33',
    shortJa: '大晦日2021',
    date: '2021-12-31',
    dateLabelJa: '2021年12月31日（金）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2022',
    org: 'rizin',
    nameJa: 'RIZIN.40',
    shortJa: '大晦日2022',
    date: '2022-12-31',
    dateLabelJa: '2022年12月31日（土）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2023',
    org: 'rizin',
    nameJa: 'RIZIN.45',
    shortJa: '大晦日2023',
    date: '2023-12-31',
    dateLabelJa: '2023年12月31日（日）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2024',
    org: 'rizin',
    nameJa: 'RIZIN DECADE（RIZIN.49）',
    shortJa: '大晦日2024',
    date: '2024-12-31',
    dateLabelJa: '2024年12月31日（火）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
  {
    slug: 'rizin-newyear2025',
    org: 'rizin',
    nameJa: 'RIZIN 師走の超強者祭り',
    shortJa: '大晦日2025',
    date: '2025-12-31',
    dateLabelJa: '2025年12月31日（水）',
    venueJa: 'さいたまスーパーアリーナ',
    cityJa: 'さいたま',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-24',
  },
];

/** JST の今日（YYYY-MM-DD）。fighterHub の isUpcoming と同じ賞味期限方式。 */
function todayJst(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

export function isUpcomingEvent(event: FightEvent): boolean {
  return todayJst() <= event.date;
}

/** 開催前の大会（開催日の近い順）。当日を含む。 */
export function upcomingEvents(): FightEvent[] {
  return EVENTS.filter(isUpcomingEvent).sort((a, b) => a.date.localeCompare(b.date));
}

/** 直近の「次の大会」（ポータル HERO 用）。 */
export function nextEvent(): FightEvent | null {
  return upcomingEvents()[0] ?? null;
}

/** 終了した大会（新しい順）＝アーカイブ。 */
export function pastEvents(): FightEvent[] {
  return EVENTS.filter((e) => !isUpcomingEvent(e)).sort((a, b) => b.date.localeCompare(a.date));
}

/** 年表用: 開催前（近い順）→ 終了（新しい順）。次に起きることが常に上に来る。 */
export function timelineEvents(): FightEvent[] {
  return [...upcomingEvents(), ...pastEvents()];
}

export function eventBySlug(slug: string): FightEvent | null {
  return EVENTS.find((e) => e.slug === slug) ?? null;
}

/** 大会ページへのリンク先（特設ハブ or 標準イベントページ）。ページが無い大会は null。 */
export function eventHref(event: FightEvent): string | null {
  if (!event.hub) return null;
  return event.hubPath ?? `/${event.slug}`;
}

/**
 * sitemap 用: このレジストリが `/{slug}` に発行するイベントページ。
 *
 * 判定は tier ではなく **hubPath の有無**で行う＝`hubPath` を持つのは /rizin5 のような手組みの特設ハブで、
 * それらは自前で sitemap に登録済み。tier で切っていると、カード発表前を量産型でしのぐ festival
 * （2026 大晦日）がページはあるのに sitemap に載らない、という取りこぼしが出る（2026-08-24 に発生）。
 */
export function standardEventPages(): FightEvent[] {
  return EVENTS.filter((e) => e.hub && !e.hubPath);
}
