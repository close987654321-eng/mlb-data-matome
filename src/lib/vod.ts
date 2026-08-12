import type { Sport } from '@/lib/sports';
import type { Locale } from '@/lib/i18n';

// 記事下 VOD CTA（収益化の器②）の唯一の正。競技ごとに「どのサービスを・どう訴求するか」をここに集約。
// 提携が確定したら href を **アフィリエイトリンクに差し替えるだけ** で各 CTA が反映される。
// href を null にした案件は自動で非表示（提携が切れた／まだ無いサービスを隠す安全弁）。
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
   * RIZIN の大型大会で PPV 販売実績がある販路。/rizin5 の #watch に視聴CTAとして出す判定に使う
   * （ページ側にサービス名をハードコードせず、販路の増減をこのファイルだけで完結させる）。
   */
  rizinPpv?: boolean;
};

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
      // 元タグは protocol-relative（//ck.jp.ap.valuecommerce.com/…）なので https: を明示して埋める。
      href: 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3777710&pid=892677360',
      impressionPixel:
        'https://ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3777710&pid=892677360',
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
      pitch: {
        ja: 'RIZIN を PPV で。',
        en: 'RIZIN via PPV.',
      },
      // A8 の ABEMA プレミアム案件（2026-08-05 承認・1号店メディアIDで発行した a8mat）。
      // 2号店（anime）のリンクとは別物＝流用すると成果否認。提携解除時は公式 https://abema.tv/ に戻す。
      href: 'https://px.a8.net/svt/ejp?a8mat=4B9YLB+8KZZQQ+4EKC+60OXE',
      rizinPpv: true,
    },
    {
      service: 'U-NEXT',
      pitch: {
        ja: 'UFC の日本向け配信はこちら。',
        en: "UFC's home for Japan.",
      },
      // TODO(提携確定後): U-NEXT リンクに差し替え
      href: 'https://video.unext.jp/',
      rizinPpv: true,
    },
    {
      service: 'スカパー!',
      pitch: {
        ja: 'RIZIN を PPV で。格闘技専門チャンネル「ファイティングTV サムライ」も。',
        en: 'RIZIN via PPV, plus a dedicated combat-sports channel.',
      },
      // もしもアフィリエイトのスカパー!案件（2026-08-05 承認）。実体はバリューコマース経由の二段リダイレクト。
      // 元タグは protocol-relative（//af.moshimo.com/…）なので https: を明示して埋める。
      href: 'https://af.moshimo.com/af/c/click?a_id=5731049&p_id=1080&pc_id=1564&pl_id=16147',
      rizinPpv: true,
    },
  ],
  // NPB（next メジャーリーガー）の視聴サービスは提携が固まるまで非表示（空配列＝vodOffers は [] を返し CTA 非表示）。
  npb: [],
};

/** href が設定済み（提携前は公式URL）の案件だけ返す。null は非表示。 */
export function vodOffers(sport: Sport): (VodOffer & { href: string })[] {
  return VOD_OFFERS[sport].filter(
    (o): o is VodOffer & { href: string } => Boolean(o.href),
  );
}
