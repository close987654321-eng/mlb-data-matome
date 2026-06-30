import type { HitGame, PitGame, WarPoint } from './gamelog';

/**
 * 試合別ログの「期間集計・率の再計算・162換算」を行う純粋関数群（fs 非依存＝クライアント島から使える）。
 * 率は必ずカウント数から再計算する（試合ごとの率を平均しない＝打数の重みを正しく扱う）。
 */

export type HitAgg = {
  g: number; pa: number; ab: number; r: number; h: number; dbl: number; tpl: number; hr: number;
  rbi: number; sb: number; cs: number; bb: number; ibb: number; hbp: number; so: number; sf: number; tb: number;
  avg: number; obp: number; slg: number; ops: number;
};
export type PitAgg = {
  g: number; gs: number; outs: number; h: number; r: number; er: number; hr: number;
  bb: number; ibb: number; hbp: number; so: number; bf: number; w: number; l: number;
  ip: number; era: number; whip: number; k9: number; bb9: number; hr9: number; kbb: number;
};

const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

/** 打撃の期間集計＋率（avg/obp/slg/ops をカウント数から再計算）。 */
export function aggHitting(rows: HitGame[]): HitAgg {
  const s = { g: rows.length, pa: 0, ab: 0, r: 0, h: 0, dbl: 0, tpl: 0, hr: 0, rbi: 0, sb: 0, cs: 0, bb: 0, ibb: 0, hbp: 0, so: 0, sf: 0, tb: 0 };
  for (const r of rows) {
    s.pa += r.pa; s.ab += r.ab; s.r += r.r; s.h += r.h; s.dbl += r.dbl; s.tpl += r.tpl;
    s.hr += r.hr; s.rbi += r.rbi; s.sb += r.sb; s.cs += r.cs; s.bb += r.bb; s.ibb += r.ibb;
    s.hbp += r.hbp; s.so += r.so; s.sf += r.sf; s.tb += r.tb;
  }
  const avg = safe(s.h, s.ab);
  const obp = safe(s.h + s.bb + s.hbp, s.ab + s.bb + s.hbp + s.sf);
  const slg = safe(s.tb, s.ab);
  return { ...s, avg, obp, slg, ops: obp + slg };
}

/** 投球の期間集計＋率（era/whip/K9 等を outs から再計算）。 */
export function aggPitching(rows: PitGame[]): PitAgg {
  const s = { g: rows.length, gs: 0, outs: 0, h: 0, r: 0, er: 0, hr: 0, bb: 0, ibb: 0, hbp: 0, so: 0, bf: 0, w: 0, l: 0 };
  for (const r of rows) {
    s.gs += r.gs; s.outs += r.outs; s.h += r.h; s.r += r.r; s.er += r.er; s.hr += r.hr;
    s.bb += r.bb; s.ibb += r.ibb; s.hbp += r.hbp; s.so += r.so; s.bf += r.bf; s.w += r.w; s.l += r.l;
  }
  const ip = s.outs / 3;
  return {
    ...s, ip,
    era: safe(s.er * 27, s.outs), // ER*9 / (outs/3) = ER*27/outs
    whip: safe((s.bb + s.h) * 3, s.outs),
    k9: safe(s.so * 27, s.outs),
    bb9: safe(s.bb * 27, s.outs),
    hr9: safe(s.hr * 27, s.outs),
    kbb: safe(s.so, s.bb),
  };
}

/** 162試合換算（チーム試合ペース）。カウント数を 162/teamGames 倍して丸め、率はそのまま（率はペースで動かない）。 */
export function projectHitting(agg: HitAgg, teamGames: number | null): HitAgg {
  if (!teamGames || teamGames <= 0) return agg;
  const f = 162 / teamGames;
  const s = (v: number) => Math.round(v * f);
  return {
    ...agg, g: Math.min(162, s(agg.g)), pa: s(agg.pa), ab: s(agg.ab), r: s(agg.r), h: s(agg.h),
    dbl: s(agg.dbl), tpl: s(agg.tpl), hr: s(agg.hr), rbi: s(agg.rbi), sb: s(agg.sb), cs: s(agg.cs),
    bb: s(agg.bb), ibb: s(agg.ibb), hbp: s(agg.hbp), so: s(agg.so), sf: s(agg.sf), tb: s(agg.tb),
  };
}
export function projectPitching(agg: PitAgg, teamGames: number | null): PitAgg {
  if (!teamGames || teamGames <= 0) return agg;
  const f = 162 / teamGames;
  const s = (v: number) => Math.round(v * f);
  const outs = s(agg.outs);
  return {
    ...agg, g: s(agg.g), gs: s(agg.gs), outs, h: s(agg.h), r: s(agg.r), er: s(agg.er), hr: s(agg.hr),
    bb: s(agg.bb), ibb: s(agg.ibb), hbp: s(agg.hbp), so: s(agg.so), bf: s(agg.bf), w: s(agg.w), l: s(agg.l),
    ip: outs / 3,
  };
}

/** WAR 点の合計（投＋打）。欠損は 0 扱い。 */
export const warTotal = (p: WarPoint): number => (p.warHit ?? 0) + (p.warPit ?? 0);

/**
 * 期間 [start, end]（試合日づけ）の WAR 増分（近似）。
 * end 以前で最も新しい点 − start より前で最も新しい点。基準が取れなければ null（＝追跡開始前で出せない）。
 */
export function warGain(history: WarPoint[], start: string, end: string): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.d.localeCompare(b.d));
  const cur = [...sorted].reverse().find((p) => p.d <= end);
  const base = [...sorted].reverse().find((p) => p.d < start);
  if (!cur || !base) return null;
  return Math.round((warTotal(cur) - warTotal(base)) * 10) / 10;
}

// ── 表示フォーマット ─────────────────────────────────────────────
/** 率指標を ".321" / "1.045" 形式に（1未満は先頭の0を落とす・3桁）。 */
export function fmtRate(x: number): string {
  const s = x.toFixed(3);
  return s.startsWith('0.') ? s.slice(1) : s;
}
/** 防御率・WHIP 等を 2 桁で。 */
export const fmt2 = (x: number): string => x.toFixed(2);
/** 防御率・K9 等を 1 桁で。 */
export const fmt1 = (x: number): string => x.toFixed(1);
/** outs → "6.2"（6回2/3）形式の投球回表示。 */
export const fmtIp = (outs: number): string => `${Math.floor(outs / 3)}.${outs % 3}`;
/** "2026-03-26" → "3/26"。 */
export const fmtMd = (d: string): string => {
  const [, m, day] = d.split('-');
  return `${Number(m)}/${Number(day)}`;
};
/** 試合日づけからシーズン中の月（3〜10）を拾う。月フィルタの選択肢生成に使う。 */
export const monthOf = (d: string): number => Number(d.split('-')[1]);
