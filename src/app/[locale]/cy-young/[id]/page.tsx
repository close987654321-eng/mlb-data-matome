import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getCyPitcher, getCyDetailRows, type CyRow } from '@/lib/cyYoungBoard';
import { getPitchArsenal } from '@/lib/pitchArsenal';
import { getAllThreads } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import { PLAYERS } from '@/lib/players';
import { getTeam, headshotUrl, teamLogoUrl } from '@/lib/teams';
import PitchArsenal from '@/components/player/PitchArsenal';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

/** 詳細ページを作る投手＝各リーグ上位N。全 locale × 10投手を静的化。 */
export async function generateStaticParams() {
  const rows = await getCyDetailRows();
  return locales.flatMap((locale) => rows.map((r) => ({ locale, id: String(r.id) })));
}

// スコア内訳の指標定義（per-metric の重み＝防御率+xERA が prevention 0.40 を折半、他はそのまま）。
const METRICS: { key: keyof CyRow['pct']; ja: string; en: string; w: number }[] = [
  { key: 'era', ja: '防御率', en: 'ERA', w: 0.2 },
  { key: 'xera', ja: 'xERA（中身）', en: 'xERA', w: 0.2 },
  { key: 'kbb', ja: 'K-BB%（支配力）', en: 'K-BB%', w: 0.25 },
  { key: 'ip', ja: '投球回（負担）', en: 'Innings', w: 0.2 },
  { key: 'whip', ja: 'WHIP', en: 'WHIP', w: 0.1 },
  { key: 'hr9', ja: '被弾の少なさ', en: 'HR prevention', w: 0.05 },
];

function copy(en: boolean, r: CyRow, season: number) {
  const lgWord = en ? (r.league === 'AL' ? 'AL' : 'NL') : r.league === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';
  return en
    ? {
        crumb: r.nameEn,
        metaTitle: `${r.nameEn} — Cy Young ${season} projection & pitch arsenal`,
        metaDesc: `${r.nameEn} (${r.teamEn}) ranks #${r.rank} in our ${lgWord} Cy Young projection: ERA ${r.era}, xERA ${r.xera ?? '—'}, ${r.ipDisp} IP. Pitch arsenal and overseas fan reactions.`,
        eyebrow: `${lgWord} Cy Young · projected #${r.rank}`,
        scoreTitle: 'Why this rank — score breakdown',
        scoreLead: `Percentile within ${lgWord} qualified starters × weight. Higher = more dominant in that category.`,
        statsTitle: 'Season line',
        reactTitle: 'Overseas reactions',
        reactEmpty: 'No reaction articles yet for this pitcher.',
        backBoard: 'Back to the Cy Young board',
        toHub: 'Player page (game-by-game)',
        source: `Data: MLB Stats API + Baseball Savant. ${season} season, as of `,
      }
    : {
        crumb: r.nameJa,
        metaTitle: `${r.nameJa} サイ・ヤング賞予測${season}｜成績と球種の分析`,
        metaDesc: `${r.nameJa}（${r.teamJa}）は当サイトの${lgWord}サイ・ヤング賞予測で${r.rank}位。防御率${r.era}・xERA${r.xera ?? '—'}・${r.ipDisp}回。球種の設計図と海外ファンの反応まで。`,
        eyebrow: `${lgWord} サイ・ヤング賞 予測 ${r.rank}位`,
        scoreTitle: 'この順位の理由（スコア内訳）',
        scoreLead: `${lgWord}の規定投手内でのパーセンタイル×重み。右にいくほどその項目でリーグ上位。`,
        statsTitle: '今季成績',
        reactTitle: '海外の反応',
        reactEmpty: 'この投手の海外の反応記事はまだありません。',
        backBoard: 'サイヤング予測ボードに戻る',
        toHub: '選手ページ（試合ごとの成績）',
        source: `出典: MLB公式Stats API＋Baseball Savant。${season}シーズン・`,
      };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const found = await getCyPitcher(Number(id));
  if (!found) return {};
  const c = copy(locale === 'en', found.row, found.board.season);
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    openGraph: { title: c.metaTitle, description: c.metaDesc, type: 'article', url: absoluteUrl(locale, `/cy-young/${id}`) },
    twitter: { card: 'summary_large_image', title: c.metaTitle, description: c.metaDesc },
    alternates: localeAlternates(locale, `/cy-young/${id}`),
  };
}

export default async function CyYoungPitcherPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const en = locale === 'en';
  const found = await getCyPitcher(Number(id));
  if (!found) notFound();
  const { row, board } = found;
  const season = board.season;
  const c = copy(en, row, season);

  const [arsenal, all] = await Promise.all([getPitchArsenal(row.id), getAllThreads()]);
  const team = getTeam(row.teamJa);
  const slug = PLAYERS.find((p) => p.mlbId === row.id)?.slug;

  // 海外の反応: この投手のタグ記事を優先し、足りなければサイ・ヤング賞タグで補う（最大6）。
  const CY_TAGS = ['サイ・ヤング賞', 'サイヤング賞'];
  const specific = all.filter((th) => (th.tags ?? []).includes(row.nameJa));
  const general = all.filter(
    (th) => (th.tags ?? []).some((x) => CY_TAGS.includes(x)) && !(th.tags ?? []).includes(row.nameJa),
  );
  const reactionItems = buildFeed([...specific, ...general].slice(0, 6), []);

  const name = en ? row.nameEn : row.nameJa;
  const teamName = en ? row.teamEn : row.teamJa;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        name: c.metaTitle,
        description: c.metaDesc,
        url: absoluteUrl(locale, `/cy-young/${id}`),
        about: { '@type': 'Person', name: row.nameEn, sameAs: `https://www.mlb.com/player/${row.id}` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: en ? 'Cy Young Board' : 'サイヤング予測', item: absoluteUrl(locale, '/cy-young') },
          { '@type': 'ListItem', position: 3, name: name, item: absoluteUrl(locale, `/cy-young/${id}`) },
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
          { name: en ? 'Cy Young Board' : 'サイヤング予測', href: '/cy-young' },
          { name: c.crumb },
        ]}
      />
      <PlayerHubNav />

      {/* ヒーロー: 顔写真＋ロゴ＋カタカナ名＋順位＋スコア。 */}
      <section className="flex flex-wrap items-center gap-5 border-b border-line pb-6">
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（再ホストしない） */}
          <img
            src={headshotUrl(row.id, 'portrait')}
            alt={`${name}（${teamName}）`}
            width={108}
            height={162}
            className="h-[132px] w-[88px] rounded-[2px] bg-paper object-cover object-top sm:h-[150px] sm:w-[100px]"
            style={team ? { borderBottom: `3px solid ${team.color}` } : undefined}
          />
          {row.teamId ? (
            // eslint-disable-next-line @next/next/no-img-element -- MLB公式チームロゴSVGを直リンク
            <img
              src={teamLogoUrl(row.teamId)}
              alt=""
              width={30}
              height={30}
              loading="lazy"
              className="absolute -bottom-2 -right-2 h-8 w-8 rounded-[2px] bg-paper object-contain p-0.5 shadow-sm ring-1 ring-line"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-ink-mute">{c.eyebrow}</span>
          <h1 className="mt-1 text-3xl font-bold text-ink sm:text-4xl">{name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {teamName}
            {row.isJp ? <span className="ml-2 rounded-[2px] border border-ink/30 px-1 py-px text-[10px] text-ink-mute">{en ? 'JP' : '日本'}</span> : null}
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums text-ink">{row.score.toFixed(1)}</span>
            <span className="text-xs text-ink-mute">{en ? 'projection score' : '予測スコア'}</span>
          </div>
        </div>
      </section>

      {/* スコア内訳＝この順位の理由（percentile バー×重み）。 */}
      <section>
        <SectionHeading label={c.scoreTitle} lead level="h2" />
        <p className="mb-3 mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{c.scoreLead}</p>
        <ul className="space-y-2.5">
          {METRICS.map((m) => {
            const v = row.pct[m.key] ?? 0;
            return (
              <li key={m.key} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_3rem]">
                <span className="truncate text-ink-soft">
                  {en ? m.en : m.ja}
                  <span className="ml-1 text-[10px] text-ink-mute">{Math.round(m.w * 100)}%</span>
                </span>
                <span className="h-2 overflow-hidden rounded-[1px] bg-line" aria-hidden>
                  <span className="block h-full bg-ink" style={{ width: `${v}%` }} />
                </span>
                <span className="text-right tabular-nums text-ink">{v}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 今季成績ライン。 */}
      <section>
        <SectionHeading label={c.statsTitle} lead level="h2" />
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-4">
          {[
            { l: en ? 'ERA' : '防御率', v: row.era },
            { l: 'xERA', v: row.xera != null ? row.xera.toFixed(2) : '—' },
            { l: en ? 'IP' : '投球回', v: row.ipDisp },
            { l: en ? 'W-L' : '勝敗', v: `${row.w}-${row.l}` },
            { l: en ? 'K' : '奪三振', v: String(row.so) },
            { l: 'WHIP', v: row.whip },
            { l: 'HR/9', v: row.hr9 != null ? row.hr9.toFixed(2) : '—' },
            { l: 'K-BB%', v: row.kbbPct != null ? `${row.kbbPct.toFixed(1)}%` : '—' },
          ].map((s) => (
            <div key={s.l} className="bg-paper px-4 py-3">
              <dt className="text-xs text-ink-mute">{s.l}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-ink">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 球種の設計図（arsenal がある投手のみ＝上位5は取得済み）。既存コンポーネントを再利用。 */}
      {arsenal && arsenal.pitches.length > 0 ? <PitchArsenal arsenal={arsenal} season={season} locale={locale} /> : null}

      {/* この投手の海外の反応。 */}
      <section>
        <SectionHeading label={c.reactTitle} count={reactionItems.length || undefined} lead level="h2" />
        {reactionItems.length > 0 ? (
          <div className="mt-3">
            <FeedGrid items={reactionItems} locale={locale} />
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-ink-soft">{c.reactEmpty}</p>
        )}
      </section>

      {/* 導線: ボードへ戻る／選手ハブ（追跡選手のみ）。 */}
      <section className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5 text-sm">
        <Link href="/cy-young" className="text-ink-soft transition-colors hover:text-ink hover:underline">
          <span aria-hidden>←</span> {c.backBoard}
        </Link>
        {slug ? (
          <Link href={`/player/${slug}`} className="text-ink-soft transition-colors hover:text-ink hover:underline">
            {c.toHub} <span aria-hidden>→</span>
          </Link>
        ) : null}
      </section>

      <p className="text-[11px] leading-relaxed text-ink-mute">
        {c.source}
        {board.asOf}
      </p>
    </div>
  );
}
