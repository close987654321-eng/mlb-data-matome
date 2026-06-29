import { ImageResponse } from 'next/og';
import { getAllThreads } from '@/lib/data';
import { PLAYERS, getPlayer, hubEligible } from '@/lib/players';
import { getPlayerSeason, getPlayersSnapshot, type PlayerSeason } from '@/lib/playerStats';
import { pickHero, pickBestRankCaption, type Hero } from '@/lib/playerHero';
import { wrc, signedInt, oneDecimal } from '@/lib/statGroups';
import { getTeamColor, ACCENT } from '@/lib/teamColors';
import { getTeam, teamLogoUrl, headshotUrl } from '@/lib/teams';
import { locales, type Locale } from '@/lib/i18n';
import { CREAM, MUTED, FAINT, RULE, loadOgBg, loadOgFonts, ogFrame } from '@/lib/ogCard';

/**
 * 選手別の OG カード「THE COLUMN／海外の反応・紙面」。X 拡散時の見栄え＝各選手の成績シェアの
 * バズ起点になる固定テンプレ。設計の核（ワークフロー合意）:
 *  - 引き算: 主役は「巨大数字1個＋和文選手名」の2要素。X 縮小サムネでも誰の何の数字か即読できる。
 *  - 和文同梱: Noto Sans JP をサブセット同梱（scripts/build-og-fonts.mjs）して「大谷翔平」を主役級に出す。
 *    巨大数字/英字は条幅の Anton。フォント未生成でも豆腐(□)を出さず英字へ縮退する（loadFonts → hasJp）。
 *  - 誠実: 数値は pickHero / pickBestRankCaption が返す実在値のみ。順位は分母を持たない「位置」リテラルだけ
 *    （%・パーセンタイル・「◯人中」は出さない＝RankMeter と同じドクトリン）。
 *  - チーム識別: 球団ロゴ/名称マークは商標なので使わず、teamColors の色だけで「自分のチームの色だ」を出す。
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'MLB日本人選手の今季成績カード｜海外の反応';

export async function generateStaticParams() {
  const [all, snap] = await Promise.all([getAllThreads(), getPlayersSnapshot()]);
  const withHub = PLAYERS.filter((p) => hubEligible(p, all, snap.players[String(p.mlbId)]));
  return locales.flatMap((locale) => withHub.map((p) => ({ locale, slug: p.slug })));
}

/**
 * OG 画像 URL に「成績の版数(id)」を埋め込む。Next のファイル規約が自動で付けるクエリは
 * ソースファイル基準＝数値が動いても変わらないため、SNS スクレイパー/CDN が古い画像を
 * 出し続ける。ここで id をその選手の実成績ハッシュにすると、数字が動いた時だけ URL が変わり
 * （= ビルドキャッシュは新パスでミス→最新で再生成・スクレイパーは再取得）、ページの数字と必ず一致する。
 * 数字が動かない選手の URL は変わらない＝不要な再生成・再取得は起こさない。
 */
function ogVersion(season: PlayerSeason | null): string {
  const basis = season
    ? JSON.stringify([
        season.team,
        season.league,
        season.hitting,
        season.pitching,
        season.fielding,
        season.saber,
        season.sprintSpeed,
      ])
    : 'degraded';
  let h = 0x811c9dc5; // FNV-1a（依存を増やさない小さなハッシュ。衝突は実用上問題にならない）
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export async function generateImageMetadata({ params }: { params: { locale: Locale; slug: string } }) {
  const player = getPlayer(params.slug);
  const season = player ? await getPlayerSeason(player.mlbId) : null;
  return [{ id: ogVersion(season), size, contentType, alt }];
}

const ROLE_JA: Record<Hero['role'], string> = { 'two-way': '二刀流', batter: '打者', pitcher: '投手' };
const ROLE_EN: Record<Hero['role'], string> = { 'two-way': 'TWO-WAY', batter: 'HITTER', pitcher: 'PITCHER' };
const leagueJa = (l?: string | null) => (l === 'AL' ? 'ア・リーグ' : l === 'NL' ? 'ナ・リーグ' : '');

/** "2026-06-23 09:09" → "6/23時点"（捏造しない・無ければ空）。 */
function asOfLabel(asOf?: string): string {
  if (!asOf) return '';
  const m = asOf.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[3])}時点` : '';
}

type Tok = { label: string; value: string };
const tok = (label: string, value: unknown): Tok | null =>
  value == null || value === '' ? null : { label, value: String(value) };

/** 欄外フッターの指標トークン（役割別・ヒーローと重複させない・最大4）。 */
function footerTokens(season: PlayerSeason, hero: Hero): Tok[] {
  const h = season.hitting;
  const p = season.pitching;
  const f = season.fielding;
  const sprint = season.sprintSpeed != null ? `${oneDecimal(season.sprintSpeed)}ft/s` : null;
  // OAA は守備位置に就く野手だけ（fielding に oaa キーがある時）。投手・大谷には付かない。
  const oaa = f && 'oaa' in f ? signedInt(f.oaa as number) : null;

  if (hero.kind === 'warTotal') {
    // 二刀流は WAR 内訳トークンが長いので3つに絞る（走力は割愛＝末尾クリップを防ぐ）。
    const ws = hero.warSplit;
    return [
      ws ? { label: 'WAR', value: `投${ws.pit}＋打${ws.bat}` } : null,
      tok('打率', h?.avg),
      tok('本塁打', h?.homeRuns),
    ].filter((t): t is Tok => t != null).slice(0, 3);
  }

  if (h && !p) {
    // 打者: ヒーロー指標を除いた上位3＋（守備 or 走力）を末尾に
    const cand = [
      tok('打率', h.avg),
      tok('OPS', h.ops),
      tok('本塁打', h.homeRuns),
      hero.kind !== 'wrc' ? tok('wRC+', wrc(season.saber?.wrcplus)) : null,
      tok('打点', h.rbi),
    ].filter((t): t is Tok => t != null && t.label !== hero.statLabel);
    const tail: Tok | null = oaa ? { label: 'OAA', value: oaa } : sprint ? { label: '走力', value: sprint } : null;
    return [...cand.slice(0, 3), ...(tail ? [tail] : [])].slice(0, 4);
  }

  // 投手
  return [
    tok('防御率', p?.era),
    tok('WHIP', p?.whip),
    tok('奪三振', p?.strikeOuts),
    tok('K/9', p?.strikeoutsPer9Inn),
    tok('被打率', p?.avg),
  ]
    .filter((t): t is Tok => t != null && t.label !== hero.statLabel)
    .slice(0, 4);
}

/**
 * 顔写真・ロゴを data URI 化して取り込む（Satori は <img> に http URL も渡せるが、ビルド時の
 * 外部フェッチ失敗で OG 生成ごと落ちるのを避けるため、ここで取得して base64 に inline する。
 * 取得失敗時は null＝写真/ロゴ無しの従来カードに自然縮退する＝ビルドを壊さない）。
 * 画像は MLB 公式 CDN から取得し、データはここでの一時利用のみ（記事/サイトに再ホストしない）。
 */
async function loadImageData(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? 'image/png';
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

// 内側コンテンツ枠（背景の上に乗る層）。padding と flex はここが持つ＝背景/黒レイヤーは全面。
function containerStyle() {
  return {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between' as const,
    color: CREAM,
    // 下を厚めに空ける: 一部の SNS/アプリは共有時に画像下へ og:title の白帯を重ねるので、
    // 成績フッターをその帯の上へ逃がす（被って成績が読めなくなるのを防ぐ）。左右60/上60。
    padding: '60px 72px 132px 72px',
    fontFamily: 'sans-serif',
  };
}

export default async function Image({ params }: { params: { locale: Locale; slug: string } }) {
  const { slug } = params;
  const [fonts, bg] = await Promise.all([loadOgFonts(), loadOgBg()]);
  const hasJp = fonts != null;
  const JP = hasJp ? 'NotoJP' : undefined; // 和文ノードの fontFamily（未生成なら undefined＝既定フォント）
  const DISP = hasJp ? 'Anton' : undefined; // 巨大数字/英字名

  const player = getPlayer(slug);
  const [season, snap] = await Promise.all([
    player ? getPlayerSeason(player.mlbId) : Promise.resolve(null),
    getPlayersSnapshot(),
  ]);

  // league=null(AAA等) や成績無しは「MLB SEASON STATS」を名乗らせず、媒体面だけの表紙に縮退。
  // 和フォント未生成(!hasJp)も縮退に倒す＝和文ラベルの豆腐(□)を一切出さず英字の名前＋媒体面だけにする。
  const hero = season && season.league ? pickHero(season) : null;
  const degraded = !season || !hero || hero.value === '—' || !hasJp;

  const teamColor = getTeamColor(season?.team);
  const yr = snap.season || 2026; // 年はスナップショット由来（ベタ書きしない）。未生成のみ 2026 フォールバック。

  // 顔写真＋所属ロゴ（MLB公式CDN→data URI）。読み込めた時だけ出す＝オフライン/失敗でもカードは成立。
  const teamInfo = getTeam(season?.team);
  const [portraitImg, logoImg] = await Promise.all([
    player ? loadImageData(headshotUrl(player.mlbId, 'portrait')) : null,
    teamInfo ? loadImageData(teamLogoUrl(teamInfo.id)) : null,
  ]);
  // 顔写真タイル: チーム色の枠＋右下に白タイルのロゴバッジ（暗色ロゴでも沈まないよう下地は CREAM）。
  const portraitBlock = portraitImg ? (
    <div style={{ display: 'flex', position: 'relative', marginRight: 40, flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI 化済みの公式写真 */}
      <img
        src={portraitImg}
        width={168}
        height={168}
        style={{ borderRadius: 10, border: `3px solid ${teamColor}`, objectFit: 'cover' }}
      />
      {logoImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI 化済みの公式ロゴ
        <img
          src={logoImg}
          width={60}
          height={60}
          style={{ position: 'absolute', bottom: -14, right: -14, borderRadius: 8, background: CREAM, padding: 7, objectFit: 'contain' }}
        />
      ) : null}
    </div>
  ) : null;

  // 選手名: 和名は6字までが主役映え。長いカタカナ中黒名（ライバル等）や和フォント未生成は英字へ。
  const nameJa = player?.nameJa ?? '';
  const graph = [...nameJa].length;
  const useJa = hasJp && nameJa !== '' && graph <= 6 && !(nameJa.includes('・') && graph >= 6);
  const nameSizeJa = graph <= 4 ? 116 : graph === 5 ? 96 : 80;
  const nameEn = (player?.nameEn ?? 'MLB').toUpperCase();
  const nameEnSize = nameEn.length <= 12 ? 84 : nameEn.length <= 18 ? 62 : 50;

  // ヘッダー（媒体面）。チーム色の縦バー＋「海外の反応」＋右に役割バッジ（縮退時はバッジ無し）。
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <div style={{ display: 'flex', width: 14, height: 42, background: teamColor, borderRadius: 3, marginRight: 20 }} />
      <div style={{ display: 'flex', fontFamily: JP, fontWeight: 700, fontSize: hasJp ? 27 : 24, letterSpacing: hasJp ? 2 : 4, color: CREAM }}>
        {hasJp ? '海外の反応' : 'MLB SEASON STATS'}
      </div>
      <div style={{ display: 'flex', fontFamily: DISP, fontSize: 23, letterSpacing: 4, color: MUTED, marginLeft: 22 }}>
        {`MLB ${yr}`}
      </div>
      {!degraded && hero ? (
        <div
          style={{
            display: 'flex',
            marginLeft: 'auto',
            border: `1px solid ${MUTED}`,
            borderRadius: 999,
            padding: '7px 22px',
            fontFamily: JP,
            fontSize: 23,
            letterSpacing: 2,
            color: CREAM,
          }}
        >
          {hasJp ? ROLE_JA[hero.role] : ROLE_EN[hero.role]}
        </div>
      ) : null}
    </div>
  );

  const asOf = asOfLabel(snap.asOf);
  const domain = (
    <div style={{ display: 'flex', alignItems: 'baseline', marginLeft: 24, flexShrink: 0 }}>
      <div style={{ display: 'flex', fontFamily: JP, fontSize: 21, color: FAINT, letterSpacing: 1 }}>
        matome-mlb-kaigai.jp
      </div>
      {asOf ? (
        <div style={{ display: 'flex', fontFamily: JP, fontSize: 19, color: FAINT, marginLeft: 14 }}>{`・ ${asOf}`}</div>
      ) : null}
    </div>
  );

  // ── 縮退カード: 媒体面＋名前＋ドメインだけ（成績ブロックを出さない）──
  if (degraded) {
    return new ImageResponse(
      ogFrame(
        bg,
        <div style={containerStyle()}>
          {header}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {portraitBlock}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontFamily: useJa ? JP : DISP, fontWeight: 900, fontSize: useJa ? nameSizeJa : nameEnSize, color: CREAM, lineHeight: 1.05 }}>
                {useJa ? nameJa : nameEn}
              </div>
              {useJa ? (
                <div style={{ display: 'flex', fontFamily: DISP, fontSize: 28, color: MUTED, letterSpacing: 3, marginTop: 12 }}>{nameEn}</div>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>{domain}</div>
        </div>,
      ),
      { ...size, ...(fonts ? { fonts } : {}) },
    );
  }

  // ── 通常カード ──
  const heroLabel = hero!.kind === 'warTotal' ? 'WAR' : hero!.statLabel ?? '';
  const heroValue = hero!.value;
  const digits = (heroValue.match(/[0-9]/g) ?? []).length;
  const heroSize = digits <= 2 ? 210 : digits === 3 ? 176 : 150;

  const caption = pickBestRankCaption(season!);
  const capScopeJa = caption ? (caption.scope === 'lg' ? leagueJa(season!.league) : 'MLB') : '';
  // 順位の指標名がヒーローと同じ時は重複するので省く（例: 本塁打17 の下に「本塁打 MLB17位」→「MLB17位」）。
  const capLabel = caption && caption.label !== heroLabel ? `${caption.label} ` : '';
  const capText = caption ? `${capLabel}${capScopeJa}${caption.rank}位` : '';
  const capThick = caption ? (caption.scope === 'lg' ? caption.rank <= 5 : caption.rank <= 10) : false;

  const metaLine = [season!.team, season!.league, String(yr)].filter(Boolean).join('  ・  ');
  const tokens = footerTokens(season!, hero!);

  return new ImageResponse(
    ogFrame(
      bg,
      <div style={containerStyle()}>
        {header}

        {/* 主役: 左=顔写真＋選手名 / 右=巨大数字＋チーム色下線＋順位リテラル */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, minWidth: 0 }}>
            {portraitBlock}
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: portraitImg ? 470 : 720, overflow: 'hidden' }}>
              <div style={{ display: 'flex', fontFamily: useJa ? JP : DISP, fontWeight: 900, fontSize: useJa ? nameSizeJa : nameEnSize, color: CREAM, lineHeight: 1.04 }}>
                {useJa ? nameJa : nameEn}
              </div>
              {useJa ? (
                <div style={{ display: 'flex', fontFamily: DISP, fontSize: 27, color: MUTED, letterSpacing: 3, marginTop: 10 }}>{nameEn}</div>
              ) : null}
              <div style={{ display: 'flex', fontFamily: JP, fontSize: 26, color: MUTED, marginTop: 22 }}>{metaLine}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 36 }}>
            <div style={{ display: 'flex', fontFamily: JP, fontSize: 26, color: MUTED, letterSpacing: 1, marginBottom: 2 }}>{heroLabel}</div>
            <div style={{ display: 'flex', fontFamily: DISP, fontSize: heroSize, color: CREAM, lineHeight: 1 }}>{heroValue}</div>
            <div style={{ display: 'flex', width: '100%', height: capThick ? 9 : 6, background: teamColor, borderRadius: 2, marginTop: 14 }} />
            {caption ? (
              <div style={{ display: 'flex', fontFamily: JP, fontWeight: 700, fontSize: 26, color: ACCENT, marginTop: 12 }}>{capText}</div>
            ) : null}
          </div>
        </div>

        {/* フッター: 罫＋指標トークン＋ドメイン */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', width: '100%', height: 1, background: RULE, marginBottom: 22 }} />
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', flex: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
              {tokens.map((t, i) => (
                <div key={t.label} style={{ display: 'flex', alignItems: 'baseline', flexShrink: 0 }}>
                  {i > 0 ? <div style={{ display: 'flex', fontFamily: JP, fontSize: 20, color: RULE, margin: '0 16px' }}>・</div> : null}
                  <div style={{ display: 'flex', fontFamily: JP, fontSize: 20, color: MUTED }}>{t.label}</div>
                  <div style={{ display: 'flex', fontFamily: JP, fontWeight: 700, fontSize: 23, color: CREAM, marginLeft: 8 }}>{t.value}</div>
                </div>
              ))}
            </div>
            {domain}
          </div>
        </div>
      </div>,
    ),
    { ...size, ...(fonts ? { fonts } : {}) },
  );
}
