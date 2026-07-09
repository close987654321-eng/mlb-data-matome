import { getMvpBoard } from '@/lib/mvpBoard';
import { renderBoardHubOg, BOARD_OG_SIZE } from '@/lib/ogBoardCard';
import { locales, type Locale } from '@/lib/i18n';

/**
 * /mvp（MVP予測ボード）の OG カード。/cy-young OG とパリティ＝同じハブ意匠で文言だけ野手版。
 */
export const size = BOARD_OG_SIZE;
export const contentType = 'image/png';
export const alt = 'MVP 予測ボード｜AL/NL打者スコアランキング｜海外の反応';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** 欄外用の短い名前（カタカナのフルネームは姓だけに落とす）。 */
const lastJa = (s: string) => s.split('・').pop() ?? s;
const lastEn = (s: string) => s.split(' ').pop() ?? s;

export default async function Image({ params }: { params: { locale: Locale } }) {
  const board = await getMvpBoard();
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
      titleLines: [{ text: 'MVP', latin: true }, { text: '予測ボード' }],
      lead: 'wRC+・xwOBA・本塁打・走塁・守備・WAR で総合スコア化',
      badge: 'AL・NL',
    },
    en: {
      titleLines: [{ text: 'MVP', latin: true }, { text: 'PREDICTION BOARD', latin: true }],
      lead: 'wRC+ · xwOBA · HR · Baserunning · Defense · WAR',
      badge: 'AL・NL',
    },
    footer,
  });
}
