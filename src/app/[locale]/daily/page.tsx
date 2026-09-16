import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { getThreadsBySport } from '@/lib/data';
import { threadTitle } from '@/lib/series';
import { issueDate } from '@/lib/frontpage';
import { buildDailyFaq } from '@/lib/dailyHub';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import FaqList from '@/components/FaqList';
import {
  DailyTodayTable,
  DailyHeroTeaser,
  DailyBuzzAndTomorrow,
  DailyWeekHeroes,
  DailyHeroCounts,
} from '@/components/DailyHubSections';
import { absoluteUrl, localeAlternates, SITE_URL } from '@/lib/site';
import type { Thread } from '@/types/thread';
import { type Locale } from '@/lib/i18n';

/**
 * 「きょうの日本人選手」の恒久ハブ（/daily）＝このシリーズの検索の受け皿。
 *
 * なぜ要るか: 日付付きの日次記事（{date}-jp-daily）は翌日に鮮度が死に、URLが毎日変わるので
 * 「日本人 メジャー 今日」「MLB 日本人 今日の結果」系のクエリで評価が積み上がらない。
 * 恒久URLのここが常に最新号を持ち（毎日16時の publish → 再ビルドで丸ごと入れ替わる＝QDF鮮度）、
 * 日付記事は Discover/アーカイブ用の flow に回す（flow→stock の二層。tagHub/sportHub と同じ勝ち型）。
 * あわせて全カードの一覧＝コレクションブックを兼ねる（No.001 から並ぶ「集めてる感」が再訪の理由になる）。
 *
 * 2026-09-16 増補: 「3行＋カード＋ボタン」だけだった面に、①全員の結果表 ②主役の現地の声2件と動画
 * ③現地ざわつきの見出し＋あすの日本人 ④この1週間の主役 ⑤主役回数 ⑥FAQ（FAQPage）を足した。
 * 狙いは、検索で来た人が記事へ跳ばずに「全員の結果・明日誰が投げる」まで分かること、そして
 * 週の流れとコレクションの面白さで翌日また開く理由を置くこと。すべて日次記事 JSON の再表示。
 */

/** daily 記事（きょうの日本人選手）だけを新しい順に。 */
async function getIssues(): Promise<Thread[]> {
  const threads = await getThreadsBySport('mlb');
  return threads
    .filter((t) => t.daily)
    .sort((a, b) => b.id.localeCompare(a.id)); // id 先頭が JST 日付＝辞書順で日付順
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const issues = await getIssues();
  const latest = issues[0];
  const title = t('dailyHub.metaTitle');
  const description = t('dailyHub.metaDesc', {
    no: String(latest?.daily?.cardNo ?? ''),
    date: latest ? issueDate(latest.fetchedAt) : '',
  });
  return {
    // レイアウトの '%s｜海外の反応' テンプレートを回さない（メタタイトルに「海外の反応」を含むため二重になる）。
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: absoluteUrl(locale, '/daily'),
      // 最新号の16:9カード＝このハブの顔。無ければ layout の既定OGに任せる。
      ...(latest?.media?.kind === 'image'
        ? { images: [{ url: latest.media.url, width: latest.media.width, height: latest.media.height }] }
        : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: localeAlternates(locale, '/daily'),
  };
}

export default async function DailyHubPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const en = locale === 'en';
  const issues = await getIssues();
  const latest = issues[0] ?? null;
  const archive = issues.slice(1);
  const faq = buildDailyFaq(latest, issues.length, en);

  const hubUrl = absoluteUrl(locale, '/daily');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        // ハブ自体はコレクションページ。発行者はサイト共通の #organization に名寄せ。
        '@type': 'CollectionPage',
        name: t('dailyHub.metaTitle'),
        url: hubUrl,
        inLanguage: locale,
        publisher: { '@id': `${SITE_URL}/#organization` },
        ...(latest ? { dateModified: latest.fetchedAt } : {}),
      },
      // 最新号から順に号のリスト（検索エンジンに「毎日刊行のシリーズ」だと機械可読で伝える）。
      {
        '@type': 'ItemList',
        itemListElement: issues.slice(0, 30).map((issue, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: threadTitle(issue, locale),
          url: absoluteUrl(locale, `/mlb/${issue.id}`),
        })),
      },
      // FAQPage は画面の「よくある質問」と同じ配列から組む＝表示と構造化データが食い違わない。
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: en ? item.q.en : item.q.ja,
          acceptedAnswer: { '@type': 'Answer', text: en ? item.a.en : item.a.ja },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t('dailyHub.title') },
        ],
      },
    ],
  };

  const latestNo = latest?.daily?.cardNo != null ? String(latest.daily.cardNo).padStart(3, '0') : '';

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-4">
        <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: t('dailyHub.title') }]} />
      </div>
      <PlayerHubNav />

      <header className="mt-8">
        <h1 className="text-2xl font-bold tracking-wide text-ink sm:text-3xl">
          {t('dailyHub.title')}
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          {t('dailyHub.lead')}
        </p>
        <p className="mt-1 text-xs text-ink-mute">
          {t('dailyHub.updatedDaily')}
          {latest ? (
            <>
              {' · '}
              {en ? `Latest No.${latestNo} (${issueDate(latest.fetchedAt)}) · ${issues.length} issues so far` : `最新 No.${latestNo}（${issueDate(latest.fetchedAt)}）· これまで${issues.length}号`}
            </>
          ) : null}
        </p>
      </header>

      {latest && (
        <div className="mt-10 space-y-12">
          <section>
            <SectionHeading
              label={`${t('dailyHub.latest')} No.${latestNo} · ${issueDate(latest.fetchedAt)}`}
              lead
            />
            {/* ① 最新号の3行＝このハブの「きょうの答え」。記事に行かなくても結果が分かる状態にする。 */}
            <ul className="mt-5 space-y-2.5 border-l-2 border-ink pl-5">
              {latest.daily!.threeLines.map((line, i) => (
                <li key={i} className="text-[15px] font-medium leading-relaxed text-ink">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          {/* ② 全員の結果を1表で。主役は行を強調。 */}
          <DailyTodayTable latest={latest} locale={locale} />

          {/* ③ 主役の物語は現地の声2件と動画だけ先出し＝続きは記事へ。 */}
          <DailyHeroTeaser latest={latest} locale={locale} />

          {/* ④ 現地ざわつきの見出し＋あすの日本人（毎日読む理由）。 */}
          <DailyBuzzAndTomorrow latest={latest} locale={locale} />

          {/* ⑤ 最新号のカード（クリックで記事へ）。保存・転載OKの配布物＝記事側に共有ボタンがある。 */}
          {latest.daily!.cardUrl && (
            <section>
              <SectionHeading label={`${t('daily.card')} No.${latestNo}`} level="h2" />
              <Link href={`/mlb/${latest.id}`} className="mt-5 block">
                <Image
                  src={latest.daily!.cardUrl}
                  alt={t('dailyHub.issueAlt', { no: String(latest.daily!.cardNo ?? '') })}
                  width={1080}
                  height={1350}
                  priority
                  className="mx-auto h-auto w-full max-w-sm"
                />
              </Link>
              <p className="mt-4 text-center text-xs text-ink-soft">
                {t('daily.cardLicense')} · {t('daily.followLead')}{' '}
                <a
                  href="https://x.com/gogogo123ka"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
                >
                  @gogogo123ka
                </a>
              </p>
              <p className="mt-5 text-center">
                <Link
                  href={`/mlb/${latest.id}`}
                  className="inline-flex min-h-[44px] items-center gap-2 bg-ink px-6 text-sm font-semibold text-paper transition-opacity hover:opacity-85"
                >
                  {t('dailyHub.readArticle')}
                  <span aria-hidden>→</span>
                </Link>
              </p>
            </section>
          )}

          {/* ⑥ 週の流れとコレクションの面白さ＝翌日また開く理由。 */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <DailyWeekHeroes issues={issues} locale={locale} />
            <DailyHeroCounts issues={issues} locale={locale} />
          </div>

          <FaqList faq={faq} en={en} heading={en ? 'About this series' : 'このシリーズのよくある質問'} />
        </div>
      )}

      {/* ⑦ アーカイブ＝コレクションブック。No.001 から並ぶ「集めてる感」が毎日来る理由になる。
          キャプションに主役と節目を添えて、カードの絵だけでなく「あの日の号」を探せるようにする。 */}
      {archive.length > 0 && (
        <section className="mt-14">
          <SectionHeading label={t('dailyHub.archive')} count={issues.length} />
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {archive.map((issue) => (
              <li key={issue.id}>
                <Link href={`/mlb/${issue.id}`} className="group block">
                  {issue.daily!.cardUrl ? (
                    <Image
                      src={issue.daily!.cardUrl}
                      alt={t('dailyHub.issueAlt', { no: String(issue.daily!.cardNo ?? '') })}
                      width={540}
                      height={675}
                      className="h-auto w-full transition-opacity group-hover:opacity-85"
                    />
                  ) : (
                    <span className="block aspect-[4/5] bg-surface ring-1 ring-line" />
                  )}
                  <span className="mt-1.5 block text-xs tabular-nums text-ink-soft">
                    No.{String(issue.daily!.cardNo ?? '').padStart(3, '0')} ·{' '}
                    {issueDate(issue.fetchedAt)}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-mute">
                    {issue.daily!.hero.player}
                    {issue.daily!.hero.note ? ` · ${issue.daily!.hero.note}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
