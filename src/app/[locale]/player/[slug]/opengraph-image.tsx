import { ImageResponse } from 'next/og';
import { getAllThreads } from '@/lib/data';
import { PLAYERS, getPlayer, hubEligible } from '@/lib/players';
import { getPlayerSeason, getPlayersSnapshot, type PlayerSeason } from '@/lib/playerStats';
import { pickHero, type Hero } from '@/lib/playerHero';
import { locales, type Locale } from '@/lib/i18n';

// 選手別の OG カード（SNS 拡散時の見栄え＝“いい感じ”の核）。
// ⚠️ JP Web フォントを足さない方針なので、画像内テキストは英字＋数字のみ（CJK は組み込み既定フォントで
//    豆腐になるため使わない）。日本語名・文脈は og:title 側（generateMetadata）が担う。数値は公知の事実のみ。
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'MLB season stats';

export async function generateStaticParams() {
  const [all, snap] = await Promise.all([getAllThreads(), getPlayersSnapshot()]);
  const withHub = PLAYERS.filter((p) => hubEligible(p, all, snap.players[String(p.mlbId)]));
  return locales.flatMap((locale) => withHub.map((p) => ({ locale, slug: p.slug })));
}

const num = (v: unknown) => (v == null || v === '' ? null : String(v));

function tiles(season: PlayerSeason, hero: Hero): Array<{ label: string; value: string }> {
  const h = season.hitting;
  const p = season.pitching;
  const wrc = season.saber?.wrcplus != null ? String(Math.round(season.saber.wrcplus)) : null;
  const out: Array<{ label: string; value: string }> = [];
  const push = (label: string, v: string | null) => v != null && out.push({ label, value: v });
  // WAR ラベルは hero.value が合計WARの時(kind==='warTotal')だけ。role だけだとセイバー欠損で WAR に ERA を載せかねない。
  if (hero.kind === 'warTotal') {
    push('WAR', hero.value);
    push('AVG', num(h?.avg));
    push('HR', num(h?.homeRuns));
    push('ERA', num(p?.era));
  } else if (hero.role === 'batter') {
    push('HR', num(h?.homeRuns));
    push('AVG', num(h?.avg));
    push('OPS', num(h?.ops));
    push('wRC+', wrc);
  } else {
    push('ERA', num(p?.era));
    push('WHIP', num(p?.whip));
    push('K', num(p?.strikeOuts));
    push('W', num(p?.wins));
  }
  return out.slice(0, 4);
}

const ROLE_EN: Record<Hero['role'], string> = { 'two-way': 'TWO-WAY', batter: 'HITTER', pitcher: 'PITCHER' };

export default async function Image({ params }: { params: { locale: Locale; slug: string } }) {
  const { slug } = params;
  const player = getPlayer(slug);
  const season = player ? await getPlayerSeason(player.mlbId) : null;

  // データが無ければ最低限のブランドカードを返す。league=null(AAA等)は「MLB SEASON STATS」を名乗らせない
  // ため成績タイルを出さない（hasMlbStats と同じゲート）。
  const hero = season && season.league ? pickHero(season) : null;
  const stat = season && hero && season.league ? tiles(season, hero) : [];
  const role = hero ? ROLE_EN[hero.role] : '';
  const league = season?.league ?? '';
  const accent = '#C8102E';
  const cream = '#FAF8F4';
  const muted = '#9b958c';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#16130F',
          color: cream,
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 52, height: 8, background: accent, borderRadius: 4, marginRight: 18 }} />
          <div style={{ fontSize: 26, letterSpacing: 4, color: accent, fontWeight: 700 }}>MLB SEASON STATS</div>
          <div style={{ marginLeft: 'auto', fontSize: 24, letterSpacing: 3, color: muted }}>{role}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1 }}>{player?.nameEn ?? 'MLB'}</div>
          <div style={{ display: 'flex', fontSize: 28, color: muted, marginTop: 12 }}>
            {[league, '2026'].filter(Boolean).join('  ·  ')}
          </div>
          <div style={{ display: 'flex', gap: 56, marginTop: 44 }}>
            {stat.map((t) => (
              <div key={t.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 24, letterSpacing: 2, color: muted }}>{t.label}</div>
                <div style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.15 }}>{t.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 22, color: '#6f6a62' }}>matome-mlb-kaigai.jp</div>
      </div>
    ),
    size,
  );
}
