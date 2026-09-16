import SectionHeading from '@/components/SectionHeading';

export type FaqItem = { q: { ja: string; en: string }; a: { ja: string; en: string } };

/**
 * 「よくある質問」の共通部品（/roy が最初の利用者）。
 *
 * なぜ要るか: 検索は「新人王 いつ発表」「村上 新人王 何位」のように問いの形で来る。地の文に同じ事実が
 * あっても、問いと答えが1対1で並んでいないと会話型の検索・AIの回答に拾われない。
 * JSON-LD の FAQPage はページ側が**同じ配列**から組む＝画面と構造化データが食い違わない。
 * 中身はそのページの他のブロックにある事実の言い換えだけにする＝出典の無い断定をFAQの形で残さない。
 * 開閉は <details> のネイティブ挙動でクライアントJSなし。閉じていてもHTMLには全文載る。
 */
export default function FaqList({ faq, en, heading }: { faq: FaqItem[]; en: boolean; heading: string }) {
  if (!faq.length) return null;
  return (
    <section>
      <div className="mb-3">
        <SectionHeading label={heading} count={faq.length} lead level="h2" />
      </div>
      <div className="border-y border-line">
        <ul className="divide-y divide-line">
          {faq.map((item) => (
            <li key={item.q.en}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{en ? item.q.en : item.q.ja}</span>
                  <span aria-hidden className="shrink-0 text-ink-mute transition-transform group-open:rotate-45">
                    ＋
                  </span>
                </summary>
                <p className="max-w-prose pb-4 text-sm leading-relaxed text-ink-soft">{en ? item.a.en : item.a.ja}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
