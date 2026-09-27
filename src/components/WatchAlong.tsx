import StickyVideo from './StickyVideo';
import Transcript from './Transcript';
import SectionHeading from './SectionHeading';
import { scoreLabel } from '@/lib/scoreLabel';
import type { Thread, ThreadComment } from '@/types/thread';

type Props = {
  thread: Thread;
  comments: ThreadComment[]; // フック除外済み・配列順
  pickedLabel: string; // 「○○件から抜粋」の見出し
  hintLabel: string; // 動画下のスクロール案内
  transcriptLabel: string; // 番組トークの見出し（あるときだけ使う）
  unpinLabel: string; // 動画のピン留めをやめる
  pinLabel: string; // 動画のピン留めに戻す
  locale: string; // 票数ラベルの言い方（ja=「いいね 1,869」/ en=「1,869 likes」）
};

/**
 * 動画つき記事のデフォルト表示：動画を上部に置き、（再生した人には）その裏をコメントが流れていく。
 * 動画とコメントを同じ親（この section）の直下に縦並びで置くことで sticky を成立させる。
 * ピン留めを再生後だけに絞る判断は StickyVideo 側のコメント参照。
 */
export default function WatchAlong({
  thread,
  comments,
  pickedLabel,
  hintLabel,
  transcriptLabel,
  unpinLabel,
  pinLabel,
  locale,
}: Props) {
  // コメントの出所で表示を変える: reddit=u/接頭辞+▲ / interview=名前のみ / youtube=名前そのまま+「いいね」
  const isInterview = thread.format === 'interview';
  const isYoutube = thread.format === 'youtube';
  const authorLabel = (a: string) => (isInterview || isYoutube ? a : `u/${a}`);
  // 訳（bodyJa）は en 面でも日本語＝html の lang="en" を打ち消して和文として組ませる（ja 面では継ぐ）。
  const jaLang = locale === 'ja' ? undefined : 'ja';
  return (
    <section className="mt-8">
      {thread.media && (
        <StickyVideo
          media={thread.media}
          sourceUrl={thread.sourceUrl}
          hintLabel={hintLabel}
          unpinLabel={unpinLabel}
          pinLabel={pinLabel}
        />
      )}

      {/* 番組トーク（あれば）を動画とコメントの間に挟む。海外ファンのコメントに入る前の文脈。 */}
      {thread.transcript && thread.transcript.length > 0 && (
        <Transcript segments={thread.transcript} heading={transcriptLabel} locale={locale} />
      )}

      <div className="mt-5">
        <SectionHeading label={pickedLabel} />
      </div>
      {/* 罫線のリスト（1件ずつの枠付きカードはやめた）。発言と発言の間（上下 py-5＝40px＋罫）を
          発言の中の間（名前→訳 6px・訳→原文 8px）の2倍以上に取り、「ここから次の人」を余白で分ける。
          強調（isHighlight）は背景の濃淡ではなく左の余白側に墨の2px線を引く＝本文の左端は他の
          コメントとそろえたまま目印だけ足す（-left-3＝12px は main の左右余白 20px の内側に収まる）。 */}
      <ul className="divide-y divide-line">
        {comments.map((c, i) => (
          <li
            key={i}
            className={`py-5 ${
              c.isHighlight
                ? 'relative before:absolute before:-left-3 before:bottom-5 before:top-5 before:w-[2px] before:bg-ink'
                : ''
            }`}
          >
            <div className="flex min-w-0 items-baseline justify-between gap-3 text-xs text-ink-soft">
              {/* 長いハンドル名でも横にはみ出さないよう、どこでも折り返せるようにする */}
              <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
                {authorLabel(c.author)}
              </span>
              {/* score=0 は「未取得」（old.reddit がログイン壁の日など）で実測0票ではない。
                  0 を出すと読者には不人気コメントに見えるので記号ごと落とす＝記事本文・
                  StoryBlocks・TagVoices と同じ扱い（値は捏造せず保存したまま）。 */}
              {!isInterview && c.score > 0 && (
                <span className="shrink-0 tabular-nums">
                  {scoreLabel(c.score, isYoutube ? 'youtube' : 'reddit', locale)}
                </span>
              )}
            </div>
            <p lang={jaLang} className="mt-1.5 text-base leading-[1.8] text-ink">
              {c.bodyJa}
            </p>
            {/* 原文（英語）は訳の補足。斜体はやめ（和文の中で読みにくい）、lang="en" で英語として組ませる。
                日本語ソース（原文＝訳）では bodyEn が空なので併記しない。 */}
            {c.bodyEn && (
              <p lang="en" className="mt-2 text-[13px] leading-[1.6] text-ink-soft">
                {c.bodyEn}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
