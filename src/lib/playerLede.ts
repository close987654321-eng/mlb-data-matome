import type { Player } from './players';
import type { PlayerSeason } from './playerStats';
import { deriveRole, pickBestRankCaption } from './playerHero';
import type { Locale } from './i18n';

/**
 * 選手ハブ H1 直下に出す「今季の地の文」（2〜4文）を組む純関数（サーバ・JSX なし）。
 * 狙い: 数値表だけの“薄ページ”を脱し、選手別の独自散文（今季成績・防御率・本塁打・海外の反応…）で
 * 対象クエリ面を広げる。数値は snapshot の実在値のみを使い、無い値は文ごと落とす（捏造しない＝CLAUDE.md §4.4）。
 */

const has = (v: unknown): boolean => v != null && v !== '';

const leagueJaOf = (l?: string | null): string => (l === 'AL' ? 'ア・リーグ' : l === 'NL' ? 'ナ・リーグ' : 'MLB');
const leagueEnOf = (l?: string | null): string => (l === 'AL' ? 'the AL' : l === 'NL' ? 'the NL' : 'MLB');
const ord = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export function playerLede(player: Player, season: PlayerSeason, year: number, locale: Locale): string {
  const ja = locale !== 'en';
  const name = ja ? player.nameJa : player.nameEn;
  const team = season.team ?? '';
  const role = deriveRole(season);
  const h = season.hitting;
  const p = season.pitching;
  const cap = pickBestRankCaption(season);

  if (ja) {
    const roleJa = role === 'two-way' ? '二刀流' : role === 'pitcher' ? '投手' : '打者';
    const bat: string[] = [];
    if (h) {
      if (has(h.avg)) bat.push(`打率${h.avg}`);
      if (has(h.homeRuns)) bat.push(`${h.homeRuns}本塁打`);
      if (has(h.rbi)) bat.push(`${h.rbi}打点`);
      if (has(h.ops)) bat.push(`OPS${h.ops}`);
    }
    const pit: string[] = [];
    if (p) {
      if (has(p.era)) pit.push(`防御率${p.era}`);
      if (has(p.wins)) pit.push(`${p.wins}勝`);
      if (has(p.strikeOuts)) pit.push(`${p.strikeOuts}奪三振`);
      if (has(p.whip)) pit.push(`WHIP${p.whip}`);
    }

    const sentences: string[] = [];
    sentences.push(`${name}は${year}年シーズン、${team ? `${team}で` : ''}${roleJa}としてプレーしている。`);
    if (role === 'two-way' && (bat.length || pit.length)) {
      const parts: string[] = [];
      if (bat.length) parts.push(`打者として${bat.join('・')}`);
      if (pit.length) parts.push(`投手として${pit.join('・')}`);
      sentences.push(`${parts.join('、')}を記録している。`);
    } else if (role === 'pitcher' && pit.length) {
      sentences.push(`${pit.join('・')}を記録している。`);
    } else if (bat.length) {
      sentences.push(`${bat.join('・')}といった成績を残している。`);
    }
    if (cap) {
      const scope = cap.scope === 'lg' ? leagueJaOf(season.league) : 'MLB';
      sentences.push(`${cap.label}は${scope}${cap.rank}位につけている。`);
    }
    sentences.push(`このページでは${name}の今季成績（打撃・投球・守備）と、現地ファンの「海外の反応」まとめ記事をまとめている。`);
    return sentences.join('');
  }

  // English
  const roleEn = role === 'two-way' ? 'two-way player' : role === 'pitcher' ? 'pitcher' : 'hitter';
  const bat: string[] = [];
  if (h) {
    if (has(h.avg)) bat.push(`a ${h.avg} average`);
    if (has(h.homeRuns)) bat.push(`${h.homeRuns} home runs`);
    if (has(h.rbi)) bat.push(`${h.rbi} RBI`);
    if (has(h.ops)) bat.push(`a ${h.ops} OPS`);
  }
  const pit: string[] = [];
  if (p) {
    if (has(p.era)) pit.push(`a ${p.era} ERA`);
    if (has(p.wins)) pit.push(`${p.wins} wins`);
    if (has(p.strikeOuts)) pit.push(`${p.strikeOuts} strikeouts`);
    if (has(p.whip)) pit.push(`a ${p.whip} WHIP`);
  }
  const sentences: string[] = [];
  sentences.push(`${name} is playing as a ${roleEn}${team ? ` for ${team}` : ''} in the ${year} MLB season.`);
  if (role === 'two-way' && (bat.length || pit.length)) {
    const parts: string[] = [];
    if (bat.length) parts.push(`${bat.join(', ')} at the plate`);
    if (pit.length) parts.push(`${pit.join(', ')} on the mound`);
    sentences.push(`He has posted ${parts.join(', and ')}.`);
  } else if (role === 'pitcher' && pit.length) {
    sentences.push(`He has posted ${pit.join(', ')}.`);
  } else if (bat.length) {
    sentences.push(`He is hitting for ${bat.join(', ')}.`);
  }
  if (cap) {
    sentences.push(`He currently ranks ${ord(cap.rank)} in ${cap.scope === 'lg' ? leagueEnOf(season.league) : 'MLB'} this season.`);
  }
  sentences.push(`This page tracks ${name}'s ${year} season stats and how overseas fans are reacting.`);
  return sentences.join(' ');
}
