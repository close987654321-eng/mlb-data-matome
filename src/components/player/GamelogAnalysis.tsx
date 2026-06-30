'use client';

import { useMemo, useRef, useState } from 'react';
import type { Gamelog, HitGame, PitGame } from '@/lib/gamelog';
import {
  aggHitting, aggPitching, projectHitting, projectPitching,
  warTotal, warGain, fmtRate, fmt2, fmt1, fmtIp, fmtMd, monthOf,
  type HitAgg, type PitAgg,
} from '@/lib/gamelogStats';

type Mode = 'hitting' | 'pitching';
type Filter = { kind: 'all' } | { kind: 'last'; n: number } | { kind: 'month'; m: number };
type SortDir = 'asc' | 'desc';

/** サマリ1行＝指標ラベル＋[選択期間, 今季累計, 162換算]の整形済み文字列。画像出力でも同じ配列を使う。 */
type SummaryRow = { label: string; vals: [string, string, string] };
/** 表の列定義。num はソート値の取り出し、cell は表示。 */
type Col<R> = { key: string; label: string; num: (r: R) => number | string; cell: (r: R) => string; align?: 'left' };

const LAST_NS = [5, 10, 15, 20, 25, 30];

export default function GamelogAnalysis({ log, locale }: { log: Gamelog; locale: string }) {
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
      }
    : {
        heading: '徹底分析（試合別）', sub: '直近の試合数や月で絞り込み。率はカウント数から再計算、162換算は今季ペースからの推計です。',
        batting: '打撃', pitching: '投球', all: '全期間', month: (m: number) => `${m}月`,
        colPeriod: '選択期間', colSeason: '今季累計', colProj: '162換算',
        warTitle: 'WAR推移', warStart: (d: string) => `${d}に追跡開始。ここから1試合ぶんずつ推移が積み上がります。`,
        warGain: '選択期間のWAR増分（近似）', warNA: '—', save: 'この内容を画像で保存', saving: '生成中…',
        date: '日付', opp: '対戦', result: '結果', win: '勝', loss: '敗', none: '—', asOf: (d: string) => `${d}時点`,
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

  const [mode, setMode] = useState<Mode>('hitting');
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: 'd', dir: 'desc' });
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const baseRows = mode === 'hitting' ? log.hitting : log.pitching;
  const months = useMemo(() => [...new Set(baseRows.map((r) => monthOf(r.d)))].sort((a, b) => a - b), [baseRows]);
  const lastNs = LAST_NS.filter((n) => n < baseRows.length);

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
      return [
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
    return [
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
  }, [mode, filtered, log, HL, PL]);

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
    ];
    return c;
  }, [mode, en, t, HL, PL]);

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

  // WAR：最新点＝今季累計、推移、選択期間の増分（近似）。
  const warLatest = log.warHistory.at(-1);
  const warT = warLatest ? warTotal(warLatest) : null;
  const warSpan =
    filter.kind !== 'all' && filtered.length > 0
      ? warGain(log.warHistory, filtered[0].d, filtered[filtered.length - 1].d)
      : null;

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
      war: warT != null ? `WAR ${warT.toFixed(1)}${warLatest ? `  (${en ? 'P' : '投'}${(warLatest.warPit ?? 0).toFixed(1)} / ${en ? 'B' : '打'}${(warLatest.warHit ?? 0).toFixed(1)})` : ''}` : '',
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
        <h2 className="text-base font-bold tracking-wide text-ink sm:text-lg">{t.heading}</h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{t.sub}</p>
      </div>

      {/* モード切替（打撃 / 投球）。 */}
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

      {/* WAR 推移。APIは累計しか返さないため、自前で日次に積み上げた近似系列。 */}
      <div className="rounded-[2px] border border-line p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-ink">{t.warTitle}</h3>
          {warT != null && (
            <span className="text-sm tabular-nums text-ink">
              <span className="text-lg font-bold">{warT.toFixed(1)}</span>
              {warLatest && (
                <span className="ml-1.5 text-xs text-ink-mute">
                  {en ? 'P' : '投'}{(warLatest.warPit ?? 0).toFixed(1)} / {en ? 'B' : '打'}{(warLatest.warHit ?? 0).toFixed(1)}
                </span>
              )}
            </span>
          )}
        </div>
        {log.warHistory.length >= 2 ? (
          <>
            <WarSparkline history={log.warHistory} />
            {filter.kind !== 'all' && (
              <p className="mt-2 text-xs text-ink-mute">
                {t.warGain}: <span className="font-semibold text-ink-soft tabular-nums">{warSpan == null ? t.warNA : `${warSpan >= 0 ? '+' : ''}${warSpan.toFixed(1)}`}</span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-ink-mute">{t.warStart(log.warHistory[0]?.d ?? log.asOf.slice(0, 10))}</p>
        )}
      </div>

      {/* 試合別テーブル（列ヘッダのクリックでソート）。 */}
      <div className="overflow-x-auto rounded-[2px] border border-line">
        <table className="w-full min-w-[560px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-ink-mute">
              {(cols as Array<Col<HitGame | PitGame>>).map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-2.5 py-2 font-medium ${c.align === 'left' ? 'text-left' : 'text-right'}`}
                >
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-0.5 hover:text-ink">
                    {c.label}
                    <span aria-hidden className={`text-[9px] ${sort.key === c.key ? 'text-ink' : 'text-transparent'}`}>
                      {sort.key === c.key && sort.dir === 'asc' ? '▲' : '▼'}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sortedRows as Array<HitGame | PitGame>).map((r, i) => (
              <tr key={`${r.d}-${i}`} className="border-b border-line/50 last:border-0">
                {(cols as Array<Col<HitGame | PitGame>>).map((c) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-2.5 py-1.5 ${c.align === 'left' ? 'text-left text-ink-soft' : 'text-right text-ink'}`}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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

/** 累計WARの推移をモノクロの簡易ラインで（SVG・依存なし）。 */
function WarSparkline({ history }: { history: Gamelog['warHistory'] }) {
  const pts = [...history].sort((a, b) => a.d.localeCompare(b.d)).map((p) => warTotal(p));
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
  d: { title: string; subtitle: string; cols: [string, string, string]; rows: SummaryRow[]; war: string; site: string },
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
