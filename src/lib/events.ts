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
  /** チケット情報（裏取り済みのみ） */
  ticketsJa?: string;
  ticketOffer?: EventTicketOffer;
  /** 視聴方法（裏取り済みのみ。未発表なら未発表と書く） */
  watchJa?: string;
  /** 公式サイト等の一次情報リンク（送客＝引用元への還元） */
  officialUrl?: string;
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
    // 出典: BreakingDown 公式サイト（breakingdown.jp・2026-08-12 参照）。
    // 会場正式名称・チケット販売期間・「全試合を BreakingDown LIVE で生中継」は公式サイトの記載。
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
    ticketsJa:
      '現地チケットは公式サイトで販売中。先着先行は2026年7月27日18:00〜8月28日23:59、一般販売は8月29日0:00〜9月18日23:59。価格帯は5,000円〜550,000円（席種による）。',
    ticketOffer: {
      url: 'https://breakingdown.jp/',
      lowPrice: 5000,
      highPrice: 550000,
      validFrom: '2026-07-27T18:00:00+09:00',
    },
    watchJa:
      '全試合が公式配信プラットフォーム「BreakingDown LIVE」でPPV生中継される（公式サイトの記載）。PPVチケットの価格は未確認＝確認でき次第ここを更新する。公式アプリ「BreakingDown Club」の有料会員はPPVチケットが20%オフになる。',
    officialUrl: 'https://breakingdown.jp/',
    updatedAt: '2026-08-12',
  },
  {
    // 出典: ゴング格闘技（gonkaku.jp/articles/24362）＝2026-07-18 LANDMARK.15 広島で発表。
    // 長崎初上陸。対戦カードは 2026-08-12 時点で未発表。
    slug: 'rizin-landmark16',
    org: 'rizin',
    nameJa: 'RIZIN LANDMARK.16 in NAGASAKI',
    shortJa: 'LANDMARK.16 長崎',
    date: '2026-10-03',
    dateLabelJa: '2026年10月3日（土）',
    venueJa: 'HAPPINESS ARENA',
    cityJa: '長崎',
    hub: true,
    tier: 'standard',
    matchTags: ['RIZIN LANDMARK.16'],
    leadJa:
      'RIZINの長崎初上陸となるLANDMARKシリーズ第16弾。2026年7月18日のRIZIN LANDMARK.15 in HIROSHIMAで開催が発表された。対戦カードは未発表＝発表され次第このページに追記していく。',
    watchJa:
      '配信の詳細は未発表。RIZINは2026年8月にABEMAが公式メディアパートナーとなり、榊原CEOは「9月からABEMAさんだけでPPVを配信」と話している（超RIZIN.5の販路発表時）。本大会の配信形態・価格が発表され次第ここを更新する。',
    officialUrl: 'https://jp.rizinff.com/',
    updatedAt: '2026-08-12',
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
    // 出典: ゴング格闘技（gonkaku.jp/articles/24362）＝既発表分として記載。大会名は主催発表の（仮）のまま。
    slug: 'rizin-newyear2026',
    org: 'rizin',
    nameJa: 'RIZIN大晦日（仮）',
    shortJa: 'RIZIN 大晦日',
    date: '2026-12-31',
    dateLabelJa: '2026年12月31日（木）',
    venueJa: 'バンテリンドームナゴヤ',
    cityJa: '名古屋',
    hub: false,
    tier: 'festival',
    updatedAt: '2026-08-12',
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
 * sitemap 用: 自前ページを持つ standard イベント（festival の特設ハブは各自で sitemap 登録済み）。
 */
export function standardEventPages(): FightEvent[] {
  return EVENTS.filter((e) => e.hub && e.tier === 'standard');
}
