import { useTranslations } from 'next-intl';
import { Link } from '@/lib/navigation';
import SectionHeading from '@/components/SectionHeading';
import type { PlayerJournal, JournalEntry } from '@/lib/playerJournal';

/**
 * 選手タグLPの「シーズン観測日誌」。月ごとの区切りで時系列（開幕→現在）に読ませ、
 * 山場の試合にだけ編集部の地の文（editorJa）が挟まる＝評価の推移を物語として追える。
 * 引用は逐語転載のみで、各エントリから必ず出典記事へリンクする（playerJournal.ts が正）。
 * ja 専用（編集部の和文を英語ページに混ぜない＝編集部ノートと同じ扱い）。
 */

function dateJa(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

/** 票数の出し方は TagVoices と同じ規約（YouTube=👍 / Reddit=▲ / interview=票なし）。 */
function QuoteMeta({ entry, author, score }: { entry: JournalEntry; author: string; score: number }) {
  const isYoutube = entry.format === 'youtube';
  const isInterview = entry.format === 'interview';
  return (
    <p className="mt-1.5 flex items-center gap-3 text-xs text-ink-mute">
      <span className="font-medium text-ink-soft">{isYoutube || isInterview ? author : `u/${author}`}</span>
      {!isInterview && (
        <span className="tabular-nums">
          {isYoutube ? '👍' : '▲'} {score.toLocaleString()}
        </span>
      )}
    </p>
  );
}

export default function SeasonJournal({ journal, label }: { journal: PlayerJournal; label: string }) {
  const t = useTranslations();
  if (journal.entries.length === 0) return null;

  // 月ごとにまとめて「4月 → 5月 → …」の章立てにする（entries は昇順で渡ってくる）。
  const months: { label: string; entries: JournalEntry[] }[] = [];
  for (const entry of journal.entries) {
    const m = `${Number(entry.date.slice(5, 7))}月`;
    const last = months[months.length - 1];
    if (last && last.label === m) last.entries.push(entry);
    else months.push({ label: m, entries: [entry] });
  }

  return (
    <section className="space-y-3">
      <SectionHeading label={label} count={journal.entries.length} />
      <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{t('tag.journalLead')}</p>
      <div className="divide-y divide-line border-y border-line">
        {months.map((month) => (
          <div key={month.label} className="py-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
              {month.label}
            </p>
            <ol className="divide-y divide-line">
              {month.entries.map((entry) => (
                <li key={`${entry.threadId}/${entry.date}`} className="py-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-sm font-semibold text-ink">{entry.headingJa}</p>
                    <span className="shrink-0 text-xs tabular-nums text-ink-mute">
                      {dateJa(entry.date)}
                    </span>
                  </div>
                  {/* 山場だけの編集部メモ＝左罫1本で引用と声色を分ける（無彩色の規律）。 */}
                  {entry.editorJa && (
                    <p className="mt-3 max-w-prose border-l-2 border-ink pl-3.5 text-sm leading-relaxed text-ink">
                      {entry.editorJa}
                    </p>
                  )}
                  <ul className="mt-3 space-y-3">
                    {entry.quotes.map((q, i) => (
                      <li key={i}>
                        <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
                          “{(q.bodyJa ?? '').trim() || q.bodyEn}”
                        </p>
                        <QuoteMeta entry={entry} author={q.author} score={q.score} />
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/${entry.sport}/${entry.threadId}`}
                    className="group mt-3 inline-flex items-center gap-1 text-xs text-ink-mute transition-colors hover:text-ink"
                  >
                    {t('tag.journalSource')}
                    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-ink-mute">{t('tag.journalNote')}</p>
    </section>
  );
}
