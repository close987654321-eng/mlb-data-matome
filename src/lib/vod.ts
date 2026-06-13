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
};

export const VOD_OFFERS: Record<Sport, VodOffer[]> = {
  mlb: [
    {
      service: 'SPOTV NOW',
      pitch: {
        ja: '大谷・ドジャース戦をはじめ MLB をライブ＆見逃し配信。',
        en: 'Watch MLB live and on demand — including Ohtani and the Dodgers.',
      },
      // TODO(提携確定後): アクセストレード / A8 の SPOTV NOW（実質 U-NEXT「SPOTV NOWパック」）リンクに差し替え
      href: 'https://www.spotvnow.jp/',
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
      service: 'U-NEXT',
      pitch: {
        ja: 'UFC の日本向け配信はこちら。',
        en: "UFC's home for Japan.",
      },
      // TODO(提携確定後): U-NEXT リンクに差し替え
      href: 'https://video.unext.jp/',
    },
    {
      service: 'ABEMA',
      pitch: {
        ja: 'RIZIN を PPV で。',
        en: 'RIZIN via PPV.',
      },
      // TODO(提携確定後): ABEMA（プレミアム/PPV・A8 等で要確認）リンクに差し替え
      href: 'https://abema.tv/',
    },
  ],
};

/** href が設定済み（提携前は公式URL）の案件だけ返す。null は非表示。 */
export function vodOffers(sport: Sport): (VodOffer & { href: string })[] {
  return VOD_OFFERS[sport].filter(
    (o): o is VodOffer & { href: string } => Boolean(o.href),
  );
}
