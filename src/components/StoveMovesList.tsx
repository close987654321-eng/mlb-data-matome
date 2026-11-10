'use client';

import { useState } from 'react';
import { Link } from '@/lib/navigation';
import type { MoveDay, MoveRow } from '@/lib/stoveMoves';

type KindFilter = 'all' | 'signing' | 'trade' | 'other' | 'jp';

const KINDS: { key: KindFilter; ja: string; en: string; test: (r: MoveRow) => boolean }[] = [
  { key: 'all', ja: 'すべて', en: 'All', test: () => true },
  { key: 'signing', ja: 'FA契約', en: 'Signings', test: (r) => r.kind === 'signing' },
  { key: 'trade', ja: 'トレード', en: 'Trades', test: (r) => r.kind === 'trade' },
  { key: 'other', ja: 'ウェーバー・自由契約', en: 'Waivers & releases', test: (r) => r.kind !== 'signing' && r.kind !== 'trade' },
  { key: 'jp', ja: '日本人', en: 'Japanese', test: (r) => r.japanese },
];

const KIND_LABEL: Record<MoveRow['kind'], { ja: string; en: string }> = {
  signing: { ja: 'FA契約', en: 'Signing' },
  trade: { ja: 'トレード', en: 'Trade' },
  waiver: { ja: 'ウェーバー', en: 'Waivers' },
  released: { ja: '自由契約', en: 'Released' },
  retired: { ja: '引退', en: 'Retired' },
};

function md(iso: string, en: boolean): string {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!en) return `${m}月${d}日`;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function Main({ r, en }: { r: MoveRow; en: boolean }) {
  const linked = r.players.filter((p) => p.href);
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center border border-line px-1.5 py-0.5 text-[11px] text-ink">
          {r.minor ? (en ? 'Minor league deal' : 'マイナー契約') : en ? KIND_LABEL[r.kind].en : KIND_LABEL[r.kind].ja}
        </span>
        {r.japanese && (
          <span className="inline-flex items-center border border-ink px-1.5 py-0.5 text-[11px] font-semibold text-ink">
            {en ? 'Japanese' : '日本人'}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[15px] font-semibold leading-relaxed text-ink">{r.text}</p>
      {r.terms && (
        <p className="mt-1 text-sm leading-relaxed text-ink">
          {r.terms.text}{' '}
          <a
            href={r.terms.source}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-xs text-ink-mute underline decoration-line underline-offset-2 hover:text-ink"
          >
            {r.terms.sourceName}
          </a>
        </p>
      )}
      {/* MLB公式の記録の文は訳さずそのまま添える（訳で情報を足さない）。 */}
      <p lang="en" className="mt-1 text-[13px] leading-relaxed text-ink-mute">
        {r.desc}
      </p>
      {linked.length > 0 && (
        <p className="mt-0.5 flex flex-wrap gap-x-4">
          {linked.map((p) => (
            <Link
              key={p.href}
              href={p.href!}
              className="inline-flex min-h-[40px] items-center text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
            >
              {en ? `${p.name}: stats and reactions` : `${p.name}の成績と海外の反応`} <span aria-hidden className="ml-1">→</span>
            </Link>
          ))}
        </p>
      )}
    </li>
  );
}

/**
 * 移籍情報の一覧（日付順）。絞り込み（種類・球団）だけがクライアントの仕事で、行の文はサーバーで組んである。
 * 初回のHTMLに全行が載る（畳んだ「そのほか」も含む）＝検索と読み上げからは全部見える。
 */
export default function StoveMovesList({
  days,
  teams,
  en,
}: {
  days: MoveDay[];
  teams: { id: number; name: string }[];
  en: boolean;
}) {
  const [kind, setKind] = useState<KindFilter>('all');
  const [team, setTeam] = useState<number | null>(null);
  const k = KINDS.find((x) => x.key === kind) ?? KINDS[0];
  const pass = (r: MoveRow) => k.test(r) && (team == null || r.teamIds.includes(team));
  const filtered = kind !== 'all' || team != null;
  const shown = days
    .map((d) => ({ ...d, main: d.main.filter(pass), other: d.other.filter(pass) }))
    // 絞り込み中は該当の無い日を出さない。絞っていないときは「この日FAになった選手」だけの日も出す。
    .filter((d) => d.main.length || d.other.length || (!filtered && d.fa));
  const all = days.flatMap((d) => [...d.main, ...d.other]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label={en ? 'Filter by type' : '種類で絞り込む'} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {KINDS.map((f) => {
            const n = all.filter(f.test).length;
            if (f.key !== 'all' && n === 0) return null;
            const on = f.key === kind;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(f.key)}
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
        <label className="flex shrink-0 items-center gap-2 text-sm text-ink-soft">
          <span>{en ? 'Team' : '球団'}</span>
          <select
            value={team ?? ''}
            onChange={(e) => setTeam(e.target.value ? Number(e.target.value) : null)}
            className="min-h-[40px] border border-line bg-surface px-2 text-sm text-ink"
          >
            <option value="">{en ? 'All teams' : 'すべての球団'}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">{en ? 'No moves match this filter yet.' : 'この条件に当てはまる動きは、まだありません。'}</p>
      ) : (
        <div className="mt-5 space-y-8">
          {shown.map((d) => (
            <section key={d.date} aria-labelledby={`day-${d.date}`}>
              <h3 id={`day-${d.date}`} className="border-b border-ink pb-1.5 text-base font-bold tabular-nums text-ink">
                {md(d.date, en)}
              </h3>
              {d.main.length > 0 && (
                <ul className="divide-y divide-line">
                  {d.main.map((r) => (
                    <Main key={r.id} r={r} en={en} />
                  ))}
                </ul>
              )}
              {!filtered && d.fa && (
                <p className="border-t border-line py-3 text-sm leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">
                    {en ? `${d.fa.count} players became free agents` : `${d.fa.count}人がFAに`}
                  </span>
                  {d.fa.notable.length > 0 && (
                    <>
                      {en ? ': ' : '：'}
                      {d.fa.notable.map((p, i) => (
                        <span key={`${p.name}-${i}`}>
                          {i > 0 && (en ? ', ' : '、')}
                          {p.href ? (
                            <Link href={p.href} className="underline decoration-line underline-offset-2 hover:text-ink">
                              {p.name}
                            </Link>
                          ) : (
                            p.name
                          )}
                        </span>
                      ))}
                      {d.fa.count > d.fa.notable.length && (en ? ' and others' : 'ほか')}
                    </>
                  )}
                </p>
              )}
              {d.other.length > 0 && (
                <details className="group border-t border-line" open={filtered}>
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-sm text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span>
                      {en
                        ? `${d.other.length} more (minor league deals, waivers, releases)`
                        : `そのほか${d.other.length}件（マイナー契約・ウェーバー・自由契約）`}
                    </span>
                    <span aria-hidden className="text-ink-mute transition-transform group-open:rotate-45">＋</span>
                  </summary>
                  <ul className="pb-3 text-sm leading-relaxed text-ink-soft">
                    {d.other.map((r) => (
                      <li key={r.id} className="py-1">
                        {r.text}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
