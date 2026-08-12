import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllTags } from '@/lib/tags';
import { linkableFighterOf } from '@/lib/fighterHub';
import {
  bdAuditionsFetchedAt,
  bdEventSummaries,
  bdTotals,
  bdVoicesByEvent,
  type BdEventSummary,
} from '@/lib/bdAuditions';
import EventTimeline from '@/components/EventTimeline';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { SPORT_INFO } from '@/lib/sports';
import { type Locale } from '@/lib/i18n';

/**
 * BreakingDown オーディション全史（データ観測ページ）。
 *
 * 切り抜きが語らない切り口＝**数字とコメント欄**でオーディションの歴史を読む:
 * 1. 大会別の再生数・コメント密度（朝倉未来チャンネルの公開統計の機械取得）
 * 2. 各大会の人気コメント逐語引用（機械抽出＝人もAIも本文を触らない）
 * 3. オーディション出身→RIZIN のパイプライン（裏取り済みの事実のみ）
 *
 * 毎大会更新: `node scripts/fetch-bd-auditions.mjs --voices` → コミットで数字と引用が伸びる。
 * 俺ボイスの地の文は山場だけ人書き（クラウド禁止規律は season-journal と同じ）＝
 * このページの初版は事実の記述だけで組み、読み解きの地の文は村山レビュー後に足す。
 */

/** 「読み解き」以前の、データから直接言える観測（実測値の記述のみ＝更新時はデータと一緒に見直す）。 */
const OBSERVATIONS: string[] = [
  '大会あたりの合計再生のピークは BD6（2022年10月・5,541万回）。以降はゆるやかに下がり、直近の BD19・BD20 は1,600万回前後で推移している。',
  'いっぽうコメント密度（コメント数÷再生数）は逆に上がっている。初期〜中期はおおむね0.10〜0.15%、直近の BD19 は0.20%・BD20 は0.18%と過去最高圏。再生が減ってもコメントは減っていない＝「観る祭り」から「語る祭り」へ視聴者の関わり方が変わっている。',
  '単発の最多再生は BD6 のオーディションVol.4（1,737万回）。歴代最多いいねのコメント（38,836いいね）もこの動画に付いている。',
  '古い動画ほどコメントの蓄積期間が長い（BD4は4年以上、BD20は約2ヶ月）。その不利があってなお直近大会の密度が高い、という点に注意して読む。',
];

/** オーディション→RIZIN の出世魚（裏取り済みの事実のみ。未確認の経歴は書かない）。 */
const PIPELINE: { nameJa: string; bodyJa: string }[] = [
  {
    nameJa: 'エドポロキング',
    bodyJa:
      '2023年のBreakingDownで注目を集めた204cmのヘビー級。RIZINでは無傷の3連勝（2026年8月時点）で、RIZIN.54では元極真世界王者を膝でTKO。11月8日・千葉のヘビー級ジャパングランプリ決勝でスダリオ剛と対戦する。',
  },
  {
    nameJa: '冨澤大智',
    bodyJa:
      'BreakingDown出身の元消防士。RIZINでは3勝2敗（2026年8月時点）で、2024年大晦日に三浦孝太を左膝一発でKO、2026年6月には加藤瑠偉に1R TKO勝ち。9月10日の超RIZIN.5にも出場する。',
  },
  {
    nameJa: 'ヒロヤ',
    bodyJa:
      '朝倉未来の弟子としてBreakingDownで名を上げてRIZINへ。元修斗世界2階級王者・新井丈からの勝利や、2025年5月・東京ドーム「RIZIN男祭り」での篠塚辰樹戦1R KOを挙げた。',
  },
];

/** パイプラインの文脈（両リングの公式な行き来）。 */
const PIPELINE_NOTE =
  'BreakingDown 20（福岡）ではRIZIN勢との対抗戦も組まれ、アラン・ヒロ・ヤマニハが12秒一本勝ちするなどRIZINの2勝1敗。オーディション→BD本戦→RIZINという出世コースだけでなく、両リングは公式に行き来する関係になっている。';

const PATH = '/breakingdown-audition';

function manJa(n: number): string {
  // 億超えは「4.7億」、万台は「5,541万」、それ未満は実数。桁がひと目で読めることを優先する。
  if (n >= 100_000_000) return `${(Math.round(n / 10_000_000) / 10).toLocaleString('ja-JP')}億`;
  return n >= 10000 ? `${Math.round(n / 10000).toLocaleString('ja-JP')}万` : n.toLocaleString('ja-JP');
}

function densityPct(d: number): string {
  return `${(d * 100).toFixed(2)}%`;
}

/** 「2022-10」→「2022年10月」（動画の投稿時期。大会開催日ではない）。 */
function monthJa(iso: string): string {
  const [y, m] = iso.split('-');
  return `${y}年${Number(m)}月`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [totals, fetchedAt] = await Promise.all([bdTotals(), bdAuditionsFetchedAt()]);
  // 「ブレイキングダウン オーディション／歴代」のクエリ形に正面から当てる（absolute で
  // layout の「｜海外の反応」を外す＝BD はうちの看板と框が違うため名乗らない）。
  const title = 'ブレイキングダウン歴代オーディション全史｜再生数・人気コメントをデータで見る';
  const description = `朝倉未来チャンネルのBreakingDownオーディション動画 全${totals.videos}本・合計${manJa(
    totals.views,
  )}回再生（${fetchedAt}時点）を大会別に集計。再生数とコメント密度の推移、各大会の人気コメント、オーディション出身でRIZINに到達した選手までを1ページで。切り抜きではなくデータで読む観測ページ、毎大会更新。`;
  const url = absoluteUrl(locale, PATH);
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: 'website', url, images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
    alternates: localeAlternates(locale, PATH),
  };
}

function StatBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full bg-ink/[0.06]" aria-hidden>
      <div className="h-full bg-ink" style={{ width: `${width}%` }} />
    </div>
  );
}

function EventRow({ s, maxViews, maxDensity }: { s: BdEventSummary; maxViews: number; maxDensity: number }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[3.5rem_1fr_1fr] sm:gap-x-6">
      <div>
        <p className="text-sm font-bold tabular-nums text-ink">BD{s.event}</p>
        <p className="text-[11px] tabular-nums text-ink-mute">{monthJa(s.firstAt.slice(0, 7))}</p>
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-[0.15em] text-ink-mute">再生</span>
          <span className="text-xs tabular-nums text-ink">
            {manJa(s.views)}回<span className="text-ink-mute">（{s.videoCount}本）</span>
          </span>
        </div>
        <StatBar value={s.views} max={maxViews} />
      </div>
      <div className="col-start-2 space-y-1 sm:col-start-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-[0.15em] text-ink-mute">コメント密度</span>
          <span className="text-xs tabular-nums text-ink">
            {densityPct(s.density)}
            <span className="text-ink-mute">（{s.comments.toLocaleString('ja-JP')}件）</span>
          </span>
        </div>
        <StatBar value={s.density} max={maxDensity} />
      </div>
    </div>
  );
}

export default async function BdAuditionPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [summaries, totals, voices, fetchedAt, allTags] = await Promise.all([
    bdEventSummaries(),
    bdTotals(),
    bdVoicesByEvent(),
    bdAuditionsFetchedAt(),
    getAllTags(),
  ]);
  const maxViews = Math.max(...summaries.map((s) => s.views));
  const maxDensity = Math.max(...summaries.map((s) => s.density));
  const lpTags = new Set(allTags.map(({ tag }) => tag));
  const mmaLabel = locale === 'en' ? SPORT_INFO.mma.labelEn : SPORT_INFO.mma.labelJa;
  const pageUrl = absoluteUrl(locale, PATH);
  const heading = 'BreakingDownオーディション全史';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: heading,
        url: pageUrl,
        dateModified: fetchedAt,
        description: `BreakingDownオーディション動画${totals.videos}本の再生数・コメントの定点観測`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: mmaLabel, item: absoluteUrl(locale, '/mma') },
          { '@type': 'ListItem', position: 3, name: heading, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs
        items={[{ name: t('nav.home'), href: '/' }, { name: mmaLabel, href: '/mma' }, { name: heading }]}
      />

      <header className="space-y-3 border-b border-line pb-8">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">DATA</span>
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">{heading}</h1>
        {/* 導入の地の文（俺ボイス・2026-08-13 村山さんレビュー済み）。本数・再生は実データを差し込む。 */}
        <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
          オーディション動画の切り抜きは腐るほどある。でも数字を並べた奴は見たことがなかったので、
          全部数えた。朝倉未来チャンネルの歴代オーディション{totals.videos}本、合計
          {manJa(totals.views)}再生。数えて分かったのは、この祭りは「衰退してる」んじゃなくて
          「変質してる」ってことだった。再生数はBD6がピークでいまは1/3。なのにコメント密度は過去最高。
          観る人が減って、語る人が残った。
        </p>
        <p className="text-xs text-ink-mute">
          数値は{fetchedAt}時点のYouTube公開統計。コメント引用は各大会の最多コメント動画から機械抽出した
          いいね数上位（宣伝・URLつきを除外）で、本文は一字も変えていない。動画そのものは各リンク先の
          公式チャンネルで。
        </p>
      </header>

      {/* ① 大会別の再生数×コメント密度（このページの主役データ） */}
      <section className="space-y-5">
        <SectionHeading label="大会別の再生数とコメント密度" count={summaries.length} />
        <div className="divide-y divide-line border-y border-line">
          {summaries.map((s) => (
            <EventRow key={s.event} s={s} maxViews={maxViews} maxDensity={maxDensity} />
          ))}
        </div>
        <div className="border border-line p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-ink-mute">
            データから直接言えること
          </p>
          <ul className="mt-2 max-w-prose list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
            {OBSERVATIONS.map((o) => (
              <li key={o.slice(0, 12)}>{o}</li>
            ))}
          </ul>
        </div>
        {/* データの読み（俺ボイス・2026-08-13 村山さんレビュー済み）。 */}
        <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
          俺の読みはこうだ。初期のオーディションは「ヤバい素人を見る動画」で、いまは「常連の続き物を
          追う番組」になった。BD16以降のコメント欄が「◯◯いらないボタン」だらけなのは民度の低下じゃなくて、
          視聴者が編成に参加し始めた証拠。番組が視聴者を選んでたのが、視聴者が番組を編成する側に回った。
          テレビが30年かけて失った距離感を、この祭りは4年で通り過ぎた。
        </p>
      </section>

      {/* ② コメント欄で読む歴史（逐語引用＝機械コピー） */}
      <section className="space-y-5">
        <SectionHeading label="コメント欄で読む歴史" />
        <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
          各大会の代表動画（その大会で最もコメントが集まった1本）の人気コメントを、古い順にそのまま並べる。
          誰が主役だったか、視聴者が何で笑い何に怒っていたか、コメント欄の使い方がどう変わったか——
          時系列で読むと、オーディションが「喧嘩の場」から「続き物のドラマ」へ、そしてコメント欄が
          「感想の場」から「投票装置」へ変わっていく様子が原文のまま残っている。
        </p>
        <div className="divide-y divide-line border-y border-line">
          {summaries.map((s) => {
            const picks = voices.get(s.event) ?? [];
            if (picks.length === 0) return null;
            const video = picks[0];
            return (
              <div key={s.event} className="grid gap-3 py-5 sm:grid-cols-[7rem_1fr]">
                <div>
                  <p className="text-lg font-bold tabular-nums text-ink">BD{s.event}</p>
                  <p className="text-xs tabular-nums text-ink-mute">{monthJa(s.firstAt.slice(0, 7))}</p>
                </div>
                <div className="space-y-3">
                  {picks.map((v) => (
                    <figure key={v.videoId + v.author} className="max-w-prose">
                      <blockquote className="border-l-2 border-ink pl-4 text-sm leading-relaxed text-ink">
                        {v.text}
                      </blockquote>
                      <figcaption className="mt-1 pl-4 text-xs text-ink-mute">
                        {v.author} ・ いいね {v.likeCount.toLocaleString('ja-JP')}
                      </figcaption>
                    </figure>
                  ))}
                  <p className="text-xs">
                    <a
                      href={`https://www.youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener"
                      className="text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
                    >
                      {video.videoTitle} →
                    </a>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {/* 歴史の締めの地の文（俺ボイス・2026-08-13 村山さんレビュー済み）。 */}
        <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
          BD4の頃「こめおが喧嘩する風潮を創った」と書かれた文化は、4年後、運営に呼ばれた審査員が
          全員にコケにされる展開を「これは流石にひでぇよw」と笑うところまで来た。次の札幌で
          コメント欄が何を発明するか、このページで数え続ける。
        </p>
      </section>

      {/* ③ オーディション→RIZIN のパイプライン（裏取り済みの事実のみ） */}
      <section className="space-y-5">
        <SectionHeading label="オーディションからRIZINへ" count={PIPELINE.length} />
        <div className="divide-y divide-line border-y border-line">
          {PIPELINE.map((p) => {
            const lp = linkableFighterOf(p.nameJa, lpTags);
            return (
              <div key={p.nameJa} className="py-4">
                {lp ? (
                  <Link
                    href={`/tag/${encodeURIComponent(lp.nameJa)}`}
                    className="group text-sm font-bold text-ink transition-colors hover:text-ink-soft"
                  >
                    {p.nameJa}
                    <span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                ) : (
                  <p className="text-sm font-bold text-ink">{p.nameJa}</p>
                )}
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">{p.bodyJa}</p>
              </div>
            );
          })}
        </div>
        <p className="max-w-prose text-xs leading-relaxed text-ink-mute">{PIPELINE_NOTE}</p>
      </section>

      {/* ④ 回遊: 次のBD大会（観戦ガイド）と大会年表 */}
      <section className="border border-ink p-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">{t('events.nextEyebrow')}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          次回 BreakingDown 21 は2026年9月19日（土）・札幌開催。対戦カード・チケット・視聴方法は
          観戦ガイドにまとめていて、大会が終わればこのページの数字と引用も1大会ぶん伸びる。
        </p>
        <p className="mt-3">
          <Link
            href="/breakingdown21"
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-ink bg-ink px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-ink-soft"
          >
            {t('events.hubCta')} <span aria-hidden>→</span>
          </Link>
        </p>
      </section>

      <EventTimeline />
    </div>
  );
}
