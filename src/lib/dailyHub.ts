import type { Thread, ThreadDaily, ThreadComment } from '@/types/thread';
import type { FaqItem } from '@/components/FaqList';
import { issueDate } from '@/lib/frontpage';

/**
 * /daily（きょうの日本人選手ハブ）の派生データ。
 * すべて日次記事 JSON（Thread.daily）の再表示・集計だけで、ここで新しい事実は作らない。
 *  - 全員の結果表（主役＋短評の行）／主役のいちばん票が多い証言／この1週間の主役／主役回数
 *  - FAQ（画面と FAQPage JSON-LD を同じ配列から組む）
 */

/** 結果表の1行＝主役と短評を同じ形に揃える。 */
export type DailyRow = {
  player: string;
  team: string;
  result: string;
  line: string;
  season?: string;
  note?: string;
  isHero: boolean;
};

export function dailyRows(daily: ThreadDaily): DailyRow[] {
  const hero: DailyRow = {
    player: daily.hero.player,
    team: daily.hero.team,
    result: daily.hero.result,
    line: daily.hero.line,
    season: daily.hero.season,
    note: daily.hero.note,
    isHero: true,
  };
  const rest = (daily.shorts ?? [])
    .filter((s) => s.player !== daily.hero.player)
    .map((s) => ({ player: s.player, team: s.team, result: s.result, line: s.line, season: s.season, isHero: false }));
  return [hero, ...rest];
}

/** 主役の本文から、票の多い現地コメントを上から n 件（quote ブロックだけ・chips は短すぎるので除く）。 */
export function heroTopQuotes(daily: ThreadDaily, n = 2): ThreadComment[] {
  return daily.hero.blocks
    .flatMap((b) => (b.type === 'quote' ? [b.comment] : []))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, n);
}

/** 主役に選ばれた回数（全号）。多い順。 */
export function heroCounts(issues: Thread[]): { player: string; team: string; count: number; last: string }[] {
  const m = new Map<string, { player: string; team: string; count: number; last: string }>();
  for (const th of issues) {
    const h = th.daily?.hero;
    if (!h) continue;
    const cur = m.get(h.player);
    if (cur) {
      cur.count++;
      if (th.id > cur.last) {
        cur.last = th.id;
        cur.team = h.team;
      }
    } else m.set(h.player, { player: h.player, team: h.team, count: 1, last: th.id });
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}

export function buildDailyFaq(latest: Thread | null, issueCount: number, en: boolean): FaqItem[] {
  const d = latest?.daily;
  const no = d?.cardNo != null ? String(d.cardNo).padStart(3, '0') : '';
  const date = latest ? issueDate(latest.fetchedAt) : '';
  const items: FaqItem[] = [
    {
      q: { ja: 'このページはいつ更新される？', en: 'When is this page updated?' },
      a: {
        ja: `毎日16時（日本時間）に、その日の米国の試合がすべて終わったあとで1枚のカードと1本の記事を出し、このページの「最新号」が丸ごと入れ替わります。${no ? `いまの最新号はNo.${no}（${date}）です。` : ''}試合のない日（オールスター休みなど）は号を出しません。`,
        en: `Every day at 16:00 JST, after all of that day’s MLB games have finished, one card and one article are published and the “latest issue” here is replaced.${no ? ` The current issue is No.${no} (${date}).` : ''} No issue is published on days without games.`,
      },
    },
    {
      q: { ja: '誰が載る？載らない選手がいるのはなぜ？', en: 'Who is included, and why is someone missing?' },
      a: {
        ja: 'その日に出場した日本人メジャーリーガー全員です。ベンチ入りしても出場しなかった選手、故障者リストの選手、マイナーにいる選手は載りません。主役の1人はその日の成績の数字だけで自動的に決まり、残りの全員も1人ずつ短評を載せます。',
        en: 'Every Japanese MLB player who appeared in a game that day. Players who did not play, are on the injured list or are in the minors are not listed. The player of the day is chosen automatically from the day’s numbers, and everyone else gets a short note.',
      },
    },
  ];
  if (d) {
    items.push({
      q: { ja: 'きょうの主役は誰？', en: 'Who is today’s player of the day?' },
      a: {
        ja: `${date}の主役は${d.hero.player}（${d.hero.team}）。${d.hero.note ? `${d.hero.note}、` : ''}${d.hero.line}。試合は${d.hero.result}でした。`,
        en: `For ${date} it is ${d.hero.player} (${d.hero.team}): ${d.hero.note ? `${d.hero.note}, ` : ''}${d.hero.line}. Final: ${d.hero.result}.`,
      },
    });
  }
  items.push(
    {
      q: { ja: '日本人選手の試合は日本時間の何時から？', en: 'What time (JST) do the games start?' },
      a: {
        ja: 'MLBの試合は日本時間の早朝から午前中に行われることが多く、東海岸の夜の試合は日本時間の朝8時前後、西海岸の夜の試合は朝10〜11時ごろの開始です。翌日の先発予定と開始時刻は最新号の「あすの日本人」に日本時間で載せています。',
        en: 'Most MLB games run in the early morning to late morning JST: an East Coast night game starts around 8:00 JST, a West Coast night game around 10:00 to 11:00 JST. The next day’s Japanese starters and start times appear in the latest issue’s “tomorrow” section, in JST.',
      },
    },
    {
      q: { ja: '「海外の反応」はどこから来ている？', en: 'Where do the overseas reactions come from?' },
      a: {
        ja: 'MLB公式YouTubeの試合ハイライト動画のコメント欄と、Redditの試合スレッドです。現地ファンの書き込みを日本語に訳し、いいね数はその時点の実測値を添えています。コメントは1文字も創作せず、出典の動画・スレッドへ記事からリンクしています。',
        en: 'From the comment sections of MLB’s official YouTube game highlights and Reddit game threads. Fan comments are translated into Japanese with their like counts as measured at the time. Nothing is invented, and every article links back to the source.',
      },
    },
    {
      q: { ja: 'カードの画像は保存・転載してもいい？', en: 'Can I save and repost the card image?' },
      a: {
        ja: 'はい。加工せずそのままであれば、保存も転載も自由で、クレジット表記も不要です。各号の記事にワンタップで共有・保存できるボタンがあります。カードは毎日16時にX（@gogogo123ka）でも先行して流しています。',
        en: 'Yes. Save and repost freely as long as the image is unaltered; no credit is required. Each issue has one-tap share and save buttons, and the card is also posted daily at 16:00 JST on X (@gogogo123ka).',
      },
    },
    {
      q: { ja: '「No.」の番号は何？過去の号はどこで見られる？', en: 'What does the issue number mean, and where are past issues?' },
      a: {
        ja: `カードの通し番号で、開幕からの日数にあたります。このシリーズは2026年7月30日のNo.127から始まり、これまでに${issueCount}号を出しました。過去の号はこのページ下部のコレクションから、カードをタップして読めます。`,
        en: `It is the card’s running number, equal to the day count since Opening Day. The series began with No.127 on July 30, 2026 and has published ${issueCount} issues so far. Past issues are in the collection at the bottom of this page.`,
      },
    },
  );
  return items;
}
