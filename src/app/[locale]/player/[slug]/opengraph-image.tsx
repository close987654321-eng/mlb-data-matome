import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getAllThreads } from '@/lib/data';
import { PLAYERS, getPlayer, hubEligible } from '@/lib/players';
import { getPlayerSeason, getPlayersSnapshot, type PlayerSeason } from '@/lib/playerStats';
import { pickHero, pickBestRankCaption, type Hero } from '@/lib/playerHero';
import { wrc, signedInt, oneDecimal } from '@/lib/statGroups';
import { getTeamColor, ACCENT } from '@/lib/teamColors';
import { locales, type Locale } from '@/lib/i18n';

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
export const alt = 'MLB season stats';

export async function generateStaticParams() {
  const [all, snap] = await Promise.all([getAllThreads(), getPlayersSnapshot()]);
  const withHub = PLAYERS.filter((p) => hubEligible(p, all, snap.players[String(p.mlbId)]));
  return locales.flatMap((locale) => withHub.map((p) => ({ locale, slug: p.slug })));
}

// ── 配色（既存トーン継承）。チーム色だけが選手ごとに変わる ──
const BG = '#16130F';
const CREAM = '#FAF8F4';
const MUTED = '#9b958c';
const FAINT = '#6f6a62';
const RULE = '#2b2620';

// ── 同梱フォントを一度だけ読んでメモ化。失敗(未生成)なら null＝英字フォールバック ──
type FontDef = { name: string; data: Buffer; weight: 400 | 700 | 900; style: 'normal' };
let fontsPromise: Promise<FontDef[] | null> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      try {
        const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
        const [n7, n9, an] = await Promise.all([
          fs.readFile(path.join(dir, 'noto-jp-700.ttf')),
          fs.readFile(path.join(dir, 'noto-jp-900.ttf')),
          fs.readFile(path.join(dir, 'anton.ttf')),
        ]);
        return [
          { name: 'NotoJP', data: n7, weight: 700, style: 'normal' },
          { name: 'NotoJP', data: n9, weight: 900, style: 'normal' },
          { name: 'Anton', data: an, weight: 400, style: 'normal' },
        ] satisfies FontDef[];
      } catch {
        return null;
      }
    })();
  }
  return fontsPromise;
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

function containerStyle() {
  return {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between' as const,
    background: BG,
    color: CREAM,
    padding: '60px 72px',
    fontFamily: 'sans-serif',
  };
}

export default async function Image({ params }: { params: { locale: Locale; slug: string } }) {
  const { slug } = params;
  const fonts = await loadFonts();
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
        MLB 2026
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
      (
        <div style={containerStyle()}>
          {header}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: useJa ? JP : DISP, fontWeight: 900, fontSize: useJa ? nameSizeJa : nameEnSize, color: CREAM, lineHeight: 1.05 }}>
              {useJa ? nameJa : nameEn}
            </div>
            {useJa ? (
              <div style={{ display: 'flex', fontFamily: DISP, fontSize: 28, color: MUTED, letterSpacing: 3, marginTop: 12 }}>{nameEn}</div>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>{domain}</div>
        </div>
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

  const metaLine = [season!.team, season!.league, '2026'].filter(Boolean).join('  ・  ');
  const tokens = footerTokens(season!, hero!);

  return new ImageResponse(
    (
      <div style={containerStyle()}>
        {header}

        {/* 主役: 左=選手名 / 右=巨大数字＋チーム色下線＋順位リテラル */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxWidth: 720, overflow: 'hidden' }}>
            <div style={{ display: 'flex', fontFamily: useJa ? JP : DISP, fontWeight: 900, fontSize: useJa ? nameSizeJa : nameEnSize, color: CREAM, lineHeight: 1.04 }}>
              {useJa ? nameJa : nameEn}
            </div>
            {useJa ? (
              <div style={{ display: 'flex', fontFamily: DISP, fontSize: 27, color: MUTED, letterSpacing: 3, marginTop: 10 }}>{nameEn}</div>
            ) : null}
            <div style={{ display: 'flex', fontFamily: JP, fontSize: 26, color: MUTED, marginTop: 22 }}>{metaLine}</div>
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
      </div>
    ),
    { ...size, ...(fonts ? { fonts } : {}) },
  );
}
