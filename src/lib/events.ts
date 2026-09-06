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
  /** 早割・先行の価格（円）。設定が無い席種は省く */
  earlyJpy?: number;
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
    // 出典: BreakingDown 公式サイト（breakingdown.jp・2026-09-06 再参照）。
    // 会場正式名称・席種価格・チケット販売期間・PPV価格・「全試合を BreakingDown LIVE で生中継」は
    // すべて公式サイトの記載。席種価格とPPV最安値は BD21 オーディション動画（朝倉未来チャンネル
    // vol.1〜5）の概要欄の表記（早割最安値 ¥6,300／学割 ¥5,000／PPV 最安値 2,680円）とも一致を確認。
    // ⚠️ 対戦カードは 2026-09-06 時点で公式サイトが「随時発表」＝正式発表なし。他サイトが載せている
    //    オーディション由来の仮カードは公式発表ではないので、ここには書かない（§4.4 捏造禁止）。
    //    この大会で公表されている一次情報は「どの回で誰と誰が動いたか」までで、それは
    //    data/bd-story/21.json（オーディション実況）が動画タイトルの範囲で扱う。
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
      '朝倉未来がCEOを務めるBreakingDownの第21回大会。BreakingDownの北海道進出は今大会が初で、会場は札幌・真駒内セキスイハイムアイスアリーナ。対戦カードは例大会どおりオーディションを経て発表される（発表され次第このページに追記する）。',
    cardsNoteJa:
      'BreakingDownは対戦カードを事前に一括発表しない。公式サイトの表記は2026年9月6日時点でも随時発表のままで、正式なカード一覧は出ていない。この大会のカードが実際に動くのは記者会見ではなくオーディションの中で、朝倉未来チャンネルで公開されているBD21オーディションvol.1〜5がその場にあたる。下の「オーディションで何が起きたか」に、どの回で誰と誰が動いたかを動画つきでまとめた。公式の正式発表が出た時点で、この欄をカード一覧に差し替える。',
    ticketsJa:
      '現地チケットは公式サイトで販売中。早割先行は2026年7月27日18:00〜9月6日23:59、一般販売は9月7日0:00〜9月18日23:59。席種は10段階で、最安はB席（早割6,300円／通常7,000円／学割5,000円）、最高はSVIP席の最前列（早割460,000円／通常550,000円）。',
    ticketTiers: [
      { nameJa: 'SVIP席【最前列】', earlyJpy: 460_000, regularJpy: 550_000 },
      { nameJa: 'SVIP席【2列目】', earlyJpy: 250_000, regularJpy: 300_000 },
      { nameJa: 'VVIP席', earlyJpy: 160_000, regularJpy: 200_000 },
      { nameJa: 'VIP席【花道席】', earlyJpy: 80_000, regularJpy: 100_000 },
      { nameJa: 'VIP席', earlyJpy: 64_000, regularJpy: 80_000 },
      { nameJa: 'SS席', earlyJpy: 22_000, regularJpy: 25_000 },
      { nameJa: 'S席【スタンド】', earlyJpy: 15_300, regularJpy: 17_000 },
      { nameJa: 'S席【アリーナ】', earlyJpy: 13_500, regularJpy: 15_000 },
      { nameJa: 'A席', earlyJpy: 10_800, regularJpy: 12_000, studentJpy: 10_000 },
      { nameJa: 'B席', earlyJpy: 6_300, regularJpy: 7_000, studentJpy: 5_000 },
    ],
    ticketOffer: {
      url: 'https://breakingdown.jp/',
      lowPrice: 5000,
      highPrice: 550000,
      validFrom: '2026-07-27T18:00:00+09:00',
    },
    accessJa:
      '会場の真駒内セキスイハイムアイスアリーナは札幌市南区にある屋内アイスアリーナで、1972年札幌オリンピックの会場として建てられた施設。BreakingDownが北海道で大会を開くのは今回が初めて。開場・開始時刻は公式サイトでは未発表（発表され次第ここを更新する）。',
    watchJa:
      '全試合が公式配信プラットフォーム「BreakingDown LIVE」で独占PPV生中継される。PPVチケットの価格は、公式アプリ経由のアプリ割が新規会員は前売2,680円／当日3,480円、既存会員は前売3,040円／当日3,840円、アプリを使わない通常チケットが前売3,700円／当日4,500円（いずれも公式サイトの表記）。視聴はスマートフォン・タブレット・パソコン・テレビに対応する。',
    officialUrl: 'https://breakingdown.jp/',
    relatedJa: [
      { labelJa: 'BreakingDownオーディション全史（歴代の再生数・人気コメントのデータ観測）', href: '/breakingdown-audition' },
    ],
    updatedAt: '2026-09-06',
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
