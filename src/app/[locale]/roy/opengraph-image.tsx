import { getRoyBoard } from '@/lib/royBoard';
import { renderBoardHubOg, BOARD_OG_SIZE } from '@/lib/ogBoardCard';
import { locales, type Locale } from '@/lib/i18n';

/**
 * /roy（新人王 予測ボード）の OG カード。/cy-young・/mvp と同じ意匠ファミリー
 * （ブランド色の地＋大判タイトル）＝媒体の顔で揃える。欄外は両リーグの予測首位（実データ）。
 */
export const size = BOARD_OG_SIZE;
export const contentType = 'image/png';
export const alt = '新人王 予測ボード｜AL/NLルーキースコアランキング｜海外の反応';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** 欄外用の短い名前（カタカナのフルネームは姓だけに落とす）。 */
const lastJa = (s: string) => s.split('・').pop() ?? s;
const lastEn = (s: string) => s.split(' ').pop() ?? s;

export default async function Image({ params }: { params: { locale: Locale } }) {
  const board = await getRoyBoard();
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
      titleLines: [{ text: '新人王' }, { text: '予測ボード' }],
      lead: 'WAR・wRC+・FIP・出場数で総合スコア化',
      badge: 'AL・NL',
    },
    en: {
      titleLines: [{ text: 'ROOKIE OF THE YEAR', latin: true }, { text: 'PREDICTION BOARD', latin: true }],
      lead: 'WAR · wRC+ · FIP · Playing time',
      badge: 'AL・NL',
    },
    footer,
  });
}
