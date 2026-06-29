import type { ThreadTranscript } from '@/types/thread';

type Props = {
  segments: ThreadTranscript[];
  heading: string; // ローカライズ済みの見出し（例: 「番組での会話」）
};

/**
 * 動画内のキャスター/解説者の会話を、動画とコメントの間に表示する。
 * 番組セグメント（MLB Network 等）を記事化するとき、海外ファンのコメントへ入る前の
 * 「文脈」として読ませる。発言者が分かる場合は名前を、原文があれば添える。
 */
export default function Transcript({ segments, heading }: Props) {
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
            <p className="text-[15px] leading-relaxed text-ink">{s.ja}</p>
            {s.en && (
              <p className="mt-1 text-xs italic leading-relaxed text-ink-soft">{s.en}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
