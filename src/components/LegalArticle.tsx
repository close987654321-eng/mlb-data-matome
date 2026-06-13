import type { LegalDoc } from '@/lib/legal';

/**
 * プライバシーポリシー・運営者情報・お問い合わせなどの法務系ページ共通レンダラ。
 * 構造化済みの LegalDoc（見出し＋段落＋箇条書き）を読みやすい記事体裁で出す。
 * children には問い合わせフォームへの CTA など、ドキュメント末尾の追加要素を差し込める。
 */
export default function LegalArticle({
  doc,
  updated,
  updatedLabel,
  children,
}: {
  doc: LegalDoc;
  updated?: string;
  updatedLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-prose">
      <header className="border-b border-line pb-6">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">{doc.title}</h1>
        {updated && updatedLabel && (
          <p className="mt-2 text-xs text-ink-soft">
            {updatedLabel}: {updated}
          </p>
        )}
      </header>

      {doc.intro && <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">{doc.intro}</p>}

      <div className="mt-8 space-y-8">
        {doc.sections.map((section, i) => (
          <section key={i}>
            {section.heading && (
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
                <span className="h-3 w-1 rounded-full bg-accent" />
                {section.heading}
              </h2>
            )}
            {section.paragraphs?.map((p, j) => (
              <p key={j} className="mt-2 text-[15px] leading-relaxed text-ink">
                {p}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-ink">
                {section.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {children}
    </article>
  );
}
