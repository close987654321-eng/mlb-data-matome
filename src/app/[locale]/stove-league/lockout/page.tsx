import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getStoveLeague, fmtDate, offseasonLabel } from '@/lib/stoveLeague';
import { getLockout, lockoutThreads, buildLockoutFaq } from '@/lib/lockout';
import StoveReactions from '@/components/StoveReactions';
import SectionHeading from '@/components/SectionHeading';
import ShareButtons from '@/components/ShareButtons';
import FaqList from '@/components/FaqList';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

/**
 * MLBのロックアウト（/stove-league/lockout）。中身の正は data/stove-lockout.json、期限の日時は
 * stove-league.json の日程（'cba'）。並びは問いの順＝いまどうなっているか → 何が止まるのか →
 * なぜ → 日本人選手はどうなる → 前はどうだった → 海外の反応 → よくある質問。
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function load() {
  const [lo, cat] = await Promise.all([getLockout(), getStoveLeague()]);
  if (!lo) return null;
  const cba = cat?.dates.find((d) => d.key === 'cba' && d.date) ?? null;
  return { lo, cat, cba };
}

const TITLE_WORD = {
  pending: { ja: 'いつから・なぜ起きる・日本人選手への影響', en: 'When, Why and What It Means for Japanese Players' },
  on: { ja: 'いつまで・なぜ起きた・日本人選手への影響', en: 'How Long, Why and What It Means for Japanese Players' },
  ended: { ja: '経過と決着・日本人選手への影響', en: 'How It Played Out' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const data = await load();
  if (!data) return {};
  const { lo } = data;
  const en = locale === 'en';
  const off = offseasonLabel(lo.season);
  const title = en
    ? `MLB Lockout ${off}: ${TITLE_WORD[lo.status].en}`
    : `MLBロックアウト${off}｜${TITLE_WORD[lo.status].ja}`;
  const description = en
    ? `${lo.headline.en} What a lockout freezes, the salary cap dispute behind it, what it means for free agents and posted Japanese players, and what happened last time — with sources, updated ${fmtDate(lo.asOf, true)}.`
    : `${lo.headline.ja}ロックアウトで何が止まるのか、争点のサラリーキャップ、FAやポスティングの日本人選手への影響、前回の経過を出典つきでまとめる（${fmtDate(lo.asOf, false)}更新）。`;
  return {
    title,
    description,
    alternates: localeAlternates(locale, '/stove-league/lockout'),
    openGraph: { title, description, type: 'article', url: absoluteUrl(locale, '/stove-league/lockout'), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
  };
}

function Source({ url, name, en }: { url: string; name: string; en: boolean }) {
  return (
    <p className="mt-1 text-xs text-ink-mute">
      {en ? 'Source: ' : '出典：'}
      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-2 hover:text-ink">
        {name}
      </a>
    </p>
  );
}

export default async function LockoutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await load();
  if (!data) notFound();
  const { lo, cba } = data;
  const t = await getTranslations();
  const en = locale === 'en';
  const off = offseasonLabel(lo.season);
  const threads = lockoutThreads(await getAllThreads(), lo.season);
  const faq = buildLockoutFaq(lo);

  const title = en ? `MLB Lockout ${off}` : `MLBロックアウト ${off}`;
  const hubTitle = en ? `MLB Hot Stove ${off}` : `MLBストーブリーグ ${off}`;
  const url = absoluteUrl(locale, '/stove-league/lockout');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: title,
        url,
        description: en ? lo.headline.en : lo.headline.ja,
        dateModified: `${lo.asOf}T00:00:00+09:00`,
      },
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
          { '@type': 'ListItem', position: 2, name: hubTitle, item: absoluteUrl(locale, '/stove-league') },
          { '@type': 'ListItem', position: 3, name: title, item: url },
        ],
      },
    ],
  };

  const checked = lo.checkedAt && lo.checkedAt > lo.asOf ? fmtDate(lo.checkedAt, en) : '';
  const statusLabel = {
    pending: { ja: '協定の期限まで', en: 'Before the deadline' },
    on: { ja: 'ロックアウト中', en: 'Locked out' },
    ended: { ja: '決着', en: 'Settled' },
  }[lo.status];

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="space-y-4">
        <Breadcrumbs
          items={[{ name: t('nav.home'), href: '/' }, { name: hubTitle, href: '/stove-league' }, { name: title }]}
        />
        <PlayerHubNav />
      </div>

      <section>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">Lockout</span>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          MLB{en ? ' ' : ''}
          <span className="inline-block">{en ? 'Lockout' : 'ロックアウト'}</span>{' '}
          <span className="inline-block">{off}</span>
        </h1>
        {/* 第一の問い「いまどうなっているのか」に、題のすぐ下で答える。 */}
        <p className="mt-3 max-w-prose text-[15px] leading-[1.8] text-ink">{en ? lo.headline.en : lo.headline.ja}</p>
        <p className="mt-1 text-xs text-ink-mute">
          {en
            ? `Updated ${fmtDate(lo.asOf, true)}${checked ? ` · checked ${checked}` : ''} · news checked every morning at 6 a.m. JST`
            : `${fmtDate(lo.asOf, false)}更新${checked ? `・${checked}確認` : ''}・報道は毎朝6時に確認`}
        </p>

        {cba?.date && (
          <div className="mt-5 border border-line bg-surface p-4">
            <p className="text-xs text-ink-mute">{en ? statusLabel.en : statusLabel.ja}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink">
              {fmtDate(cba.date, en)}
              {cba.time && <span className="ml-2 text-base font-semibold">{en ? cba.time.en : cba.time.ja}</span>}
              <span className="ml-2 text-sm font-normal text-ink-soft">{en ? 'Japan time' : '（日本時間）'}</span>
            </p>
            {lo.deadlineNote && (
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{en ? lo.deadlineNote.en : lo.deadlineNote.ja}</p>
            )}
          </div>
        )}
      </section>

      <section id="news" className="space-y-2">
        <SectionHeading label={en ? 'Latest' : '最新の動き'} lead />
        <ol className="divide-y divide-line border-y border-line">
          {lo.timeline.map((n) => (
            <li key={`${n.date}-${n.source}`} className="grid gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[5.5rem_1fr]">
              <time dateTime={n.date} className="text-sm font-semibold tabular-nums text-ink">
                {fmtDate(n.date, en)}
              </time>
              <div className="min-w-0">
                <p className="text-sm leading-relaxed text-ink-soft">{en ? n.en : n.ja}</p>
                <a
                  href={n.source}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-0.5 inline-block text-xs text-ink-mute underline decoration-line underline-offset-2 hover:text-ink"
                >
                  {n.sourceName}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="what" className="space-y-3">
        <SectionHeading label={en ? 'What a lockout is, and what stops' : 'ロックアウトとは｜何が止まるのか'} lead />
        <p className="max-w-prose text-[15px] leading-[1.8] text-ink">
          {en
            ? 'A lockout is a measure in which club owners shut players out of club activity and freeze signings and other transactions.'
            : 'ロックアウトは、球団経営者側が選手を球団の活動から締め出し、契約や移籍の手続きを止める措置です。'}
        </p>
        <ul className="max-w-prose space-y-2">
          {lo.what.items.map((x) => (
            <li key={x.en} className="border-l-2 border-ink pl-3 text-[15px] leading-relaxed text-ink">
              {en ? x.en : x.ja}
            </li>
          ))}
        </ul>
        <p className="max-w-prose text-[15px] leading-[1.8] text-ink">{en ? lo.what.vsStrike.en : lo.what.vsStrike.ja}</p>
        <Source url={lo.what.source} name={lo.what.sourceName} en={en} />
      </section>

      <section id="why" className="space-y-5">
        <SectionHeading label={en ? 'Why: the issues' : 'なぜ起きるのか｜争点'} count={lo.issues.length} lead />
        {lo.issues.map((x) => (
          <div key={x.title.en}>
            <h3 className="text-sm font-bold text-ink">{en ? x.title.en : x.title.ja}</h3>
            <p className="mt-1.5 max-w-prose text-[15px] leading-[1.8] text-ink">{en ? x.en : x.ja}</p>
            <Source url={x.source} name={x.sourceName} en={en} />
          </div>
        ))}
      </section>

      <section id="japan" className="space-y-5">
        <SectionHeading label={en ? 'What it means for Japanese players' : '日本人選手への影響'} count={lo.japan.length} lead />
        {lo.japan.map((x) => (
          <div key={x.title.en}>
            <h3 className="text-sm font-bold text-ink">{en ? x.title.en : x.title.ja}</h3>
            <p className="mt-1.5 max-w-prose text-[15px] leading-[1.8] text-ink">{en ? x.en : x.ja}</p>
            <Source url={x.source} name={x.sourceName} en={en} />
            {x.href && (
              <Link
                href={x.href}
                className="inline-flex min-h-[44px] items-center text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
              >
                {en ? 'Where each player stands' : '選手ごとの現在地を見る'} <span aria-hidden className="ml-1">→</span>
              </Link>
            )}
          </div>
        ))}
      </section>

      <section id="history" className="space-y-5">
        <SectionHeading label={en ? 'What happened before' : '過去の例'} count={lo.history.length} lead />
        {lo.history.map((h) => (
          <div key={h.label.en}>
            <h3 className="text-sm font-bold text-ink">
              {en ? h.label.en : h.label.ja}
              {h.from && h.to && (
                <span className="ml-2 text-xs font-normal tabular-nums text-ink-mute">
                  {fmtDate(h.from, en, 1)}
                  {en ? ' – ' : '〜'}
                  {fmtDate(h.to, en, 1)}
                  {h.days ? (en ? ` (${h.days} days)` : `（${h.days}日間）`) : ''}
                </span>
              )}
            </h3>
            <p className="mt-1.5 max-w-prose text-[15px] leading-[1.8] text-ink">{en ? h.en : h.ja}</p>
            <Source url={h.source} name={h.sourceName} en={en} />
          </div>
        ))}
      </section>

      <StoveReactions
        threads={threads}
        locale={locale}
        label={{ ja: 'ロックアウトへの海外の反応', en: 'Overseas reactions to the lockout' }}
      />

      <div id="faq">
        <FaqList faq={faq} en={en} heading={en ? 'Lockout FAQ' : 'ロックアウトのよくある質問'} />
      </div>

      <ShareButtons url={url} title={en ? title : `${title}｜${TITLE_WORD[lo.status].ja}`} />

      <div className="flex flex-col text-sm">
        <Link href="/stove-league" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Hot stove hub: Japanese players, calendar and reactions' : 'ストーブリーグ：日本人選手の去就・日程・海外の反応'}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link href="/stove-league/fa" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Free agent rankings: who has signed, who is left' : 'FAランキング：誰が決まり、誰が残っているか'}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link href="/stove-league/guide" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Offseason terms: luxury tax, qualifying offers and more' : 'オフの用語：ぜいたく税・クオリファイングオファーとは'}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
        <Link href="/prospects" className="inline-flex min-h-[44px] items-center text-ink-soft transition-colors hover:text-ink hover:underline">
          {en ? 'Japanese players heading to MLB (posting and international FA)' : `メジャー挑戦する日本人選手${lo.season + 1}（ポスティング・海外FA）`}{' '}
          <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>
    </div>
  );
}
