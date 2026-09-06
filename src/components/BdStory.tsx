import LiteVideo from './LiteVideo';
import SectionHeading from './SectionHeading';
import type { BdStory as BdStoryData, BdBeat } from '@/lib/bdStory';

/**
 * BreakingDown イベントページの読み物「オーディションで何が起きたか」。ja 専用。
 *
 * リール（BdReel）が縦スワイプで**送る**面なのに対して、こちらは**止まって読ませる**面。
 * 役割が違うので共存させる（2026-09-06 村山さん合意）。決定的な違いは、こちらの引用は
 * ページ本文の HTML に載る＝検索エンジンが読める。リールの在庫は /bd-reel.json で noindex。
 *
 * 見せ方の核は「やり取り」（kind: 'thread'）＝親コメントに返信をぶら下げる。
 * BD のコメント欄でいちばん読ませるのは単発の名文ではなく応酬で、いいね順に並べるだけでは
 * その絵は絶対に出てこない（返信は親のスコアに乗らないため）。
 *
 * 数値・動画タイトルは data/bd-auditions.json（CI 更新）由来、地の文と引用の選定は
 * data/bd-story/{event}.json 由来。詳細と規律は src/lib/bdStory.ts のヘッダに書いた。
 */

function num(n: number): string {
  return n.toLocaleString('ja-JP');
}

/** 1件の引用（著者といいね数を必ず添える＝出所の無い転載にしない）。 */
function Attribution({ author, likeCount }: { author: string; likeCount: number }) {
  return (
    <p className="mt-1.5 text-xs tabular-nums text-ink-mute">
      {author}
      <span className="mx-2 text-line">/</span>
      {num(likeCount)}いいね
    </p>
  );
}

function Beat({ beat }: { beat: BdBeat }) {
  return (
    <li className="py-5">
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{beat.text}</p>
      <Attribution author={beat.author} likeCount={beat.likeCount} />
      {beat.roleJa && (
        <p className="mt-1 text-xs font-medium text-ink-soft">{beat.roleJa}</p>
      )}

      {beat.replies && beat.replies.length > 0 && (
        <div className="mt-4 border-l border-line pl-4">
          {typeof beat.replyCount === 'number' && beat.replyCount > 0 && (
            <p className="text-xs tabular-nums text-ink-mute">
              このコメントへの返信 {num(beat.replyCount)}件（抜粋 {beat.replies.length}件）
            </p>
          )}
          <ul className="mt-2 space-y-3">
            {beat.replies.map((r) => (
              <li key={`${r.author}-${r.likeCount}-${r.text.slice(0, 12)}`}>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                  {r.text}
                </p>
                <Attribution author={r.author} likeCount={r.likeCount} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export default function BdStory({
  data,
  eventNameJa,
}: {
  data: BdStoryData;
  eventNameJa: string;
}) {
  return (
    <section id="audition" className="space-y-6">
      <SectionHeading label={`${eventNameJa} オーディションで何が起きたか`} />

      {/* 中の人の導入（人が書く地の文。事実だけ・評価は引用に語らせる） */}
      <p className="max-w-prose whitespace-pre-line text-sm leading-loose text-ink">
        {data.ledeJa}
      </p>

      <p className="text-xs text-ink-mute">
        オーディション{data.totals.videos}本・通算{num(data.totals.views)}回再生／
        コメント{num(data.totals.comments)}件（{data.asOf}時点）。
        このページに載せている引用は{num(data.quoted)}件で、本文はすべて原文のまま。
      </p>

      <div className="divide-y divide-line border-t border-line">
        {data.chapters.map((ch) => (
          <article key={ch.videoId} id={`vol${ch.vol}`} className="space-y-4 py-8">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
                vol.{ch.vol}
              </span>
              <span className="text-xs tabular-nums text-ink-mute">
                {ch.publishedAt}
                <span className="mx-2 text-line">/</span>
                {num(ch.viewCount)}回再生
                <span className="mx-2 text-line">/</span>
                コメント{num(ch.commentCount)}件
              </span>
            </div>

            <h3 className="text-base font-bold leading-snug text-ink sm:text-lg">{ch.title}</h3>

            {/* 動画タイトルが報じている範囲だけ＝公式の正式発表ではないことは見出しで断る */}
            {ch.matchJa && (
              <p className="inline-block border border-line px-3 py-1.5 text-xs text-ink-soft">
                この回で動いた対戦：{ch.matchJa}
              </p>
            )}

            {/* ファサード＝クリックするまで iframe を作らない（5本ぶんのプレイヤーを初期ロードしない） */}
            <div className="relative aspect-video overflow-hidden bg-black">
              <LiteVideo
                embedUrl={`https://www.youtube.com/embed/${ch.videoId}`}
                thumbUrl={`https://i.ytimg.com/vi/${ch.videoId}/hqdefault.jpg`}
                title={ch.title}
              />
            </div>

            <div className="max-w-prose space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
                中の人メモ
              </p>
              <p className="whitespace-pre-line text-sm leading-loose text-ink">{ch.noteJa}</p>
            </div>

            <ul className="divide-y divide-line border-t border-line">
              {ch.beats.map((b) => (
                <Beat key={`${b.author}-${b.likeCount}`} beat={b} />
              ))}
            </ul>

            <p>
              <a
                href={`https://www.youtube.com/watch?v=${ch.videoId}`}
                target="_blank"
                rel="noopener"
                className="text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
              >
                この回をYouTubeで見る <span aria-hidden>→</span>
              </a>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
