import type { Metadata } from 'next';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getAllThreads } from '@/lib/data';
import { PLAYERS, hubEligible, type Player } from '@/lib/players';
import { getPlayersSnapshot, seasonYear, type PlayerSeason } from '@/lib/playerStats';
import { getMvpBoard } from '@/lib/mvpBoard';
import { getCyYoungBoard } from '@/lib/cyYoungBoard';
import { ALLSTAR } from '@/lib/allstar';
import CompareTable, { type CompareCol, type CompareRow } from '@/components/CompareTable';
import SectionHeading from '@/components/SectionHeading';
import { getTeam, headshotUrl } from '@/lib/teams';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
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

// 予測ボード（MVP/サイヤング）の日本人ハイライトに使う最小形。MvpRow / CyRow の共通部分。
type JpRankRow = { isJp: boolean; rank: number; league: 'AL' | 'NL'; nameJa: string; nameEn: string };

export default async function PlayerIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const en = locale === 'en';
  const [snap, all, mvpBoard, cyBoard] = await Promise.all([
    getPlayersSnapshot(),
    getAllThreads(),
    getMvpBoard(),
    getCyYoungBoard(),
  ]);
  const year = seasonYear(snap);

  // 比較に出すのは MLBロースターで今季成績がある選手（＝ハブが必ず存在＝行クリックが必ず有効）。
  // AAA等（league=null）は MLB比較に混ぜない。
  const withStats = PLAYERS.map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined })).filter(
    (x) => x.s && x.s.league,
  );

  // 投手1行ぶんの値（日本人投手表で使う）。
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

  // 打者1行ぶんの値（日本人打者表とドジャース打線で共用）。
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

  // 行オブジェクトの共通形（CompareRow）。3つの表で同形なので1か所にまとめる。
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

  // 日本人 野手：日本人の野手（大谷を含む＝最上段の表に主役を置く）。
  const batRows: CompareRow[] = withStats
    .filter((x) => x.s!.hitting && !x.p.rival)
    .map(({ p, s }) => toRow(p, s!, batValues(s!)));

  // 日本人 投手：投手ゲートを通った日本人（大谷・山本を含む＝二刀流の投手面/日本人エース）。
  const pitRows: CompareRow[] = withStats
    .filter((x) => isRealPitcher(x.s!) && !x.p.rival)
    .map(({ p, s }) => toRow(p, s!, pitValues(s!)));

  // ドジャース打線：所属＝ドジャース（teamId 119）の野手全員（大谷＋同僚）。rival フラグでなく
  // 「今どこに居るか」の事実で引く＝トレードでもデータ追従で自動更新される。
  const dodgersRows: CompareRow[] = withStats
    .filter((x) => x.s!.hitting && getTeam(x.s!.team)?.id === 119)
    .map(({ p, s }) => toRow(p, s!, batValues(s!)));

  // ドジャース打線は当面全件。将来15人超で初期高さを抑えたくなったら数値1つ（例 10）にするだけ。
  const DODGERS_CAP: number | null = null;
  const dodgersShown = DODGERS_CAP ? dodgersRows.slice(0, DODGERS_CAP) : dodgersRows;

  // 選手名鑑：日本人（非 rival）のハブ対象全員＝「目当ての選手へ1タップ」の最速ルート。
  // 比較表は野手/投手に分かれ、記事のみの選手（村上ら）はどの表にも出ない＝探すジョブはここが一手に受ける。
  // 並びは MLB今季成績あり（WAR合計降順＝大谷が先頭）→ 成績なし（カタログ順）。
  const warOf = (s?: PlayerSeason) => (s?.saber?.hit ?? 0) + (s?.saber?.pit ?? 0);
  const directory: { p: Player; s?: PlayerSeason }[] = PLAYERS.filter((p) => !p.rival)
    .map((p) => ({ p, s: snap.players[String(p.mlbId)] as PlayerSeason | undefined }))
    .filter((x) => hubEligible(x.p, all, x.s))
    .sort((a, b) => {
      const am = a.s?.league ? 1 : 0;
      const bm = b.s?.league ? 1 : 0;
      if (am !== bm) return bm - am;
      return warOf(b.s) - warOf(a.s);
    });

  // 予測ボードの日本人最上位（例: 大谷 ナ・リーグ1位）。レース分析は /mvp・/cy-young に一本化し、
  // /player は「いま日本人が何位か」だけ見せて送客する（劣化コピーの表を持たない）。
  const bestJp = (rows: JpRankRow[]): JpRankRow | null =>
    rows.filter((r) => r.isJp).sort((a, b) => a.rank - b.rank)[0] ?? null;
  const mvpJp = mvpBoard ? bestJp([...mvpBoard.leagues.NL, ...mvpBoard.leagues.AL]) : null;
  const cyJp = cyBoard ? bestJp([...cyBoard.leagues.NL, ...cyBoard.leagues.AL]) : null;

  // 専門ボードへの入口カード。オールスターは会期フラグで自動的に消える（PlayerHubNav と同じ流儀）。
  const boardCards: { href: string; title: string; desc: string; jp?: JpRankRow | null }[] = [
    { href: '/mvp', title: t('player.boardMvp'), desc: t('player.boardMvpDesc'), jp: mvpJp },
    { href: '/cy-young', title: t('player.boardCy'), desc: t('player.boardCyDesc'), jp: cyJp },
    { href: '/ranking', title: t('nav.ranking'), desc: t('player.boardRankingDesc') },
    ...(ALLSTAR.enabled ? [{ href: '/allstar', title: t('nav.allstar'), desc: t('player.boardAllstarDesc') }] : []),
  ];

  // ピラー（/player）から全ハブへ内部リンクを閉じる。名鑑は日本人のみだが、rival のハブ（ボード・
  // ドジャース打線から回遊で届く）も ItemList には列挙して評価を渡す。
  const hubPlayers = PLAYERS.filter((p) => hubEligible(p, all, snap.players[String(p.mlbId)]));

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

      <PlayerHubNav />

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

      {/* ① 選手名鑑＝個別ハブ（滞在5分の母艦）への最速ルート。顔＋名前＋所属の1タップ導線を最上段に。 */}
      {directory.length > 0 && (
        <section>
          <SectionHeading label={t('player.directory')} count={directory.length} />
          <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.directoryLead')}</p>
          <ul className="flex flex-wrap gap-2">
            {directory.map(({ p, s }) => {
              const teamColor = s?.team ? getTeam(s.team)?.color : undefined;
              return (
                <li key={p.slug}>
                  <Link
                    href={`/player/${p.slug}`}
                    className="flex items-center gap-2 rounded-[3px] border border-line py-1.5 pl-1.5 pr-3.5 transition-colors hover:border-ink hover:bg-paper"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNの顔写真を直リンク（CompareTable と同じ流儀・再ホストしない） */}
                    <img
                      src={headshotUrl(p.mlbId, 'spot')}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      className="h-7 w-7 shrink-0 rounded-full bg-paper object-cover"
                      style={teamColor ? { boxShadow: `0 0 0 1.5px ${teamColor}` } : undefined}
                    />
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm font-medium text-ink">{en ? p.nameEn : p.nameJa}</span>
                      {s?.team && <span className="text-[10px] text-ink-soft">{s.team}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ② 日本人 野手（大谷を含む＝先頭に主役）。 */}
      {batRows.length > 0 && (
        <section>
          <SectionHeading label={t('player.batting')} count={batRows.length} />
          <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.battingLead')}</p>
          <CompareTable rows={batRows} cols={BAT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {/* ③ 日本人 投手（大谷・山本を含む）。 */}
      {pitRows.length > 0 && (
        <section>
          <SectionHeading label={t('player.pitching')} count={pitRows.length} />
          <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.pitchingLead')}</p>
          <CompareTable rows={pitRows} cols={PIT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      {/* ④ 予測ボード・ランキングへの交通整理。レースの表そのものは持たず（/mvp・/cy-young が正）、
          日本人の現在地ハイライトつきカードで送客する。 */}
      <section>
        <SectionHeading label={t('player.boardsTitle')} count={boardCards.length} />
        <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.boardsLead')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {boardCards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col rounded-[3px] border border-line p-4 transition-colors hover:border-ink"
            >
              <span className="flex items-center justify-between gap-2 text-base font-bold text-ink">
                {c.title}
                <span aria-hidden className="shrink-0 text-ink-mute transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </span>
              <span className="mt-1 text-xs leading-relaxed text-ink-soft">{c.desc}</span>
              {c.jp && (
                <span className="mt-3 flex items-baseline justify-between gap-2 border-t border-line pt-2.5">
                  <span className="text-sm font-semibold text-ink">{en ? c.jp.nameEn : c.jp.nameJa}</span>
                  <span className="text-xs tabular-nums text-ink-soft">
                    {t('player.boardJpRank', {
                      league: c.jp.league === 'AL' ? t('player.lgAL') : t('player.lgNL'),
                      rank: String(c.jp.rank),
                    })}
                  </span>
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* ⑤ 看板「海外ファンと見る」で毎試合追うドジャース打線＝大谷＋同僚を所属で一括り。
          id=dodgers＝試合記事の「ドジャース選手の成績を見る」(/player#dodgers) の着地点。 */}
      {dodgersRows.length > 0 && (
        <section id="dodgers" className="scroll-mt-24">
          <SectionHeading label={t('player.dodgersLineup')} count={dodgersRows.length} />
          <p className="mb-3 mt-1.5 max-w-prose text-sm text-ink-soft">{t('player.dodgersLineupLead')}</p>
          <CompareTable rows={dodgersShown} cols={BAT_COLS} defaultKey="war" hint={t('player.swipeHint')} />
        </section>
      )}

      <p className="text-xs text-ink-soft">{t('player.statsNote')}</p>
    </div>
  );
}
