'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { track } from '@/lib/analytics';
import type { BdReelStock, BdReelSummary, BdReelVideo } from '@/lib/bdReel';

/**
 * BreakingDown オーディションの縦スワイプ・リール（「オーディションマラソン」）。ja 専用。
 *
 * 4号店（affiliate-factory）のサンプルマラソンの移植。あちらで実測で確定した挙動をそのまま持ち込む:
 * - **上へ払うと次**（∧∨ボタン・↑↓キー・ホイールでも送れる）
 * - **距離だけで判定しない**＝フリック（速さ）でも送る。距離しきい値だけだと「速く払ったのに
 *   何も起きない」＝いちばん重く感じる
 * - **動いている最中でも次の指を受ける**（settle）。アニメの終わりを待たせるのが「重い」の正体
 * - **送っている最中に来た入力を1つだけ覚える**（pending）。捨てると「効かない」と感じる
 * - **次のコマを先読み**＝払った瞬間に絵が出る（idx±1 のサムネだけ eager で読む）
 * - **差し込みカードを5本ごと**に入れて、列の操縦（並び替え）と数字の言語化をする
 * - **閉じたら続きから**（最後に見た動画から再開。終端で閉じた人だけ先頭に戻す）
 * - **列の在庫はページに埋めず /bd-reel.json から開いたときに初めて読む**＝リールを開かない人に
 *   94本ぶんの動画とコメント（RSCペイロードで +117KB）を運ばせない
 *
 * ⚠️ プレーヤーの上に受け皿は敷かない。再生前はファサード（サムネ＋再生ボタン）なのでコマ全面で
 *    送れて、再生後は動画の面だけ YouTube に譲る＝4号店が踏んだ「シークバーを潰す」事故を避ける。
 *    残りの面（タイトル・コメント・CTA）は再生中もそのまま送りに使える。
 */

type Lane = 'now' | 'time';

type Slide =
  | { k: 'v'; id: string; v: BdReelVideo }
  | { k: 'n'; id: string; textJa: string }
  | { k: 'c'; id: string }
  | { k: 'e'; id: string };

/** 差し込みカードの間隔（動画◯本ごと）。4号店は 7 → 5 に短縮して定着した値。 */
const EVERY = 5;
/** 送りの時間。これ以上短いとどちらへ動いたか目で追えない（4号店の実測 380→300ms）。 */
const DUR = 300;
const STORE_KEY = 'bd-reel';

function laneOrder(videos: BdReelVideo[], eventNo: number | null, lane: Lane): BdReelVideo[] {
  const all = [...videos];
  if (lane === 'time') return all.sort((a, b) => a.d.localeCompare(b.d));
  // 既定＝この大会のオーディションを公開順（vol.1 から予習）→ そのあと歴代を再生数順（沼）。
  const mine = all.filter((v) => v.e === eventNo).sort((a, b) => a.d.localeCompare(b.d));
  const rest = all.filter((v) => v.e !== eventNo).sort((a, b) => b.v - a.v);
  return [...mine, ...rest];
}

function buildSlides(videos: BdReelVideo[], data: BdReelSummary, lane: Lane): Slide[] {
  const out: Slide[] = [];
  let n = 0;
  let note = 0;
  let sinceChoice = 99; // 最初の差し込みは分岐にする（＝早い段階で「別の並びもある」と気づかせる）
  for (const v of laneOrder(videos, data.event, lane)) {
    out.push({ k: 'v', id: v.i, v });
    n += 1;
    if (n % EVERY !== 0) continue;
    // 分岐カードは3枚あけて何度でも出す（1回きりだと戻り道が無くなる＝4号店の規律）。
    if (sinceChoice >= 3) {
      out.push({ k: 'c', id: `c${n}` });
      sinceChoice = 0;
    } else if (data.notes.length > 0) {
      out.push({ k: 'n', id: `n${n}`, textJa: data.notes[note % data.notes.length].textJa });
      note += 1;
      sinceChoice += 1;
    }
  }
  out.push({ k: 'e', id: 'end' });
  return out;
}

function manJa(n: number): string {
  if (n >= 100_000_000) return `${(Math.round(n / 10_000_000) / 10).toLocaleString('ja-JP')}億`;
  return n >= 10000 ? `${Math.round(n / 10000).toLocaleString('ja-JP')}万` : n.toLocaleString('ja-JP');
}

function dayJa(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

export default function BdReel({ data, eventNameJa }: { data: BdReelSummary; eventNameJa?: string }) {
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState<BdReelVideo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lane, setLane] = useState<Lane>(data.event ? 'now' : 'time');
  const [idx, setIdx] = useState(0);
  const [hint, setHint] = useState(false);
  const [picker, setPicker] = useState(false);
  const openRef = useRef(false);

  const slides = useMemo(() => (stock ? buildSlides(stock, data, lane) : []), [stock, data, lane]);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);
  const busyRef = useRef(false);
  const pendingRef = useRef(0);
  const finishRef = useRef<null | (() => void)>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const depthRef = useRef(0);
  const durRef = useRef(DUR);

  idxRef.current = idx;

  /** track を今の位置（＋指で持ち上げている量）に置く。 */
  const place = useCallback((px: number, anim: boolean) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = anim && durRef.current > 0 ? `transform ${durRef.current}ms cubic-bezier(.22,.61,.36,1)` : 'none';
    el.style.transform = `translate3d(0, calc(${-100 * idxRef.current}% + ${px}px), 0)`;
  }, []);

  // idx / lane / 開閉が変わったら位置を張り直す。列は全コマを描いてあるので DOM の並びは動かない
  // ＝ここで同じ値を書き直しても画は跳ねない（コマを付け替える方式で起きる「開いたのに真っ白」を構造的に回避）。
  useLayoutEffect(() => {
    if (open) place(0, false);
  }, [idx, lane, open, place]);

  /**
   * 送りの後始末を予約する。⚠️ 控え（finishRef）を持つ＝**途中でも即座に着地させられる**。
   * 次の指が来たときにアニメの終わりを待たせるのが「重い」の正体（4号店の settle）。
   */
  const after = useCallback((fn: () => void) => {
    const el = trackRef.current;
    if (!el) return fn();
    const run = () => {
      if (finishRef.current !== run) return;
      window.clearTimeout(timer);
      el.removeEventListener('transitionend', run);
      finishRef.current = null;
      fn();
    };
    const timer = window.setTimeout(run, durRef.current + 60);
    finishRef.current = run;
    el.addEventListener('transitionend', run, { once: true });
  }, []);

  const settle = useCallback(() => finishRef.current?.(), []);

  /** 端で「これ以上ない」と手に伝える小さな戻り。 */
  const nudge = useCallback(
    (dir: number) => {
      place(-dir * 22, true);
      window.setTimeout(() => place(0, true), 140);
    },
    [place],
  );

  const go = useCallback(
    (dir: number) => {
      if (busyRef.current) {
        pendingRef.current = dir; // 送っている最中の入力は1つだけ覚える（捨てると「効かない」）
        return;
      }
      const to = idxRef.current + dir;
      if (to < 0 || to >= slides.length) {
        nudge(dir);
        return;
      }
      busyRef.current = true;
      const el = trackRef.current;
      if (el) {
        el.style.transition = durRef.current > 0 ? `transform ${durRef.current}ms cubic-bezier(.22,.61,.36,1)` : 'none';
        el.style.transform = `translate3d(0, ${-100 * to}%, 0)`;
      }
      after(() => {
        idxRef.current = to;
        setIdx(to);
        busyRef.current = false;
        const s = slides[to];
        if (s?.k === 'v') seenRef.current.add(s.v.i);
        if (to > depthRef.current) {
          depthRef.current = to;
          // 10コマごとだけ送る（1コマずつ送るとイベント数が跳ねて GA4 の他の指標を薄める）。
          if (to % 10 === 0) track('bd_reel_depth', { depth: to, lane, event: data.event ?? 0 });
        }
        const p = pendingRef.current;
        pendingRef.current = 0;
        if (p) go(p);
      });
    },
    [after, data.event, lane, nudge, slides],
  );

  /** いま開いている列の中で、その大会の最初のコマへ飛ぶ（大会ジャンプ）。 */
  const jumpToEvent = useCallback(
    (ev: number) => {
      const at = slides.findIndex((x) => x.k === 'v' && x.v.e === ev);
      if (at < 0) return;
      settle();
      busyRef.current = false;
      pendingRef.current = 0;
      idxRef.current = at;
      setIdx(at);
      setPicker(false);
      if (at > depthRef.current) depthRef.current = at;
      track('bd_reel_jump', { to: ev, lane });
    },
    [lane, settle, slides],
  );

  /** 列に入っている大会の一覧（本数つき）。ジャンプ先の選択肢＝在庫のある大会だけ出す。 */
  const eventList = useMemo(() => {
    const count = new Map<number, number>();
    for (const v of stock ?? []) count.set(v.e, (count.get(v.e) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => a[0] - b[0]).map(([e, n]) => ({ e, n }));
  }, [stock]);

  /** 並び替え（分岐カード）。まだ見ていない最初の動画へ着地する＝「続き」を壊さない。 */
  const switchLane = useCallback(
    (next: Lane) => {
      if (next === lane) return;
      const list = buildSlides(stock ?? [], data, next);
      const at = list.findIndex((s) => s.k === 'v' && !seenRef.current.has(s.v.i));
      setLane(next);
      const to = at < 0 ? 0 : at;
      idxRef.current = to;
      setIdx(to);
      busyRef.current = false;
      pendingRef.current = 0;
      track('bd_reel_lane', { lane: next, event: data.event ?? 0 });
    },
    [data, lane, stock],
  );

  // --- 指で送る（上へ払うと次）---
  const downRef = useRef<{ y: number; x: number; dy: number; lock: 0 | 1 | 2; ly: number; lt: number; v: number } | null>(
    null,
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (busyRef.current) settle(); // 動いている最中でも受ける（着地させてから次を始める）
    const el = e.target as HTMLElement;
    if (el.closest('a,button')) return; // CTA・再生・閉じる・送りボタンの操作を邪魔しない
    if (busyRef.current || slides.length < 2) return;
    downRef.current = { y: e.clientY, x: e.clientX, dy: 0, lock: 0, ly: e.clientY, lt: Date.now(), v: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 指が枠外に出ても離した瞬間を拾えるようにするだけ＝失敗しても送りは効く */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const down = downRef.current;
    if (!down) return;
    down.dy = e.clientY - down.y;
    // 縦か横かの判定は8px動いてから。最初の move（1〜3px）で決めると、縦に払っても横ロックになって
    // そのジェスチャが丸ごと死ぬ（4号店の「擦ったのに無反応」の正体）。
    if (!down.lock) {
      const ax = Math.abs(e.clientX - down.x);
      const ay = Math.abs(down.dy);
      if (Math.max(ax, ay) < 8) return;
      down.lock = ay > ax ? 1 : 2;
    }
    if (down.lock !== 1) return;
    const now = Date.now();
    const dt = now - down.lt;
    if (dt > 0) {
      down.v = (e.clientY - down.ly) / dt; // 直近の速さだけを見る（止めた指をフリックと誤判定しない）
      down.ly = e.clientY;
      down.lt = now;
    }
    const end = (idxRef.current === 0 && down.dy > 0) || (idxRef.current === slides.length - 1 && down.dy < 0);
    place(down.dy * (end ? 0.28 : 1), false); // 端では重くする
  };

  const release = () => {
    const down = downRef.current;
    if (!down) return;
    downRef.current = null;
    const dy = down.lock === 1 ? down.dy : 0;
    const v = down.lock === 1 ? down.v : 0;
    const box = boxRef.current;
    const far = Math.abs(dy) > Math.min(84, (box?.offsetHeight ?? 600) * 0.11);
    // フリック＝指を弾く動きは距離が短い（20〜60px）ので、速さでも送る。最後まで同じ向きに動いていること。
    const flick = Math.abs(v) > 0.35 && Math.abs(dy) > 20 && (dy < 0) === (v < 0); // 最後まで同じ向きに動いていること
    if (far || flick) {
      if (hint) {
        setHint(false);
        try {
          window.localStorage.setItem(`${STORE_KEY}-tip`, '1'); // 分かった人には二度と出さない
        } catch {
          /* プライベートモード等で保存できなくても動作に影響しない */
        }
      }
      go(dy < 0 ? 1 : -1);
    } else {
      place(0, true);
    }
  };

  // ホイール・トラックパッド。慣性で小さい delta が長く続くので、勢いが切れたら数え直し＋クールダウン。
  useEffect(() => {
    const box = boxRef.current;
    if (!open || !box) return;
    let acc = 0;
    let fired = 0;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // 裏のページを揺らさない（ダイアログ内にスクロールは無い）
      const now = Date.now();
      if (now - last > 160) acc = 0;
      last = now;
      acc += e.deltaY;
      if (Math.abs(acc) > 60 && now - fired > 420) {
        fired = now;
        const dir = acc > 0 ? 1 : -1;
        acc = 0;
        go(dir);
      }
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [open, go]);

  // キーボード。⚠️ 開いたら箱側にフォーカスを移す＝↑↓が別ドメインの iframe に吸われない。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        // スペースは「ボタンを押す」キーでもある。ボタンにフォーカスがある時に送りへ横取りすると
        // 閉じる・分岐が押せなくなる（keydown で preventDefault するとクリックごと消える）。
        if ((e.target as HTMLElement | null)?.closest('a,button')) return;
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);

  /**
   * 入口＝ここだけ /bd-reel.json を読み終えてから開く（列が無いまま開くと真っ白になる）。
   * @param to 行き先。全史ページの大会行・引用ブロックから「その大会／その動画」で開くのに使う。
   *           指定があるときは「続きから」より行き先を優先する（押した場所と違うコマが出ると壊れて見える）。
   */
  const openReel = async (to?: { video?: string; event?: number }) => {
    if (loading) return;
    let videos = stock;
    if (!videos) {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(`/bd-reel.json?v=${encodeURIComponent(data.ver)}`);
        if (!res.ok) throw new Error(String(res.status));
        videos = ((await res.json()) as BdReelStock).videos;
        setStock(videos);
      } catch {
        setFailed(true); // 取れなかったことは黙らない（開かないボタンにしない）
        return;
      } finally {
        setLoading(false);
      }
    }
    durRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : DUR;
    let start = 0;
    let startLane: Lane = data.event ? 'now' : 'time';
    try {
      setHint(window.localStorage.getItem(`${STORE_KEY}-tip`) !== '1');
    } catch {
      setHint(true); // 保存が読めない環境（プライベートモード等）は毎回ヒントを出すだけ
    }
    if (to?.video || to?.event) {
      // 大会から入るときは時系列にそろえる＝そこから先へ進むと歴史がそのまま続く。
      if (to.event) startLane = 'time';
      const list = buildSlides(videos, data, startLane);
      const at = to.video
        ? list.findIndex((x) => x.k === 'v' && x.v.i === to.video)
        : list.findIndex((x) => x.k === 'v' && x.v.e === to.event);
      if (at > 0) start = at;
    } else {
      try {
        const raw = window.localStorage.getItem(STORE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { lane?: Lane; id?: string };
          if (saved.lane === 'now' || saved.lane === 'time') startLane = saved.lane;
          // 終端で閉じた人はそこに続きが無いので先頭に戻す（4号店の規律）。
          if (saved.id && saved.id !== 'end') {
            const at = buildSlides(videos, data, startLane).findIndex((x) => x.id === saved.id);
            if (at > 0) start = at;
          }
        }
      } catch {
        /* 保存が読めない環境は先頭から開くだけ */
      }
    }
    setLane(startLane);
    idxRef.current = start;
    setIdx(start);
    depthRef.current = start;
    setPicker(false);
    openRef.current = true;
    setOpen(true);
    track('bd_reel_open', { event: data.event ?? 0, at: start, from: to?.event ? 'event' : to?.video ? 'video' : 'tile' });
  };
  const openRef2 = useRef(openReel);
  openRef2.current = openReel;

  /**
   * ページのどこに置いた入口からでも開けるようにする（4号店の `.js-reel` と同じ＝入口だけ増やす）。
   * サーバーコンポーネントのままの全史ページが `data-bd-reel="event:6"` を書くだけで入口になる。
   */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('[data-bd-reel]');
      if (!el) return;
      const raw = el.getAttribute('data-bd-reel') ?? '';
      e.preventDefault();
      const [kind, value] = raw.split(':');
      if (kind === 'event') void openRef2.current({ event: Number(value) });
      else if (kind === 'video') void openRef2.current({ video: value });
      else void openRef2.current();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      boxRef.current?.focus();
      document.documentElement.style.overflow = 'hidden';
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  const closeReel = useCallback(() => {
    if (!openRef.current) return; // Esc は onCancel → close() → onClose と2回届く＝1回だけ数える
    openRef.current = false;
    const cur = slides[idxRef.current];
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ lane, id: cur?.id ?? null }));
    } catch {
      /* 保存できなくても閉じる動作には影響しない */
    }
    track('bd_reel_close', { depth: depthRef.current, lane, event: data.event ?? 0 });
    document.documentElement.style.overflow = '';
    setOpen(false);
  }, [data.event, lane, slides]);

  useEffect(() => () => {
    document.documentElement.style.overflow = '';
  }, []);

  const cur = slides[idx];
  const eventVideos = data.eventVideos;

  return (
    // ⚠️ dialog はセクションの外に出す。space-y-* の「子どうしの間隔」は dialog にも掛かり、
    //    トップレイヤーに出た箱が margin-top ぶんずれて下端（送りボタン）が画面外に出る（実測16px）。
    <>
      <section className="border border-ink p-5">
        {/* 入口タイル。在庫（本数・再生数）を実数で見せる＝何が待っているかを数字で伝える。 */}
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">オーディション</span>
        <h2 className="mt-1 text-lg font-bold text-ink">オーディションマラソン</h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">
          {eventVideos > 0
            ? `${eventNameJa}のオーディション${eventVideos}本を公開順に、そのあと歴代の再生数トップから順に。`
            : 'BD4からいまの大会まで、歴代のオーディションを古い順に通しで。'}
          1本ずつ、動画・再生数・その動画に付いた人気コメントを縦に送って見ていく。
        </p>
        <p className="mt-2 text-xs tabular-nums text-ink-mute">
          全{data.totals.videos}本・{data.totals.events}大会・通算{manJa(data.totals.views)}回再生（{data.asOf}時点）
        </p>
        <p className="mt-3">
          <button
            type="button"
            onClick={() => void openReel()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
          >
            {loading ? '読み込み中…' : '1本目から見る'} <span aria-hidden>→</span>
          </button>
          {failed && (
            <span className="ml-3 text-xs text-ink-soft">読み込めなかった。時間をおいて試してほしい。</span>
          )}
        </p>
      </section>

      <dialog
        ref={dlgRef}
        onClose={closeReel}
        onCancel={(e) => {
          e.preventDefault();
          closeReel();
        }}
        // ⚠️ margin は !important で殺す。dialog は DOM 上ではただの子要素なので、祖先の
        // space-y-*（`> :not([hidden]) ~ :not([hidden])`＝詳細度が .m-0 より高い）に margin-top を
        // 付けられ、トップレイヤーに出た箱がそのぶん下へずれて送りボタンが画面外へ出る
        // （実測: セクション内で16px・ページ直下で40px）。max-h / max-w も UA の :modal 既定を外す。
        aria-label="オーディションマラソン"
        className="fixed inset-0 !m-0 h-full max-h-none w-full max-w-none bg-paper p-0 text-ink backdrop:bg-ink/70"
      >
        {open && (
          <div
            ref={boxRef}
            tabIndex={-1}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={release}
            onPointerCancel={release}
            className="relative h-full w-full touch-none select-none overflow-hidden outline-none"
            style={{ overscrollBehavior: 'contain' }}
          >
            {/* 上の帯: いまどこか＋閉じる */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-paper via-paper/90 to-transparent px-4 pb-6 pt-3">
              <span className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPicker((v) => !v)}
                  aria-expanded={picker}
                  className="rounded-[3px] border border-line bg-paper px-2 py-1 text-xs font-medium tabular-nums tracking-wide text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  {cur?.k === 'v' ? `BD${cur.v.e}` : 'BreakingDown'}
                  <span aria-hidden className="ml-1.5 text-ink-mute">大会を選ぶ</span>
                </button>
                <span className="text-xs font-medium tabular-nums tracking-wide text-ink-mute">
                  {idx + 1} / {slides.length}
                </span>
              </span>
              <button
                type="button"
                onClick={closeReel}
                aria-label="閉じる"
                className="pointer-events-auto -mr-1 rounded-[3px] px-2 py-1 text-sm text-ink-soft transition-colors hover:text-ink"
              >
                閉じる
              </button>
            </div>

            {/* 大会ジャンプ＝113コマを延々払わなくても目的の大会に行ける。数字だけのページから
                入ってきた人が「その大会の実物」に最短で着けるようにするための口。 */}
            {picker && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute inset-x-0 top-[52px] z-30 mx-3 max-h-[60vh] overflow-y-auto border border-ink bg-paper p-3 shadow-[0_8px_24px_rgba(25,26,28,0.12)]"
              >
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.15em] text-ink-mute">大会で飛ぶ</p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {eventList.map(({ e, n }) => {
                    const here = cur?.k === 'v' && cur.v.e === e;
                    return (
                      <button
                        key={e}
                        type="button"
                        onClick={() => jumpToEvent(e)}
                        className={`rounded-[3px] border px-2 py-1.5 text-xs tabular-nums transition-colors ${
                          here
                            ? 'border-ink bg-ink font-bold text-paper'
                            : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                        }`}
                      >
                        BD{e}
                        <span className={`ml-1 ${here ? 'text-paper/70' : 'text-ink-mute'}`}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div ref={trackRef} className="absolute inset-0 will-change-transform">
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  // 列は全コマを DOM に置いてある（コマの付け替えをしないため）＝いま見ていないコマは
                  // inert にして、タブ順と読み上げから外す。付けないと Tab が113コマぶん彷徨う。
                  inert={i !== idx}
                  className="flex h-full w-full flex-col justify-center px-4 py-14"
                >
                  {s.k === 'v' && <VideoSlide v={s.v} near={Math.abs(i - idx) <= 1} eventNo={data.event} />}
                  {s.k === 'n' && (
                    <div className="mx-auto max-w-prose border-y border-line py-8">
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">データ</span>
                      <p className="mt-3 text-base leading-loose text-ink">{s.textJa}</p>
                    </div>
                  )}
                  {s.k === 'c' && (
                    <div className="mx-auto max-w-prose border-y border-line py-8">
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">並び替え</span>
                      <p className="mt-3 text-base leading-relaxed text-ink">
                        {/* ⚠️ 「」は引用専用（§4.7）。編集部の言い回しに使うと、隣に並ぶ現地コメントと
                            地の文の区別が読者から付かなくなる。 */}
                        {lane === 'now'
                          ? 'いまの並びは、今大会のオーディション → 歴代の再生数順。古い順にたどると、オーディションが何に変わっていったかが見える。'
                          : 'いまの並びは古い順。再生数の多い順に戻すと、歴代の伝説回から見られる。'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => switchLane(lane === 'now' ? 'time' : 'now')}
                          className="rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
                        >
                          {lane === 'now' ? '古い順（BD4から）にする' : '再生数の多い順にする'}
                        </button>
                        <button
                          type="button"
                          onClick={() => go(1)}
                          className="rounded-[3px] border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
                        >
                          このまま続ける
                        </button>
                      </div>
                    </div>
                  )}
                  {s.k === 'e' && (
                    <div className="mx-auto max-w-prose border-y border-line py-8">
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">ここまで</span>
                      <p className="mt-3 text-base leading-relaxed text-ink">
                        この並びのオーディションは以上（全{data.totals.videos}本）。
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => switchLane(lane === 'now' ? 'time' : 'now')}
                          className="rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
                        >
                          {lane === 'now' ? '古い順で見直す' : '再生数の多い順で見直す'}
                        </button>
                        <button
                          type="button"
                          onClick={closeReel}
                          className="rounded-[3px] border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
                        >
                          ページに戻る
                        </button>
                      </div>
                      <p className="mt-4 text-xs leading-relaxed text-ink-mute">
                        大会ごとの再生数・コメント密度の推移は「オーディション全史」に置いてある。閉じるとページの関連リンクから開ける。
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 下の帯: 送りボタン（指が使えない環境の唯一の口＝必ず出す） */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-paper via-paper/90 to-transparent px-4 pb-3 pt-8">
              <span className="text-xs text-ink-mute">{hint ? '上にスワイプで次' : ''}</span>
              <span className="pointer-events-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="前へ"
                  disabled={idx === 0}
                  className="rounded-[3px] border border-line bg-paper px-3 py-2 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-30"
                >
                  <span aria-hidden>∧</span>
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="次へ"
                  disabled={idx === slides.length - 1}
                  className="rounded-[3px] border border-ink bg-ink px-3 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft disabled:opacity-30"
                >
                  <span aria-hidden>∨</span>
                </button>
              </span>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

/**
 * 1コマ＝動画＋タイトル＋数字＋その動画に付いた人気コメント＋CTA。まるごと一緒に動く。
 * 再生は lite-youtube のファサード（タップで初めて iframe を読む）＝94コマぶんのプレーヤーを抱えない。
 */
const VideoSlide = memo(function VideoSlide({
  v,
  near,
  eventNo,
}: {
  v: BdReelVideo;
  near: boolean;
  eventNo: number | null;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-prose flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden bg-ink">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${v.i}?autoplay=1`}
            title={v.t}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setPlaying(true);
              track('bd_reel_play', { video_id: v.i, event: v.e });
            }}
            aria-label={`${v.t} を再生`}
            className="group absolute inset-0 h-full w-full"
          >
            <Image
              src={`https://i.ytimg.com/vi/${v.i}/hqdefault.jpg`}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              // 先読み＝いま見ているコマの前後だけ先に読む。払った瞬間に絵が出るのはこれが効いている。
              loading={near ? 'eager' : 'lazy'}
              className="object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/5">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform group-hover:scale-105">
                <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-white" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>

      <div>
        <p className="text-xs tabular-nums text-ink-mute">
          BD{v.e}
          {eventNo === v.e && <span className="ml-2 text-ink-soft">今大会</span>}
          <span className="mx-2 text-line">/</span>
          {dayJa(v.d)}
          <span className="mx-2 text-line">/</span>
          {manJa(v.v)}回再生
          <span className="mx-2 text-line">/</span>
          コメント{manJa(v.c)}件
        </p>
        <h3 className="mt-1 text-base font-bold leading-snug text-ink">{v.t}</h3>
      </div>

      {/* 引用は逐語（機械コピー）。この動画に付いたコメントだけ＝出所がズレない。 */}
      {v.q.length > 0 && (
        <ul className="space-y-2 border-t border-line pt-3">
          {v.q.map((q) => (
            <li key={`${q.a}-${q.l}`} className="text-sm leading-relaxed text-ink">
              {q.t}
              <span className="mt-0.5 block text-xs tabular-nums text-ink-mute">
                {q.a}
                <span className="mx-2 text-line">/</span>
                {q.l.toLocaleString('ja-JP')}いいね
              </span>
            </li>
          ))}
        </ul>
      )}

      <p>
        <a
          href={`https://www.youtube.com/watch?v=${v.i}`}
          target="_blank"
          rel="noopener"
          className="text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
        >
          YouTubeで見る <span aria-hidden>→</span>
        </a>
      </p>
    </div>
  );
});
