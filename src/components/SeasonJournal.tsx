import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/navigation";
import SectionHeading from "@/components/SectionHeading";
import {
  journalChapters,
  journalNext,
  type PlayerJournal,
  type JournalEntry,
} from "@/lib/playerJournal";

/**
 * 選手タグLPの「シーズン観測日誌」v2。
 * 引用の羅列に見えない編集構造（村山指摘「並べただけ感」への回答）:
 *  - 章立て: 評価の転換点で編集者が幕を割る（第◯章＋タイトル＋リード）＝物語として読む
 *  - 背骨タイムライン: 左の縦罫＋ノードで「上から時系列」を視覚で言う
 *  - 強弱: 通常試合は1行ビート、山場（peak）は横幅を使った見せ場（引用を横に並べる）
 * 引用は逐語転載のみで、各エントリから出典（記事 or MLB公式動画）へ必ずリンクする。
 * ja 専用（編集部の和文を英語ページに混ぜない＝編集部ノートと同じ扱い）。
 */

function dateJa(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

/** 章の期間表示（例「3月30日 — 5月17日」。1試合だけの章は単日）。 */
function rangeJa(entries: JournalEntry[]): string {
  const first = dateJa(entries[0].date);
  const last = dateJa(entries[entries.length - 1].date);
  return first === last ? first : `${first} — ${last}`;
}

/** 票数の出し方は TagVoices と同じ規約（YouTube=👍 / Reddit=▲ / interview=票なし）。 */
function quoteMeta(entry: JournalEntry, author: string, score: number) {
  const isYoutube = entry.format === "youtube" || Boolean(entry.video);
  const isInterview = entry.format === "interview";
  return (
    <span className="flex items-center gap-2.5 text-xs text-ink-mute">
      <span className="font-medium text-ink-soft">
        {isYoutube || isInterview ? author : `u/${author}`}
      </span>
      {!isInterview && (
        <span className="tabular-nums">
          {isYoutube ? "👍" : "▲"} {score.toLocaleString()}
        </span>
      )}
    </span>
  );
}

/** シーズン観測日誌（MLB選手）と、キャリア観測日誌（格闘技）の文言出し分け。 */
export type JournalVariant = "season" | "career";

/** 出典リンク（記事＝内部 / 開幕期のMLB公式ハイライト＝外部）。 */
function SourceLink({
  entry,
  variant,
}: {
  entry: JournalEntry;
  variant: JournalVariant;
}) {
  const t = useTranslations();
  if (entry.threadId && entry.sport) {
    return (
      <Link
        href={`/${entry.sport}/${entry.threadId}`}
        className="group inline-flex items-center gap-1 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        {/* キャリア版のエントリは試合以外（場外の話題）もあるので「この試合の」と言わない。 */}
        {t(
          variant === "career"
            ? "tag.careerJournalSource"
            : "tag.journalSource",
        )}
        <span
          aria-hidden
          className="transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </Link>
    );
  }
  if (entry.video) {
    return (
      <a
        href={entry.video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1 text-xs text-ink-mute transition-colors hover:text-ink"
      >
        {t("tag.journalVideoSource", { channel: entry.video.channel })}
        <span aria-hidden>↗</span>
      </a>
    );
  }
  return null;
}

/** 通常ビート＝1試合を小さく刻む（日付・見出し・引用1〜2件を締めて置く）。 */
function Beat({
  entry,
  variant,
}: {
  entry: JournalEntry;
  variant: JournalVariant;
}) {
  return (
    <li className="relative py-4 pl-8">
      <span
        aria-hidden
        className="absolute left-[1.5px] top-[1.35rem] h-2 w-2 rounded-full border border-ink-mute bg-paper"
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="shrink-0 text-xs tabular-nums text-ink-mute">
          {dateJa(entry.date)}
        </span>
        <p className="text-sm font-semibold text-ink">{entry.headingJa}</p>
      </div>
      {entry.editorJa && (
        <p className="mt-2.5 max-w-prose border-l-2 border-ink pl-3.5 text-sm leading-relaxed text-ink">
          {entry.editorJa}
        </p>
      )}
      {entry.quotes.length > 0 && (
        <ul className="mt-2.5 space-y-2.5">
          {entry.quotes.map((q, i) => (
            <li key={i} className="max-w-prose">
              <p className="text-sm leading-relaxed text-ink-soft">
                “{(q.bodyJa ?? "").trim() || q.bodyEn}”
              </p>
              <div className="mt-1">{quoteMeta(entry, q.author, q.score)}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5">
        <SourceLink entry={entry} variant={variant} />
      </div>
    </li>
  );
}

/** 山場＝横幅を使った見せ場。ノードは塗り、枠で持ち上げ、引用を横に並べて熱量を見せる。 */
function PeakBeat({
  entry,
  variant,
}: {
  entry: JournalEntry;
  variant: JournalVariant;
}) {
  return (
    <li className="relative py-5 pl-8">
      <span
        aria-hidden
        className="absolute left-[0.5px] top-[2.05rem] h-2.5 w-2.5 rounded-full bg-ink"
      />
      <div className="overflow-hidden rounded-[3px] border border-line bg-surface">
        {/* 山場のサムネ＝出典動画の公式サムネ（恒久URL）。試合の絵で見せ場に格を出す。 */}
        {entry.thumbUrl && (
          <div className="relative aspect-video border-b border-line">
            <Image
              src={entry.thumbUrl}
              alt={entry.headingJa}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
            />
          </div>
        )}
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="shrink-0 text-xs tabular-nums text-ink-mute">
              {dateJa(entry.date)}
            </span>
            <p className="text-base font-bold text-ink">{entry.headingJa}</p>
          </div>
          {entry.editorJa && (
            <p className="mt-3.5 max-w-prose border-l-2 border-ink pl-3.5 text-sm leading-relaxed text-ink">
              {entry.editorJa}
            </p>
          )}
          {entry.quotes.length > 0 && (
            <ul className="mt-4 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
              {entry.quotes.map((q, i) => (
                <li key={i}>
                  <p className="text-sm leading-relaxed text-ink-soft">
                    “{(q.bodyJa ?? "").trim() || q.bodyEn}”
                  </p>
                  <div className="mt-1.5">
                    {quoteMeta(entry, q.author, q.score)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-line pt-3">
            <SourceLink entry={entry} variant={variant} />
          </div>
        </div>
      </div>
    </li>
  );
}

export default function SeasonJournal({
  journal,
  label,
  variant = "season",
}: {
  journal: PlayerJournal;
  label: string;
  variant?: JournalVariant;
}) {
  const t = useTranslations();
  if (journal.entries.length === 0) return null;
  const chapters = journalChapters(journal);
  const next = journalNext(journal);

  return (
    <section className="space-y-4">
      <SectionHeading label={label} count={journal.entries.length} />
      <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
        {journal.introJa ?? t("tag.journalLead")}
      </p>
      <div className="space-y-9">
        {chapters.map((chapter, ci) => (
          // 最終章＝最新の観測。「いま」ブロックのアンカーの着地点（sticky ヘッダー分の余白つき）。
          <div
            key={ci}
            id={ci === chapters.length - 1 ? "journal-latest" : undefined}
            className="scroll-mt-24"
          >
            {/* 章見出し＝編集者が幕を割る。番号＋期間で「上から時系列」であることも同時に言う。 */}
            <div className="border-b border-ink pb-2.5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
                {t("tag.journalChapter", { n: ci + 1 })} ・{" "}
                {rangeJa(chapter.entries)}
              </p>
              {chapter.titleJa && (
                <h3 className="mt-1.5 text-base font-bold tracking-wide text-ink sm:text-lg">
                  {chapter.titleJa}
                </h3>
              )}
              {chapter.leadJa && (
                <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-soft">
                  {chapter.leadJa}
                </p>
              )}
            </div>
            {/* 背骨タイムライン: 左の縦罫にノードを打つ＝上から下へ時間が流れる構造を視覚で示す。 */}
            <ol className="relative">
              <span
                aria-hidden
                className="absolute bottom-2 left-[5px] top-2 w-px bg-line"
              />
              {chapter.entries.map((entry) =>
                entry.peak ? (
                  <PeakBeat
                    key={`${entry.date}/${entry.headingJa}`}
                    entry={entry}
                    variant={variant}
                  />
                ) : (
                  <Beat
                    key={`${entry.date}/${entry.headingJa}`}
                    entry={entry}
                    variant={variant}
                  />
                ),
              )}
            </ol>
          </div>
        ))}
      </div>
      {/* 次の見どころ＝物語のクリフハンガー。期限（nextUntil）を過ぎるとビルド時に自然に消える。 */}
      {next && (
        <div className="rounded-[3px] border border-ink p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
            {t("tag.journalNext")}
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink">
            {next}
          </p>
        </div>
      )}
      <p className="text-xs leading-relaxed text-ink-mute">
        {t(variant === "career" ? "tag.careerJournalNote" : "tag.journalNote")}
      </p>
    </section>
  );
}
