import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { playerSlugByJaName } from '@/lib/players';
import SectionHeading from '@/components/SectionHeading';
import MediaEmbed from '@/components/MediaEmbed';
import DailyCardShare from '@/components/DailyCardShare';
import StoryBlocks from '@/components/StoryBlocks';
import type { ThreadDaily } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/**
 * 日次記事「きょうの日本人選手」の本文。帯番組のコーナー構成で描く（骨子v2・2026-07-30）:
 *
 *   ① きょうの3行 → ② きょうの主役 → ③ 残り全員ひと言ずつ → ④ きょうの現地ざわつき
 *   → ⑤ きょうの1枚（カード配布）→ ⑥ あすの日本人
 *
 * なぜコーナー制か: 試合ごとのデータ反復（スコア表→成績→コメント列）は「データベースの出力」で、
 * 読み物にならなかった。毎日同じリズムのコーナーが習慣を作り、②の「地の文に引用を差し込む」書き方が
 * 記事自身の語りを作る。忙しい読者は①で帰れて、読みたい読者は②④で10分楽しめる二層構造。
 */
export default async function DailyArticle({
  daily,
  sourceUrl,
  locale,
}: {
  daily: ThreadDaily;
  sourceUrl: string; // 埋め込めない動画のときの送客先
  locale: Locale;
}) {
  const t = await getTranslations();
  const heroSlug = playerSlugByJaName(daily.hero.player);

  return (
    <div>
      {/* ① きょうの3行 — 忙しい人はここで帰ってOK。先に全部言うことが信頼＝毎日開く理由になる。 */}
      <section className="mt-8">
        <SectionHeading label={t('daily.threeLines')} />
        <ul className="mt-4 space-y-2.5 border-l-2 border-ink pl-5">
          {daily.threeLines.map((line, i) => (
            <li key={i} className="text-[15px] font-medium leading-relaxed text-ink">
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* ② きょうの主役 — 1人だけ深く。試合の物語＋現地の声。 */}
      <section className="mt-12">
        <SectionHeading label={t('daily.hero')} />
        <h2 className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-bold text-ink sm:text-3xl">
          {/* 選手名は選手LP（/tag）へ。日次記事は出場者全員をタグに持つ規約＝LPの存在が保証される */}
          {heroSlug ? (
            <Link href={`/tag/${encodeURIComponent(daily.hero.player)}`} className="hover:underline">
              {daily.hero.player}
            </Link>
          ) : (
            daily.hero.player
          )}
          {daily.hero.note && (
            <span className="rounded-[2px] border border-ink/30 px-2 py-0.5 text-sm font-semibold text-ink">
              {daily.hero.note}
            </span>
          )}
        </h2>
        {/* 結果と成績は1行ずつ。表は出さない＝数字は物語の脇に立たせる。 */}
        <p className="mt-2 text-sm text-ink-soft">
          <span className="mr-2 text-xs text-ink-mute">{daily.hero.team}</span>
          <span className="tabular-nums">{daily.hero.result}</span>
        </p>
        <p className="mt-1 text-sm tabular-nums text-ink-soft">{daily.hero.line}</p>
        {daily.hero.season && (
          <p className="mt-1 text-xs tabular-nums text-ink-mute">
            {t('daily.seasonPrefix')} {daily.hero.season}
          </p>
        )}

        {daily.hero.media && (
          <MediaEmbed media={daily.hero.media} sourceUrl={daily.hero.media.url || sourceUrl} />
        )}

        <StoryBlocks blocks={daily.hero.blocks} />
      </section>

      {/* ③ 残り全員、ひと言ずつ — 網羅性はここで担保。反応が無い日は正直にそう書く。 */}
      <section className="mt-12">
        <SectionHeading label={t('daily.shorts')} />
        <div className="mt-4 divide-y divide-line border-y border-line">
          {daily.shorts.map((s) => {
            const slug = playerSlugByJaName(s.player);
            return (
              <div key={s.player} className="py-5">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-base font-bold text-ink">
                    {slug ? (
                      <Link href={`/tag/${encodeURIComponent(s.player)}`} className="hover:underline">
                        {s.player}
                      </Link>
                    ) : (
                      s.player
                    )}
                  </span>
                  <span className="text-xs text-ink-mute">{s.team}</span>
                  <span className="text-xs tabular-nums text-ink-soft">{s.result}</span>
                </p>
                <p className="mt-1 text-sm tabular-nums text-ink">{s.line}</p>
                {s.season && (
                  <p className="mt-0.5 text-xs tabular-nums text-ink-mute">
                    {t('daily.seasonPrefix')} {s.season}
                  </p>
                )}
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.text}</p>
                {s.quotes?.map((c, i) => (
                  <blockquote key={i} className="mt-3 border-l-2 border-line pl-4">
                    <p className="text-sm leading-relaxed text-ink">“{c.bodyJa}”</p>
                    <footer className="mt-1 text-xs text-ink-mute">
                      — {c.author} <span className="tabular-nums">👍{c.score.toLocaleString()}</span>
                    </footer>
                  </blockquote>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* ④ きょうの現地ざわつき — 日本の報道に絶対出ない話題の定位置。日本人と無関係でも拾う。
          1〜2件。見出し（SectionHeading）は先頭の1回だけ出し、2件目は同じコーナーの続きとして並べる。 */}
      {(daily.buzz ?? []).map((buzz, i) => (
        <section key={buzz.title} className={i === 0 ? 'mt-12' : 'mt-10'}>
          {i === 0 && <SectionHeading label={t('daily.buzz')} />}
          <h3 className="mt-4 text-xl font-bold leading-snug text-ink sm:text-2xl">{buzz.title}</h3>
          {buzz.media && <MediaEmbed media={buzz.media} sourceUrl={buzz.media.url || sourceUrl} />}
          <StoryBlocks blocks={buzz.blocks} />
        </section>
      ))}

      {/* ⑤ きょうの1枚 — カードは「保存・転載していい配布物」として渡す。詳細は DailyCardShare。 */}
      {daily.cardUrl && (
        <section className="mt-12">
          <SectionHeading
            label={
              daily.cardNo != null
                ? `${t('daily.card')} No.${String(daily.cardNo).padStart(3, '0')}`
                : t('daily.card')
            }
          />
          <figure className="mt-5">
            <Image
              src={daily.cardUrl}
              alt={t('daily.cardAlt')}
              width={1080}
              height={1350}
              className="mx-auto h-auto w-full max-w-sm"
            />
          </figure>
          <DailyCardShare
            cardUrl={daily.cardUrl}
            cardNo={daily.cardNo}
            shareLabel={t('daily.cardShare')}
            saveLabel={t('daily.cardSave')}
            licenseLabel={t('daily.cardLicense')}
          />
          {/* コレクションブック（/daily）への導線＝シリーズの恒久ハブに評価とセッションを沈める。 */}
          <p className="mt-4 text-center text-sm">
            <Link
              href="/daily"
              className="font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
            >
              {t('daily.archiveLink')} <span aria-hidden>→</span>
            </Link>
          </p>
          {/* 記事読者→Xフォローへの導線。カードはXで先行して流れる＝「毎日見たければフォロー」が自然に立つ。 */}
          <p className="mt-3 text-center text-xs text-ink-soft">
            {t('daily.followLead')}{' '}
            <a
              href="https://x.com/gogogo123ka"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
            >
              @gogogo123ka
            </a>
          </p>
        </section>
      )}

      {/* ⑥ あすの日本人 — 毎日読む理由を最後に置く（先発予定は statsapi probables の実測のみ）。 */}
      {daily.tomorrow && daily.tomorrow.length > 0 && (
        <section className="mt-12">
          <SectionHeading label={t('daily.tomorrow')} />
          <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-ink">
            {daily.tomorrow.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="mt-[0.7em] h-px w-4 shrink-0 bg-ink" />
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
