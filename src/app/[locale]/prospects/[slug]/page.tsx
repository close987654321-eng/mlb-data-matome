import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getNpbProspect, npbThreadsOf, NPB_PROSPECTS } from '@/lib/npbPlayers';
import { getPlayer } from '@/lib/players';
import { buildFeed, feedKey } from '@/lib/feed';
import FeedCard from '@/components/FeedCard';
import Breadcrumbs from '@/components/Breadcrumbs';
import SectionHeading from '@/components/SectionHeading';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates, OG_IMAGES, OG_IMAGES_TW } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => NPB_PROSPECTS.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = getNpbProspect(slug);
  if (!p) return {};
  const en = locale === 'en';
  // 今季の見出し数値を description 前方へ＝「{選手} 成績 2026」系の指名検索に当てる（公知の数値のみ）。
  const statStr = p.season
    ? p.season.stats.slice(0, 3).map((s) => `${en ? s.en : s.ja}${s.value}`).join(en ? ' · ' : '・')
    : '';
  const title = en
    ? `${p.nameEn} — NPB Player on the MLB Radar`
    : `${p.nameJa} — MLB挑戦が注目されるNPBの逸材`;
  const description = en
    ? `${p.nameEn} (${p.team.en}, ${p.pos.en})${statStr ? ` — 2026 ${statStr}.` : '.'} Why MLB scouts are watching, his posting outlook, and a hub of overseas reactions.`
    : `${p.nameJa}（${p.team.ja}・${p.pos.ja}）の2026年成績${statStr ? `（${statStr}）` : ''}、MLB注目ポイント、ポスティング見通し、海外の反応まとめ。`;
  return {
    title,
    description,
    alternates: localeAlternates(locale, `/prospects/${slug}`),
    openGraph: { title, description, type: 'profile', url: absoluteUrl(locale, `/prospects/${slug}`), images: OG_IMAGES },
    twitter: { card: 'summary_large_image', title, description, images: OG_IMAGES_TW },
  };
}

export default async function ProspectPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const p = getNpbProspect(slug);
  if (!p) notFound();
  const t = await getTranslations();
  const en = locale === 'en';

  const all = await getAllThreads();
  const threads = npbThreadsOf(p, all);
  const feed = buildFeed(threads, []);

  const compPlayer = p.compMlbSlug ? getPlayer(p.compMlbSlug) : undefined;
  const url = absoluteUrl(locale, `/prospects/${slug}`);

  // Person/Athlete + ProfilePage（記事側 about:Person と双方向化）。数値は持たず実在の所属/経歴のみ（捏造しない）。
  const person = {
    '@type': ['Person', 'Athlete'],
    '@id': `${url}#person`,
    name: p.nameJa,
    alternateName: p.nameEn,
    jobTitle: '野球選手',
    sport: 'Baseball',
    url,
    description: en ? p.bio.en : p.bio.ja,
    memberOf: { '@type': 'SportsTeam', name: en ? p.team.en : p.team.ja },
    ...(p.sameAs?.length ? { sameAs: p.sameAs } : {}),
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        mainEntity: person,
        ...(threads.length
          ? { relatedLink: threads.slice(0, 25).map((th) => absoluteUrl(locale, `/${th.sport}/${th.id}`)) }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t('prospects.indexTitle'), item: absoluteUrl(locale, '/prospects') },
          { '@type': 'ListItem', position: 3, name: p.nameJa, item: url },
        ],
      },
    ],
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs
        items={[
          { name: t('nav.home'), href: '/' },
          { name: t('prospects.indexTitle'), href: '/prospects' },
          { name: p.nameJa },
        ]}
      />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">{t('prospects.eyebrow')}</span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
          {en ? p.nameEn : p.nameJa}
          <span className="ml-2 text-base font-normal text-ink-soft">{en ? p.nameJa : p.nameEn}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {en ? p.team.en : p.team.ja} · {en ? p.pos.en : p.pos.ja}
        </p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{en ? p.bio.en : p.bio.ja}</p>
        {p.sameAs?.length ? (
          <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-ink-soft">
            {p.sameAs.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex min-h-[44px] items-center underline hover:text-ink"
              >
                {u.includes('wikipedia') ? 'Wikipedia' : '公式'}
              </a>
            ))}
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-3">
          <SectionHeading label={t('prospects.mlbWatch')} />
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-ink">{en ? p.mlbWatch.en : p.mlbWatch.ja}</p>
      </section>

      <section>
        <div className="mb-3">
          <SectionHeading label={t('prospects.posting')} />
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{en ? p.posting.en : p.posting.ja}</p>
      </section>

      <section>
        <div className="mb-3">
          <SectionHeading label={t('prospects.comp')} />
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
          {en ? p.comp.en : p.comp.ja}
          {compPlayer && (
            <>
              {' '}
              <Link href={`/player/${compPlayer.slug}`} className="text-ink underline transition-colors hover:text-ink-soft">
                {en ? compPlayer.nameEn : compPlayer.nameJa} <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </p>
      </section>

      <section>
        <div className="mb-3">
          <SectionHeading label={t('prospects.stats')} />
        </div>
        {p.season ? (
          <div className="rounded-[2px] border border-line bg-surface p-5">
            <dl className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-5">
              {p.season.stats.map((s) => (
                <div key={s.ja}>
                  <dt className="text-xs text-ink-soft">{en ? s.en : s.ja}</dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-ink-soft">
              {t('prospects.statsAsOf', { date: p.season.asOf })}
              {' · '}
              <a
                href={p.season.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline hover:text-ink"
              >
                {t('prospects.statsSource')}
              </a>
            </p>
          </div>
        ) : (
          <p className="rounded-[2px] border border-dashed border-line p-4 text-sm text-ink-soft">
            {t('prospects.statsSoon')}
          </p>
        )}
      </section>

      {feed.length > 0 && (
        <section>
          <div className="mb-5">
            <SectionHeading label={t('prospects.articles', { name: p.nameJa, count: threads.length })} lead />
          </div>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {feed.map((item, i) => (
              <li key={feedKey(item)}>
                <FeedCard item={item} locale={locale} priority={i === 0} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pt-2">
        <div className="mb-3">
          <SectionHeading label={t('prospects.relatedTitle')} level="h3" />
        </div>
        <div className="flex flex-wrap gap-2">
          {NPB_PROSPECTS.filter((x) => x.slug !== slug).map((rp) => (
            <Link
              key={rp.slug}
              href={`/prospects/${rp.slug}`}
              className="inline-flex min-h-[40px] items-center rounded-[2px] border border-line px-3.5 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              {en ? rp.nameEn : rp.nameJa}
            </Link>
          ))}
        </div>
      </section>

      <p className="text-sm">
        <Link href="/prospects" className="text-ink-soft transition-colors hover:text-ink hover:underline">
          ← {t('prospects.indexTitle')}
        </Link>
      </p>
    </div>
  );
}
