import { useTranslations } from "next-intl";
import SectionHeading from "@/components/SectionHeading";
import type { Fighter } from "@/lib/fighters";
import type { EditorNote } from "@/lib/editorNotes";
import type { JournalEntry, JournalQuote } from "@/lib/playerJournal";

/**
 * 格闘技タグLPの「いま」ブロック＝PlayerNow のファイター版。検索着地の第一意図
 * 「直近、海外はどう見てる？」に最初の1画面で答え、数字で目を引く:
 *  - 最新の山場の声（キャリア観測日誌の journalLatestHighlight）
 *  - 編集部ノート（総評）を吸収
 *  - ビッグ数字パネル: 通算戦績・KO率（record からの単純演算）＋ headlineStats
 *    （世界戦連勝・P4P順位など fighters.ts の裏取り済みカタログ値）
 * 数値は手動カタログの再表示のみ＝ここでは KO率（kos/wins）以外を計算で作らない。
 * ja 専用（編集部の和文を英語ページに混ぜない＝日誌と同じ扱い）。
 */

function dateJa(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

/** 引用の話者行（規約は SeasonJournal / PlayerNow と同じ: YouTube=👍 / Reddit=▲ + u/ 接頭）。 */
function quoteAuthor(entry: JournalEntry, quote: JournalQuote) {
  const isYoutube = entry.format === "youtube" || Boolean(entry.video);
  return (
    <>
      <span className="font-medium text-ink-soft">
        {isYoutube ? quote.author : `u/${quote.author}`}
      </span>
      <span className="tabular-nums">
        {isYoutube ? "👍" : "▲"} {quote.score.toLocaleString()}
      </span>
    </>
  );
}

export default function FighterNow({
  fighter,
  highlight,
  editorNote,
  showJournalJump,
}: {
  fighter: Fighter;
  highlight?: { entry: JournalEntry; quote: JournalQuote } | null;
  editorNote?: EditorNote | null;
  showJournalJump?: boolean;
}) {
  const t = useTranslations();
  const r = fighter.record;
  const record = `${r.wins}-${r.losses}${r.draws > 0 ? `-${r.draws}` : ""}`;
  // KO率＝勝利のうちKO決着の割合（公知の戦績からの単純演算。母数0は出さない）
  const koRate = r.wins > 0 ? `${Math.round((r.kos / r.wins) * 100)}%` : null;
  const tiles: { value: string; labelJa: string }[] = [
    { value: record, labelJa: `通算戦績（${r.kos}KO）` },
    ...(koRate ? [{ value: koRate, labelJa: "KO率" }] : []),
    ...(fighter.headlineStats ?? []),
  ];

  const quoteBody = highlight
    ? (highlight.quote.bodyJa ?? "").trim() || highlight.quote.bodyEn
    : null;

  return (
    <section className="space-y-5">
      <SectionHeading label={t("tag.now", { name: fighter.nameJa })} />
      <div className="rounded-[3px] border border-line bg-surface p-5 sm:p-6">
        {/* 最新の山場の声＝このLPの顔。 */}
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
        {/* 編集部ノート（総評）＝「いま」に吸収（PlayerNow と同じ判断）。 */}
        {editorNote && (
          <div className={quoteBody ? "pt-5" : ""}>
            <p className="max-w-prose text-sm leading-relaxed text-ink">
              {editorNote.noteJa}
            </p>
            <p className="mt-2 text-xs text-ink-mute">
              {t("tag.editorNoteBy")} ・{" "}
              {t("tag.updated", { date: editorNote.updatedAt })}
            </p>
          </div>
        )}
        {/* ビッグ数字パネル＝戦績・KO率・世界戦・P4P。デカく出して最初の1画面で格を伝える。 */}
        <div
          className={
            quoteBody || editorNote ? "mt-5 border-t border-line pt-5" : ""
          }
        >
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.labelJa}>
                <dd className="text-3xl font-bold tabular-nums tracking-tight text-ink sm:text-4xl">
                  {tile.value}
                </dd>
                <dt className="mt-1 text-xs leading-snug text-ink-mute">
                  {tile.labelJa}
                </dt>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-ink-mute">
            {t("tag.asOfDate", { date: r.asOf })}・{fighter.accoladeJa}
          </p>
        </div>
        {showJournalJump && (
          <div className="mt-5 flex justify-end border-t border-line pt-3.5">
            <a
              href="#journal-latest"
              className="inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {t("tag.nowLatest")}
              <span aria-hidden>↓</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
