import type { Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';

// 記事下 VOD CTA（収益化の器②）の唯一の正。競技ごとに「どのサービスを・どう訴求するか」をここに集約。
// 提携が確定したら href を **アフィリエイトリンクに差し替えるだけ** で各 CTA が反映される。
// href を null にした案件は自動で非表示（提携が切れた／まだ無いサービスを隠す安全弁）。

/**
 * 設置場所。バリューコマースの「広告スペース」（同じ広告を pid 違いで発行し、設置場所ごとに
 * レポートを分けて読む仕組み）に対応する。同じ pid を使い回すと成果が合算されて
 * 「どの場所が効いたか」が永久に分からなくなるので、場所を増やすときはスペースも増やす。
 */
export type VodPlacement =
  /** 記事下の既定枠（全競技の記事詳細） */
  | 'article'
  /** 日次「きょうの日本人選手」の ⑥あすの日本人 直後 */
  | 'daily'
  /** 選手・チームのタグLP（未設置＝次の展開用の枠） */
  | 'hub'
  /** 興行の観測LP（/rizin5・イベント量産型）の #watch。興行直前は記事下と読者の温度が違うので枠を分ける */
  | 'event';

/** 設置場所ごとに差し替えるリンクと計測ピクセル（VC の広告スペース1つ分）。 */
export type VodSpace = {
  href: string;
  impressionPixel?: string;
};

export type VodOffer = {
  /** 表示名（サービス名） */
  service: string;
  /** 一言の訴求（なぜこの競技にこのサービスか） */
  pitch: Record<Locale, string>;
  /** 遷移先。当面は各社の公式 URL。提携確定後にアフィリエイトリンクへ差し替える。null で非表示。 */
  href: string | null;
  /**
   * インプレッション計測用の 1x1 画像（バリューコマースのタグはリンクと対で貼る仕様）。
   * 落とすと表示数が計上されず EPC が読めなくなるので、VC 案件は必ずセットで入れる。
   */
  impressionPixel?: string;
  /**
   * 設置場所ごとの差し替え。定義が無い場所は既定（href / impressionPixel）にフォールバックするので、
   * 広告スペースを1つしか持たない案件は今までどおり href だけ書けばよい。
   */
  spaces?: Partial<Record<VodPlacement, VodSpace>>;
  /**
   * **いま開催予定の超RIZIN.5 を実際に売っている販路**。/rizin5 の #watch に視聴CTAとして出す判定に使う
   * （ページ側にサービス名をハードコードせず、販路の増減をこのファイルだけで完結させる）。
   *
   * ⚠️ 2026-08-12 に意味を「PPV販売実績がある販路」から上のとおり厳密化し、榊原CEOの「9月から
   * ABEMAさんだけでPPVを配信」（報道）を根拠に U-NEXT・スカパー! を落とした。**2026-08-17 に
   * スカパー! を戻した**＝RIZIN 公式の PPV 情報ページが 100 CLUB／RIZIN LIVE／ABEMA／スカパー! の
   * 4販路を案内していて、単独販売という前提が誤りだったため。判定の根拠は報道の言い回しではなく
   * 大会公式の販路表にする（U-NEXT はその表に無いので落としたまま＝UFC等では現役）。
   */
  rizinPpv?: boolean;
  /**
   * その販路が「PPV購入と抱き合わせの新規会員登録キャッシュバック」を実施しているか。
   * CTA の文言をここで切り替える＝ABEMA だけがプレミアム新規登録の還元（＝うちのアフィの成果地点）を
   * 持つので、他の販路に「プレミアムの登録はこちら」と出してしまわないための分岐。
   */
  premiumCashback?: boolean;
};

/** 設置場所を解決したあとの案件（href は必ず存在する＝非表示のものは vodOffers が落とす）。 */
export type ResolvedVodOffer = Omit<VodOffer, 'href' | 'spaces'> & { href: string };

/** VC のタグは sid（サイト）と pid（広告スペース）の組。pid だけが設置場所ごとに変わる。 */
const VC_SID = '3777710';
const vcTag = (pid: string) =>
  `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC_SID}&pid=${pid}`;
const vcPixel = (pid: string) =>
  `https://ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=${VC_SID}&pid=${pid}`;

export const VOD_OFFERS: Record<Sport, VodOffer[]> = {
  // 2026-08-12: 止めたままだった SPOTV NOW 枠（href:null）を畳み、アマプラ1本に絞る。
  // MLB は全記事の8割超＝最大の面なので、選択肢を並べず「1クリックで決まる」形にする。
  mlb: [
    {
      service: 'Amazon Prime Video',
      // 訴求は Amazon 公式発表（2026-03-27 配信開始・SPOTVチャンネル）の事実のみ。景表法上、
      // 「全試合見放題」等の言い過ぎは書かない＝配信は350試合以上（全2430試合ではない）。
      pitch: {
        ja: 'プライム会員なら追加料金なし。SPOTVチャンネルで 2026 レギュラーシーズンを350試合以上ライブ配信（ドジャース戦ほか日本人選手の所属チーム中心）。',
        en: 'Included with Prime at no extra cost. 350+ live MLB regular-season games in 2026 via the SPOTV channel.',
      },
      // バリューコマースの Amazon Prime Video 紹介プログラム（2026-08-12 提携・成果地点=申込完了）。
      // 広告は1本（広告ID 2920656・自由テキスト）で、pid が違うのは「広告スペース」＝設置場所の
      // 計測枠の違い。sid=3777710 は本サイト。元タグは protocol-relative（//ck.jp.ap…）なので
      // https: を明示して埋める。
      // ⚠️ バナー素材（300x250 / 200x200）は平均EPC ¥0.03 / ¥0.00 に対し、この自由テキストは
      // ¥23.23＝桁が3つ違う。画像バナーに差し替えないこと。
      href: vcTag('892677360'), // 既定＝記事下（260812_..._テキスト）
      impressionPixel: vcPixel('892677360'),
      spaces: {
        // 日次記事（260812_..._テキスト_1）。438記事に薄く広く出す記事下と、
        // 「あすの試合」の文脈で1本だけ出す日次のどちらが効くかを分けて読むために pid を割る。
        daily: { href: vcTag('892677646'), impressionPixel: vcPixel('892677646') },
        // 選手・チームのタグLP（260812_..._テキスト_2）。枠だけ先に確保＝未設置。
        hub: { href: vcTag('892677649'), impressionPixel: vcPixel('892677649') },
      },
    },
  ],
  boxing: [
    {
      service: 'U-NEXT',
      pitch: {
        ja: '井上尚弥らの注目カードを PPV・見逃しで。',
        en: 'Catch marquee bouts like Naoya Inoue via PPV and on demand.',
      },
      // TODO(提携確定後): U-NEXT（全ASPでクローズド・個別申請）リンクに差し替え
      href: 'https://video.unext.jp/',
    },
    {
      service: 'DAZN',
      pitch: {
        ja: '海外のビッグマッチ（Matchroom 等）をライブ配信。',
        en: 'Stream major overseas cards (Matchroom and more) live.',
      },
      // TODO(提携確定後): アクセストレード / Link-A の DAZN（クローズド・要審査）リンクに差し替え
      href: 'https://www.dazn.com/ja-JP/',
    },
  ],
  mma: [
    {
      service: 'ABEMA',
      // 成果地点は「ABEMAプレミアム新規登録」で、PPV購入では成果が出ない（A8案件条件・2026-08-05）。
      // よって PPV 単体を売り文句にせず、プレミアムで得られる価値（見逃し・過去大会）を前に出す。
      pitch: {
        ja: 'RIZIN公式メディアパートナー。PPVも見逃しもここで。',
        en: "RIZIN's official media partner — PPV and replays.",
      },
      // A8 の ABEMA プレミアム案件（2026-08-05 承認・1号店メディアIDで発行した a8mat）。
      // 2号店（anime）のリンクとは別物＝流用すると成果否認。提携解除時は公式 https://abema.tv/ に戻す。
      href: 'https://px.a8.net/svt/ejp?a8mat=4B9YLB+8KZZQQ+4EKC+60OXE',
      rizinPpv: true,
      premiumCashback: true,
    },
    {
      service: 'U-NEXT',
      pitch: {
        ja: 'UFC の日本向け配信はこちら。',
        en: "UFC's home for Japan.",
      },
      // TODO(提携確定後): U-NEXT リンクに差し替え
      href: 'https://video.unext.jp/',
      // rizinPpv なし＝U-NEXT は超RIZIN.5 の販路に入っていない（2026-08-17 公式PPV情報ページで確認）。UFC の販路としては現役。
    },
    {
      service: 'スカパー!',
      // 2026-08-17: rizinPpv を戻した。8/12 に「超RIZIN.5 は ABEMA 単独販売」と判断して外したが、
      // RIZIN 公式の PPV 情報ページ（_ct/17858666）が 100 CLUB／RIZIN LIVE／ABEMA／スカパー! の
      // 4販路を案内していた＝前提が誤り。スカパー! は 8/27 販売開始・6,900円（価格体系が別）。
      //
      // ⚠️ 成果地点は「スカパー!への新規加入（本登録）」＝PPV を買わせても1円にもならない（ABEMA と同じ構造）。
      // 幸い スカパー! で PPV を観るには PPV 代に加えて契約（基本料）が要る＝**読者の必要と成果地点が一致する**
      // 数少ない販路なので、訴求は「PPV が観たいなら契約が要る」と正直に書く。着地も加入手続きの LP。
      pitch: {
        ja: '超RIZIN.5のPPVは8/27から（6,900円）。視聴にはスカパー!の契約が必要で、月額料金は加入月無料。',
        en: 'Super RIZIN.5 PPV from Aug 27 (¥6,900). Requires a SKY PerfecTV! contract.',
      },
      // バリューコマース「スカパー!新規加入プロモーション」（プログラムID 2045696・2026-08-20 提携・
      // 広告ID 2585177＝スマホ用の自由テキスト・報酬 ¥3,982／成果地点=新規加入の本登録・再加入と複数台目は対象外）。
      // ⚠️ リスティング広告での誘導は禁止（確認されると提携解除）。うちは検索広告を出していないので現状は問題なし。
      //
      // ⚠️ 2026-08-20、**もしも経由の旧リンクが死んでいた**のを実測で発見（404「無効な広告リンク｜もしもアフィリエイト」）。
      // mma 記事66本＋/mma LP＋/rizin5 が壊れた PR 枠を出していたため、もしもは畳んで VC 直に一本化した。
      // 二段リダイレクトが1段減り、1x1 で表示数も取れる（もしも版は表示数が取れず EPC が読めなかった）。
      //
      // ⚠️ 広告は15本あるが**名前でなく着地とEPCで選ぶ**。J SPORTS 広告（2832456）は名前に反して着地が
      // 汎用の加入ナビ LP で EPC ¥0.00＝同じ着地なら EPC ¥3.52 のこれ（2585177）を使う。野球面に貼るときだけは
      // プロ野球セット専用 LP（広告2832454・baseball.html・EPC ¥2.93）で取り直すこと。
      href: vcTag('892682813'), // 既定＝mma 記事下
      impressionPixel: vcPixel('892682813'),
      spaces: {
        // イベントLP（/rizin5・events 量産型）の #watch。興行直前の温度と記事下を混ぜると、
        // どちらが効いたか読めなくなるので pid を割る（アマプラで article/daily を割ったのと同じ理由）。
        event: { href: vcTag('892682812'), impressionPixel: vcPixel('892682812') },
      },
      rizinPpv: true,
    },
  ],
  npb: [
    {
      service: 'スカパー! プロ野球セット',
      // 事実はスカパー!公式（baseball.skyperfectv.co.jp／加入ガイドLP）の記載のまま。
      // 「全試合生中継」は広告主自身の表記＝セ・パ12球団のホーム・ビジター戦が対象。
      pitch: {
        ja: 'セ・パ12球団のホーム・ビジター戦を全試合生中継（月4,054円・商品コード062）。加入月は視聴料0円、申込から約30分で見られる。',
        en: 'Every NPB game, home and away, across all 12 clubs (¥4,054/mo).',
      },
      // VC「スカパー!新規加入プロモーション」(2045696) の**プロ野球セット専用広告**（広告ID 2832454・
      // 着地 /cp/af/af1/baseball.html・EPC ¥2.93）。mma で使う汎用LP（2585177）とは着地が違う＝
      // 野球面にはこちらを使う（着地と訴求を一致させないと申込まで残らない）。
      // 成果地点・禁止事項は mma のスカパー! と同じ＝新規加入の本登録／リスティング誘導は禁止。
      href: vcTag('892682818'),
      impressionPixel: vcPixel('892682818'),
      // spaces は割っていない＝/prospects と npb 記事下が同じ pid に乗る。面が小さいうちは
      // 分けても読めないため。記事が増えて判断材料になったら VC 側でスペースを足して分割する。
    },
  ],
};

/**
 * href が設定済み（提携前は公式URL）の案件だけ、設置場所を解決して返す。null は非表示。
 * placement 未指定は 'article'＝これまでの記事下と同じ挙動。
 */
export function vodOffers(sport: Sport, placement: VodPlacement = 'article'): ResolvedVodOffer[] {
  return VOD_OFFERS[sport].flatMap(({ spaces, href, impressionPixel, ...rest }) => {
    const space = spaces?.[placement];
    // 場所ごとの枠があればそれを使い、無ければ既定にフォールバック（枠を持たない案件はここを通る）。
    const resolvedHref = space?.href ?? href;
    if (!resolvedHref) return []; // href:null＝提携前 or 停止中の案件は出さない
    return [
      {
        ...rest,
        href: resolvedHref,
        impressionPixel: space ? space.impressionPixel : impressionPixel,
      },
    ];
  });
}
