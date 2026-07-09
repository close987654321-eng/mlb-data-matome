import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_setRequestLocale, getTranslations } from 'next-intl/server';
import { getMvpHitter, getMvpDetailRows, type MvpRow } from '@/lib/mvpBoard';
import { getAllThreads } from '@/lib/data';
import { buildFeed } from '@/lib/feed';
import { PLAYERS } from '@/lib/players';
import { getTeam, headshotUrl, teamLogoUrl } from '@/lib/teams';
import FeedGrid from '@/components/FeedGrid';
import SectionHeading from '@/components/SectionHeading';
import Breadcrumbs from '@/components/Breadcrumbs';
import PlayerHubNav from '@/components/PlayerHubNav';
import { Link } from '@/lib/navigation';
import { absoluteUrl, localeAlternates } from '@/lib/site';
import { locales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

/** 詳細ページを作る打者＝ボードの全行（規定到達の全打者）。全 locale × 全打者を静的化。 */
export async function generateStaticParams() {
  const rows = await getMvpDetailRows();
  return locales.flatMap((locale) => rows.map((r) => ({ locale, id: String(r.id) })));
}

// スコア内訳の指標定義（per-metric の重み＝wRC+ + xwOBA が batting 0.45 を折半、他はそのまま）。
const METRICS: { key: keyof MvpRow['pct']; ja: string; en: string; w: number }[] = [
  { key: 'wrc', ja: 'wRC+', en: 'wRC+', w: 0.25 },
  { key: 'xwoba', ja: 'xwOBA', en: 'xwOBA', w: 0.25 },
  { key: 'hr', ja: '本塁打', en: 'Home runs', w: 0.15 },
  { key: 'run', ja: '走塁', en: 'Baserunning', w: 0.05 },
  { key: 'def', ja: '守備＋位置補正', en: 'Defense + positional', w: 0.05 },
  { key: 'war', ja: 'WAR', en: 'WAR', w: 0.25 },
];

function copy(en: boolean, r: MvpRow, season: number) {
  const lgWord = en ? (r.league === 'AL' ? 'AL' : 'NL') : r.league === 'AL' ? 'ア・リーグ' : 'ナ・リーグ';
  return en
    ? {
        crumb: r.nameEn,
        metaTitle: `${r.nameEn} — MVP ${season} projection & batted-ball profile`,
        metaDesc: `${r.nameEn} (${r.teamEn}) ranks #${r.rank} in our ${lgWord} MVP projection: ${r.wrcPlus ?? '—'} wRC+, ${r.hr} HR, ${r.warTotal ?? '—'} WAR. Batted-ball quality, bat speed and overseas fan reactions.`,
        eyebrow: `${lgWord} MVP · projected #${r.rank}`,
        scoreTitle: 'Score breakdown',
        scoreLead: `Each bar shows where he ranks among ${lgWord} qualified hitters (0–100). Longer = better in that category; the weighted sum is the projection score.`,
        statsTitle: 'Season line',
        scTitle: 'Batted-ball quality & swing (Statcast)',
        scLead: 'How hard and how well he hits the ball — the “stuff” behind the batting line.',
        vsTitle: 'Performance by pitch type',
        vsLead: 'How pitchers attack him and what he punishes — strengths and holes by pitch type.',
        vsCols: { pitch: 'Pitch', usage: 'Seen%', pa: 'PA', woba: 'wOBA', xwoba: 'xwOBA', whiff: 'Whiff%', hard: 'Hard-hit%' },
        stTitle: 'Swing decisions (Swing/Take)',
        stLead: 'Runs gained from swing-or-take decisions by zone. Positive = better judgment.',
        stZones: { all: 'Total', heart: 'Heart', shadow: 'Shadow', chase: 'Chase', waste: 'Waste' },
        stNotes: [
          'Total — runs added purely by swing-or-take decisions across all zones this season.',
          'Heart — hittable pitches over the middle. Swinging is the right call; taking them costs runs.',
          'Shadow — pitches on the edges of the zone. The toughest calls, where judgment separates hitters.',
          'Chase — clear balls off the plate. Laying off earns runs; chasing gives them back.',
          'Waste — pitches far outside the zone. Almost everyone takes these, so little separation.',
        ],
        twoWay: (h: number, p: number) => `Two-way: ${h} batting WAR + ${p} pitching WAR`,
        reactTitle: 'Overseas reactions',
        reactEmpty: 'No reaction articles yet for this hitter.',
        backBoard: 'Back to the MVP board',
        toHub: 'Player page (game-by-game)',
        source: `Data: MLB Stats API + Baseball Savant. ${season} season, as of `,
      }
    : {
        crumb: r.nameJa,
        metaTitle: `${r.nameJa} MVP予測${season}｜成績と打球の質の分析`,
        metaDesc: `${r.nameJa}（${r.teamJa}）は当サイトの${lgWord}MVP予測で${r.rank}位。wRC+${r.wrcPlus ?? '—'}・${r.hr}本塁打・WAR${r.warTotal ?? '—'}。打球の質・バットスピードと海外ファンの反応まで。`,
        eyebrow: `${lgWord} MVP 予測 ${r.rank}位`,
        scoreTitle: 'スコア内訳',
        scoreLead: `各項目は、${lgWord}の規定打者の中でどの位置にいるかを0〜100で表した値。バーが長いほどリーグ上位で、これに重みを掛けて合算したものが予測スコアです。`,
        statsTitle: '今季成績',
        scTitle: '打球の質・スイング（Statcast）',
        scLead: 'どれだけ強く・どれだけ良い角度で打てているか＝打撃成績の“中身”。',
        vsTitle: '球種別の打撃成績',
        vsLead: 'どの球種を打ち、どの球種に空振りしているか＝投手からの攻められ方と得意・苦手。',
        vsCols: { pitch: '球種', usage: '見た割合', pa: '打席', woba: 'wOBA', xwoba: 'xwOBA', whiff: '空振り率', hard: 'ハードヒット率' },
        stTitle: 'スイング判断（Swing/Take）',
        stLead: '「振るか・見送るか」の判断で稼いだ得点をゾーン別に。プラスほど選球・判断が良い。',
        stZones: { all: '合計', heart: 'ハート（甘い球）', shadow: 'シャドー（境界）', chase: 'チェイス（ボール球）', waste: 'ウェイスト（大外れ）' },
        stNotes: [
          '合計＝4ゾーンぶんの合算。今季「振るか見送るか」の判断だけでどれだけ得点を積んだか。',
          'ハート（甘い球）＝ど真ん中付近の打ちごろの球。振るのが正解で、見逃すほどマイナスになりやすい。',
          'シャドー（境界）＝ストライクゾーンの縁ギリギリ。振る/見送るの判断が最も難しく、打者の差が出やすい。',
          'チェイス（ボール球）＝明らかなボール球。振らされずに見送れるほどプラス＝選球眼がそのまま出る。',
          'ウェイスト（大外れ）＝大きく外れた球。ほぼ誰でも見送るので差はつきにくい。',
        ],
        twoWay: (h: number, p: number) => `二刀流＝打撃WAR${h}＋投手WAR${p}を合算して評価`,
        reactTitle: '海外の反応',
        reactEmpty: 'この打者の海外の反応記事はまだありません。',
        backBoard: 'MVP予測ボードに戻る',
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
  const found = await getMvpHitter(Number(id));
  if (!found) return {};
  const c = copy(locale === 'en', found.row, found.board.season);
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    openGraph: { title: c.metaTitle, description: c.metaDesc, type: 'article', url: absoluteUrl(locale, `/mvp/${id}`) },
    twitter: { card: 'summary_large_image', title: c.metaTitle, description: c.metaDesc },
    alternates: localeAlternates(locale, `/mvp/${id}`),
  };
}

export default async function MvpHitterPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations();
  const en = locale === 'en';
  const found = await getMvpHitter(Number(id));
  if (!found) notFound();
  const { row, board } = found;
  const season = board.season;
  const c = copy(en, row, season);

  const all = await getAllThreads();
  const team = getTeam(row.teamJa);
  const slug = PLAYERS.find((p) => p.mlbId === row.id)?.slug;

  // 海外の反応: この打者のタグ記事を優先し、足りなければ MVP タグで補う（最大6）。
  const MVP_TAGS = ['MVP'];
  const specific = all.filter((th) => (th.tags ?? []).includes(row.nameJa));
  const general = all.filter(
    (th) => (th.tags ?? []).some((x) => MVP_TAGS.includes(x)) && !(th.tags ?? []).includes(row.nameJa),
  );
  const reactionItems = buildFeed([...specific, ...general].slice(0, 6), []);

  const name = en ? row.nameEn : row.nameJa;
  const teamName = en ? row.teamEn : row.teamJa;
  const sc = row.sc;
  const fmt = (v: number | null, unit = '', digits = 1) => (v != null ? `${v.toFixed(digits)}${unit}` : '—');
  const fmtSigned = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`);
  // 二刀流は守備の重みを WAR に振替（スコア計算と同じ扱いを表示にも反映）。
  const metrics = METRICS.map((m) =>
    row.pos === 'TWP' && m.key === 'def' ? { ...m, w: 0 } : row.pos === 'TWP' && m.key === 'war' ? { ...m, w: 0.3 } : m,
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        name: c.metaTitle,
        description: c.metaDesc,
        url: absoluteUrl(locale, `/mvp/${id}`),
        about: { '@type': 'Person', name: row.nameEn, sameAs: `https://www.mlb.com/player/${row.id}` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: en ? 'MVP Board' : 'MVP予測', item: absoluteUrl(locale, '/mvp') },
          { '@type': 'ListItem', position: 3, name: name, item: absoluteUrl(locale, `/mvp/${id}`) },
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
          { name: en ? 'MVP Board' : 'MVP予測', href: '/mvp' },
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
          {row.warPitch != null && row.war != null ? (
            <p className="mt-1.5 text-xs text-ink-mute">{c.twoWay(row.war, row.warPitch)}</p>
          ) : null}
        </div>
      </section>

      {/* スコア内訳（percentile バー×重み）＝この順位になっている根拠。 */}
      <section>
        <SectionHeading label={c.scoreTitle} lead level="h2" />
        <p className="mb-3 mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{c.scoreLead}</p>
        <ul className="space-y-2.5">
          {metrics.map((m) => {
            const v = row.pct[m.key] ?? 0;
            return (
              <li key={m.key} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_3rem]">
                <span className="truncate text-ink-soft">
                  {en ? m.en : m.ja}
                  <span className="ml-1 text-[10px] text-ink-mute">{Math.round(m.w * 1000) / 10}%</span>
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
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-5">
          {[
            { l: en ? 'AVG' : '打率', v: row.avg },
            { l: en ? 'wOBA' : 'wOBA（出塁率）', v: row.woba != null ? row.woba.toFixed(3) : '—' },
            { l: en ? 'SLG' : '長打率', v: row.slg },
            { l: 'OPS', v: row.ops },
            { l: 'wRC+', v: row.wrcPlus != null ? String(row.wrcPlus) : '—' },
            { l: en ? 'HR' : '本塁打', v: String(row.hr) },
            { l: en ? 'RBI' : '打点', v: String(row.rbi) },
            { l: en ? 'SB' : '盗塁', v: String(row.sbs) },
            { l: en ? 'xwOBA' : 'xwOBA（期待出塁率）', v: row.xwoba != null ? row.xwoba.toFixed(3) : '—' },
            { l: 'WAR', v: row.warTotal != null ? row.warTotal.toFixed(1) : '—' },
          ].map((s) => (
            <div key={s.l} className="bg-paper px-4 py-3">
              <dt className="text-xs text-ink-mute">{s.l}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-ink">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 打球の質・スイング＝野手の“中身”データ（投手ページの球種の設計図に対応する厚み）。 */}
      <section>
        <SectionHeading label={c.scTitle} lead level="h2" />
        <p className="mb-3 mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{c.scLead}</p>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-5">
          {[
            { l: en ? 'Avg exit velo' : '平均打球速度', v: fmt(sc.ev, ' mph') },
            { l: en ? 'Max exit velo' : '最大打球速度', v: fmt(sc.maxEv, ' mph') },
            { l: en ? 'Barrel%' : 'バレル率', v: fmt(sc.barrel, '%') },
            { l: en ? 'Hard-hit%' : 'ハードヒット率', v: fmt(sc.hardHit, '%') },
            { l: en ? 'Sweet-spot%' : 'スイートスポット率', v: fmt(sc.sweetSpot, '%') },
            { l: en ? 'Bat speed' : 'バットスピード', v: fmt(sc.batSpeed, ' mph') },
            { l: en ? 'Squared-up%' : '芯食い率', v: fmt(sc.squaredUp, '%') },
            { l: en ? 'Hard swing%' : '強スイング率', v: fmt(sc.hardSwing, '%') },
            { l: en ? 'Sprint speed' : '走力', v: fmt(sc.sprint, ' ft/s') },
            { l: 'OAA', v: sc.oaa != null ? String(sc.oaa) : '—' },
          ].map((s) => (
            <div key={s.l} className="bg-paper px-4 py-3">
              <dt className="text-xs text-ink-mute">{s.l}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-ink">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 球種別の打撃成績＝投手の球種の設計図に対応する「攻められ方」の厚み。 */}
      {row.vsPitch.length > 0 ? (
        <section>
          <SectionHeading label={c.vsTitle} lead level="h2" />
          <p className="mb-3 mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{c.vsLead}</p>
          <div className="overflow-x-auto rounded-[2px] border border-line">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-xs text-ink-mute">
                  <th className="px-3 py-2 text-left font-medium">{c.vsCols.pitch}</th>
                  <th className="px-3 py-2 text-right font-medium">{c.vsCols.usage}</th>
                  <th className="px-3 py-2 text-right font-medium">{c.vsCols.pa}</th>
                  <th className="px-3 py-2 text-right font-semibold text-ink">{c.vsCols.woba}</th>
                  <th className="px-3 py-2 text-right font-medium">{c.vsCols.xwoba}</th>
                  <th className="px-3 py-2 text-right font-medium">{c.vsCols.whiff}</th>
                  <th className="px-3 py-2 text-right font-medium">{c.vsCols.hard}</th>
                </tr>
              </thead>
              <tbody>
                {row.vsPitch.map((v) => (
                  <tr key={v.type} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium text-ink">{en ? v.name : v.nameJa}</td>
                    <td className="px-3 py-2 text-right text-ink-soft">{v.usage != null ? `${v.usage.toFixed(1)}%` : '—'}</td>
                    <td className="px-3 py-2 text-right text-ink-soft">{v.pa}</td>
                    <td className="px-3 py-2 text-right font-bold text-ink">{v.woba != null ? v.woba.toFixed(3) : '—'}</td>
                    <td className="px-3 py-2 text-right text-ink-soft">{v.xwoba != null ? v.xwoba.toFixed(3) : '—'}</td>
                    <td className="px-3 py-2 text-right text-ink-soft">{v.whiff != null ? `${v.whiff.toFixed(1)}%` : '—'}</td>
                    <td className="px-3 py-2 text-right text-ink-soft">{v.hardHit != null ? `${v.hardHit.toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* スイング判断（Swing/Take）＝選球眼をゾーン別 run value で。 */}
      {row.st ? (
        <section>
          <SectionHeading label={c.stTitle} lead level="h2" />
          <p className="mb-3 mt-1 max-w-prose text-xs leading-relaxed text-ink-mute">{c.stLead}</p>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-line bg-line sm:grid-cols-5">
            {([
              { k: 'all', v: row.st.all, strong: true },
              { k: 'heart', v: row.st.heart },
              { k: 'shadow', v: row.st.shadow },
              { k: 'chase', v: row.st.chase },
              { k: 'waste', v: row.st.waste },
            ] as const).map((z) => (
              <div key={z.k} className="bg-paper px-4 py-3">
                <dt className="text-xs text-ink-mute">{c.stZones[z.k]}</dt>
                <dd className={`mt-0.5 text-lg font-bold tabular-nums ${'strong' in z && z.strong ? 'text-ink' : 'text-ink-soft'}`}>
                  {fmtSigned(z.v)}
                </dd>
              </div>
            ))}
          </dl>
          {/* ゾーンの意味＝初見の読者向けの脚注（村山依頼: よくわからないので説明を）。 */}
          <ul className="mt-3 space-y-1 text-xs leading-relaxed text-ink-mute">
            {c.stNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* この打者の海外の反応。 */}
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
        <Link href="/mvp" className="text-ink-soft transition-colors hover:text-ink hover:underline">
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
