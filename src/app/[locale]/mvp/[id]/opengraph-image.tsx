import { notFound } from 'next/navigation';
import { getMvpHitter, getMvpDetailRows, type MvpRow } from '@/lib/mvpBoard';
import { renderBoardDetailOg, ogVersionOf, BOARD_OG_SIZE } from '@/lib/ogBoardCard';
import { locales, type Locale } from '@/lib/i18n';

/**
 * /mvp/[id]（打者別の予測詳細）の OG カード。/cy-young/[id] OG とパリティ＝同じ意匠で
 * 欄外トークンだけ野手の主要指標にする。
 */
export const size = BOARD_OG_SIZE;
export const contentType = 'image/png';
export const alt = 'MVP 予測順位と今季成績のカード｜海外の反応';

// 意匠の版。デザインを変えたらここを上げて SNS スクレイパー/CDN に再取得させる。
const DESIGN_REV = 'mvp-board-v1';

export async function generateStaticParams() {
  const rows = await getMvpDetailRows();
  return locales.flatMap((locale) => rows.map((r) => ({ locale, id: String(r.id) })));
}

/** OG URL に「順位・成績の版」を埋め込む＝順位が動いた打者だけ URL が変わる。 */
export async function generateImageMetadata({ params }: { params: { locale: Locale; id: string } }) {
  const found = await getMvpHitter(Number(params.id));
  const basis = found ? [found.row.rank, found.row.score, found.row.avg, found.row.hr, found.row.warTotal] : 'none';
  return [
    {
      id: ogVersionOf(DESIGN_REV, basis),
      size,
      contentType,
      alt: found ? `${found.row.nameJa} MVP予測${found.row.rank}位` : alt,
    },
  ];
}

function tokens(r: MvpRow, en: boolean) {
  return [
    { label: en ? 'AVG' : '打率', value: r.avg },
    { label: en ? 'HR' : '本塁打', value: String(r.hr) },
    { label: 'wRC+', value: r.wrcPlus != null ? String(r.wrcPlus) : '—' },
    { label: 'WAR', value: r.warTotal != null ? r.warTotal.toFixed(1) : '—' },
  ];
}

export default async function Image({ params }: { params: { locale: Locale; id: string } }) {
  const found = await getMvpHitter(Number(params.id));
  if (!found) notFound(); // dynamicParams=false なので通常到達しない
  const { row, board } = found;
  const lgJa = row.league === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';

  return renderBoardDetailOg({
    locale: params.locale,
    season: board.season,
    asOf: board.asOf,
    mlbId: row.id,
    teamId: row.teamId,
    league: row.league,
    rank: row.rank,
    score: row.score,
    nameJa: row.nameJa,
    nameEn: row.nameEn,
    teamJa: row.teamJa,
    teamEn: row.teamEn,
    ja: { badge: 'MVP予測', heroLabel: `${lgJa} MVP予測`, scoreWord: 'スコア', tokens: tokens(row, false) },
    en: { badge: 'MVP', heroLabel: `${row.league} MVP PROJECTION`, scoreWord: 'SCORE', tokens: tokens(row, true) },
  });
}
