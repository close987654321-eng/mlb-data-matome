import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { getNpbProspect, npbThreadsOf, NPB_PROSPECTS, prospectRelated } from '@/lib/npbPlayers';
import { getPlayer } from '@/lib/players';
import { getNpbStats, headlineStats, topRanks, prospectLede } from '@/lib/npbStats';
import { buildFeed, feedKey } from '@/lib/feed';
import { tagHubVoices, voicesRecentFirst } from '@/lib/tagHub';
import FeedCard from '@/components/FeedCard';
import TagVoices from '@/components/TagVoices';
import Breadcrumbs from '@/components/Breadcrumbs';
import SectionHeading from '@/components/SectionHeading';
import PostingWatch from '@/components/PostingWatch';
import ProspectScouting from '@/components/ProspectScouting';
import ProspectCareer from '@/components/ProspectCareer';
import ProspectRanks from '@/components/ProspectRanks';
import FaqList from '@/components/FaqList';
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
  const npb = await getNpbStats();
  const stats = npb.players[slug] ?? null;
  // 年はハードコードしない＝成績JSONのシーズンから取る（年をまたいだ瞬間に古びる見出しを作らない）。
  const npbSeason = npb.season || new Date().getFullYear();
  // 今季の見出し数値を description 前方へ＝「{選手} 成績 2026」系の指名検索に当てる（公知の数値のみ）。
  // 数値は NPB公式由来の静的JSON から取る＝手入力の据え置きで古い数字を SERP に出さない。
  const statStr = stats
    ? headlineStats(stats, locale)
        .slice(0, 3)
        .map((s) => `${s.label}${s.value}`)
        .join(en ? ' · ' : '・')
    : '';
  // 「{名前} ポスティング」はオフシーズンの頭クエリ（GSC実測: 「牧 ポスティング」が記事側 順位11で
  // 21表示・8月時点）。冬に跳ねる前に LP のタイトルへ語を入れておく（説明文には従来からある）。
  // 申請が有力と報じられた選手だけ「最新情報」に切り替える＝読者の意図（いつ・どこへ）と一致させ、
  // まだ動きの無い選手に同じ看板を掲げない（見出し⇔中身の一致）。layout が「｜海外の反応」を足す。
  // 海外FA（route='intl-fa'）は語が違う＝「ポスティング」で検索されないので看板も分ける。
  const watch = p.postingWatch;
  // 「{選手名} ポスティング」で検索されるのは申請が有力な選手だけではない（才木浩人のように
  // 一度断られた選手ほど「今年はどうなのか」で探される）。watch=公式な動きが無い選手だけ一般の看板にする。
  const posted = watch?.level === 'expected' || watch?.level === 'rumored';
  const faRoute = watch?.route === 'intl-fa';
  const title = en
    ? `${p.nameEn} — ${posted ? 'MLB Posting Watch' : faRoute ? 'MLB Free Agency Watch' : 'NPB Player on the MLB Radar'}`
    : faRoute
      ? `${p.nameJa} 海外FA・メジャー移籍の最新情報と${npbSeason}年成績`
      : posted
        ? `${p.nameJa} ポスティング最新情報と${npbSeason}年成績`
        : `${p.nameJa} — ポスティング・MLB挑戦が注目されるNPBの逸材`;
  // ポスティングの現在地（報道ベース）を説明文の前方へ。オフに跳ねる「{選手名} ポスティング」で
  // 来た読者が SERP の時点で答えを受け取れる＝タイトルと合わせて意図一致させる。
  const watchStr = watch ? (en ? watch.headline.en : watch.headline.ja) : '';
  const description = en
    ? `${p.nameEn} (${p.team.en}, ${p.pos.en})${statStr ? ` — ${npbSeason} ${statStr}.` : '.'} ${watchStr} Why MLB scouts are watching, and a hub of overseas reactions.`
    : `${p.nameJa}（${p.team.ja}・${p.pos.ja}）の${npbSeason}年成績${statStr ? `（${statStr}）` : ''}。${watchStr}MLB注目ポイントと海外の反応まとめ。`;
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
  const npb = await getNpbStats();
  const stats = npb.players[slug] ?? null;
  const lede = stats ? prospectLede(en ? p.nameEn : p.nameJa, en ? p.team.en : p.team.ja, stats, locale) : '';
  const headline = stats ? headlineStats(stats, locale) : [];
  const ranks = stats ? topRanks(stats) : [];

  // 現地ファンの声。選手タグLP（/tag/{名前}）と同じ選び方で、この選手に言及しているコメントだけを拾う。
  // npb 記事は本数が少ないので全記事から探す（MLB 側の tagHub は直近40本の窓で足りるが、ここは母数が違う）。
  const voices = voicesRecentFirst(
    tagHubVoices(buildFeed(all, []), { nameJa: p.nameJa, nameEn: p.nameEn, aliases: p.aliases }),
    [],
  );

  const compPlayer = p.compMlbSlug ? getPlayer(p.compMlbSlug) : undefined;
  const url = absoluteUrl(locale, `/prospects/${slug}`);
  const related = prospectRelated(p);

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
      // FAQPage は画面の「よくある質問」と**同じ配列**から組む＝表示と構造化データが食い違わない。
      // 「{選手名} いつメジャー」のような問いの形の検索・AIの回答に拾われる枠。
      ...(p.faq?.length
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: p.faq.map((item) => ({
                '@type': 'Question',
                name: en ? item.q.en : item.q.ja,
                acceptedAnswer: { '@type': 'Answer', text: en ? item.a.en : item.a.ja },
              })),
            },
          ]
        : []),
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
        {/* 今季の地の文（NPB公式の実在値だけで機械生成）。数値表の前に散文を置くことで、
            「{選手名} 成績」で着地した読者が最初の1行で今季を掴める。 */}
        {lede && <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink">{lede}</p>}
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">{en ? p.bio.en : p.bio.ja}</p>
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

      {/* ポスティングの現在地はページ最上段（H1直下）。検索着地の第一意図がここだから、
          経歴やcompより先に「いま何が報じられているか」を出す。 */}
      {p.postingWatch && (
        <PostingWatch
          watch={p.postingWatch}
          en={en}
          heading={p.postingWatch.route === 'intl-fa' ? t('prospects.faWatchTitle') : t('prospects.watchTitle')}
          levelLabel={t(`prospects.watchLevel.${p.postingWatch.level}`)}
          routeLabel={t(`prospects.route.${p.postingWatch.route === 'intl-fa' ? 'intlFa' : 'posting'}`)}
          windowLabel={t('prospects.watchWindow')}
          suitorsLabel={t('prospects.watchSuitors')}
          marketLabel={t('prospects.watchMarket')}
          timelineLabel={t('prospects.watchTimeline')}
          asOfLabel={t('prospects.statsAsOf', { date: p.postingWatch.asOf })}
        />
      )}

      <section>
        <div className="mb-3">
          <SectionHeading label={t('prospects.stats')} />
        </div>
        {stats && headline.length ? (
          <div className="rounded-[2px] border border-line bg-surface p-5">
            <dl className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-5">
              {headline.map((s) => (
                <div key={s.label}>
                  <dt className="text-xs text-ink-soft">{s.label}</dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
            <ProspectRanks ranks={ranks} en={en} label={t('prospects.ranksLabel')} />
            <p className="mt-4 text-xs text-ink-soft">
              {t('prospects.statsAsOf', { date: npb.asOf })}
              {' · '}
              <a
                href={stats.sourceUrl}
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

      <section>
        <div className="mb-3">
          <SectionHeading label={t('prospects.mlbWatch')} />
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-ink">{en ? p.mlbWatch.en : p.mlbWatch.ja}</p>
      </section>

      {p.scouting && (
        <ProspectScouting
          scouting={p.scouting}
          en={en}
          heading={t('prospects.scouting')}
          strengthsLabel={t('prospects.strengths')}
          concernsLabel={t('prospects.concerns')}
        />
      )}

      <section>
        <div className="mb-3">
          <SectionHeading label={t('prospects.posting')} />
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{en ? p.posting.en : p.posting.ja}</p>
        {p.contract && (
          <dl className="mt-4 grid gap-4 rounded-[2px] border border-line bg-surface p-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-soft">{t('prospects.contractDebut')}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink">{en ? p.contract.debut.en : p.contract.debut.ja}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">{t('prospects.contractFa')}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink">{en ? p.contract.fa.en : p.contract.fa.ja}</dd>
            </div>
            {p.contract.salary && (
              <div>
                <dt className="text-xs text-ink-soft">{t('prospects.contractSalary')}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink">
                  {en ? p.contract.salary.en : p.contract.salary.ja}
                  <a
                    href={p.contract.salary.source}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="ml-1.5 whitespace-nowrap text-xs text-ink-mute underline decoration-line underline-offset-2 transition-colors hover:text-ink"
                  >
                    {p.contract.salary.sourceName} <span aria-hidden>↗</span>
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}
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

      {stats && (
        <ProspectCareer
          stats={stats}
          en={en}
          heading={t('prospects.career')}
          sourceLabel={t('prospects.statsSource')}
          caption={t('prospects.careerCaption', { name: en ? p.nameEn : p.nameJa })}
        />
      )}

      {p.faq && <FaqList faq={p.faq} en={en} heading={t('prospects.faq')} />}

      {/* 現地ファンの声。記事一覧より前に置く＝「海外の反応」で来た読者への答えは、記事カードの
          並びではなく発言そのもの（選手タグLPで確立した並び）。 */}
      {voices.length > 0 && (
        <TagVoices
          voices={voices}
          locale={locale}
          label={t('tag.voices', { name: en ? p.nameEn : p.nameJa })}
        />
      )}

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
        {/* 同じ今オフ組・同じ球団の選手を先に出す＝「今オフ誰が出るのか」を比べに来た読者の次の一手に合わせる。 */}
        <div className="flex flex-wrap gap-2">
          {related.map((rp) => (
            <Link
              key={rp.slug}
              href={`/prospects/${rp.slug}`}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[2px] border border-line px-3.5 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              {en ? rp.nameEn : rp.nameJa}
              {rp.postingWatch?.level === 'expected' && (
                <span className="text-[11px] text-ink-mute">
                  {t('prospects.watchLevel.expected')}
                </span>
              )}
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
