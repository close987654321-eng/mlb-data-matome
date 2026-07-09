import { notFound } from 'next/navigation';
import { getCyPitcher, getCyDetailRows, type CyRow } from '@/lib/cyYoungBoard';
import { renderBoardDetailOg, ogVersionOf, BOARD_OG_SIZE } from '@/lib/ogBoardCard';
import { locales, type Locale } from '@/lib/i18n';

/**
 * /cy-young/[id]（投手別の予測詳細）の OG カード。選手ハブ OG と同じ「チーム色の地＋顔写真＋
 * 巨大数字」の意匠で、数字はその投手の予測順位。欄外はボードの主要指標（実データのみ）。
 */
export const size = BOARD_OG_SIZE;
export const contentType = 'image/png';
export const alt = 'サイ・ヤング賞 予測順位と今季成績のカード｜海外の反応';

// 意匠の版。デザインを変えたらここを上げて SNS スクレイパー/CDN に再取得させる。
const DESIGN_REV = 'cy-board-v1';

export async function generateStaticParams() {
  const rows = await getCyDetailRows();
  return locales.flatMap((locale) => rows.map((r) => ({ locale, id: String(r.id) })));
}

/**
 * OG URL に「順位・成績の版」を埋め込む（選手ハブ OG の ogVersion と同じ狙い）。
 * ボードは毎日更新＝順位が動いた投手だけ URL が変わり、ページの数字と画像が必ず一致する。
 */
export async function generateImageMetadata({ params }: { params: { locale: Locale; id: string } }) {
  const found = await getCyPitcher(Number(params.id));
  const basis = found ? [found.row.rank, found.row.score, found.row.era, found.row.xera, found.row.ipDisp] : 'none';
  return [
    {
      id: ogVersionOf(DESIGN_REV, basis),
      size,
      contentType,
      alt: found ? `${found.row.nameJa} サイ・ヤング賞予測${found.row.rank}位` : alt,
    },
  ];
}

function tokens(r: CyRow, en: boolean) {
  return [
    { label: 'ERA', value: r.era },
    { label: 'xERA', value: r.xera != null ? r.xera.toFixed(2) : '—' },
    { label: 'K-BB%', value: r.kbbPct != null ? `${r.kbbPct.toFixed(1)}%` : '—' },
    { label: en ? 'IP' : '投球回', value: r.ipDisp },
  ];
}

export default async function Image({ params }: { params: { locale: Locale; id: string } }) {
  const found = await getCyPitcher(Number(params.id));
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
    ja: { badge: 'サイヤング予測', heroLabel: `${lgJa} サイ・ヤング賞予測`, scoreWord: 'スコア', tokens: tokens(row, false) },
    en: { badge: 'CY YOUNG', heroLabel: `${row.league} CY YOUNG PROJECTION`, scoreWord: 'SCORE', tokens: tokens(row, true) },
  });
}
