'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/lib/navigation';
import { track } from '@/lib/analytics';
import Chevron from '@/components/Chevron';
import { getTeam, headshotUrl, teamLogoUrl } from '@/lib/teams';
import { SANS, hexToRgba, teamField, teamAccent, lightenHex, roundRectPath, drawLogoBadge } from '@/lib/cardCanvas';
import type { Gamelog, HitGame, PitGame } from '@/lib/gamelog';
import {
  aggHitting, aggPitching, projectHitting, projectPitching,
  warTotal, estimateGameWar, fmtWar, fmtRate, fmt2, fmt1, fmtIp, fmtMd, monthOf, etToJst,
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

/** SNS シェア用カードの形（縦長=フィード映え / 正方=万能 / ワイド=X 4枚投稿の2×2グリッド向け）と実ピクセル。 */
type CardFormat = 'portrait' | 'square' | 'wide';
const CARD_DIMS: Record<CardFormat, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  wide: { w: 1600, h: 800 }, // X(Twitter)4枚＝2×2タイル比(約2:1)。横長の専用レイアウトで描く
};
/** 画像カードに描くデータ。主役＝選手名/写真/ロゴ/期間。成績は強弱なしの均等グリッド（村山指示）。 */
type CardData = {
  name: string; nameEn: string;
  // 期間ロックアップ＝カード最大の見せ場。英語表記（Toppsカード調・村山指示）。eyebrow=年, head=期間。
  periodEyebrow: string; // 2026
  periodHead: string; // THIS SEASON / LAST 10 GAMES / JUNE
  modeLabel: string; // 打撃 / 投球
  teamName: string; // ドジャース / Dodgers（ロゴ脇の所属表記）
  asOf: string;
  grid: { label: string; value: string }[]; // 9指標を均等サイズで並べる
  site: string; tagline: string;
};
const MONTHS_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
/** カードの装飾レイヤー（顔写真・チームロゴ・チーム色・役割＝投手/打者のシルエット選択）。 */
type CardArt = { headImg: HTMLImageElement | null; logoImg: HTMLImageElement | null; teamColor: string; role: Mode };

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
        share: 'Share', copyText: 'Copy caption', copyImg: 'Copy image', copied: 'Copied',
        shareHeading: 'Share as an image', shareSub: 'A clean stat card for X, Instagram or your blog. Pick the period and format below — the card follows live.',
        shareCta: 'Make a share card', close: 'Close',
        fmtPortrait: 'Portrait', fmtSquare: 'Square', fmtWide: 'X 4-up', period: 'Period', lastGroup: 'Recent', monthGroup: 'By month', tagline: 'Overseas reactions, in Japanese',
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
        share: 'シェアする', copyText: '投稿文をコピー', copyImg: '画像をコピー', copied: 'コピーしました',
        shareHeading: '成績カードを画像でシェア', shareSub: 'X・インスタ・ブログにそのまま使える成績カード。期間と形を選ぶと、その場でカードが変わります。',
        shareCta: '成績カードを作る', close: '閉じる',
        fmtPortrait: '縦長', fmtSquare: '正方形', fmtWide: 'X4枚', period: '期間', lastGroup: '直近', monthGroup: '月別', tagline: '海外の反応まとめ',
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
  const [imgCopied, setImgCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [canCopyImg, setCanCopyImg] = useState(false);
  const [shareOpen, setShareOpen] = useState(false); // 成績カードのシェア＝モーダル（期間と連動・本文末尾でなく即起動）。
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ネイティブ共有（モバイル＝OSのシェアシートにファイルを渡せる）か／画像をクリップボードへ直接書けるか。
  // 後者は「画像をコピー」ボタンの出し分け＝コピーで1枚を保証する正規ルート（共有シートの「コピー」に頼らない）。
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    setCanCopyImg(
      typeof navigator !== 'undefined' &&
        !!navigator.clipboard &&
        typeof navigator.clipboard.write === 'function' &&
        typeof window !== 'undefined' &&
        typeof window.ClipboardItem === 'function',
    );
  }, []);

  // シェアカードの装飾＝所属チームの色/ロゴ＋選手の顔写真。すべて MLB公式CDN（CORS可＝crossOrigin で
  // 読み込めば canvas を汚染せず toBlob/toDataURL が通る）。チーム未解決時は無彩色で素のカードに自然縮退。
  const team = getTeam(log.team);
  const teamColor = team?.color ?? '#191A1C';
  const headUrl = headshotUrl(log.player.id, 'portrait');
  const logoUrl = team ? teamLogoUrl(team.id) : null;
  const [headImg, setHeadImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    const load = (src: string) =>
      new Promise<HTMLImageElement | null>((res) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => res(im);
        im.onerror = () => res(null); // 失敗時は無し＝カードは描ける（顔/ロゴだけ欠落）
        im.src = src;
      });
    load(headUrl).then((im) => { if (alive) setHeadImg(im); });
    if (logoUrl) load(logoUrl).then((im) => { if (alive) setLogoImg(im); });
    return () => { alive = false; };
  }, [headUrl, logoUrl]);

  const baseRows = mode === 'hitting' ? log.hitting : log.pitching;
  const months = useMemo(() => [...new Set(baseRows.map((r) => monthOf(etToJst(r.d))))].sort((a, b) => a - b), [baseRows]);
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
    if (filter.kind === 'month') return baseRows.filter((r) => monthOf(etToJst(r.d)) === filter.m);
    return baseRows;
  }, [baseRows, filter]);

  const filterLabel = filter.kind === 'all' ? t.all : filter.kind === 'last' ? `直近${filter.n}試合` : t.month(filter.m);
  const filterLabelEn = filter.kind === 'all' ? t.all : filter.kind === 'last' ? `Last ${filter.n} games` : t.month(filter.m);
  const fLabel = en ? filterLabelEn : filterLabel;

  // 期間 select の値⇄Filter（"all" / "last:N" / "month:M"）。
  const filterValue = filter.kind === 'all' ? 'all' : filter.kind === 'last' ? `last:${filter.n}` : `month:${filter.m}`;
  const applyFilterValue = (v: string) => {
    if (v.startsWith('last:')) setFilter({ kind: 'last', n: Number(v.slice(5)) });
    else if (v.startsWith('month:')) setFilter({ kind: 'month', m: Number(v.slice(6)) });
    else setFilter({ kind: 'all' });
  };

  // カードメーカー＝モーダルを開く唯一の入口（このセクションの CTA・ヒーローのボタン・記事からの
  // #card ディープリンク）。開いた瞬間を card_open として計測し、source で流入元を分ける＝発見導線の効きを見る。
  const openShare = (source: string) => {
    setShareOpen(true);
    track('card_open', { player: log.player.nameEn, mode, period: filterValue, format, source });
  };
  // 最新 state を読む openShare をリスナから呼ぶための ref（mount 一度きりの購読でも値が陳腐化しない）。
  const openShareRef = useRef(openShare);
  openShareRef.current = openShare;
  // ヒーローの「成績カードを作る」（同ページ＝カスタムイベント）と、記事 CTA からの /player/{slug}#card
  // （別ページ＝ハッシュ）の両方からモーダルを開く。発見導線とループの着地を同じ口に集約する。
  useEffect(() => {
    if (window.location.hash === '#card') openShareRef.current('deeplink');
    const onOpen = (e: Event) => openShareRef.current(((e as CustomEvent).detail as string) || 'cta');
    window.addEventListener('mlb:open-card', onOpen);
    return () => window.removeEventListener('mlb:open-card', onOpen);
  }, []);

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
        { key: 'd', label: t.date, num: (r) => r.d, cell: (r) => fmtMd(etToJst(r.d)), align: 'left' },
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
      { key: 'd', label: t.date, num: (r) => r.d, cell: (r) => fmtMd(etToJst(r.d)), align: 'left' },
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

  // ── SNS シェア用カード。主役＝選手名/写真/ロゴ/期間。成績は強弱なしの均等9グリッド（村山指示）。 ──
  const cardData = useMemo<CardData>(() => {
    const site = 'matome-mlb-kaigai.jp';
    const name = en ? log.player.nameEn : log.player.nameJa;
    const war = warT != null ? warT.toFixed(1) : '—';
    const tm = getTeam(log.team);
    // 期間ヘッドライン＝英語（All→THIS SEASON / Last→LAST N GAMES / Month→月名）。
    const periodHead =
      filter.kind === 'all' ? 'THIS SEASON'
      : filter.kind === 'last' ? `LAST ${filter.n} GAMES`
      : (MONTHS_EN[filter.m - 1] ?? `MONTH ${filter.m}`);
    const base = {
      name,
      nameEn: log.player.nameEn,
      periodEyebrow: String(log.season),
      periodHead,
      modeLabel: mode === 'hitting' ? t.batting : t.pitching,
      teamName: en ? (tm?.nameEn ?? '') : (log.team ?? ''),
      asOf: t.asOf(log.asOf),
      site,
      tagline: t.tagline,
    };
    if (mode === 'hitting') {
      const p = aggHitting(filtered as HitGame[]);
      return {
        ...base,
        grid: [
          { label: HL.avg, value: fmtRate(p.avg) },
          { label: HL.hr, value: `${p.hr}` },
          { label: HL.rbi, value: `${p.rbi}` },
          { label: HL.obp, value: fmtRate(p.obp) },
          { label: HL.slg, value: fmtRate(p.slg) },
          { label: HL.ops, value: fmtRate(p.ops) },
          { label: HL.h, value: `${p.h}` },
          { label: HL.sb, value: `${p.sb}` },
          { label: 'WAR', value: war },
        ],
      };
    }
    const p = aggPitching(filtered as PitGame[]);
    return {
      ...base,
      grid: [
        { label: PL.era, value: fmt2(p.era) },
        { label: PL.ip, value: fmtIp(p.outs) },
        { label: PL.so, value: `${p.so}` },
        { label: PL.whip, value: fmt2(p.whip) },
        { label: en ? 'W' : '勝', value: `${p.w}` },
        { label: en ? 'L' : '敗', value: `${p.l}` },
        { label: PL.k9, value: fmt1(p.k9) },
        { label: PL.kbb, value: fmt1(p.kbb) },
        { label: 'WAR', value: war },
      ],
    };
  }, [mode, filtered, filter, log, en, t, HL, PL, warT]);

  // 投稿文（コピー用）＝期間＋主要指標＋ハッシュタグ＋ハブURL（[[x-promotion-workflow]] の本文＋リンク）。
  const caption = useMemo(() => {
    const year = log.season;
    let line: string;
    if (mode === 'hitting') {
      const p = aggHitting(filtered as HitGame[]);
      line = en
        ? `${HL.hr} ${p.hr} · ${HL.avg} ${fmtRate(p.avg)} · ${HL.ops} ${fmtRate(p.ops)}`
        : `${HL.hr} ${p.hr}・${HL.avg} ${fmtRate(p.avg)}・${HL.ops} ${fmtRate(p.ops)}`;
    } else {
      const p = aggPitching(filtered as PitGame[]);
      line = en
        ? `${PL.era} ${fmt2(p.era)} · ${PL.so} ${p.so} · ${PL.whip} ${fmt2(p.whip)}`
        : `${PL.era} ${fmt2(p.era)}・${PL.so} ${p.so}・${PL.whip} ${fmt2(p.whip)}`;
    }
    const warStr = warT != null ? (en ? ` · WAR ${warT.toFixed(1)}` : `・WAR ${warT.toFixed(1)}`) : '';
    const tag = (en ? log.player.nameEn : log.player.nameJa).replace(/[\s・]/g, '');
    const head = en
      ? `${log.player.nameEn} ${year} (${fLabel}) — ${line}${warStr}`
      : `${log.player.nameJa} ${year}（${fLabel}）｜${line}${warStr}`;
    // 投稿文のリンクにだけ UTM を付ける（カード経由の来訪を GA4 で見分ける＝③の計測）。画像に焼く
    // フッターURL（drawCard 側）は素のドメインのまま＝印字なので UTM を付けても意味がなく見栄えも崩す。
    const shareLink = shareUrl
      ? `${shareUrl}${shareUrl.includes('?') ? '&' : '?'}utm_source=card&utm_medium=image&utm_campaign=player_card`
      : undefined;
    // 投稿文（コピー用）＝ハッシュタグ＋UTM付きURL。画像のネイティブ共有には text を一切渡さない
    // （iOS は files＋text を一緒に渡すと共有シートの「コピー」でクリップボードに画像が2枚乗るため）。送客は
    // 「画像をコピー」(画像のみ)＋「投稿文をコピー」(このテキスト) の2ボタンに分離して担保する。
    const body = [head, `#MLB #${tag}`].join('\n');
    return shareLink ? `${body}\n${shareLink}` : body;
  }, [mode, filtered, en, log, HL, PL, fLabel, warT, shareUrl]);

  // プレビュー＝状態変化（データ・形・読み込んだ画像）のたびに描き直す（見たままがそのまま保存／共有される）。
  // canvas はモーダル内にのみ存在するので shareOpen も依存に入れる（開いた瞬間にマウント→描画）。
  useEffect(() => {
    if (!shareOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = CARD_DIMS[format];
    canvas.width = w;
    canvas.height = h;
    drawCard(canvas, cardData, format, { headImg, logoImg, teamColor, role: mode });
  }, [shareOpen, cardData, format, headImg, logoImg, teamColor, mode]);

  // モーダル中は Esc で閉じる＋背面スクロールをロック。
  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShareOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [shareOpen]);

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
    drawCard(canvas, cardData, format, { headImg, logoImg, teamColor, role: mode });
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
        // text は渡さない＝iOS 共有シートの「コピー」で画像が2枚クリップボードに乗るのを防ぐ。投稿文は別ボタン。
        await navigator.share({ files: [file] });
        return;
      }
    } catch {
      return; // キャンセル／共有不可は尊重して終了（保存に勝手に倒さない）
    }
    saveImage(); // files 共有自体が不可なら保存にフォールバック
  };
  const onPrimaryShare = () => {
    // 「出す」操作の発火＝②シェア率の分子（method でネイティブ共有/保存を分ける）。OS シェアシート上の
    // キャンセルは全環境で確実に検知できないため、意思＝ボタン押下を計測する（実運用で十分な近似）。
    track('card_share', { player: log.player.nameEn, mode, period: filterValue, format, method: canShare ? 'share' : 'save' });
    return canShare ? shareImage() : saveImage();
  };
  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      track('card_copy', { player: log.player.nameEn, mode, period: filterValue, format });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* クリップボード不可（古い環境）は黙って無視 */
    }
  };
  // 画像だけをクリップボードに置く＝コピー＝1枚を保証（共有シート経由でなく直接書き込み）。Safari は
  // user gesture を維持するため ClipboardItem に Blob の Promise を渡す（toBlob が非同期でも活性が切れない）。
  const copyImage = async () => {
    const canvas = drawNow();
    if (!canvas) return;
    try {
      const item = new ClipboardItem({
        'image/png': new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
        }),
      });
      await navigator.clipboard.write([item]);
      setImgCopied(true);
      track('card_copy_image', { player: log.player.nameEn, mode, period: filterValue, format });
      setTimeout(() => setImgCopied(false), 1800);
    } catch {
      saveImage(); // 画像クリップボード不可な環境は保存にフォールバック
    }
  };

  return (
    <section id="card" className="scroll-mt-24 space-y-4" aria-label={t.heading}>
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

      {/* 期間フィルタ。カード生成の入口は選手ページ上部のボタン（MakeCardButton）に一本化したので
          ここには置かない（イベント mlb:open-card / #card で同じモーダルが開く）。 */}
      <div className="flex flex-wrap items-center gap-2">
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
                  <option key={n} value={`last:${n}`}>{en ? `Last ${n} games` : `直近${n}試合`}</option>
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

      {/* 成績カードのシェア＝モーダル（期間 select は本文上部とモーダル内の両方から操作・状態は共有）。
          開いた瞬間に canvas がマウントされ、見たままがそのまま保存／共有される。 */}
      {shareOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.shareHeading}
          onClick={() => setShareOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm sm:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-md rounded-[2px] border border-line bg-paper p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink">{t.shareHeading}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-mute">{t.shareSub}</p>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                aria-label={t.close}
                className="shrink-0 rounded-[2px] border border-line p-2 text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 期間（連動・カードが即変わる）＋形（縦長/正方形）。 */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="relative inline-block">
                <select
                  aria-label={t.period}
                  value={filterValue}
                  onChange={(e) => applyFilterValue(e.target.value)}
                  className="min-h-[40px] appearance-none rounded-[2px] border border-line bg-paper py-2 pl-3 pr-9 text-sm font-medium text-ink transition-colors hover:border-ink focus:border-ink focus:outline-none"
                >
                  <option value="all">{t.all}</option>
                  {lastNs.length > 0 && (
                    <optgroup label={t.lastGroup}>
                      {lastNs.map((n) => (
                        <option key={n} value={`last:${n}`}>{en ? `Last ${n} games` : `直近${n}試合`}</option>
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
              <div className="inline-flex overflow-hidden rounded-[2px] border border-line">
                {(['portrait', 'square', 'wide'] as CardFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`min-h-[40px] px-4 text-xs font-semibold transition-colors ${
                      format === f ? 'bg-ink text-paper' : 'bg-paper text-ink-soft hover:text-ink'
                    }`}
                    aria-pressed={format === f}
                  >
                    {f === 'portrait' ? t.fmtPortrait : f === 'square' ? t.fmtSquare : t.fmtWide}
                  </button>
                ))}
              </div>
            </div>

            {/* プレビュー（実物）＋操作。 */}
            <div className="mt-4 flex flex-col items-center gap-4">
              <canvas
                ref={canvasRef}
                width={CARD_DIMS[format].w}
                height={CARD_DIMS[format].h}
                aria-label={t.shareHeading}
                className="block h-auto w-full max-w-[300px] rounded-[2px] border border-line"
              />
              <div className="flex w-full max-w-[300px] flex-col gap-2">
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
                {canCopyImg && (
                  <button
                    type="button"
                    onClick={copyImage}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-line px-5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
                  >
                    {imgCopied ? t.copied : t.copyImg}
                    {!imgCopied && (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth={2} aria-hidden>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="9" r="1.6" />
                        <path d="M21 15l-5-5L6 20" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )}
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
        </div>
      )}
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
 * SNS 用の成績カードを canvas に描く＝「拡散したくなる」プレミアム1枚（Toppsカードの質感が狙い）。
 * 構図＝右にフチなしの顔写真（ドロップシャドウ＋背後グローで浮かせる）／左に積み上げ大見出しの選手名／
 * 最上段に最も目立つ期間ロックアップ（英語・ガラス調グラデ＋斜めハッチ＋シーンの“透過レイヤー重ね”）／
 * 下段に均等3×3の成績ブロック（一回り大きく）。背景はチーム色を“色を残したまま”暗く正規化した地
 * （teamField＝黄も水色も黒も白文字が映える色つきに）＋斜めスイープ＋役割シルエットの透かし。
 * モノクロ規律の例外＝オフサイトのSNS素材としてチーム色を主役に使う（運営合意・[[design-system-monochrome]]）。
 * 画像は MLB公式CDN（CORS可）を crossOrigin で読むので canvas は汚染されない（保存/共有が通る）。
 */
function drawCard(canvas: HTMLCanvasElement, d: CardData, format: CardFormat, art: CardArt) {
  if (format === 'wide') { drawCardWide(canvas, d, art); return; } // X4枚＝横長の専用レイアウト
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // letterSpacing（eyebrow用）＝Chrome99+/Safari16.4+ で有効。未対応環境では no-op に縮退（型は交差で付与）。
  const ctxLS = ctx as CanvasRenderingContext2D & { letterSpacing: string };
  const W = canvas.width;
  const H = canvas.height;
  const portrait = format === 'portrait';
  const wht = (a: number) => `rgba(255,255,255,${a})`;
  const team = art.teamColor || '#191A1C';
  const acc = teamAccent(team);
  const fx = 30;

  ctx.clearRect(0, 0, W, H);
  // ── 背景：チーム色を“色つきのまま暗く”した地の縦グラデ＋斜めスイープ＋役割シルエットの透かし。
  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, teamField(team, 0.25));
  bg.addColorStop(1, teamField(team, 0.15));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.moveTo(W * 0.44, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.16, H); ctx.closePath();
  ctx.fillStyle = hexToRgba(teamField(team, 0.31), 0.55); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W * 0.52, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.28, H); ctx.closePath();
  ctx.fillStyle = hexToRgba(acc, 0.1); ctx.fill();
  drawAthlete(ctx, fx + 230, H * (portrait ? 0.68 : 0.66), H * (portrait ? 0.42 : 0.46), art.role, hexToRgba(acc, 0.08));

  // ── 顔写真（右・フチなし＝ドロップシャドウ＋背後グローで浮かせる。村山指示で枠/白線は撤去）。
  const pw = portrait ? 452 : 372;
  const ph = Math.round(pw * 1.5);
  const px = W - fx - pw - 6;
  const py = portrait ? 150 : 116;
  const pgx = px + pw * 0.5;
  const pgy = py + ph * 0.4;
  const rg = ctx.createRadialGradient(pgx, pgy, 0, pgx, pgy, pw * 0.8);
  rg.addColorStop(0, hexToRgba(acc, 0.3));
  rg.addColorStop(1, hexToRgba(acc, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(px - 140, py - 90, pw + 280, ph + 180);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  roundRectPath(ctx, px, py, pw, ph, 8);
  ctx.fillStyle = '#0E0F11';
  ctx.fill();
  ctx.restore();
  if (art.headImg) drawPortrait(ctx, art.headImg, px, py, pw, ph);
  else { roundRectPath(ctx, px, py, pw, ph, 8); ctx.fillStyle = teamField(team, 0.3); ctx.fill(); }

  // ── カード外周フレーム（“1枚もの”の収まり）。
  roundRectPath(ctx, fx, fx, W - fx * 2, H - fx * 2, 8);
  ctx.lineWidth = 2;
  ctx.strokeStyle = wht(0.14);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const colMaxW = px - 28 - (fx + 30); // 左カラム（写真左端まで）の使える幅。

  // ── 期間ロックアップ（最大の見せ場）＝箱なしのエディトリアル調（村山「モダンでスマート・洗練」）。
  // eyebrow（年・字間広め・アクセント色）→ headline（期間・白の大見出し）→ 細いルール（左にチーム色の短い区間）。
  const bx = fx + 30;
  const by = portrait ? 150 : 120;
  const ebSize = portrait ? 23 : 20;
  const accLt = lightenHex(acc, 0.18);
  let hSize = portrait ? 58 : 50;
  ctxLS.letterSpacing = '1px';
  ctx.font = `800 ${hSize}px ${SANS}`;
  while (ctx.measureText(d.periodHead).width > colMaxW && hSize > 34) { hSize -= 2; ctx.font = `800 ${hSize}px ${SANS}`; }
  const headW = ctx.measureText(d.periodHead).width;
  // eyebrow（年）＝字間広めの小さなキッカー。
  const ebY = by + ebSize;
  ctxLS.letterSpacing = '6px';
  ctx.fillStyle = accLt;
  ctx.font = `700 ${ebSize}px ${SANS}`;
  ctx.fillText(d.periodEyebrow, bx, ebY);
  // headline（期間）＝白の大見出し。
  const hY = ebY + 22 + hSize - 6;
  ctxLS.letterSpacing = '1px';
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${hSize}px ${SANS}`;
  ctx.fillText(d.periodHead, bx, hY);
  ctxLS.letterSpacing = '0px';
  // 細いルール＋左端のチーム色アクセント区間（洗練の決め手）。
  const ruleY = hY + 24;
  const ruleW = Math.max(headW, portrait ? 300 : 260);
  ctx.fillStyle = wht(0.22);
  ctx.fillRect(bx, ruleY, ruleW, 2);
  ctx.fillStyle = accLt;
  ctx.fillRect(bx, ruleY - 0.5, 64, 3);
  const bannerBottom = ruleY + 2;

  // ── 選手名＝姓/名を積み上げた大見出し（空白・中黒で2分割できる時）。長い・1語は1行で自動縮小。
  // nameBottomY＝名前ブロックの最下ベースライン（=ロゴ列を直下に重ねず置くためのアンカー）。
  const parts = d.name.split(/[\s・]/).filter(Boolean);
  const nameTop = bannerBottom + (portrait ? 116 : 96);
  let nameBottomY: number;
  if (parts.length === 2) {
    let ns = portrait ? 98 : 80;
    ctx.font = `800 ${ns}px ${SANS}`;
    while (Math.max(ctx.measureText(parts[0]).width, ctx.measureText(parts[1]).width) > colMaxW && ns > 48) {
      ns -= 4; ctx.font = `800 ${ns}px ${SANS}`;
    }
    ctx.fillStyle = '#fff';
    ctx.fillText(parts[0], fx + 30, nameTop);
    ctx.fillText(parts[1], fx + 30, nameTop + ns + 2);
    nameBottomY = nameTop + ns + 2;
    if (d.name !== d.nameEn) {
      nameBottomY += portrait ? 44 : 38;
      ctx.fillStyle = wht(0.62);
      ctx.font = `500 ${portrait ? 27 : 24}px ${SANS}`;
      ctx.fillText(d.nameEn, fx + 34, nameBottomY);
    }
  } else {
    let ns = portrait ? 74 : 62;
    ctx.font = `800 ${ns}px ${SANS}`;
    while (ctx.measureText(d.name).width > colMaxW && ns > 36) { ns -= 2; ctx.font = `800 ${ns}px ${SANS}`; }
    ctx.fillStyle = '#fff';
    ctx.fillText(d.name, fx + 30, nameTop);
    nameBottomY = nameTop;
    if (d.name !== d.nameEn) {
      nameBottomY += portrait ? 50 : 44;
      ctx.fillStyle = wht(0.62);
      ctx.font = `500 ${portrait ? 27 : 24}px ${SANS}`;
      ctx.fillText(d.nameEn, fx + 34, nameBottomY);
    }
  }

  // ── ロゴバッジ＋所属＋asOf（名前ブロックの“下”に確実に置く＝重なり防止）。
  const badgeR = portrait ? 52 : 46;
  const logoCY = nameBottomY + (portrait ? 28 : 24) + badgeR;
  const metaX = fx + 30 + badgeR * 2 + 18;
  if (art.logoImg) {
    drawLogoBadge(ctx, art.logoImg, fx + 30 + badgeR, logoCY, badgeR);
    ctx.fillStyle = wht(0.78);
    ctx.font = `600 ${portrait ? 27 : 24}px ${SANS}`;
    if (d.teamName) ctx.fillText(d.teamName, metaX, logoCY - 8);
    ctx.fillStyle = wht(0.5);
    ctx.font = `400 ${portrait ? 23 : 21}px ${SANS}`;
    ctx.fillText(`${d.modeLabel}・${d.asOf}`, metaX, logoCY + 28);
  } else {
    ctx.fillStyle = wht(0.5);
    ctx.font = `400 ${portrait ? 23 : 21}px ${SANS}`;
    ctx.fillText(`${d.modeLabel}・${d.asOf}`, fx + 30, logoCY);
  }

  // ── 成績ブロック（均等3×3・強弱なし）＝半透明パネル＋アクセント線。一回り大きく（村山指示）。
  const bandX = fx + 24;
  const bandW = W - fx * 2 - 48;
  const bandH = portrait ? 408 : 300;
  const bandY = H - bandH - (portrait ? 118 : 92); // フッタ（URL/タグライン）と被らないよう一段持ち上げ
  roundRectPath(ctx, bandX, bandY, bandW, bandH, 10);
  ctx.fillStyle = wht(0.055);
  ctx.fill();
  roundRectPath(ctx, bandX, bandY, 130, 5, 2.5);
  ctx.fillStyle = acc;
  ctx.fill();
  // 数値ベースライン基準で3段を組む＝パネル内に確実に収める（村山「枠から数字がはみ出ている」修正）。
  // 村山「もう一回り大きく」でエリア・文字とも拡大（パネル360→408・数値64→74・ラベル26→28px）。
  const cols = 3;
  const cw = bandW / cols;
  const valSize = portrait ? 74 : 56;
  const labSize = portrait ? 28 : 24;
  const rowPitch = portrait ? 116 : 88;
  const vTop = portrait ? 88 : 64; // 1段目の数値ベースライン
  const labGap = portrait ? 40 : 34;
  ctx.textAlign = 'center';
  d.grid.forEach((item, i) => {
    const cx = bandX + (i % cols) * cw + cw / 2;
    const vy = bandY + vTop + Math.floor(i / cols) * rowPitch;
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${valSize}px ${SANS}`;
    ctx.fillText(item.value, cx, vy);
    ctx.fillStyle = wht(0.52);
    ctx.font = `600 ${labSize}px ${SANS}`;
    ctx.fillText(item.label, cx, vy + labGap);
  });
  ctx.textAlign = 'left';

  // ── フッタ：ドメイン（送客）＋タグライン。
  ctx.fillStyle = wht(0.82);
  ctx.font = `700 ${portrait ? 26 : 24}px ${SANS}`;
  ctx.fillText(d.site, fx + 30, H - 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = wht(0.45);
  ctx.font = `500 ${portrait ? 23 : 21}px ${SANS}`;
  ctx.fillText(d.tagline, W - fx - 24, H - 44);
  ctx.textAlign = 'left';
}

/**
 * 選手成績カード＝ワイド（X 4枚投稿の2×2タイル向け・1600×800）。右にフチなし顔写真、左に期間バナー＋
 * 選手名＋ロゴ＋3×3 の成績グリッドを横長に組み替える。色・図形・法務 posture は縦長/正方と同じ。
 * グリッドは行ピッチ適応式でフッタと被らないよう枠内に必ず収める。
 */
function drawCardWide(canvas: HTMLCanvasElement, d: CardData, art: CardArt) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ctxLS = ctx as CanvasRenderingContext2D & { letterSpacing: string };
  const W = canvas.width; // 1600
  const H = canvas.height; // 800
  const wht = (a: number) => `rgba(255,255,255,${a})`;
  const team = art.teamColor || '#191A1C';
  const acc = teamAccent(team);
  const accLt = lightenHex(acc, 0.18);
  const fx = 30;

  ctx.clearRect(0, 0, W, H);
  // ── 背景：チーム色の地＋斜めスイープ＋役割シルエットの透かし。
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, teamField(team, 0.25));
  bg.addColorStop(1, teamField(team, 0.15));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.moveTo(W * 0.5, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.34, H); ctx.closePath();
  ctx.fillStyle = hexToRgba(teamField(team, 0.31), 0.55); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W * 0.6, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.46, H); ctx.closePath();
  ctx.fillStyle = hexToRgba(acc, 0.1); ctx.fill();
  drawAthlete(ctx, W * 0.74, H * 0.6, H * 0.72, art.role, hexToRgba(acc, 0.07));

  // ── 顔写真（右・フチなし＝ドロップシャドウ＋背後グロー）。
  const pw = 470;
  const ph = Math.round(pw * 1.5);
  const px = W - fx - pw - 8;
  const py = 48;
  const pgx = px + pw * 0.5;
  const pgy = py + ph * 0.4;
  const rg = ctx.createRadialGradient(pgx, pgy, 0, pgx, pgy, pw * 0.8);
  rg.addColorStop(0, hexToRgba(acc, 0.3));
  rg.addColorStop(1, hexToRgba(acc, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(px - 140, py - 80, pw + 280, ph + 160);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  roundRectPath(ctx, px, py, pw, ph, 8);
  ctx.fillStyle = '#0E0F11';
  ctx.fill();
  ctx.restore();
  if (art.headImg) drawPortrait(ctx, art.headImg, px, py, pw, ph);
  else { roundRectPath(ctx, px, py, pw, ph, 8); ctx.fillStyle = teamField(team, 0.3); ctx.fill(); }

  // ── 外周フレーム。
  roundRectPath(ctx, fx, fx, W - fx * 2, H - fx * 2, 8);
  ctx.lineWidth = 2;
  ctx.strokeStyle = wht(0.14);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const bx = fx + 30;
  const colMaxW = px - 28 - bx;

  // ── 期間バナー（eyebrow=年 / head=期間 / 細いルール）。
  ctxLS.letterSpacing = '6px';
  ctx.fillStyle = accLt;
  ctx.font = `700 23px ${SANS}`;
  ctx.fillText(d.periodEyebrow, bx, 112);
  let hSize = 48;
  ctxLS.letterSpacing = '1px';
  ctx.font = `800 ${hSize}px ${SANS}`;
  while (ctx.measureText(d.periodHead).width > colMaxW && hSize > 30) { hSize -= 2; ctx.font = `800 ${hSize}px ${SANS}`; }
  const headBaseline = 112 + 24 + hSize - 6;
  ctx.fillStyle = '#fff';
  ctx.fillText(d.periodHead, bx, headBaseline);
  ctxLS.letterSpacing = '0px';
  const ruleY = headBaseline + 20;
  ctx.fillStyle = wht(0.22);
  ctx.fillRect(bx, ruleY, Math.max(ctx.measureText(d.periodHead).width, 280), 2);
  ctx.fillStyle = accLt;
  ctx.fillRect(bx, ruleY - 0.5, 60, 3);

  // ── 選手名（姓/名を積む or 1行）＋EN サブ。
  const parts = d.name.split(/[\s・]/).filter(Boolean);
  const nameTop = ruleY + 76;
  let nameBottom: number;
  if (parts.length === 2) {
    let ns = 76;
    ctx.font = `800 ${ns}px ${SANS}`;
    while (Math.max(ctx.measureText(parts[0]).width, ctx.measureText(parts[1]).width) > colMaxW && ns > 44) { ns -= 4; ctx.font = `800 ${ns}px ${SANS}`; }
    ctx.fillStyle = '#fff';
    ctx.fillText(parts[0], bx, nameTop);
    ctx.fillText(parts[1], bx, nameTop + ns + 2);
    nameBottom = nameTop + ns + 2;
  } else {
    let ns = 66;
    ctx.font = `800 ${ns}px ${SANS}`;
    while (ctx.measureText(d.name).width > colMaxW && ns > 36) { ns -= 2; ctx.font = `800 ${ns}px ${SANS}`; }
    ctx.fillStyle = '#fff';
    ctx.fillText(d.name, bx, nameTop);
    nameBottom = nameTop;
  }
  if (d.name !== d.nameEn) {
    nameBottom += 34;
    ctx.fillStyle = wht(0.62);
    ctx.font = `500 24px ${SANS}`;
    ctx.fillText(d.nameEn, bx + 2, nameBottom);
  }

  // ── ロゴ＋所属＋mode/asOf。
  const badgeR = 38;
  const logoCY = nameBottom + 22 + badgeR;
  if (art.logoImg) {
    drawLogoBadge(ctx, art.logoImg, bx + badgeR, logoCY, badgeR);
    const mx = bx + badgeR * 2 + 16;
    ctx.fillStyle = wht(0.78);
    ctx.font = `600 23px ${SANS}`;
    if (d.teamName) ctx.fillText(d.teamName, mx, logoCY - 6);
    ctx.fillStyle = wht(0.5);
    ctx.font = `400 20px ${SANS}`;
    ctx.fillText(`${d.modeLabel}・${d.asOf}`, mx, logoCY + 22);
  } else {
    ctx.fillStyle = wht(0.5);
    ctx.font = `400 20px ${SANS}`;
    ctx.fillText(`${d.modeLabel}・${d.asOf}`, bx, logoCY);
  }

  // ── 成績グリッド（3×3・均等）。行ピッチ適応＝フッタ手前まで等分し枠内に必ず収める。
  const gx = bx;
  const gw = colMaxW;
  const cols = 3;
  const cw = gw / cols;
  const footerY = H - 40;
  const gTop = logoCY + badgeR + 20;
  const rowPitch = ((footerY - 26) - gTop) / 3;
  const valSize = Math.min(54, Math.round(rowPitch * 0.62));
  ctx.textAlign = 'center';
  d.grid.forEach((item, i) => {
    const cx = gx + (i % cols) * cw + cw / 2;
    const vy = gTop + Math.floor(i / cols) * rowPitch + valSize;
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${valSize}px ${SANS}`;
    ctx.fillText(item.value, cx, vy);
    ctx.fillStyle = wht(0.52);
    ctx.font = `600 22px ${SANS}`;
    ctx.fillText(item.label, cx, vy + 28);
  });
  ctx.textAlign = 'left';

  // ── フッタ：ドメイン（送客）＋タグライン。
  ctx.fillStyle = wht(0.82);
  ctx.font = `700 24px ${SANS}`;
  ctx.fillText(d.site, bx, H - 40);
  ctx.textAlign = 'right';
  ctx.fillStyle = wht(0.45);
  ctx.font = `500 21px ${SANS}`;
  ctx.fillText(d.tagline, W - fx - 24, H - 40);
  ctx.textAlign = 'left';
}

/**
 * 役割シルエット（共通の図）。hitting=打者のスイング／pitching=投手の投球フォーム。
 * 太い丸キャップのカプセル（=四肢）＋極太の胴カプセル＋頭の円を“重ねて連続した塊”に合成する
 * （多角形の自己交差で崩れず、参考画像のような塗りシルエットになる）。座標は 300×360 の図を正規化。
 */
function drawAthlete(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, role: Mode, rgba: string) {
  const NW = 300;
  const NH = 360;
  const s = h / NH;
  const ox = cx - (NW * s) / 2;
  const oy = cy - (NH * s) / 2;
  ctx.save();
  ctx.strokeStyle = rgba;
  ctx.fillStyle = rgba;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cap = (x1: number, y1: number, x2: number, y2: number, w: number) => {
    ctx.lineWidth = w * s;
    ctx.beginPath();
    ctx.moveTo(ox + x1 * s, oy + y1 * s);
    ctx.lineTo(ox + x2 * s, oy + y2 * s);
    ctx.stroke();
  };
  const circ = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(ox + x * s, oy + y * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  };
  const ell = (x: number, y: number, rx: number, ry: number, rot: number) => {
    ctx.beginPath();
    ctx.ellipse(ox + x * s, oy + y * s, rx * s, ry * s, (rot * Math.PI) / 180, 0, Math.PI * 2);
    ctx.fill();
  };
  if (role === 'hitting') {
    // 右向き・フォロースルー（バットを右上へ振り抜き）。
    cap(150, 206, 192, 260, 27); cap(192, 260, 214, 322, 19); ell(214, 326, 15, 9, 20); // 前脚
    cap(150, 206, 112, 256, 27); cap(112, 256, 80, 318, 19); ell(80, 322, 15, 9, -20); // 後脚
    cap(162, 120, 150, 208, 44); // 胴（極太）
    cap(164, 124, 182, 100, 19); cap(182, 100, 190, 86, 16); cap(168, 128, 184, 104, 19); // 腕
    cap(186, 86, 264, 46, 11); // バット
    cap(160, 118, 180, 92, 18); circ(184, 86, 25); cap(196, 80, 224, 72, 12); // 首・頭・つば
  } else {
    // 左向き・広いストライドの投球（投げ腕を右後上へコック）。
    cap(166, 194, 104, 232, 27); cap(104, 232, 46, 298, 19); ell(44, 302, 15, 9, -15); // 前脚（大きく踏み出す）
    cap(166, 194, 208, 246, 27); cap(208, 246, 238, 300, 19); ell(240, 304, 15, 9, 18); // 軸脚
    cap(178, 126, 166, 196, 44); // 胴
    cap(172, 130, 116, 150, 19); cap(116, 150, 96, 176, 16); // グラブ腕
    cap(184, 128, 238, 148, 19); cap(238, 148, 250, 106, 16); circ(250, 100, 8); // 投げ腕＋ボール
    cap(178, 124, 182, 92, 18); circ(182, 86, 25); cap(170, 80, 142, 72, 12); // 首・頭・つば
  }
  ctx.restore();
}

/** 顔写真を縦長長方形（一覧と同じ 2:3）で額装する＝object-top の cover フィットで顔のカット感を消す。
 * フレーム/シャドウは呼び出し側で描く（ここはクリップした写真本体のみ）。 */
function drawPortrait(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 8);
  ctx.fillStyle = '#0E0F11';
  ctx.fill();
  ctx.clip();
  const scale = Math.max(w / iw, h / ih); // cover
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y, dw, dh); // 上揃え＝頭を切らない
  ctx.restore();
}
