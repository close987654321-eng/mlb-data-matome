'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

/** SNS シェア用カードの形（縦長=フィード映え / 正方=万能）と実ピクセル。 */
type CardFormat = 'portrait' | 'square';
const CARD_DIMS: Record<CardFormat, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
};
/** 画像カードに描く厳選データ（ページの全項目表とは別＝SNSで映える主役＋6指標に絞る）。 */
type CardData = {
  name: string; nameEn: string; meta: string; badge: string;
  hero: { value: string; label: string; note: string };
  hero2: { value: string; label: string };
  grid: { label: string; value: string }[];
  war: string; warSplit: string; site: string; tagline: string;
};

export default function GamelogAnalysis({
  log,
  locale,
  articles,
  shareUrl,
}: {
  log: Gamelog;
  locale: string;
  articles?: Record<string, ArticleRef>;
  /** この選手ハブの正規URL。シェア用の投稿文（コピー）に入れて送客する。 */
  shareUrl?: string;
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
        warGain: 'WAR in this span (approx)', warNA: '—', save: 'Save image', saving: 'Rendering…',
        share: 'Share', copyText: 'Copy caption', copied: 'Copied',
        shareHeading: 'Share as an image', shareSub: 'A clean stat card for X, Instagram or your blog — narrow the period above and the card follows. Tap to share or save.',
        fmtPortrait: 'Portrait', fmtSquare: 'Square', period: 'Period', lastGroup: 'Recent', monthGroup: 'By month', tagline: 'Overseas reactions, in Japanese',
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
        warGain: '選択期間のWAR増分（近似）', warNA: '—', save: '画像を保存', saving: '生成中…',
        share: 'シェアする', copyText: '投稿文をコピー', copied: 'コピーしました',
        shareHeading: '成績カードを画像でシェア', shareSub: 'X・インスタ・ブログにそのまま使える成績カード。上で期間を絞ると、その期間のカードになります。タップで共有／保存。',
        fmtPortrait: '縦長', fmtSquare: '正方形', period: '期間', lastGroup: '直近', monthGroup: '月別', tagline: '海外の反応まとめ',
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
  const [format, setFormat] = useState<CardFormat>('portrait');
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ネイティブ共有（モバイル＝OSのシェアシートにファイルを渡せる）か。ボタン文言と挙動を分岐。
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

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

  // 期間 select の値⇄Filter（"all" / "last:N" / "month:M"）。
  const filterValue = filter.kind === 'all' ? 'all' : filter.kind === 'last' ? `last:${filter.n}` : `month:${filter.m}`;
  const applyFilterValue = (v: string) => {
    if (v.startsWith('last:')) setFilter({ kind: 'last', n: Number(v.slice(5)) });
    else if (v.startsWith('month:')) setFilter({ kind: 'month', m: Number(v.slice(6)) });
    else setFilter({ kind: 'all' });
  };

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

  // ── SNS シェア用カード（ページの全項目表とは別＝主役数字＋162換算/節目＋6指標＋WAR に厳選） ──
  const cardData = useMemo<CardData>(() => {
    const site = 'matome-mlb-kaigai.jp';
    const name = en ? log.player.nameEn : log.player.nameJa;
    const meta = `${mode === 'hitting' ? t.batting : t.pitching} · ${fLabel} · ${t.asOf(log.asOf)}`;
    const badge = paceInfo.chase ?? '';
    const war = warT != null ? warT.toFixed(1) : '';
    const warSplit =
      warLatest && warLatest.warHit != null && warLatest.warPit != null
        ? `${en ? 'P' : '投'}${warLatest.warPit.toFixed(1)} / ${en ? 'B' : '打'}${warLatest.warHit.toFixed(1)}`
        : '';
    const base = { name, nameEn: log.player.nameEn, meta, badge, war, warSplit, site, tagline: t.tagline };
    if (mode === 'hitting') {
      const p = aggHitting(filtered as HitGame[]);
      const j = projectHitting(aggHitting(log.hitting), log.teamGames);
      return {
        ...base,
        hero: { value: `${p.hr}`, label: HL.hr, note: en ? `162-pace ${j.hr}` : `162換算 ${j.hr}本` },
        hero2: { value: fmtRate(p.ops), label: HL.ops },
        grid: [
          { label: HL.avg, value: fmtRate(p.avg) },
          { label: HL.obp, value: fmtRate(p.obp) },
          { label: HL.slg, value: fmtRate(p.slg) },
          { label: HL.h, value: `${p.h}` },
          { label: HL.rbi, value: `${p.rbi}` },
          { label: HL.sb, value: `${p.sb}` },
        ],
      };
    }
    const p = aggPitching(filtered as PitGame[]);
    return {
      ...base,
      hero: { value: fmt2(p.era), label: PL.era, note: `WHIP ${fmt2(p.whip)}` },
      hero2: { value: `${p.so}`, label: PL.so },
      grid: [
        { label: PL.ip, value: fmtIp(p.outs) },
        { label: PL.k9, value: fmt1(p.k9) },
        { label: PL.kbb, value: fmt1(p.kbb) },
        { label: PL.wl, value: `${p.w}-${p.l}` },
        { label: PL.hr, value: `${p.hr}` },
        { label: PL.bb, value: `${p.bb}` },
      ],
    };
  }, [mode, filtered, log, en, t, HL, PL, fLabel, paceInfo.chase, warT, warLatest]);

  // 投稿文（コピー用）＝主役指標＋ハッシュタグ＋ハブURL（[[x-promotion-workflow]] の本文＋リンク）。
  const caption = useMemo(() => {
    const year = log.season;
    const heroLine =
      mode === 'hitting'
        ? en
          ? `${HL.hr} ${cardData.hero.value} (${cardData.hero.note}) · ${HL.ops} ${cardData.hero2.value}`
          : `${HL.hr} ${cardData.hero.value}（${cardData.hero.note}）・${HL.ops} ${cardData.hero2.value}`
        : en
          ? `${PL.era} ${cardData.hero.value} · ${PL.so} ${cardData.hero2.value}`
          : `${PL.era} ${cardData.hero.value}・${PL.so} ${cardData.hero2.value}`;
    const tag = (en ? log.player.nameEn : log.player.nameJa).replace(/[\s・]/g, '');
    const head = en
      ? `${log.player.nameEn} ${year} — ${heroLine}${cardData.war ? ` · WAR ${cardData.war}` : ''}`
      : `${log.player.nameJa} ${year}｜${heroLine}${cardData.war ? ` ・WAR ${cardData.war}` : ''}`;
    return [head, `#MLB #${tag}`, shareUrl].filter(Boolean).join('\n');
  }, [mode, cardData, HL, PL, en, log, shareUrl]);

  // プレビュー＝状態変化のたびに描き直す（見たままがそのまま保存／共有される）。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = CARD_DIMS[format];
    canvas.width = w;
    canvas.height = h;
    drawCard(canvas, cardData, format);
  }, [cardData, format]);

  const cardFileName = () => {
    const slug = filter.kind === 'all' ? 'season' : filter.kind === 'last' ? `last${filter.n}` : `m${filter.m}`;
    return `${log.player.nameEn.replace(/\s+/g, '-').toLowerCase()}-${mode}-${slug}.png`;
  };
  const drawNow = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const { w, h } = CARD_DIMS[format];
    canvas.width = w;
    canvas.height = h;
    drawCard(canvas, cardData, format);
    return canvas;
  };
  // 保存（ダウンロード）。
  const saveImage = () => {
    const canvas = drawNow();
    if (!canvas) return;
    setBusy(true);
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cardFileName();
        a.click();
        URL.revokeObjectURL(url);
      }
      setBusy(false);
    }, 'image/png');
  };
  // ネイティブ共有（モバイル）。iOS は transient activation を要求＝toDataURL を同期取得して File を作り、
  // ユーザー操作の文脈を保ったまま share する（toBlob の非同期コールバックだと活性が切れて失敗するため）。
  const shareImage = async () => {
    const canvas = drawNow();
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const [head, b64] = dataUrl.split(',');
      const mime = head.match(/:(.*?);/)?.[1] ?? 'image/png';
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], cardFileName(), { type: mime });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
        return;
      }
    } catch {
      return; // キャンセル／共有不可は尊重して終了（保存に勝手に倒さない）
    }
    saveImage(); // files 共有自体が不可なら保存にフォールバック
  };
  const onPrimaryShare = () => (canShare ? shareImage() : saveImage());
  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* クリップボード不可（古い環境）は黙って無視 */
    }
  };

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

      {/* 期間フィルタ＝optgroup付きネイティブ select（項目が増えても伸びない・モバイルはネイティブピッカー）。 */}
      <div className="flex items-center gap-2">
        <label htmlFor="gl-period" className="text-xs font-medium text-ink-mute">{t.period}</label>
        <div className="relative inline-block">
          <select
            id="gl-period"
            value={filterValue}
            onChange={(e) => applyFilterValue(e.target.value)}
            className="min-h-[40px] appearance-none rounded-[2px] border border-line bg-paper py-2 pl-3 pr-9 text-sm font-medium text-ink transition-colors hover:border-ink focus:border-ink focus:outline-none"
          >
            <option value="all">{t.all}</option>
            {lastNs.length > 0 && (
              <optgroup label={t.lastGroup}>
                {lastNs.map((n) => (
                  <option key={n} value={`last:${n}`}>{en ? `Last ${n}` : `直近${n}試合`}</option>
                ))}
              </optgroup>
            )}
            {months.length > 0 && (
              <optgroup label={t.monthGroup}>
                {months.map((m) => (
                  <option key={m} value={`month:${m}`}>{t.month(m)}</option>
                ))}
              </optgroup>
            )}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft">
            <Chevron />
          </span>
        </div>
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

      {/* 画像でシェア＝プレビューを見て即 共有/保存。期間 select を絞ればその期間のカードになる。 */}
      <div className="space-y-4 rounded-[2px] border border-line p-4">
        <div>
          <h3 className="text-sm font-bold text-ink">{t.shareHeading}</h3>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{t.shareSub}</p>
        </div>

        {/* 形（縦長 / 正方形）。 */}
        <div className="inline-flex overflow-hidden rounded-[2px] border border-line">
          {(['portrait', 'square'] as CardFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`min-h-[36px] px-4 text-xs font-semibold transition-colors ${
                format === f ? 'bg-ink text-paper' : 'bg-paper text-ink-soft hover:text-ink'
              }`}
              aria-pressed={format === f}
            >
              {f === 'portrait' ? t.fmtPortrait : t.fmtSquare}
            </button>
          ))}
        </div>

        {/* プレビュー（実物）＋操作。 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <canvas
            ref={canvasRef}
            width={1080}
            height={1350}
            aria-label={t.shareHeading}
            className="block h-auto w-full max-w-[260px] self-center rounded-[2px] border border-line sm:self-start"
          />
          <div className="flex w-full flex-col gap-2 sm:max-w-[220px]">
            <button
              type="button"
              onClick={onPrimaryShare}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-ink bg-ink px-5 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
            >
              {busy ? t.saving : canShare ? t.share : t.save}
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} aria-hidden>
                {canShare ? (
                  <path d="M12 15V4M8 8l4-4 4 4M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M12 4v11M8 11l4 4 4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
            <button
              type="button"
              onClick={copyCaption}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-line px-5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              {copied ? t.copied : t.copyText}
              {!copied && (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth={2} aria-hidden>
                  <rect x="9" y="9" width="11" height="11" rx="1.5" />
                  <path d="M5 15V5a1 1 0 011-1h9" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
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

/**
 * SNS 用の成績カードを canvas に描く（白地・無彩色・編集的レイアウト）。
 * 構成＝ヘッダ(名前/メタ＋右上に節目バッジ) → 題字罫 → 主役の大数字＋162換算/note と右に第2指標
 * → 6指標グリッド(3×2) → WAR バンド → フッタ(ドメイン＋タグライン)。縦長/正方の双方に収まる縦フロー。
 * ブランド規律＝赤は使わない（[[design-system-monochrome]]：カードは無彩色で締める）。
 */
function drawCard(canvas: HTMLCanvasElement, d: CardData, format: CardFormat) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const portrait = format === 'portrait';
  const PAPER = '#FAFAF9';
  const INK = '#191A1C';
  const SOFT = '#565659';
  const MUTE = '#97979B';
  const LINE = '#E7E6E3';
  const SANS = '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const padX = 72;
  const right = W - padX;

  // ── ヘッダ：選手名（幅に収まるよう自動縮小）＋ English ＋ メタ
  let nameSize = 78;
  const maxNameW = W - padX * 2 - 170; // 右上の節目バッジ分を空ける
  ctx.font = `800 ${nameSize}px ${SANS}`;
  while (ctx.measureText(d.name).width > maxNameW && nameSize > 38) {
    nameSize -= 2;
    ctx.font = `800 ${nameSize}px ${SANS}`;
  }
  ctx.fillStyle = INK;
  ctx.fillText(d.name, padX, 152);
  let metaY: number;
  if (d.name !== d.nameEn) {
    ctx.fillStyle = MUTE;
    ctx.font = `500 30px ${SANS}`;
    ctx.fillText(d.nameEn, padX, 196);
    metaY = 240;
  } else {
    metaY = 204;
  }
  ctx.fillStyle = SOFT;
  ctx.font = `400 27px ${SANS}`;
  ctx.fillText(d.meta, padX, metaY);

  // 節目バッジ（50本ペース等）を右上に枠つきで。
  if (d.badge) {
    ctx.font = `800 30px ${SANS}`;
    const bw = ctx.measureText(d.badge).width;
    const bh = 54;
    const by = 92;
    const bx = right - bw - 24;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 18, by, bw + 36, bh);
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.fillText(d.badge, bx, by + bh / 2 + 2);
    ctx.textBaseline = 'alphabetic';
  }

  // 題字罫（無彩色で締める）。
  const ruleY = metaY + 34;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(padX, ruleY);
  ctx.lineTo(right, ruleY);
  ctx.stroke();

  // ── 主役：大きな数字＋ラベル＋note、右に第2指標。
  const heroTop = ruleY + (portrait ? 64 : 44);
  ctx.fillStyle = MUTE;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText(d.hero.label, padX, heroTop + 6);
  const heroSize = portrait ? 188 : 152;
  const heroBaseline = heroTop + heroSize * 0.78;
  ctx.fillStyle = INK;
  ctx.font = `800 ${heroSize}px ${SANS}`;
  ctx.fillText(d.hero.value, padX - 4, heroBaseline);
  ctx.fillStyle = SOFT;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText(d.hero.note, padX, heroBaseline + 46);
  // 第2指標（右揃え）。
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = `800 76px ${SANS}`;
  ctx.fillText(d.hero2.value, right, heroBaseline - 6);
  ctx.fillStyle = MUTE;
  ctx.font = `600 28px ${SANS}`;
  ctx.fillText(d.hero2.label, right, heroBaseline + 32);
  ctx.textAlign = 'left';

  // ── 6指標グリッド（3列×2行）。
  const gridTop = heroBaseline + (portrait ? 116 : 92);
  const cols = 3;
  const colW = (W - padX * 2) / cols;
  const rowH = portrait ? 148 : 130;
  d.grid.forEach((item, i) => {
    const cx = padX + (i % cols) * colW;
    const ry = gridTop + Math.floor(i / cols) * rowH;
    ctx.fillStyle = INK;
    ctx.font = `800 56px ${SANS}`;
    ctx.fillText(item.value, cx, ry + 56);
    ctx.fillStyle = MUTE;
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText(item.label, cx, ry + 92);
  });
  const gridBottom = gridTop + 2 * rowH;

  // ── WAR バンド（罫の下に大きく＋投/打内訳）。
  if (d.war) {
    const wy = gridBottom + 16;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, wy);
    ctx.lineTo(right, wy);
    ctx.stroke();
    ctx.fillStyle = SOFT;
    ctx.font = `700 32px ${SANS}`;
    ctx.fillText('WAR', padX, wy + 66);
    ctx.fillStyle = INK;
    ctx.font = `800 64px ${SANS}`;
    ctx.fillText(d.war, padX + 100, wy + 72);
    const warW = ctx.measureText(d.war).width;
    if (d.warSplit) {
      ctx.fillStyle = MUTE;
      ctx.font = `500 28px ${SANS}`;
      ctx.fillText(d.warSplit, padX + 100 + warW + 24, wy + 68);
    }
  }

  // ── フッタ（下部固定）：題字罫＋ドメイン（送客）＋タグライン。
  const footRule = H - 96;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, footRule);
  ctx.lineTo(right, footRule);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `700 28px ${SANS}`;
  ctx.fillText(d.site, padX, footRule + 46);
  ctx.textAlign = 'right';
  ctx.fillStyle = MUTE;
  ctx.font = `500 25px ${SANS}`;
  ctx.fillText(d.tagline, right, footRule + 46);
  ctx.textAlign = 'left';
}
