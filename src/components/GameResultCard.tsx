'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { getTeam, teamLogoUrl } from '@/lib/teams';
import {
  SANS, hexToRgba, teamField, teamAccent, roundRectPath, drawLogoBadge,
} from '@/lib/cardCanvas';
import type { ThreadGame } from '@/types/thread';

/** 試合結果カードの形（縦長=フィード映え / 正方=万能）と実ピクセル。選手カードと同寸。 */
type CardFormat = 'portrait' | 'square';
const CARD_DIMS: Record<CardFormat, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
};

/** カードに描く1試合ぶんの結果＋（あれば）日本人選手のこの試合の成績。 */
type GameCardData = {
  dateLabel: string; // 2026.6.12
  away: { name: string; score: number };
  home: { name: string; score: number };
  lines: { player: string; line: string }[]; // 日本人選手のこの試合（最大2）
  site: string;
  tagline: string;
};
type GameCardArt = {
  awayColor: string; homeColor: string;
  awayLogo: HTMLImageElement | null; homeLogo: HTMLImageElement | null;
};

/**
 * 記事詳細（MLB・試合の最終スコアがある記事）から「試合結果カード」を画像出力する。選手カード
 * （GamelogAnalysis）の横展開＝同じ Topps 質感・チーム色主役・URL 焼き込み（1枚が広告）・GA4 計測。
 * スコアは記事JSONの公知数値だけ（thread.game）。ロゴ/色は MLB公式CDN を crossOrigin で読む（canvas を汚さない）。
 */
export default function GameResultCard({
  game,
  dateLabel,
  stats,
  articleUrl,
  locale,
}: {
  game: ThreadGame;
  dateLabel: string; // 試合日（表示用・"2026.6.12"）
  stats?: { player: string; line: string }[]; // 日本人選手のこの試合の成績（任意）
  articleUrl: string; // この記事の正規URL。投稿文に UTM 付きで入れて送客（カード＝広告）
  locale: string;
}) {
  const en = locale === 'en';
  const t = useMemo(
    () =>
      en
        ? {
            cta: 'Make a result card', heading: 'Share the result as an image',
            sub: 'A clean scoreboard card for X, Instagram or your blog. Pick the format below.',
            close: 'Close', portrait: 'Portrait', square: 'Square',
            share: 'Share', save: 'Save image', saving: 'Rendering…', copy: 'Copy caption', copied: 'Copied',
            tagline: 'Overseas reactions, in Japanese',
          }
        : {
            cta: '試合結果カードを作る', heading: '試合結果を画像でシェア',
            sub: 'X・インスタ・ブログにそのまま使えるスコアカード。形を選んで保存／シェア。',
            close: '閉じる', portrait: '縦長', square: '正方形',
            share: 'シェアする', save: '画像を保存', saving: '生成中…', copy: '投稿文をコピー', copied: 'コピーしました',
            tagline: '海外の反応まとめ',
          },
    [en],
  );

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<CardFormat>('portrait');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // チーム色（teams.ts）＝カード地・アクセント。未解決は無彩色に自然縮退。表示名は ja/en で出し分け。
  const awayTeam = getTeam(game.away.ja);
  const homeTeam = getTeam(game.home.ja);
  const awayColor = awayTeam?.color ?? '#191A1C';
  const homeColor = homeTeam?.color ?? '#191A1C';
  const awayName = en ? (awayTeam?.nameEn ?? game.away.en) : game.away.ja;
  const homeName = en ? (homeTeam?.nameEn ?? game.home.en) : game.home.ja;

  // ロゴ（MLB公式CDN・CORS可）を crossOrigin で読む＝canvas を汚さず保存/共有が通る。失敗時は無しで続行。
  const [awayLogo, setAwayLogo] = useState<HTMLImageElement | null>(null);
  const [homeLogo, setHomeLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    const load = (src: string | null) =>
      new Promise<HTMLImageElement | null>((res) => {
        if (!src) return res(null);
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = src;
      });
    load(awayTeam ? teamLogoUrl(awayTeam.id) : null).then((im) => { if (alive) setAwayLogo(im); });
    load(homeTeam ? teamLogoUrl(homeTeam.id) : null).then((im) => { if (alive) setHomeLogo(im); });
    return () => { alive = false; };
  }, [awayTeam, homeTeam]);

  const lines = useMemo(
    () => (stats ?? []).filter((s) => s.line).slice(0, 2),
    [stats],
  );

  const cardData = useMemo<GameCardData>(
    () => ({
      dateLabel,
      away: { name: awayName, score: game.away.score },
      home: { name: homeName, score: game.home.score },
      lines,
      site: 'matome-mlb-kaigai.jp',
      tagline: t.tagline,
    }),
    [dateLabel, awayName, homeName, game, lines, t.tagline],
  );

  // 投稿文＝スコア1行＋（あれば）日本人選手の成績＋ハッシュタグ＋UTM付きURL（カード経由の来訪を計測）。
  const caption = useMemo(() => {
    const head = en
      ? `${awayName} ${game.away.score} - ${game.home.score} ${homeName} — FINAL ${dateLabel}`
      : `${awayName} ${game.away.score} - ${game.home.score} ${homeName}｜${dateLabel}`;
    const statLines = lines.map((s) => `${s.player} ${s.line}`);
    const tagOf = (s: string) => s.replace(/[\s・]/g, '');
    const tags = `#MLB #${tagOf(awayName)} #${tagOf(homeName)}`;
    const link = `${articleUrl}${articleUrl.includes('?') ? '&' : '?'}utm_source=card&utm_medium=image&utm_campaign=game_card`;
    return [head, ...statLines, tags, link].join('\n');
  }, [en, awayName, homeName, game, dateLabel, lines, articleUrl]);

  // プレビュー＝開いている間、状態（形・読み込んだロゴ）が変わるたび描き直す（見たまま＝保存/共有される）。
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = CARD_DIMS[format];
    canvas.width = w; canvas.height = h;
    drawGameCard(canvas, cardData, format, { awayColor, homeColor, awayLogo, homeLogo });
  }, [open, cardData, format, awayColor, homeColor, awayLogo, homeLogo]);

  // モーダル中は Esc で閉じ、背面スクロールをロック。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  const fileName = () => {
    const slug = (s: string) => s.replace(/\s+/g, '-').toLowerCase();
    return `${slug(game.away.en)}-${game.away.score}-${game.home.score}-${slug(game.home.en)}.png`;
  };
  const drawNow = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const { w, h } = CARD_DIMS[format];
    canvas.width = w; canvas.height = h;
    drawGameCard(canvas, cardData, format, { awayColor, homeColor, awayLogo, homeLogo });
    return canvas;
  };
  const trackParams = () => ({ kind: 'game', sport: 'mlb', game: `${game.away.en} vs ${game.home.en}`, format });
  const openCard = () => { setOpen(true); track('card_open', { ...trackParams(), source: 'article' }); };
  const saveImage = () => {
    const canvas = drawNow();
    if (!canvas) return;
    setBusy(true);
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName(); a.click();
        URL.revokeObjectURL(url);
      }
      setBusy(false);
    }, 'image/png');
  };
  // ネイティブ共有（モバイル）。iOS は transient activation を要求＝toDataURL を同期取得して File を作る。
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
      const file = new File([arr], fileName(), { type: mime });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
        return;
      }
    } catch {
      return; // キャンセル／共有不可は尊重（保存に勝手に倒さない）
    }
    saveImage();
  };
  const onPrimaryShare = () => {
    track('card_share', { ...trackParams(), method: canShare ? 'share' : 'save' });
    return canShare ? shareImage() : saveImage();
  };
  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      track('card_copy', trackParams());
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* クリップボード不可（古い環境）は黙って無視 */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openCard}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[2px] border border-ink bg-ink px-4 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="9" r="1.6" />
          <path d="M21 15l-5-5L6 20" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t.cta}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.heading}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm sm:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-md rounded-[2px] border border-line bg-paper p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink">{t.heading}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-mute">{t.sub}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="shrink-0 rounded-[2px] border border-line p-2 text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mt-4 inline-flex overflow-hidden rounded-[2px] border border-line">
              {(['portrait', 'square'] as CardFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`min-h-[40px] px-4 text-xs font-semibold transition-colors ${
                    format === f ? 'bg-ink text-paper' : 'bg-paper text-ink-soft hover:text-ink'
                  }`}
                  aria-pressed={format === f}
                >
                  {f === 'portrait' ? t.portrait : t.square}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col items-center gap-4">
              <canvas
                ref={canvasRef}
                width={CARD_DIMS[format].w}
                height={CARD_DIMS[format].h}
                aria-label={t.heading}
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
                <button
                  type="button"
                  onClick={copyCaption}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] border border-line px-5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  {copied ? t.copied : t.copy}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 試合結果カードを canvas に描く＝拡散したくなるスコアボード1枚（Toppsカードの質感）。
 * 構図＝上にビジター行／下にホーム行（米式リネスコア順）。各行＝ロゴ＋チーム名＋大きな得点。勝者は
 * チームアクセント色＋名の下に短いバー、敗者はトーンを落とす。背景は上=ビジター色／下=ホーム色の淡い
 * 地で各行を所属色に結ぶ。最下段に日本人選手のこの試合＋ドメイン（送客）。モノクロ規律の例外（SNS素材）。
 */
function drawGameCard(canvas: HTMLCanvasElement, d: GameCardData, format: CardFormat, art: GameCardArt) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ctxLS = ctx as CanvasRenderingContext2D & { letterSpacing: string };
  const W = canvas.width;
  const H = canvas.height;
  const portrait = format === 'portrait';
  const wht = (a: number) => `rgba(255,255,255,${a})`;
  const fx = 30;
  const awayWon = d.away.score > d.home.score;
  const homeWon = d.home.score > d.away.score;
  const hasWinner = awayWon || homeWon;
  const awayAcc = teamAccent(art.awayColor);
  const homeAcc = teamAccent(art.homeColor);

  ctx.clearRect(0, 0, W, H);
  // ── 背景：黒地＋上にビジター色／下にホーム色の淡いグラデ（各行を所属色に結ぶ）＋斜めスイープ。
  ctx.fillStyle = '#0E0F11';
  ctx.fillRect(0, 0, W, H);
  const topG = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  topG.addColorStop(0, hexToRgba(teamField(art.awayColor, 0.3), 0.95));
  topG.addColorStop(1, hexToRgba(teamField(art.awayColor, 0.3), 0));
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, W, H * 0.58);
  const botG = ctx.createLinearGradient(0, H * 0.45, 0, H);
  botG.addColorStop(0, hexToRgba(teamField(art.homeColor, 0.3), 0));
  botG.addColorStop(1, hexToRgba(teamField(art.homeColor, 0.3), 0.95));
  ctx.fillStyle = botG;
  ctx.fillRect(0, H * 0.42, W, H * 0.58);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W * 0.46, 0); ctx.lineTo(0, H * 0.36); ctx.closePath();
  ctx.fillStyle = hexToRgba(awayAcc, 0.08); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, H); ctx.lineTo(W * 0.54, H); ctx.lineTo(W, H * 0.64); ctx.closePath();
  ctx.fillStyle = hexToRgba(homeAcc, 0.08); ctx.fill();

  // ── 外周フレーム。
  roundRectPath(ctx, fx, fx, W - fx * 2, H - fx * 2, 8);
  ctx.lineWidth = 2;
  ctx.strokeStyle = wht(0.14);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';

  // ── eyebrow：FINAL＋日付（中央・字間広め）。
  ctx.textAlign = 'center';
  ctxLS.letterSpacing = '5px';
  ctx.fillStyle = wht(0.72);
  ctx.font = `700 ${portrait ? 27 : 24}px ${SANS}`;
  ctx.fillText(`FINAL   ${d.dateLabel}`, W / 2, fx + (portrait ? 82 : 66));
  ctxLS.letterSpacing = '0px';

  // ── スコアボード（2行）。
  const padX = fx + 38;
  const rightX = W - fx - 38;
  const badgeR = portrait ? 66 : 56;
  const awayCY = portrait ? 430 : 332;
  const homeCY = portrait ? 690 : 540;
  const scoreSize = portrait ? 152 : 122;
  const rows = [
    { name: d.away.name, score: d.away.score, won: awayWon, color: art.awayColor, acc: awayAcc, logo: art.awayLogo, cy: awayCY },
    { name: d.home.name, score: d.home.score, won: homeWon, color: art.homeColor, acc: homeAcc, logo: art.homeLogo, cy: homeCY },
  ];
  for (const r of rows) {
    const dim = hasWinner && !r.won ? 0.5 : 1;
    const logoCX = padX + badgeR;
    if (r.logo) drawLogoBadge(ctx, r.logo, logoCX, r.cy, badgeR);
    else {
      ctx.beginPath();
      ctx.arc(logoCX, r.cy, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(r.acc, 0.28);
      ctx.fill();
    }
    // 得点（右・特大）＝勝者はアクセント色／敗者は淡い白。
    ctx.textAlign = 'right';
    ctx.font = `800 ${scoreSize}px ${SANS}`;
    ctx.fillStyle = r.won ? r.acc : wht(dim);
    ctx.fillText(String(r.score), rightX, r.cy + scoreSize * 0.35);
    // チーム名（左・大見出し・幅に応じて自動縮小）。
    ctx.textAlign = 'left';
    const nameX = logoCX + badgeR + 28;
    const nameMaxW = rightX - (portrait ? 210 : 180) - nameX;
    let ns = portrait ? 72 : 60;
    ctx.font = `800 ${ns}px ${SANS}`;
    while (ctx.measureText(r.name).width > nameMaxW && ns > 40) { ns -= 2; ctx.font = `800 ${ns}px ${SANS}`; }
    const nameBaseline = r.cy + ns * 0.36;
    ctx.fillStyle = wht(dim);
    ctx.fillText(r.name, nameX, nameBaseline);
    // 勝者＝名の下に短いアクセントバー。
    if (r.won) {
      ctx.fillStyle = r.acc;
      ctx.fillRect(nameX, nameBaseline + 16, Math.min(ctx.measureText(r.name).width, portrait ? 240 : 200), 5);
    }
  }
  // 行間の細いルール。
  ctx.fillStyle = wht(0.1);
  ctx.fillRect(padX, (awayCY + homeCY) / 2, rightX - padX, 2);

  // ── 日本人選手のこの試合（あれば）＝半透明パネル＋アクセント線。
  if (d.lines.length) {
    const panelX = fx + 24;
    const panelW = W - fx * 2 - 48;
    const lineH = portrait ? 58 : 50;
    const panelH = (portrait ? 44 : 36) + d.lines.length * lineH;
    const panelY = homeCY + (portrait ? 150 : 120);
    roundRectPath(ctx, panelX, panelY, panelW, panelH, 10);
    ctx.fillStyle = wht(0.055);
    ctx.fill();
    roundRectPath(ctx, panelX, panelY, 120, 5, 2.5);
    ctx.fillStyle = wht(0.4);
    ctx.fill();
    ctx.textAlign = 'left';
    d.lines.forEach((s, i) => {
      const ly = panelY + (portrait ? 40 : 32) + i * lineH + (portrait ? 26 : 22);
      ctx.fillStyle = wht(0.95);
      ctx.font = `800 ${portrait ? 30 : 26}px ${SANS}`;
      ctx.fillText(s.player, panelX + 30, ly);
      const pw = ctx.measureText(s.player).width;
      ctx.fillStyle = wht(0.78);
      ctx.font = `500 ${portrait ? 28 : 24}px ${SANS}`;
      ctx.fillText(s.line, panelX + 30 + pw + 20, ly);
    });
  }

  // ── フッタ：ドメイン（送客）＋タグライン。
  ctx.textAlign = 'left';
  ctx.fillStyle = wht(0.82);
  ctx.font = `700 ${portrait ? 26 : 24}px ${SANS}`;
  ctx.fillText(d.site, fx + 30, H - 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = wht(0.45);
  ctx.font = `500 ${portrait ? 23 : 21}px ${SANS}`;
  ctx.fillText(d.tagline, W - fx - 24, H - 44);
  ctx.textAlign = 'left';
}
