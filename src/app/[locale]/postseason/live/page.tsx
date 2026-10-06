import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { currentRound, gameWhen, getPostseason, nextScheduledGame, roundName, teamLabel } from '@/lib/postseason';
import { buildScenes, getScenesFile, scenesByDay } from '@/lib/postseasonScenes';
import { getAllThreads } from '@/lib/data';
import { SceneCard, dayLabel } from '@/components/PostseasonScenes';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import ReadEndSentinel from '@/components/ReadEndSentinel';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW, SITE_URL } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

/**
 * ポストシーズン名場面ライブ（2026-10-06 新設）。
 *
 * これまでの記事は「動画を見ながらコメントを読む」型だった。ここは動画を置かず、見出し・状況・海外の反応・
 * 中の人のひと言だけで、各試合の山場と現地の熱を追える面にする＝通勤中や音を出せない場所でも読める。
 * 新しい試合ほど上に積み上がる（LiveBlogPosting）。編集した場面と、まだ編集していない試合記事からの
 * 自動の場面が同じ列に並ぶ（データの正と規律は src/lib/postseasonScenes.ts）。
 *
 * URL に年号を入れない（/postseason と同じ型）＝毎年同じURLが育ち、閉幕後はその年の名場面集として残る。
 * 狙う検索は「ポストシーズン 海外の反応」「{ラウンド} 海外の反応」「{選手} ポストシーズン 海外の反応」。
 * 表の検索（組み合わせ・日程）は /postseason が受ける＝役割を分けて共食いさせない。
 */
function copy(en: boolean, season: number, count: number, latest: string | null) {
  if (en) {
    const title = `${season} MLB Postseason Moments & Overseas Reactions (Live)`;
    return {
      title,
      h1: `${season} MLB Postseason Moments`,
      eyebrow: 'Live · updated after every game',
      lead: 'No video needed. Every big moment of the postseason told through a headline, the facts, what overseas fans said, and a word from our editor. Newest games on top.',
      desc: `${season} MLB postseason moments told through overseas fan reactions, no video needed. ${count} moments so far${latest ? `; latest: ${latest}` : ''}.`,
    };
  }
  return {
    title: `MLBポストシーズン${season} 名場面の海外の反応【随時更新】`,
    h1: `MLBポストシーズン${season} 名場面ライブ`,
    eyebrow: '随時更新・試合が終わるたびに上に積み上がります',
    lead: '動画を見られない時間でも、試合の山場と現地ファンの熱はここで追えます。ポストシーズンの各試合から話題になった場面を、見出しと状況、海外の反応、中の人のひと言で並べました。新しい試合ほど上。日本人選手が絡む場面には名前の印が付きます。',
    desc: `${season}年MLBポストシーズンの名場面を、動画なしで海外の反応だけで追うライブページ。いま${count}場面${latest ? `、最新は「${latest}」` : ''}。村上宗隆・大谷翔平ら日本人選手の場面も。`,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const data = await getPostseason();
  if (!data) return {};
  const scenes = buildScenes(await getAllThreads(), data, await getScenesFile(data.season));
  const c = copy(locale === 'en', data.season, scenes.length, scenes[0]?.headline ?? null);
  return {
    // 題字に「海外の反応」を含むので layout の接尾（｜海外の反応）を付けない＝二重表記を避ける。
    title: { absolute: c.title },
    description: c.desc,
    // openGraph/twitter はページ側で書くと layout の画像が消える（site.ts の注意書き）＝既定画像を渡す。
    openGraph: { title: c.title, description: c.desc, type: 'website', url: absoluteUrl(locale, '/postseason/live'), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title: c.title, description: c.desc, images: OG_IMAGES_TW },
    alternates: localeAlternates(locale, '/postseason/live'),
  };
}

export default async function PostseasonLivePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const data = await getPostseason();
  if (!data) notFound();
  const en = locale === 'en';
  const scenes = buildScenes(await getAllThreads(), data, await getScenesFile(data.season));
  const days = scenesByDay(scenes);
  const c = copy(en, data.season, scenes.length, scenes[0]?.headline ?? null);
  const url = absoluteUrl(locale, '/postseason/live');

  // いまの局面（表の面と同じデータ）。読者が最初に知りたい「次はいつ」を題字の下で答える。
  const cur = currentRound(data);
  const next = nextScheduledGame(data);
  const champ = data.champion ? teamLabel(data.champion.id, en) : null;
  const now = champ
    ? en
      ? `${champ} won the ${data.season} World Series.`
      : `${data.season}年のワールドシリーズは${champ}が制しました。`
    : [
        cur ? (en ? `${roundName(cur, true)} under way.` : `いまは${roundName(cur, false)}の最中。`) : '',
        next
          ? en
            ? ` Next: ${teamLabel(next.game.away.id!, true)} at ${teamLabel(next.game.home.id!, true)}, ${gameWhen(next.game, true)}.`
            : `次の試合は${gameWhen(next.game, false)}（日本時間）の${teamLabel(next.game.away.id!, false)}対${teamLabel(next.game.home.id!, false)}。`
          : '',
      ].join('');

  // 試合の開始〜決着の範囲（LiveBlogPosting の coverage）。決まっていない終わりはワールドシリーズ最終戦の予定日。
  const allGames = data.series.flatMap((s) => s.games);
  const firstStart = allGames.map((g) => g.start).sort()[0];
  const lastStart = allGames.map((g) => g.start).sort().at(-1);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LiveBlogPosting',
        '@id': `${url}#live`,
        headline: c.title,
        description: c.desc,
        url,
        inLanguage: locale,
        ...(firstStart ? { coverageStartTime: firstStart } : {}),
        ...(lastStart ? { coverageEndTime: lastStart } : {}),
        ...(scenes.length ? { datePublished: scenes[scenes.length - 1].at, dateModified: scenes[0].at } : {}),
        author: { '@id': `${SITE_URL}/#organization` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        // 1場面＝1更新。本文は状況と中の人のひと言（引用は各試合の記事が持つ）。
        liveBlogUpdate: scenes.slice(0, 40).map((s) => ({
          '@type': 'BlogPosting',
          headline: s.headline,
          datePublished: s.at,
          url: `${url}#${s.thread.id}`,
          articleBody: [s.lead, s.take].filter(Boolean).join(' '),
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: en ? 'Postseason' : 'ポストシーズン', item: absoluteUrl(locale, '/postseason') },
          { '@type': 'ListItem', position: 3, name: c.h1, item: url },
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs
        items={[
          { name: t('nav.home'), href: '/' },
          { name: en ? 'Postseason' : 'ポストシーズン', href: '/postseason' },
          { name: en ? 'Moments' : '名場面ライブ' },
        ]}
      />

      <PlayerHubNav />

      <section className="border-b border-ink pb-6">
        <span className="text-xs font-medium tracking-[0.2em] text-ink-mute">{c.eyebrow}</span>
        <h1 className="mt-2 text-3xl font-bold text-ink [font-feature-settings:'palt'] sm:text-4xl">{c.h1}</h1>
        <p className="mt-3 max-w-prose text-base leading-[1.8] text-ink-soft">{c.lead}</p>
        {now && <p className="mt-3 text-sm font-medium text-ink">{now}</p>}
        <p className="mt-3 text-sm">
          <Link href="/postseason" className="text-ink-soft underline underline-offset-4 hover:text-ink">
            {en ? 'Bracket, schedule (JST) and how to watch' : 'トーナメント表・日程（日本時間）・放送と配信はこちら'}
          </Link>
        </p>
        {days.length > 1 && (
          <nav aria-label={en ? 'Jump to a day' : '日付で移動'} className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-mute">
            {days.map((d) => (
              <a key={d.day} href={`#day-${d.day}`} className="tabular-nums hover:text-ink hover:underline">
                {dayLabel(d.day, en)}
              </a>
            ))}
          </nav>
        )}
      </section>

      {days.length > 0 ? (
        days.map((d) => (
          <section key={d.day} id={`day-${d.day}`} aria-label={dayLabel(d.day, en)}>
            <h2 className="border-b border-line pb-2 text-sm font-bold tabular-nums tracking-wide text-ink">{dayLabel(d.day, en)}</h2>
            {d.scenes.map((s) => (
              <SceneCard key={s.thread.id} scene={s} locale={locale} />
            ))}
          </section>
        ))
      ) : (
        <p className="text-sm text-ink-soft">{en ? 'Moments will appear here once the games begin.' : '試合が始まると、ここに場面が積み上がります。'}</p>
      )}

      {/* 読了の番兵（GA4 read_end）。最後の場面まで読まれたかを測る。 */}
      <ReadEndSentinel id="postseason-live" category="mlb" format="story" />

      <p className="text-sm">
        <Link href="/postseason" className="text-ink underline underline-offset-4 hover:text-ink-soft">
          {en ? 'Back to the postseason bracket' : 'ポストシーズンのトーナメント表へ戻る'} <span aria-hidden>→</span>
        </Link>
      </p>
    </div>
  );
}
