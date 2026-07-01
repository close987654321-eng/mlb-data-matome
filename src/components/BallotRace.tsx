import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import type { AllStarBallot, BallotPosition, BallotPlayer } from '@/lib/allstarBallot';
import type { Locale } from '@/lib/i18n';

/**
 * オールスター投票レース＝各リーグ×守備位置の候補を「成績（OPS）で見る」ボード。
 * ⚠️ 投票数は公式APIに無いので出さない（捏造しない）。順位は OPS 順の proxy、実際の投票は公式ballotへ送客。
 * 日本人候補は名前を太字＋ハブへのリンク＋「日本」タグで強調（無彩色規律＝色でなく体裁で差をつける）。
 */
const ORDER = ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH'];
const POS_LABEL: Record<string, { ja: string; en: string }> = {
  C: { ja: '捕手', en: 'Catcher' },
  '1B': { ja: '一塁', en: '1B' },
  '2B': { ja: '二塁', en: '2B' },
  '3B': { ja: '三塁', en: '3B' },
  SS: { ja: '遊撃', en: 'SS' },
  OF: { ja: '外野', en: 'OF' },
  DH: { ja: '指名打者', en: 'DH' },
};

const fmtOps = (v: number | null) => (v == null ? '—' : v.toFixed(3).replace(/^0\./, '.'));
const logoUrl = (id: number | null) => (id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : null);

// 表示は上位3人＋（圏外なら）日本人を必ず追加。
function shown(pos: BallotPosition): BallotPlayer[] {
  const top = pos.players.slice(0, 3);
  for (const p of pos.players) if (p.jp && !top.includes(p)) top.push(p);
  return top;
}

export default async function BallotRace({ ballot, locale }: { ballot: AllStarBallot; locale: Locale }) {
  const t = await getTranslations();
  const en = locale === 'en';
  const posLabel = (k: string) => (en ? POS_LABEL[k]?.en : POS_LABEL[k]?.ja) ?? k;

  const playerRow = (p: BallotPlayer) => {
    const lg = logoUrl(p.teamId);
    const name = p.jp ? (en ? p.name : p.ja) : p.name;
    return (
      <li key={p.id} className="flex items-center gap-2 py-1.5">
        <span className="w-4 shrink-0 text-center text-xs font-bold tabular-nums text-ink-mute">{p.rank}</span>
        {lg && (
          // eslint-disable-next-line @next/next/no-img-element -- MLB公式CDNのチームロゴを直リンク（再ホストしない）
          <img src={lg} alt="" width={20} height={20} className="h-5 w-5 shrink-0 object-contain" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm">
          {p.slug ? (
            <Link href={`/player/${p.slug}`} className="font-bold text-ink hover:underline">
              {name}
            </Link>
          ) : (
            <span className={p.jp ? 'font-bold text-ink' : 'text-ink'}>{name}</span>
          )}
          {p.jp && (
            <span className="ml-1.5 rounded-[3px] border border-line px-1 py-px text-[10px] text-ink-soft">
              {t('allstar.jpTag')}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{fmtOps(p.ops)}</span>
      </li>
    );
  };

  const card = (posKey: string, pos: BallotPosition) => (
    <div key={posKey} className="border border-line p-4">
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <span className="text-sm font-bold text-ink">{posLabel(posKey)}</span>
        <span className="text-[11px] uppercase tracking-wider text-ink-mute">OPS</span>
      </div>
      <ol className="mt-1">{shown(pos).map(playerRow)}</ol>
    </div>
  );

  const leagueBlock = (lgKey: 'AL' | 'NL') => {
    const positions = ballot.leagues[lgKey]?.positions ?? {};
    const cards = ORDER.filter((k) => positions[k]).map((k) => card(k, positions[k]));
    if (!cards.length) return null;
    return (
      <div key={lgKey}>
        <h3 className="mb-3 text-sm font-bold tracking-wide text-ink">{t(`allstar.league${lgKey}`)}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {(['AL', 'NL'] as const).map(leagueBlock)}
    </div>
  );
}
