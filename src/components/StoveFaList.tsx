'use client';

import { useState } from 'react';
import { Link } from '@/lib/navigation';
import type { FaRow } from '@/lib/stoveBoard';

type FilterKey = 'all' | 'open' | 'done' | 'jp' | 'pitcher' | 'hitter' | 'qo';

const FILTERS: { key: FilterKey; ja: string; en: string; test: (r: FaRow) => boolean }[] = [
  { key: 'all', ja: 'すべて', en: 'All', test: () => true },
  { key: 'open', ja: '未契約', en: 'Unsigned', test: (r) => !r.status.done },
  { key: 'done', ja: '決着', en: 'Settled', test: (r) => r.status.done },
  { key: 'jp', ja: '日本人', en: 'Japanese', test: (r) => r.japanese },
  { key: 'pitcher', ja: '投手', en: 'Pitchers', test: (r) => r.pitcher },
  { key: 'hitter', ja: '野手', en: 'Hitters', test: (r) => !r.pitcher },
  { key: 'qo', ja: 'QOあり', en: 'With QO', test: (r) => Boolean(r.qo) },
];

function Row({ r, en, altName, projName }: { r: FaRow; en: boolean; altName: string; projName: string }) {
  const meta = [en ? r.pos.en : r.pos.ja, r.age ? (en ? `age ${r.age}` : `${r.age}歳`) : '', r.team ? (en ? r.team.en : r.team.ja) : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-3 border-b border-line py-5">
      <span className="pt-1 text-lg font-bold tabular-nums text-ink">{r.rank}</span>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          {r.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない）
            <img src={r.photo} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-full bg-ink/[0.04] object-cover" />
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {r.href && !r.hrefIsArticle ? (
                <Link href={r.href} className="font-bold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                  {r.name}
                </Link>
              ) : (
                <span className="font-bold text-ink">{r.name}</span>
              )}
              {r.nameSub && <span className="text-xs text-ink-mute">{r.nameSub}</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center border px-1.5 py-0.5 text-[11px] ${
                  r.status.done ? 'border-ink bg-ink text-surface' : 'border-line text-ink'
                }`}
              >
                {en ? r.status.label.en : r.status.label.ja}
                {r.status.team && (en ? `: ${r.status.team.en}` : `：${r.status.team.ja}`)}
              </span>
              {r.japanese && (
                <span className="inline-flex items-center border border-line px-1.5 py-0.5 text-[11px] text-ink">
                  {en ? 'Japanese' : '日本人'}
                </span>
              )}
              <span className="text-xs text-ink-soft">{meta}</span>
            </div>
          </div>
        </div>

        {/* 決着した選手は契約の中身（報道の数字・出典つき）を、予想より先に出す。 */}
        {r.status.terms && (
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {en ? r.status.terms.en : r.status.terms.ja}{' '}
            <a
              href={r.status.terms.source}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-xs text-ink-mute underline decoration-line underline-offset-2 hover:text-ink"
            >
              {r.status.terms.sourceName}
            </a>
          </p>
        )}

        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {r.statLine && (
            <>
              <dt className="text-xs leading-6 text-ink-mute">{en ? '2026' : '今季'}</dt>
              <dd className="tabular-nums text-ink">{r.statLine}</dd>
            </>
          )}
          {r.projection && (
            <>
              <dt className="text-xs leading-6 text-ink-mute">{en ? 'Projection' : '予想契約'}</dt>
              <dd className="tabular-nums text-ink">
                {en ? r.projection.en : r.projection.ja}
                <span className="ml-1.5 text-xs text-ink-mute">{projName}</span>
              </dd>
            </>
          )}
          {r.espnRank && (
            <>
              <dt className="text-xs leading-6 text-ink-mute">{altName}</dt>
              <dd className="tabular-nums text-ink-soft">{en ? `No. ${r.espnRank}` : `${r.espnRank}位`}</dd>
            </>
          )}
          {r.suitors && !r.status.done && (
            <>
              <dt className="text-xs leading-6 text-ink-mute">{en ? 'Linked' : '関心球団'}</dt>
              <dd className="text-ink-soft">{r.suitors.map((s) => (en ? s.en : s.ja)).join(en ? ', ' : '・')}</dd>
            </>
          )}
        </dl>

        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{en ? r.note.en : r.note.ja}</p>
        {r.href && (r.hrefIsArticle || r.japanese) && (
          <Link
            href={r.href}
            className="inline-flex min-h-[44px] items-center text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
          >
            {r.hrefIsArticle
              ? en
                ? 'Fan reactions'
                : '海外の反応を読む'
              : en
                ? 'Timeline and reactions'
                : '報道の時系列と海外の反応'}{' '}
            <span aria-hidden className="ml-1">→</span>
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * FA一覧（/stove-league/fa）の表本体。絞り込みだけがクライアントの仕事＝行の中身はサーバーで組んだ
 * FaRow をそのまま出す（初回のHTMLに30人ぶん載る＝検索・読み上げから全員見える）。
 *
 * なぜ絞り込みが要るか: 冬が進むと問いが「誰が残っているか」に変わる（「FA 未契約」「FA 残り」）。
 * 契約済みと未契約が混ざった30行を読ませず、1タップで未契約だけにする。
 */
export default function StoveFaList({
  rows,
  en,
  altName,
  projName,
}: {
  rows: FaRow[];
  en: boolean;
  /** もう1つの順位の媒体名（例: ESPN）。 */
  altName: string;
  /** 予想契約の媒体名（例: MLB Trade Rumors）。 */
  projName: string;
}) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = rows.filter(active.test);
  return (
    <div>
      <div role="group" aria-label={en ? 'Filter' : '絞り込み'} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((f) => {
          const n = rows.filter(f.test).length;
          // 該当が0人の絞り込みは出さない（序盤の「決着」など）。
          if (f.key !== 'all' && n === 0) return null;
          const on = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap border px-3 text-sm transition-colors ${
                on ? 'border-ink bg-ink text-surface' : 'border-line text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              {en ? f.en : f.ja}
              <span className={`text-xs tabular-nums ${on ? 'text-surface/70' : 'text-ink-mute'}`}>{n}</span>
            </button>
          );
        })}
      </div>
      <ol className="mt-3 grid border-t border-line lg:grid-cols-2 lg:gap-x-10">
        {shown.map((r) => (
          <Row key={r.rank} r={r} en={en} altName={altName} projName={projName} />
        ))}
      </ol>
    </div>
  );
}
