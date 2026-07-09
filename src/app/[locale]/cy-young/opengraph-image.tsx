import { getCyYoungBoard } from '@/lib/cyYoungBoard';
import { renderBoardHubOg, BOARD_OG_SIZE } from '@/lib/ogBoardCard';
import { locales, type Locale } from '@/lib/i18n';

/**
 * /cy-young（サイヤング予測ボード）の OG カード。/ranking OG と同じ意匠ファミリー
 * （ブランド色の地＋大判タイトル）＝媒体の顔で揃える。欄外は両リーグの予測上位（実データ）。
 */
export const size = BOARD_OG_SIZE;
export const contentType = 'image/png';
export const alt = 'サイ・ヤング賞 予測ボード｜AL/NL投手スコアランキング｜海外の反応';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** 欄外用の短い名前（カタカナのフルネームは姓だけに落とす）。 */
const lastJa = (s: string) => s.split('・').pop() ?? s;
const lastEn = (s: string) => s.split(' ').pop() ?? s;

export default async function Image({ params }: { params: { locale: Locale } }) {
  const board = await getCyYoungBoard();
  const season = board?.season ?? 2026;
  // 各リーグの首位だけ（2名以上はカタカナ姓だと右端が見切れる）。
  const footer = board
    ? (['NL', 'AL'] as const).map((lg) => ({
        lg,
        ja: board.leagues[lg].slice(0, 1).map((r) => lastJa(r.nameJa)),
        en: board.leagues[lg].slice(0, 1).map((r) => lastEn(r.nameEn)),
      }))
    : [];

  return renderBoardHubOg({
    locale: params.locale,
    season,
    asOf: board?.asOf ?? '',
    ja: {
      titleLines: [{ text: 'サイ・ヤング賞' }, { text: '予測ボード' }],
      lead: 'ERA・xERA・K-BB%・投球回などで総合スコア化',
      badge: 'AL・NL',
    },
    en: {
      titleLines: [{ text: 'CY YOUNG', latin: true }, { text: 'PREDICTION BOARD', latin: true }],
      lead: 'ERA · xERA · K-BB% · Innings · WHIP · HR/9',
      badge: 'AL・NL',
    },
    footer,
  });
}
