import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { PLAYERS, hubEligible } from '@/lib/players';
import { getPlayersSnapshot, seasonYear, type PlayerSeason } from '@/lib/playerStats';
import CompareTable, { type CompareCol, type CompareRow } from '@/components/CompareTable';
import SectionHeading from '@/components/SectionHeading';
import { getTeam } from '@/lib/teams';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { type Locale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const snap = await getPlayersSnapshot();
  const year = seasonYear(snap);
  const en = locale === 'en';
  // 指名検索のロングテール（「大谷 山本 成績」等）を拾うため代表選手名を description 末尾へ。
  const names = PLAYERS.filter((p) => !p.rival)
    .slice(0, 4)
    .map((p) => (en ? p.nameEn : p.nameJa));
  const description = en
    ? `${t('player.indexLead')} Featuring ${names.join(', ')} and more.`
    : `${t('player.indexLead')} ${names.join('・')}ほか。`;
  // 年は文字列で渡す（ICU 数値引数の桁区切り「2,026」を避ける）。
  const title = t('player.indexTitleYear', { year: String(year) });
  return {
    title,
    description,
    // openGraph/twitter を「ここで」定義する＝親(layout)の twitter.images:/og.png を外し、
    // ファイルベースの opengraph-image.tsx（ハブ専用カード）を og と twitter の両方に充当させる。
    // images は敢えて指定しない（指定すると規約画像が固定され opengraph-image が効かなくなる）。
    openGraph: { title, description, type: 'website', url: absoluteUrl(locale, '/player') },
    twitter: { card: 'summary_large_image', title, description },
    alternates: localeAlternates(locale, '/player'),
  };
}

const num = (raw: string | number | null | undefined, d?: string): { v: number | null; d: string } => {
  if (raw == null) return { v: null, d: '—' };
  const v = Number(raw);
  return { v: Number.isNaN(v) ? null : v, d: d ?? String(raw) };
};

const BAT_COLS: CompareCol[] = [
  { key: 'avg', label: '打率', better: 'high' },
  { key: 'homeRuns', label: '本', better: 'high' },
  { key: 'rbi', label: '打点', better: 'high' },
  { key: 'stolenBases', label: '盗', better: 'high' },
  { key: 'ops', label: 'OPS', better: 'high' },
  { key: 'wrcplus', label: 'wRC+', better: 'high' },
  { key: 'war', label: 'WAR', better: 'high' },
];
const PIT_COLS: CompareCol[] = [
  { key: 'era', label: '防御率', better: 'low' },
  { key: 'wins', label: '勝', better: 'high' },
  { key: 'losses', label: '敗', better: 'low' },
  { key: 'inningsPitched', label: '回', better: 'high' },
  { key: 'strikeOuts', label: '奪三', better: 'high' },
  { key: 'whip', label: 'WHIP', better: 'low' },
  { key: 'war', label: 'WAR', better: 'high' },
];

export default async function PlayerIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const [snap, all] = await Promise.all([getPlayersSnapshot(), getAllThreads()]);
  const year = seasonYear(snap);

  // 比較に出すのは MLBロースターで今季成績がある選手（＝ハブが必ず存在＝行クリックが必ず有効）。
  // AAA等（league=null）は MLB比較に混ぜない。
  const withStats = PLAYERS.map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined })).filter(
    (x) => x.s && x.s.league,
  );

  // 投手1行ぶんの値（日本人投手表とサイヤング争いブロックで共用）。
  const pitValues = (s: PlayerSeason) => {
    const pi = s.pitching!;
    const sb = s.saber;
    return {
      era: num(pi.era),
      wins: num(pi.wins),
      losses: num(pi.losses),
      inningsPitched: num(pi.inningsPitched),
      strikeOuts: num(pi.strikeOuts),
      whip: num(pi.whip),
      war: num(sb?.pit, sb?.pit != null ? sb.pit.toFixed(1) : undefined),
    };
  };

  // 打者1行ぶんの値（日本人打者表とスター野手比較ブロックで共用）。
  const batValues = (s: PlayerSeason) => {
    const h = s.hitting!;
    const sb = s.saber;
    return {
      avg: num(h.avg),
      homeRuns: num(h.homeRuns),
      rbi: num(h.rbi),
      stolenBases: num(h.stolenBases),
      ops: num(h.ops),
      wrcplus: num(sb?.wrcplus, sb?.wrcplus != null ? String(Math.round(sb.wrcplus)) : undefined),
      war: num(sb?.hit, sb?.hit != null ? sb.hit.toFixed(1) : undefined),
    };
  };

  // 行オブジェクトの共通形（CompareRow）。5つの表で同形なので1か所にまとめる。
  const toRow = (p: (typeof withStats)[number]['p'], s: PlayerSeason, values: CompareRow['values']): CompareRow => ({
    slug: p.slug,
    name: p.nameJa,
    team: s.team,
    mlbId: p.mlbId,
    teamColor: getTeam(s.team)?.color,
    values,
  });

  // 投手ゲート：先発登板あり or 規定級の投球回がある＝「投手として」の行だけを投手表に出す。
  // 野手の火消し登板（ロハス GS=0/IP=4.0 等）を選手名に依存せず構造的に弾く恒久対策。
  const isRealPitcher = (s: PlayerSeason) =>
    !!s.pitching && (Number(s.pitching.gamesStarted) >= 1 || Number(s.pitching.inningsPitched) >= 10);

  // サイ・ヤング賞レースの“当事者”集合（日本人エース）。大谷・山本はここの主役だが、日本人投手表にも出す
  // ＝大谷は二刀流・両当事者という唯一の主役なので各表に正当に再登場させる（議論の最終結論＝重複は許容）。
  const cyJpSlugs = new Set(['shohei-ohtani', 'yoshinobu-yamamoto']);

  // 日本人 野手：日本人の野手（大谷を含む＝最上段の表に主役を置く）。
  const batRows: CompareRow[] = withStats
    .filter((x) => x.s!.hitting && !x.p.rival)
    .map(({ p, s }) => toRow(p, s!, batValues(s!)));

  // 日本人 投手：投手ゲートを通った日本人（大谷・山本を含む＝二刀流の投手面/日本人エース）。
  const pitRows: CompareRow[] = withStats
    .filter((x) => isRealPitcher(x.s!) && !x.p.rival)
    .map(({ p, s }) => toRow(p, s!, pitValues(s!)));

  // サイ・ヤング賞レース：投手ゲートを通った rival 投手＋大谷・山本。野手の火消し登板は弾く。
  const cyRows: CompareRow[] = withStats
    .filter((x) => isRealPitcher(x.s!) && (x.p.rival || cyJpSlugs.has(x.p.slug)))
    .map(({ p, s }) => toRow(p, s!, pitValues(s!)));

  // ドジャース打線：所属＝ドジャース（teamId 119）の野手全員（大谷＋同僚）。rival フラグでなく
  // 「今どこに居るか」の事実で引く＝トレードでもデータ追従で自動更新される。
  const dodgersRows: CompareRow[] = withStats
    .filter((x) => x.s!.hitting && getTeam(x.s!.team)?.id === 119)
    .map(({ p, s }) => toRow(p, s!, batValues(s!)));

  // クロスリーグの強打者：大谷（比較のアンカー）＋ドジャース以外の rival 野手（リード文と一致）。
  const leagueRows: CompareRow[] = withStats
    .filter((x) => x.s!.hitting && (x.p.slug === 'shohei-ohtani' || (x.p.rival && getTeam(x.s!.team)?.id !== 119)))
    .map(({ p, s }) => toRow(p, s!, batValues(s!)));

  // ドジャース打線は当面全件。将来15人超で初期高さを抑えたくなったら数値1つ（例 10）にするだけ。
  const DODGERS_CAP: number | null = null;
  const dodgersShown = DODGERS_CAP ? dodgersRows.slice(0, DODGERS_CAP) : dodgersRows;

  // ピラー（/player）から全ハブへ内部リンクを閉じる。比較表に出ない（MLB今季成績が無い）が記事のある
  // 選手（村上・岡本・ヌートバー等）への入口を一覧に持たせ、子ハブに評価・回遊を届ける。
  const hubPlayers = PLAYERS.filter((p) => hubEligible(p, all, snap.players[String(p.mlbId)]));
  const tableSlugs = new Set(
    [...cyRows, ...dodgersRows, ...leagueRows, ...pitRows, ...batRows].map((r) => r.slug),
  );
  const moreHubs = hubPlayers.filter((p) => !tableSlugs.has(p.slug));

  // 一覧（GA4最強回遊面）の構造化データ。CollectionPage＋ItemList（全ハブを列挙）＋パンくず。
  const indexTitle = t('player.indexTitleYear', { year: String(year) });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: indexTitle,
        description: t('player.indexLead'),
        url: absoluteUrl(locale, '/player'),
      },
      {
        '@type': 'ItemList',
        itemListElement: hubPlayers.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: locale === 'en' ? p.nameEn : p.nameJa,
          url: absoluteUrl(locale, `/player/${p.slug}`),
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t('player.indexTitle'), item: absoluteUrl(locale, '/player') },
        ],
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ name: t('nav.home'), href: '/' }, { name: t('player.indexTitle') }]} />

      <section className="border-b border-line pb-6">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-mute">
          {t('player.eyebrow')}
        </span>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{t('player.indexTitle')}</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{t('player.indexLead')}</p>
        {snap.asOf && (
          <p className="mt-1 text-xs text-ink-soft">{t('player.asOf', { date: snap.asOf })}</p>
        )}
      </section>

      {/* 事業の主眼＝日本人ハブ（検索母艦）を最上段に。① 日本人 野手（大谷を含む＝先頭に主役）。 */}
      {batRows.length > 0 && (
        <section>
          <SectionHeading label={t('player.batting')} count={batRows.length} />
          <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.battingLead')}</p>
          <CompareTable rows={batRows} cols={BAT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {/* ② 日本人 投手（大谷・山本を含む）。 */}
      {pitRows.length > 0 && (
        <section>
          <SectionHeading label={t('player.pitching')} count={pitRows.length} />
          <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.pitchingLead')}</p>
          <CompareTable rows={pitRows} cols={PIT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {/* ③ 二刀流で投げる大谷のサイ・ヤング賞挑戦＝レースの当事者を1表に。 */}
      {cyRows.length > 0 && (
        <section>
          <SectionHeading label={t('player.cyYoung')} count={cyRows.length} />
          <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.cyYoungLead')}</p>
          <CompareTable rows={cyRows} cols={PIT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {/* ④ 看板「海外ファンと見る」で毎試合追うドジャース打線＝大谷＋同僚を所属で一括り。
          id=dodgers＝試合記事の「ドジャース選手の成績を見る」(/player#dodgers) の着地点。 */}
      {dodgersRows.length > 0 && (
        <section id="dodgers" className="scroll-mt-24">
          <SectionHeading label={t('player.dodgersLineup')} count={dodgersRows.length} />
          <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.dodgersLineupLead')}</p>
          <CompareTable rows={dodgersShown} cols={BAT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {/* ⑤ 大谷の打撃を測る、リーグ横断の強打者（大谷＋他球団のライバル野手）。 */}
      {leagueRows.length > 0 && (
        <section>
          <SectionHeading label={t('player.leagueSluggers')} count={leagueRows.length} />
          <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.leagueSluggersLead')}</p>
          <CompareTable rows={leagueRows} cols={BAT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {moreHubs.length > 0 && (
        <section>
          <SectionHeading label={t('player.moreTitle')} count={moreHubs.length} />
          <div className="mt-3 flex flex-wrap gap-2">
            {moreHubs.map((p) => (
              <Link
                key={p.slug}
                href={`/player/${p.slug}`}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-line px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-ink hover:bg-paper"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current text-ink-mute" aria-hidden>
                  <rect x="3" y="13" width="4" height="8" />
                  <rect x="10" y="8" width="4" height="13" />
                  <rect x="17" y="4" width="4" height="17" />
                </svg>
                {locale === 'en' ? p.nameEn : p.nameJa}
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-ink-soft">{t('player.statsNote')}</p>
    </div>
  );
}
