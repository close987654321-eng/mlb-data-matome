import type { Thread } from '@/types/thread';
import type { FaqItem } from '@/components/FaqList';
import { getPlayer } from './players';
import { playerLabel } from './playerNames';
import { NPB_PROSPECTS } from './npbPlayers';
import { headshotUrl } from './teams';
import { fmtDate } from './format';
import {
  articleFor,
  faStatus,
  fmtUsdM,
  projectionText,
  statLine,
  teamPath,
  type FaStatusKey,
  type StoveCatalog,
  type StoveStats,
} from './stoveLeague';

type Bi = { ja: string; en: string };

/**
 * FA注目選手の1行ぶん（入口 /stove-league の抜粋と、一覧 /stove-league/fa が同じ行を使う）。
 *
 * なぜ lib に出したか: 2026-11-10 にFA一覧を専用ページへ分けた＝同じ30人を2つのページが並べる。
 * 行の組み立て（名前の日本語表記・リンク先・状況）を2か所に書くと、片方だけ直して食い違う。
 * 値はすべて data の再配置（順位＝MLB公式／espnRank＝ESPN／予想契約＝MLB Trade Rumors／成績＝statsapi）。
 */
export type FaRow = {
  rank: number;
  espnRank?: number;
  name: string;
  nameSub?: string;
  /** 日本人＝選手LP、外国人＝その選手を語ったオフの記事（無ければリンクしない）。 */
  href?: string;
  hrefIsArticle?: boolean;
  photo?: string;
  japanese: boolean;
  pitcher: boolean;
  age?: number;
  pos: Bi;
  team?: Bi;
  status: { key: FaStatusKey; label: Bi; done: boolean; team?: Bi; terms?: Bi & { source: string; sourceName: string } };
  qo?: 'offered' | 'accepted' | 'declined';
  statLine: string;
  /** 他社の予想契約（文字列に整形済み・媒体名は見出し側で出す）。 */
  projection?: Bi;
  projectionUsdM?: number;
  suitors?: Bi[];
  note: Bi;
};

export async function buildFaRows(opts: {
  cat: StoveCatalog;
  stats: StoveStats;
  threads: Thread[];
  /** NPB組の成績1行（NPB公式由来の静的JSONから引く）。 */
  npbLine: (slug: string) => string;
  locale: string;
  faOpen: boolean;
}): Promise<FaRow[]> {
  const { cat, stats, threads, npbLine, locale, faOpen } = opts;
  const en = locale === 'en';
  return Promise.all(
    cat.board.map(async (b) => {
      const s = b.mlbId ? stats.players[String(b.mlbId)] : undefined;
      const prospect = b.prospectSlug ? NPB_PROSPECTS.find((p) => p.slug === b.prospectSlug) : undefined;
      const jp = b.jpSlug ? getPlayer(b.jpSlug) : undefined;
      // 記事のタグは日本語＝en ページでも日本語表記で引く。
      const labelJa = jp || prospect ? null : (await playerLabel(b.nameEn, { locale: 'ja', mlbId: b.mlbId })).label;
      const label = jp || prospect ? null : await playerLabel(b.nameEn, { locale, mlbId: b.mlbId });
      const article = labelJa ? articleFor(threads, labelJa) : null;
      const name = jp ? (en ? jp.nameEn : jp.nameJa) : prospect ? (en ? prospect.nameEn : prospect.nameJa) : label!.label;
      const st = faStatus(b, s, faOpen);
      // 関心球団は日本人なら去就の正（japanese[] / postingWatch）、外国人は board の出典つきの欄。
      const jpStove = b.jpSlug ? cat.japanese.find((j) => j.slug === b.jpSlug) : undefined;
      // 選手LPを持つ外国人（stars[]）も、関心球団は去就の欄が正（board 側と二重に書かない）。
      const star = b.mlbId ? cat.stars?.find((s) => getPlayer(s.slug)?.mlbId === b.mlbId) : undefined;
      const suitors =
        jpStove?.suitors ?? star?.suitors ?? prospect?.postingWatch?.suitors ?? b.suitors?.map((x) => ({ ja: x.ja, en: x.en }));
      return {
        rank: b.rank,
        espnRank: b.espnRank,
        name,
        nameSub: en ? undefined : b.nameEn,
        // 選手LPがある外国人（stars[]）は記事でなく選手LPへ＝去就の欄と成績がそこにある。
        href: jp
          ? `/player/${jp.slug}`
          : star
            ? `/player/${star.slug}`
            : prospect
              ? `/prospects/${prospect.slug}`
              : article
                ? `/${article.sport}/${article.id}`
                : undefined,
        hrefIsArticle: !jp && !star && !prospect && Boolean(article),
        photo: b.mlbId ? headshotUrl(b.mlbId, 'spot') : undefined,
        japanese: Boolean(jp || prospect),
        pitcher: /HP$/.test(b.pos.en),
        age: s?.age,
        pos: b.pos,
        team: teamPath(b, s),
        status: st,
        qo: b.qo?.status,
        statLine: s ? statLine(s, en) : prospect ? npbLine(prospect.slug) : '',
        projection: b.projection
          ? { ja: projectionText(b.projection, false), en: projectionText(b.projection, true) }
          : undefined,
        projectionUsdM: b.projection?.usdM,
        suitors: suitors?.length ? suitors : undefined,
        note: b.note,
      } satisfies FaRow;
    }),
  );
}

/** 一覧の上に出す数（状況の内訳）。すべて行からの数え上げ。 */
export function faCounts(rows: FaRow[]) {
  return {
    total: rows.length,
    done: rows.filter((r) => r.status.done).length,
    open: rows.filter((r) => !r.status.done).length,
    qoPending: rows.filter((r) => r.qo === 'offered').length,
    qoAll: rows.filter((r) => r.qo).length,
    japanese: rows.filter((r) => r.japanese).length,
    pitchers: rows.filter((r) => r.pitcher).length,
  };
}

/**
 * FA一覧のよくある質問。答えは同じページの表にある事実の言い換えだけ＝順位は誰の順位か、
 * 予想契約は誰の予想かを必ず添える（このサイトの予想に見せない）。
 */
export function buildFaFaq(cat: StoveCatalog, rows: FaRow[]): FaqItem[] {
  const off = `${cat.season}-${cat.season + 1}`;
  const top = rows[0];
  const items: FaqItem[] = [];
  const src = { ja: cat.ranking.name.replace(/（.*）$/, ''), en: cat.ranking.nameEn.replace(/ \(.*\)$/, '') };
  const alt = cat.altRanking
    ? { ja: cat.altRanking.name.replace(/（.*）$/, ''), en: cat.altRanking.nameEn.replace(/ \(.*\)$/, '') }
    : null;
  const proj = cat.projection ? { ja: cat.projection.name, en: cat.projection.nameEn } : null;
  if (top) {
    items.push({
      q: { ja: `${off}年のMLBのFAランキング1位は誰？`, en: `Who is the No. 1 MLB free agent in ${off}?` },
      a: {
        ja: `${src.ja}のFAランキングでは${top.name}（${top.pos.ja}${top.team ? `・${top.team.ja}` : ''}）が1位${alt && top.espnRank === 1 ? `で、${alt.ja}でも1位` : ''}。${top.projection && proj ? `${proj.ja}は${top.projection.ja}の契約を予想している。` : ''}${top.status.done ? `状況は「${top.status.label.ja}${top.status.team ? `：${top.status.team.ja}` : ''}」。` : 'まだ契約は決まっていない。'}`,
        en: `${top.name} (${top.pos.en}${top.team ? `, ${top.team.en}` : ''}) is No. 1 on ${src.en}'s list${alt && top.espnRank === 1 ? ` and on ${alt.en}'s` : ''}.${top.projection && proj ? ` ${proj.en} predicts ${top.projection.en}.` : ''}${top.status.done ? ` Status: ${top.status.label.en}${top.status.team ? ` (${top.status.team.en})` : ''}.` : ' He has not signed yet.'}`,
      },
    });
  }
  const jp = rows.filter((r) => r.japanese);
  if (jp.length) {
    const line = (r: FaRow, en: boolean) =>
      en
        ? `${r.name} (No. ${r.rank}${r.espnRank && alt ? `, ${alt.en} No. ${r.espnRank}` : ''})`
        : `${r.name}（${r.rank}位${r.espnRank && alt ? `・${alt.ja}${r.espnRank}位` : ''}）`;
    items.push({
      q: { ja: 'FAランキングに入っている日本人選手は？', en: 'Which Japanese players are on the free agent rankings?' },
      a: {
        ja: `${src.ja}の上位${rows.length}人には、${jp.map((r) => line(r, false)).join('、')}の${jp.length}人が入っている。`,
        en: `${jp.length} are in ${src.en}'s top ${rows.length}: ${jp.map((r) => line(r, true)).join(', ')}.`,
      },
    });
  }
  const open = rows.filter((r) => !r.status.done);
  const done = rows.filter((r) => r.status.done);
  items.push({
    q: { ja: 'まだ契約していない主なFA選手は？', en: 'Which top free agents are still unsigned?' },
    a: {
      ja: `${fmtDate(cat.checkedAt ?? cat.asOf, false)}時点で、上位${rows.length}人のうち${open.length}人が未契約${done.length ? `（${done.length}人は決着）` : ''}。順位の高い順に${open.slice(0, 5).map((r) => r.name).join('、')}${open.length > 5 ? 'など' : ''}。`,
      en: `As of ${fmtDate(cat.checkedAt ?? cat.asOf, true)}, ${open.length} of the top ${rows.length} are unsigned${done.length ? ` (${done.length} settled)` : ''}, led by ${open.slice(0, 5).map((r) => r.name).join(', ')}.`,
    },
  });
  const qo = rows.filter((r) => r.qo);
  const qoAccept = cat.dates.find((d) => d.key === 'qo-accept' && d.date);
  if (qo.length) {
    const md = (iso: string) => `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日`;
    items.push({
      q: {
        ja: `${cat.season}年オフにクオリファイング・オファー（QO）を受けた選手は？`,
        en: `Who received a qualifying offer after the ${cat.season} season?`,
      },
      a: {
        ja: `${qo.map((r) => r.name).join('、')}の${qo.length}人（1年${cat.qualifyingOffer.amountJa}）。${qoAccept ? `回答の期限は日本時間${md(qoAccept.date!)}${qoAccept.time?.ja ?? ''}。` : ''}${qo.filter((r) => r.qo === 'accepted').length ? `受諾したのは${qo.filter((r) => r.qo === 'accepted').map((r) => r.name).join('、')}。` : ''}${qo.filter((r) => r.qo === 'declined').length ? `拒否したのは${qo.filter((r) => r.qo === 'declined').map((r) => r.name).join('、')}。` : ''}`,
        en: `${qo.length} players: ${qo.map((r) => r.name).join(', ')} (one year, ${cat.qualifyingOffer.amountEn}).${qoAccept ? ` Answers are due ${qoAccept.date} Japan time.` : ''}`,
      },
    });
  }
  if (proj && cat.projection) {
    const sum = rows.reduce((a, r) => a + (r.projectionUsdM ?? 0), 0);
    const n = rows.filter((r) => r.projectionUsdM).length;
    items.push({
      q: { ja: '予想契約は誰の予想？', en: 'Whose contract projections are these?' },
      a: {
        ja: `${proj.ja}が${fmtDate(cat.projection.date, false)}に発表したFA上位50人の予想で、このサイトの予想ではない。上位${rows.length}人のうち予想が出ている${n}人の合計は${fmtUsdM(Math.round(sum * 100) / 100, false)}。実際の契約が決まったら、契約の内容に置き換える。`,
        en: `They come from ${proj.en}'s top-50 list published on ${fmtDate(cat.projection.date, true)}, not from this site. The ${n} players here with a projection total ${fmtUsdM(Math.round(sum * 100) / 100, true)}. Once a deal is done, we replace it with the actual terms.`,
      },
    });
  }
  return items;
}
