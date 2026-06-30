'use client';

import { useMemo, useRef, useState } from 'react';
import { Link } from '@/lib/navigation';
import Chevron from '@/components/Chevron';
import type { Gamelog, HitGame, PitGame } from '@/lib/gamelog';
import {
  aggHitting, aggPitching, projectHitting, projectPitching,
  warTotal, estimateGameWar, fmtWar, fmtRate, fmt2, fmt1, fmtIp, fmtMd, monthOf,
  type HitAgg, type PitAgg,
} from '@/lib/gamelogStats';

/** 試合(ET日付) → その試合の海外の反応まとめ記事への参照。 */
type ArticleRef = { id: string; sport: string; series: boolean };

type Mode = 'hitting' | 'pitching';
type Filter = { kind: 'all' } | { kind: 'last'; n: number } | { kind: 'month'; m: number };
type SortDir = 'asc' | 'desc';
type Agg = HitAgg | PitAgg;

/** サマリ1行＝指標ラベル＋[選択期間, 今季累計, 162換算]の整形済み文字列。画像出力でも同じ配列を使う。 */
type SummaryRow = { label: string; vals: [string, string, string] };
/** 表の列定義。num はソート値の取り出し、cell は表示。 */
type Col<R> = { key: string; label: string; num: (r: R) => number | string; cell: (r: R) => string; align?: 'left' };

const LAST_NS = [5, 10, 15, 20, 25, 30];

export default function GamelogAnalysis({
  log,
  locale,
  articles,
}: {
  log: Gamelog;
  locale: string;
  articles?: Record<string, ArticleRef>;
}) {
  const en = locale === 'en';
  // ラベル群は locale でだけ変わる＝毎レンダー新規生成しないよう memo（下流 useMemo の依存安定化）。
  const t = useMemo(
    () =>
      en
    ? {
        heading: 'Game-by-game analysis', sub: 'Sort by recent games or month. Rates are recomputed from raw counts; the 162-game pace projects from the full-season rate.',
        batting: 'Batting', pitching: 'Pitching', all: 'Full', month: (m: number) => `${m}/`,
        colPeriod: 'Selected', colSeason: 'Season', colProj: '162 pace',
        warTitle: 'WAR trend', warStart: (d: string) => `Tracking began ${d}. The trend builds from here (one point per game day).`,
        warGain: 'WAR in this span (approx)', warNA: '—', save: 'Save as image', saving: 'Rendering…',
        date: 'Date', opp: 'Opp', result: 'Dec', win: 'W', loss: 'L', none: '—', asOf: (d: string) => `As of ${d}`,
        gameWar: 'Est. WAR', warNote: 'Per-game value estimated from each box score, calibrated so the season total matches the official WAR.',
        warDelta: 'Est. WAR in this span', covered: (n: number) => `${n} games with overseas-reaction digests`,
        splits: 'Splits', home: 'Home', away: 'Away', pitchDay: 'On days he pitched', restDay: 'Other days',
        twoWay: 'Two-way split (batting)', vsTeam: 'By opponent', pace: 'Milestones & pace', proj: '162-pace',
        watchGame: 'View game',
      }
    : {
        heading: '徹底分析（試合別）', sub: '直近の試合数や月で絞り込み。率はカウント数から再計算、162換算は今季ペースからの推計です。',
        batting: '打撃', pitching: '投球', all: '全期間', month: (m: number) => `${m}月`,
        colPeriod: '選択期間', colSeason: '今季累計', colProj: '162換算',
        warTitle: 'WAR推移', warStart: (d: string) => `${d}に追跡開始。ここから1試合ぶんずつ推移が積み上がります。`,
        warGain: '選択期間のWAR増分（近似）', warNA: '—', save: 'この内容を画像で保存', saving: '生成中…',
        date: '日付', opp: '対戦', result: '結果', win: '勝', loss: '敗', none: '—', asOf: (d: string) => `${d}時点`,
        gameWar: '推定WAR', warNote: '各試合の成績から1試合ぶんを試算し、季節合計が公式WARに一致するよう補正した推定値です。',
        warDelta: '選択期間の推定WAR', covered: (n: number) => `海外の反応つき ${n}試合`,
        splits: 'スプリット', home: 'ホーム', away: 'ビジター', pitchDay: '登板した試合', restDay: 'それ以外',
        twoWay: '二刀流スプリット（打撃）', vsTeam: '対戦相手別', pace: '節目・ペース', proj: '162換算',
        watchGame: '試合を見る',
      },
    [en],
  );
  // 指標ラベル（サマリ／画像で共通）。
  const HL = useMemo(
    () =>
      en
        ? { g: 'G', avg: 'AVG', hr: 'HR', rbi: 'RBI', ops: 'OPS', obp: 'OBP', slg: 'SLG', h: 'H', bb: 'BB', so: 'SO', sb: 'SB' }
        : { g: '試合', avg: '打率', hr: '本塁打', rbi: '打点', ops: 'OPS', obp: '出塁率', slg: '長打率', h: '安打', bb: '四球', so: '三振', sb: '盗塁' },
    [en],
  );
  const PL = useMemo(
    () =>
      en
        ? { g: 'G', era: 'ERA', whip: 'WHIP', ip: 'IP', so: 'SO', bb: 'BB', hr: 'HR', wl: 'W-L', k9: 'K/9', kbb: 'K/BB' }
        : { g: '登板', era: '防御率', whip: 'WHIP', ip: '投球回', so: '奪三振', bb: '与四球', hr: '被本塁打', wl: '勝-敗', k9: 'K/9', kbb: 'K/BB' },
    [en],
  );

  // 全選手に展開＝単一分野（純投手/純打者）でも壊さない。既定モードは試合数が多い方（二刀流は打撃→大谷）、
  // 切替トグルは両分野を持つ二刀流だけ出す（純投手に空の「打撃」タブを見せない）。
  const hasHit = log.hitting.length > 0;
  const hasPit = log.pitching.length > 0;
  const twoWay = hasHit && hasPit;
  const [mode, setMode] = useState<Mode>(log.pitching.length > log.hitting.length ? 'pitching' : 'hitting');
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: 'd', dir: 'desc' });
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const baseRows = mode === 'hitting' ? log.hitting : log.pitching;
  const months = useMemo(() => [...new Set(baseRows.map((r) => monthOf(r.d)))].sort((a, b) => a - b), [baseRows]);
  const lastNs = LAST_NS.filter((n) => n < baseRows.length);

  // 1試合ごとの推定WAR（公式季節値に補正）。試合表の列・推移カーブ・期間増分すべてに使う。
  const est = useMemo(() => estimateGameWar(log), [log]);
  const warByDate = mode === 'hitting' ? est.hitByDate : est.pitByDate;
  // 海外の反応つき試合数（打＋投の全試合日のうち記事がある数）。
  const coveredCount = useMemo(
    () => (articles ? new Set([...log.hitting, ...log.pitching].map((r) => r.d).filter((d) => articles[d])).size : 0),
    [articles, log],
  );

  // ② スプリット（ホーム/ビジター・二刀流の登板日/非登板日・対戦相手別）。すべて gamelog から純粋集計。
  const pitchDates = useMemo(() => new Set(log.pitching.map((p) => p.d)), [log]);
  const venueSplit = useMemo<{ label: string; agg: Agg }[]>(() => {
    const f = (pred: (home: boolean) => boolean) =>
      mode === 'hitting'
        ? aggHitting(log.hitting.filter((r) => pred(r.home)))
        : aggPitching(log.pitching.filter((r) => pred(r.home)));
    return [
      { label: t.home, agg: f((h) => h) },
      { label: t.away, agg: f((h) => !h) },
    ];
  }, [mode, log, t]);
  // 二刀流スプリット＝登板した試合の打撃 vs それ以外（打撃モードのみ・大谷固有の切り口）。
  const twoWaySplit = useMemo<{ label: string; agg: Agg }[] | null>(() => {
    if (mode !== 'hitting' || log.pitching.length === 0) return null;
    return [
      { label: t.pitchDay, agg: aggHitting(log.hitting.filter((r) => pitchDates.has(r.d))) },
      { label: t.restDay, agg: aggHitting(log.hitting.filter((r) => !pitchDates.has(r.d))) },
    ];
  }, [mode, log, pitchDates, t]);
  const byOpp = useMemo(() => {
    const m = new Map<string, (HitGame | PitGame)[]>();
    for (const r of baseRows) {
      const arr = m.get(r.oppJa) ?? [];
      arr.push(r);
      m.set(r.oppJa, arr);
    }
    return [...m.entries()]
      .map(([opp, rs]) => ({
        opp,
        n: rs.length,
        agg: (mode === 'hitting' ? aggHitting(rs as HitGame[]) : aggPitching(rs as PitGame[])) as Agg,
      }))
      .sort((a, b) => b.n - a.n);
  }, [baseRows, mode]);
  // スプリット表の指標行（モード別・4指標に絞る）。
  const splitRows = useMemo<{ label: string; get: (a: Agg) => string }[]>(
    () =>
      mode === 'hitting'
        ? [
            { label: HL.g, get: (a) => `${(a as HitAgg).g}` },
            { label: HL.avg, get: (a) => fmtRate((a as HitAgg).avg) },
            { label: HL.hr, get: (a) => `${(a as HitAgg).hr}` },
            { label: HL.ops, get: (a) => fmtRate((a as HitAgg).ops) },
          ]
        : [
            { label: PL.g, get: (a) => `${(a as PitAgg).g}` },
            { label: PL.era, get: (a) => fmt2((a as PitAgg).era) },
            { label: PL.whip, get: (a) => fmt2((a as PitAgg).whip) },
            { label: PL.so, get: (a) => `${(a as PitAgg).so}` },
          ],
    [mode, HL, PL],
  );

  // ③ 節目・ペース（今季累計＋162換算）。chase（50本ペース等）はSNSカードの見出しにも使う。
  const cumHit = useMemo(() => aggHitting(log.hitting), [log]);
  const projHit = useMemo(() => projectHitting(cumHit, log.teamGames), [cumHit, log.teamGames]);
  const cumPit = useMemo(() => aggPitching(log.pitching), [log]);
  const projPit = useMemo(() => projectPitching(cumPit, log.teamGames), [cumPit, log.teamGames]);
  const paceInfo = useMemo<{ lines: string[]; chase: string | null }>(() => {
    if (mode === 'hitting') {
      const hrNext = Math.ceil((cumHit.hr + 1) / 10) * 10;
      const chase =
        projHit.hr >= 50 && projHit.sb >= 50 ? '50-50' :
        projHit.hr >= 40 && projHit.sb >= 40 ? '40-40' :
        projHit.hr >= 50 ? (en ? '50 HR pace' : '50本塁打ペース') :
        projHit.hr >= 40 ? (en ? '40 HR pace' : '40本塁打ペース') : null;
      const lines = en
        ? [
            `HR ${cumHit.hr} — ${hrNext - cumHit.hr} to ${hrNext} (162-pace ${projHit.hr})`,
            `RBI ${cumHit.rbi} (162-pace ${projHit.rbi})`,
            `H ${cumHit.h} (162-pace ${projHit.h}) · SB ${cumHit.sb} (${projHit.sb})`,
          ]
        : [
            `本塁打 ${cumHit.hr} — あと${hrNext - cumHit.hr}本で${hrNext}号（162換算 ${projHit.hr}本）`,
            `打点 ${cumHit.rbi}（162換算 ${projHit.rbi}）`,
            `安打 ${cumHit.h}（162換算 ${projHit.h}）・盗塁 ${cumHit.sb}（${projHit.sb}）`,
          ];
      return { lines, chase };
    }
    const soNext = Math.ceil((cumPit.so + 1) / 50) * 50;
    const ipRemain = (log.teamGames ?? 0) - cumPit.ip;
    const chase = projPit.so >= 250 ? (en ? '250 K pace' : '250奪三振ペース') : projPit.so >= 200 ? (en ? '200 K pace' : '200奪三振ペース') : null;
    const lines = en
      ? [
          `K ${cumPit.so} — ${soNext - cumPit.so} to ${soNext} (162-pace ${projPit.so})`,
          `ERA ${fmt2(cumPit.era)} · WHIP ${fmt2(cumPit.whip)}`,
          `${cumPit.w}-${cumPit.l} (162-pace ${projPit.w} W) · ${ipRemain > 0 ? `${ipRemain.toFixed(1)} IP to qualify` : 'qualified'}`,
        ]
      : [
          `奪三振 ${cumPit.so} — あと${soNext - cumPit.so}で${soNext}（162換算 ${projPit.so}）`,
          `防御率 ${fmt2(cumPit.era)} ・ WHIP ${fmt2(cumPit.whip)}`,
          `${cumPit.w}勝${cumPit.l}敗（162換算 ${projPit.w}勝）・${ipRemain > 0 ? `規定まであと${ipRemain.toFixed(1)}回` : '規定到達'}`,
        ];
    return { lines, chase };
  }, [mode, en, cumHit, projHit, cumPit, projPit, log.teamGames]);

  // 絞り込み（時系列 asc のまま＝期間の端＝最初/最後の試合日が取れる）。
  const filtered = useMemo(() => {
    if (filter.kind === 'last') return baseRows.slice(-filter.n);
    if (filter.kind === 'month') return baseRows.filter((r) => monthOf(r.d) === filter.m);
    return baseRows;
  }, [baseRows, filter]);

  const filterLabel = filter.kind === 'all' ? t.all : filter.kind === 'last' ? `直近${filter.n}` : t.month(filter.m);
  const filterLabelEn = filter.kind === 'all' ? t.all : filter.kind === 'last' ? `Last ${filter.n}` : t.month(filter.m);
  const fLabel = en ? filterLabelEn : filterLabel;

  // サマリ3列（選択期間 / 今季累計 / 162換算）。162は「今季累計」からの推計（絞り込みに依らず固定）。
  const summary: SummaryRow[] = useMemo(() => {
    if (mode === 'hitting') {
      const p = aggHitting(filtered as HitGame[]);
      const c = aggHitting(log.hitting);
      const j = projectHitting(c, log.teamGames);
      const row = (label: string, f: (a: HitAgg) => string): SummaryRow => ({ label, vals: [f(p), f(c), f(j)] });
      // WAR行：選択期間＝推定の和／今季累計＝公式値／162換算＝公式値×162/チーム試合。
      const warRow: SummaryRow = {
        label: 'WAR',
        vals: [
          (filtered as HitGame[]).reduce((s, r) => s + (est.hitByDate.get(r.d) ?? 0), 0).toFixed(1),
          est.official.hit.toFixed(1),
          (log.teamGames ? (est.official.hit * 162) / log.teamGames : est.official.hit).toFixed(1),
        ],
      };
      return [
        warRow,
        row(HL.g, (a) => `${a.g}`),
        row(HL.avg, (a) => fmtRate(a.avg)),
        row(HL.hr, (a) => `${a.hr}`),
        row(HL.rbi, (a) => `${a.rbi}`),
        row(HL.ops, (a) => fmtRate(a.ops)),
        row(HL.obp, (a) => fmtRate(a.obp)),
        row(HL.slg, (a) => fmtRate(a.slg)),
        row(HL.h, (a) => `${a.h}`),
        row(HL.bb, (a) => `${a.bb}`),
        row(HL.so, (a) => `${a.so}`),
        row(HL.sb, (a) => `${a.sb}`),
      ];
    }
    const p = aggPitching(filtered as PitGame[]);
    const c = aggPitching(log.pitching);
    const j = projectPitching(c, log.teamGames);
    const row = (label: string, f: (a: PitAgg) => string): SummaryRow => ({ label, vals: [f(p), f(c), f(j)] });
    const warRow: SummaryRow = {
      label: 'WAR',
      vals: [
        (filtered as PitGame[]).reduce((s, r) => s + (est.pitByDate.get(r.d) ?? 0), 0).toFixed(1),
        est.official.pit.toFixed(1),
        (log.teamGames ? (est.official.pit * 162) / log.teamGames : est.official.pit).toFixed(1),
      ],
    };
    return [
      warRow,
      row(PL.g, (a) => `${a.g}`),
      row(PL.era, (a) => fmt2(a.era)),
      row(PL.whip, (a) => fmt2(a.whip)),
      row(PL.ip, (a) => fmtIp(a.outs)),
      row(PL.so, (a) => `${a.so}`),
      row(PL.bb, (a) => `${a.bb}`),
      row(PL.hr, (a) => `${a.hr}`),
      row(PL.wl, (a) => `${a.w}-${a.l}`),
      row(PL.k9, (a) => fmt1(a.k9)),
      row(PL.kbb, (a) => fmt1(a.kbb)),
    ];
  }, [mode, filtered, log, HL, PL, est]);

  // 表の列定義。
  const cols: Col<HitGame>[] | Col<PitGame>[] = useMemo(() => {
    const oppCell = (r: { home: boolean; oppJa: string; opp: string }) => `${r.home ? 'vs' : '@'} ${en ? r.opp.split(' ').pop() : r.oppJa}`;
    if (mode === 'hitting') {
      const c: Col<HitGame>[] = [
        { key: 'd', label: t.date, num: (r) => r.d, cell: (r) => fmtMd(r.d), align: 'left' },
        { key: 'opp', label: t.opp, num: (r) => r.opp, cell: oppCell, align: 'left' },
        { key: 'ab', label: HL.h === '安打' ? '打数' : 'AB', num: (r) => r.ab, cell: (r) => `${r.ab}` },
        { key: 'h', label: HL.h, num: (r) => r.h, cell: (r) => `${r.h}` },
        { key: 'hr', label: HL.hr, num: (r) => r.hr, cell: (r) => `${r.hr}` },
        { key: 'rbi', label: HL.rbi, num: (r) => r.rbi, cell: (r) => `${r.rbi}` },
        { key: 'bb', label: HL.bb, num: (r) => r.bb, cell: (r) => `${r.bb}` },
        { key: 'so', label: HL.so, num: (r) => r.so, cell: (r) => `${r.so}` },
        { key: 'sb', label: HL.sb, num: (r) => r.sb, cell: (r) => `${r.sb}` },
        { key: 'war', label: t.gameWar, num: (r) => warByDate.get(r.d) ?? 0, cell: (r) => (warByDate.has(r.d) ? fmtWar(warByDate.get(r.d)!) : t.none) },
      ];
      return c;
    }
    const c: Col<PitGame>[] = [
      { key: 'd', label: t.date, num: (r) => r.d, cell: (r) => fmtMd(r.d), align: 'left' },
      { key: 'opp', label: t.opp, num: (r) => r.opp, cell: oppCell, align: 'left' },
      { key: 'ip', label: PL.ip, num: (r) => r.outs, cell: (r) => fmtIp(r.outs) },
      { key: 'h', label: en ? 'H' : '安打', num: (r) => r.h, cell: (r) => `${r.h}` },
      { key: 'er', label: en ? 'ER' : '自責', num: (r) => r.er, cell: (r) => `${r.er}` },
      { key: 'so', label: PL.so, num: (r) => r.so, cell: (r) => `${r.so}` },
      { key: 'bb', label: en ? 'BB' : '四球', num: (r) => r.bb, cell: (r) => `${r.bb}` },
      { key: 'hr', label: en ? 'HR' : '被弾', num: (r) => r.hr, cell: (r) => `${r.hr}` },
      { key: 'dec', label: t.result, num: (r) => (r.w ? 2 : r.l ? 1 : 0), cell: (r) => (r.w ? t.win : r.l ? t.loss : t.none) },
      { key: 'war', label: t.gameWar, num: (r) => warByDate.get(r.d) ?? 0, cell: (r) => (warByDate.has(r.d) ? fmtWar(warByDate.get(r.d)!) : t.none) },
    ];
    return c;
  }, [mode, en, t, HL, PL, warByDate]);

  // 表示用にソート（型は緩めて扱う＝列の num で取り出した値で比較）。
  const sortedRows = useMemo(() => {
    const rows = [...filtered] as Array<HitGame | PitGame>;
    const col = (cols as Array<Col<HitGame | PitGame>>).find((c) => c.key === sort.key);
    if (!col) return rows;
    rows.sort((a, b) => {
      const va = col.num(a);
      const vb = col.num(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filtered, cols, sort]);

  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'd' ? 'desc' : 'desc' }));

  // WAR：headline＝公式の今季累計（warHistory 最新点）。推移＝1試合ごとの推定の積み上がり（末尾＝公式値）。
  // 選択期間の増分＝その mode の per-game 推定の合計（＝表の推定WAR列の和・絞り込みと完全一致）。
  const warLatest = log.warHistory.at(-1);
  const warT = warLatest ? warTotal(warLatest) : null;
  const warSpanEst = useMemo(
    () => (filter.kind === 'all' ? null : filtered.reduce((s, r) => s + (warByDate.get(r.d) ?? 0), 0)),
    [filter.kind, filtered, warByDate],
  );

  // ── 画像出力（クライアント canvas・モノクロのサマリカード） ──
  const saveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    drawCard(canvas, {
      title: en ? log.player.nameEn : log.player.nameJa,
      subtitle: `${mode === 'hitting' ? t.batting : t.pitching} · ${fLabel} · ${t.asOf(log.asOf)}`,
      cols: [t.colPeriod, t.colSeason, t.colProj],
      rows: summary,
      war: warT != null ? `WAR ${warT.toFixed(1)}${warLatest && warLatest.warHit != null && warLatest.warPit != null ? `  (${en ? 'P' : '投'}${warLatest.warPit.toFixed(1)} / ${en ? 'B' : '打'}${warLatest.warHit.toFixed(1)})` : ''}` : '',
      badge: paceInfo.chase ?? '',
      site: 'matome-mlb-kaigai.jp',
    });
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const slug = filter.kind === 'all' ? 'season' : filter.kind === 'last' ? `last${filter.n}` : `m${filter.m}`;
        a.href = url;
        a.download = `${log.player.nameEn.replace(/\s+/g, '-').toLowerCase()}-${mode}-${slug}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setBusy(false);
    }, 'image/png');
  };

  const chip = (active: boolean) =>
    `rounded-[2px] border px-3 py-1.5 text-xs tabular-nums transition-colors ${
      active ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft hover:border-ink hover:text-ink'
    }`;

  return (
    <section className="space-y-4" aria-label={t.heading}>
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-base font-bold tracking-wide text-ink sm:text-lg">{t.heading}</h2>
          {/* 節目バッジ（50本ペース等）は“結論ファースト”で見出し直下に。触る作業の前に読んで驚く入口。該当時のみ。 */}
          {paceInfo.chase && (
            <span className="rounded-[2px] border border-ink px-2 py-0.5 text-xs font-bold text-ink">{paceInfo.chase}</span>
          )}
        </div>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{t.sub}</p>
      </div>

      {/* モード切替（打撃 / 投球）＝二刀流（両分野あり）だけ。純投手/純打者は単一モード固定で出さない。 */}
      {twoWay && (
        <div className="inline-flex overflow-hidden rounded-[2px] border border-line">
          {(['hitting', 'pitching'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setFilter({ kind: 'all' }); setSort({ key: 'd', dir: 'desc' }); }}
              className={`min-h-[40px] px-5 text-sm font-semibold transition-colors ${
                mode === m ? 'bg-ink text-paper' : 'bg-paper text-ink-soft hover:text-ink'
              }`}
              aria-pressed={mode === m}
            >
              {m === 'hitting' ? t.batting : t.pitching}
            </button>
          ))}
        </div>
      )}

      {/* 期間フィルタ。 */}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(filter.kind === 'all')} onClick={() => setFilter({ kind: 'all' })}>{t.all}</button>
        {lastNs.map((n) => (
          <button key={n} type="button" className={chip(filter.kind === 'last' && filter.n === n)} onClick={() => setFilter({ kind: 'last', n })}>
            {en ? `Last ${n}` : `直近${n}`}
          </button>
        ))}
        {months.map((m) => (
          <button key={m} type="button" className={chip(filter.kind === 'month' && filter.m === m)} onClick={() => setFilter({ kind: 'month', m })}>
            {t.month(m)}
          </button>
        ))}
      </div>

      {/* サマリ3列。 */}
      <div className="overflow-x-auto rounded-[2px] border border-line">
        <table className="w-full min-w-[420px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-ink-mute">
              <th className="px-3 py-2 text-left font-medium"> </th>
              <th className="px-3 py-2 text-right font-semibold text-ink">{t.colPeriod}</th>
              <th className="px-3 py-2 text-right font-medium">{t.colSeason}</th>
              <th className="px-3 py-2 text-right font-medium">{t.colProj}</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((r) => (
              <tr key={r.label} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2 text-left text-ink-soft">{r.label}</td>
                <td className="px-3 py-2 text-right font-bold text-ink">{r.vals[0]}</td>
                <td className="px-3 py-2 text-right text-ink-soft">{r.vals[1]}</td>
                <td className="px-3 py-2 text-right text-ink-soft">{r.vals[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ③ 節目・ペース（chase は SNS カードの見出しにも使う）。 */}
      <div className="rounded-[2px] border border-line p-4">
        <h3 className="text-sm font-bold text-ink">{t.pace}</h3>
        <ul className="mt-2 space-y-1 text-sm tabular-nums text-ink-soft">
          {paceInfo.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      {/* WAR 推移。1試合ごとの推定WARの積み上がり（末尾＝公式季節値に一致）。 */}
      <div className="rounded-[2px] border border-line p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-ink">{t.warTitle}</h3>
          {warT != null && (
            <span className="text-sm tabular-nums text-ink">
              <span className="text-lg font-bold">{warT.toFixed(1)}</span>
              {/* 投/打 内訳は二刀流のみ（単一分野は総計＝その分野値なので内訳を出さない）。 */}
              {warLatest && warLatest.warHit != null && warLatest.warPit != null && (
                <span className="ml-1.5 text-xs text-ink-mute">
                  {en ? 'P' : '投'}{warLatest.warPit.toFixed(1)} / {en ? 'B' : '打'}{warLatest.warHit.toFixed(1)}
                </span>
              )}
            </span>
          )}
        </div>
        {est.cumulative.length >= 2 ? (
          <>
            <WarSparkline points={est.cumulative.map((c) => c.cum)} />
            <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-ink-mute">{t.warNote}</p>
            {warSpanEst != null && (
              <p className="mt-1 text-xs text-ink-mute">
                {t.warDelta}（{mode === 'hitting' ? (en ? 'B' : '打') : en ? 'P' : '投'}）:{' '}
                <span className="font-semibold text-ink-soft tabular-nums">{fmtWar(warSpanEst)}</span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-ink-mute">{t.warStart(log.warHistory[0]?.d ?? log.asOf.slice(0, 10))}</p>
        )}
      </div>

      {/* 試合別テーブル（列ヘッダのクリックでソート・推定WAR列・行から海外の反応へ送客）。 */}
      {articles && coveredCount > 0 && <p className="text-xs text-ink-mute">{t.covered(coveredCount)}</p>}
      <div className="overflow-x-auto rounded-[2px] border border-line">
        <table className="w-full min-w-[560px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-ink-mute">
              {(cols as Array<Col<HitGame | PitGame>>).map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-2.5 py-2 font-medium ${c.align === 'left' ? 'text-left' : 'text-right'}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={`inline-flex min-h-[40px] items-center gap-0.5 hover:text-ink ${c.align === 'left' ? '' : 'flex-row-reverse'}`}
                  >
                    {c.label}
                    {/* ソート可能のアフォーダンスを常時可視に（未選択=ink-mute・選択=ink）。絵文字▲▼→caret SVG。 */}
                    <svg
                      viewBox="0 0 12 12"
                      aria-hidden
                      className={`h-2 w-2 fill-current transition-transform ${sort.key === c.key ? 'text-ink' : 'text-ink-mute'} ${sort.key === c.key && sort.dir === 'asc' ? 'rotate-180' : ''}`}
                    >
                      <path d="M6 8.5 2 4.5h8z" />
                    </svg>
                  </button>
                </th>
              ))}
              {articles && <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium">{t.watchGame}</th>}
            </tr>
          </thead>
          <tbody>
            {(sortedRows as Array<HitGame | PitGame>).map((r, i) => {
              const article = articles?.[r.d];
              return (
                <tr key={`${r.d}-${i}`} className={`border-b border-line/50 last:border-0 ${article ? 'bg-ink/[0.02]' : ''}`}>
                  {(cols as Array<Col<HitGame | PitGame>>).map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-2.5 py-1.5 ${c.align === 'left' ? 'text-left text-ink-soft' : 'text-right text-ink'}`}
                    >
                      {c.cell(r)}
                    </td>
                  ))}
                  {articles && (
                    <td className="whitespace-nowrap px-2.5 py-1 text-right">
                      {article ? (
                        // 試合ページへ遷移＝矢印アイコンのみ（北東矢印＝外部遷移の含意）。ラベルは aria のみ・実効36pxの正方タップ域。
                        <Link
                          href={`/${article.sport}/${article.id}`}
                          aria-label={t.watchGame}
                          className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[2px] border border-line text-ink-soft transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth={2} aria-hidden>
                            <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      ) : (
                        <span className="text-ink-mute">{t.none}</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ② スプリット（ホーム/ビジター・二刀流の登板日/非登板日・対戦相手別）。 */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-ink">{t.splits}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-ink-mute">{t.home} / {t.away}</p>
            <MiniStatTable groups={venueSplit} rows={splitRows} />
          </div>
          {twoWaySplit && (
            <div>
              <p className="mb-1 text-xs text-ink-mute">{t.twoWay}</p>
              <MiniStatTable groups={twoWaySplit} rows={splitRows} />
            </div>
          )}
        </div>
        <details className="group rounded-[2px] border border-line">
          <summary className="flex min-h-[40px] cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {t.vsTeam}
            <span aria-hidden className="text-ink-soft transition-transform group-open:rotate-180"><Chevron /></span>
          </summary>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[420px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-xs text-ink-mute">
                  <th className="px-3 py-2 text-left font-medium">{t.opp}</th>
                  {splitRows.map((s) => (
                    <th key={s.label} className="px-3 py-2 text-right font-medium">{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byOpp.map((o) => (
                  <tr key={o.opp} className="border-b border-line/50 last:border-0">
                    <td className="whitespace-nowrap px-3 py-1.5 text-left text-ink-soft">{o.opp}</td>
                    {splitRows.map((s) => (
                      <td key={s.label} className="px-3 py-1.5 text-right text-ink">{s.get(o.agg)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      {/* 画像出力。 */}
      <div>
        <button
          type="button"
          onClick={saveImage}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[2px] border border-ink bg-ink px-5 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
        >
          {busy ? t.saving : t.save}
        </button>
        <canvas ref={canvasRef} width={1200} height={760} className="hidden" />
      </div>
    </section>
  );
}

/** スプリット比較の小表（列＝グループ・行＝指標）。型は呼び出し側の Agg に従う（any を避ける）。 */
function MiniStatTable<A>({ groups, rows }: { groups: { label: string; agg: A }[]; rows: { label: string; get: (a: A) => string }[] }) {
  return (
    <div className="overflow-x-auto rounded-[2px] border border-line">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line text-xs text-ink-mute">
            <th className="px-3 py-2 text-left font-medium"> </th>
            {groups.map((g) => (
              <th key={g.label} className="px-3 py-2 text-right font-semibold text-ink">{g.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line/60 last:border-0">
              <td className="px-3 py-2 text-left text-ink-soft">{r.label}</td>
              {groups.map((g) => (
                <td key={g.label} className="px-3 py-2 text-right text-ink">{r.get(g.agg)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 推移をモノクロの簡易ラインで（SVG・依存なし）。points は時系列の累積値。 */
function WarSparkline({ points: pts }: { points: number[] }) {
  const W = 600;
  const H = 80;
  const pad = 6;
  const max = Math.max(...pts);
  const min = Math.min(...pts, 0);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-20 w-full" preserveAspectRatio="none" role="img" aria-label="WAR trend">
      <path d={d} fill="none" stroke="#191A1C" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r={2.5} fill="#191A1C" />
    </svg>
  );
}

/** サマリカードを canvas に描く（白地・無彩色・送客ウォーターマーク）。 */
function drawCard(
  canvas: HTMLCanvasElement,
  d: { title: string; subtitle: string; cols: [string, string, string]; rows: SummaryRow[]; war: string; badge: string; site: string },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const PAPER = '#FAFAF9';
  const INK = '#191A1C';
  const SOFT = '#565659';
  const MUTE = '#97979B';
  const LINE = '#E7E6E3';
  const SANS = '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const padX = 60;
  // タイトル
  ctx.fillStyle = INK;
  ctx.font = `700 46px ${SANS}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(d.title, padX, 86);
  ctx.fillStyle = SOFT;
  ctx.font = `400 24px ${SANS}`;
  ctx.fillText(d.subtitle, padX, 126);
  // 節目バッジ（50本ペース等）を右上に太字で（SNSで一目で伝わる見出し）。
  if (d.badge) {
    ctx.font = `700 28px ${SANS}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.fillText(d.badge, W - padX, 86);
    ctx.textAlign = 'left';
  }
  // 題字罫（サイト唯一の赤の一点はここでは使わず無彩色で締める）
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, 150);
  ctx.lineTo(W - padX, 150);
  ctx.stroke();

  // 列ヘッダ（右3列）
  const colX = [W - padX - 420, W - padX - 210, W - padX];
  ctx.font = `600 22px ${SANS}`;
  ctx.fillStyle = MUTE;
  ctx.textAlign = 'right';
  d.cols.forEach((c, i) => ctx.fillText(c, colX[i], 196));
  ctx.textAlign = 'left';

  // 行
  let y = 240;
  const rowH = 44;
  for (const r of d.rows) {
    ctx.fillStyle = SOFT;
    ctx.font = `400 24px ${SANS}`;
    ctx.fillText(r.label, padX, y);
    ctx.textAlign = 'right';
    r.vals.forEach((v, i) => {
      ctx.fillStyle = i === 0 ? INK : MUTE;
      ctx.font = `${i === 0 ? 700 : 400} 24px ${SANS}`;
      ctx.fillText(v, colX[i], y);
    });
    ctx.textAlign = 'left';
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + 14);
    ctx.lineTo(W - padX, y + 14);
    ctx.stroke();
    y += rowH;
  }

  // WAR
  if (d.war) {
    ctx.fillStyle = INK;
    ctx.font = `700 28px ${SANS}`;
    ctx.fillText(d.war, padX, y + 30);
  }
  // ウォーターマーク（送客）
  ctx.fillStyle = MUTE;
  ctx.font = `500 22px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText(d.site, W - padX, H - 32);
  ctx.textAlign = 'left';
}
