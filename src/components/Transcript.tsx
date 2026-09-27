import type { ThreadTranscript } from '@/types/thread';

type Props = {
  segments: ThreadTranscript[];
  heading: string; // ローカライズ済みの見出し（例: 「番組での会話」）
  locale: string; // en 面では訳（日本語）に lang="ja" を付ける
};

/**
 * 動画内のキャスター/解説者の会話を、動画とコメントの間に表示する。
 * 番組セグメント（MLB Network 等）を記事化するとき、海外ファンのコメントへ入る前の
 * 「文脈」として読ませる。発言者が分かる場合は名前を、原文があれば添える。
 */
export default function Transcript({ segments, heading, locale }: Props) {
  // 訳は en 面でも日本語＝html の lang="en" を打ち消して和文として組ませる（ja 面では継ぐ）。
  const jaLang = locale === 'ja' ? undefined : 'ja';
  return (
    <section className="mt-8">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
        <span className="h-3 w-[2px] bg-ink" />
        {heading}
      </h2>
      <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
        {segments.map((s, i) => (
          <div key={i} className="border-l-2 border-line/70 pl-3">
            {s.speaker && (
              <p className="text-xs font-medium text-ink-soft">{s.speaker}</p>
            )}
            <p lang={jaLang} className="text-base leading-[1.8] text-ink">
              {s.ja}
            </p>
            {/* 原文（英語）は訳の補足。斜体はやめ lang="en" で英語として組ませる（コメント列と同じ扱い）。 */}
            {s.en && (
              <p lang="en" className="mt-1 text-[13px] leading-[1.6] text-ink-soft">
                {s.en}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
