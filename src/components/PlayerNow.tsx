import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import type { Player } from '@/lib/players';
import type { PlayerSeason } from '@/lib/playerStats';
import type { Gamelog } from '@/lib/gamelog';
import { fmtIp, fmtMd, etToJst } from '@/lib/gamelogStats';
import type { JpRank } from '@/lib/jpRank';
import type { EditorNote } from '@/lib/editorNotes';
import type { JournalEntry, JournalQuote } from '@/lib/playerJournal';
import type { Locale } from '@/lib/i18n';

/**
 * 選手タグLPの「いま」ブロック＝検索着地の第一意図「直近、海外なんて言ってる？」に
 * ファーストビューで答えるカード。
 *  - 日誌がある選手（ja）: 最新の山場引用＋編集部ノート（総評）＋スタットパネル＋最新の観測へのアンカー
 *  - それ以外（日誌なし・en）: スタットパネルだけに退化＝全選手LP共通の「成績ハブへの太い橋」
 * 数値はすべて snapshot / gamelog（CIが更新する公知の数値）の再表示で、ここでは何も計算で作らない。
 * WARスパークラインは gamelog.warHistory の実測期間だけを正直に描く（開幕からとは言わない）。
 */

const num = (raw: unknown): number => {
  const v = Number(raw);
  return Number.isNaN(v) ? 0 : v;
};

/** 墨一色のWAR推移スパークライン。装飾なし＝デザインシステム（無彩色・シャープ）に合わせる。 */
function Sparkline({ points }: { points: number[] }) {
  const W = 240;
  const H = 40;
  const P = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v: number) => H - P - ((v - min) * (H - 2 * P)) / span;
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="h-10 w-full text-ink">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 引用の話者行（規約は TagVoices / SeasonJournal と同じ: YouTube=👍 / Reddit=▲ + u/ 接頭）。 */
function quoteAuthor(entry: JournalEntry, quote: JournalQuote) {
  const isYoutube = entry.format === 'youtube' || Boolean(entry.video);
  return (
    <>
      <span className="font-medium text-ink-soft">{isYoutube ? quote.author : `u/${quote.author}`}</span>
      <span className="tabular-nums">
        {isYoutube ? '👍' : '▲'} {quote.score.toLocaleString()}
      </span>
    </>
  );
}

function dateJa(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

export default function PlayerNow({
  locale,
  player,
  season,
  gamelog,
  jpRank,
  asOf,
  highlight,
  editorNote,
  showJournalJump,
}: {
  locale: Locale;
  player: Player;
  season: PlayerSeason | null;
  gamelog: Gamelog | null;
  jpRank: JpRank | null;
  asOf?: string;
  highlight?: { entry: JournalEntry; quote: JournalQuote } | null;
  editorNote?: EditorNote | null;
  showJournalJump?: boolean;
}) {
  const t = useTranslations();
  const en = locale === 'en';
  const name = en ? player.nameEn : player.nameJa;

  // 主要3値（打者=打率/本塁打/OPS・投手=勝敗/防御率/奪三振。二刀流は打撃優先＋投球1行）。
  const h = season?.hitting;
  const p = season?.pitching;
  const isBatter = Boolean(h && num(h.plateAppearances) > 0);
  const bigs: { label: string; value: string }[] = isBatter
    ? [
        { label: t('tag.statAvg'), value: String(h!.avg ?? '-') },
        { label: t('tag.statHr'), value: String(h!.homeRuns ?? 0) },
        { label: t('tag.statOps'), value: String(h!.ops ?? '-') },
      ]
    : p
      ? [
          { label: t('tag.statWl'), value: `${p.wins ?? 0}-${p.losses ?? 0}` },
          { label: t('tag.statEra'), value: String(p.era ?? '-') },
          { label: t('tag.statSo'), value: String(p.strikeOuts ?? 0) },
        ]
      : [];
  const twoWay = isBatter && p; // 大谷: 打撃の下に投球1行を併記

  // WAR（snapshot の sabermetrics 値。二刀流は打+投の合算＝ /mvp と同じ見せ方）。
  const war = (season?.saber?.hit ?? 0) + (season?.saber?.pit ?? 0);
  const hasWar = season?.saber?.hit != null || season?.saber?.pit != null;

  // WAR推移（gamelog.warHistory の実測期間。2点未満なら描かない）。
  const warPoints = (gamelog?.warHistory ?? []).map((w) => (w.warHit ?? 0) + (w.warPit ?? 0));
  const warFrom = gamelog?.warHistory?.[0]?.d;
  const warTo = gamelog?.warHistory?.at(-1)?.d;

  // 直近試合（二刀流は打撃/投球の新しい方）。日付は常に JST に直して出す（ET のまま出さない）。
  const lastHit = isBatter ? gamelog?.hitting.at(-1) : undefined;
  const lastPit = gamelog?.pitching.at(-1);
  const useHit = Boolean(lastHit && (!lastPit || lastHit.d >= lastPit.d));
  let lastLabel: string | null = null;
  let lastLine: string | null = null;
  if (useHit && lastHit) {
    lastLabel = t('tag.lastGame');
    lastLine = en
      ? `${fmtMd(etToJst(lastHit.d))} vs ${lastHit.opp} — ${lastHit.h}-for-${lastHit.ab}${lastHit.hr ? `, ${lastHit.hr} HR` : ''}${lastHit.rbi ? `, ${lastHit.rbi} RBI` : ''}`
      : `${fmtMd(etToJst(lastHit.d))} ${lastHit.oppJa}戦 — ${lastHit.ab}打数${lastHit.h}安打${lastHit.hr ? `・${lastHit.hr}本塁打` : ''}${lastHit.rbi ? `・${lastHit.rbi}打点` : ''}`;
  } else if (lastPit) {
    lastLabel = t('tag.lastStart');
    lastLine = en
      ? `${fmtMd(etToJst(lastPit.d))} vs ${lastPit.opp} — ${fmtIp(lastPit.outs)} IP, ${lastPit.er} ER, ${lastPit.so} K${lastPit.w ? ', W' : lastPit.l ? ', L' : ''}`
      : `${fmtMd(etToJst(lastPit.d))} ${lastPit.oppJa}戦 — ${fmtIp(lastPit.outs)}回・自責${lastPit.er}・${lastPit.so}K${lastPit.w ? '・勝ち投手' : lastPit.l ? '・負け投手' : ''}`;
  }

  const hasPanel = bigs.length > 0;
  const quoteBody = highlight ? (highlight.quote.bodyJa ?? '').trim() || highlight.quote.bodyEn : null;
  if (!hasPanel && !quoteBody) return null;

  return (
    <section className="space-y-5">
      <SectionHeading label={quoteBody ? t('tag.now', { name }) : t('tag.panelTitle', { name })} />
      <div className="rounded-[3px] border border-line bg-surface p-5 sm:p-6">
        {/* 最新の山場の声＝このLPの顔。検索着地の「直近どう見られてる？」に最初の1画面で答える。 */}
        {highlight && quoteBody && (
          <figure className="border-b border-line pb-5">
            <blockquote className="max-w-prose text-lg font-bold leading-relaxed text-ink sm:text-xl">
              “{quoteBody}”
            </blockquote>
            <figcaption className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-mute">
              {quoteAuthor(highlight.entry, highlight.quote)}
              <span>
                {dateJa(highlight.entry.date)}・{highlight.entry.headingJa}
              </span>
            </figcaption>
          </figure>
        )}
        {/* 編集部ノート（総評）を「いま」に吸収＝単独セクションだった300字をここで読ませる。 */}
        {editorNote && (
          <div className={quoteBody ? 'pt-5' : ''}>
            <p className="max-w-prose text-sm leading-relaxed text-ink">{editorNote.noteJa}</p>
            <p className="mt-2 text-xs text-ink-mute">
              {t('tag.editorNoteBy')} ・ {t('tag.updated', { date: editorNote.updatedAt })}
            </p>
          </div>
        )}
        {/* スタットパネル＝数字の現在地。声（上）と物語（下の日誌）を数値で裏づける。 */}
        {hasPanel && (
          <div className={quoteBody || editorNote ? 'mt-5 border-t border-line pt-5' : ''}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <dl className="grid grid-cols-3 gap-x-8 gap-y-1">
                {bigs.map((b) => (
                  <div key={b.label}>
                    <dt className="text-xs text-ink-mute">{b.label}</dt>
                    <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-ink sm:text-3xl">
                      {b.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {hasWar && (
                <div className="text-right">
                  <p className="text-xs text-ink-mute">WAR</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-ink sm:text-3xl">
                    {war.toFixed(1)}
                  </p>
                  {jpRank && (
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {t(jpRank.side === 'bat' ? 'tag.jpRankBat' : 'tag.jpRankPit', { rank: jpRank.rank })}
                    </p>
                  )}
                </div>
              )}
            </div>
            {twoWay && p && (
              <p className="mt-3 text-xs text-ink-soft">
                {t('tag.twoWayPit', {
                  w: String(p.wins ?? 0),
                  l: String(p.losses ?? 0),
                  era: String(p.era ?? '-'),
                  so: String(p.strikeOuts ?? 0),
                })}
              </p>
            )}
            {warPoints.length >= 2 && warFrom && warTo && (
              <div className="mt-5">
                <div className="flex items-baseline justify-between text-xs text-ink-mute">
                  <span>{t('tag.warTrend', { from: fmtMd(warFrom), to: fmtMd(warTo) })}</span>
                  {asOf && <span>{t('tag.asOfDate', { date: asOf.slice(0, 10) })}</span>}
                </div>
                <div className="mt-1.5 border-b border-line pb-1">
                  <Sparkline points={warPoints} />
                </div>
              </div>
            )}
            {lastLine && (
              <p className="mt-4 text-sm text-ink-soft">
                <span className="mr-2 text-xs font-medium text-ink-mute">{lastLabel}</span>
                {lastLine}
              </p>
            )}
          </div>
        )}
        {/* フッター: 数字の深掘りはハブへ、物語の続きは日誌の最新へ＝2つの「次」を並べる。 */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-3.5">
          <Link
            href={`/player/${player.slug}`}
            className="group inline-flex items-center gap-1 text-sm font-semibold text-ink transition-colors hover:text-ink-soft"
          >
            {t('tag.statsHub', { name })}
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
          {showJournalJump && (
            <a
              href="#journal-latest"
              className="inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {t('tag.nowLatest')}
              <span aria-hidden>↓</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
