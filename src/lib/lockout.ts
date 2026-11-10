import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FaqItem } from '@/components/FaqList';
import type { Thread } from '@/types/thread';

/**
 * ロックアウト（/stove-league/lockout）＝労使協定の期限に向けて、先に育てておくページ。
 *
 * なぜ要るか: 協定は米東部時間12月1日に切れ、MLB側のロックアウトが有力視されている。実際に始まれば
 * 「mlb ロックアウト とは／なぜ／いつまで／日本人選手」の検索が一気に増える（入力候補に並んでいる）。
 * 起きてから作ると索引が間に合わない＝3週間前に出して Google に読ませておく（/rizin5 と同じ育て方）。
 *
 * 正は `data/stove-lockout.json`（人＝毎朝の定期実行が書く・出典URL必須）。ここは読むだけで、
 * 新しい事実は作らない。日程（期限の日時）は stove-league.json の dates（'cba'・'lockout'）を使う。
 */

type Bi = { ja: string; en: string };
type Sourced = Bi & { source: string; sourceName: string };

export type Lockout = {
  season: number;
  /** 中身を最後に書き換えた日（JST）／毎朝の定期実行が確認した日。 */
  asOf: string;
  checkedAt?: string;
  /** pending＝期限の前／on＝ロックアウト中／ended＝新しい協定がまとまった。題と見出しの言い方が変わる。 */
  status: 'pending' | 'on' | 'ended';
  /** いまの状態の1〜2文（題の下・説明文・FAQの1問目に使う）。 */
  headline: Bi;
  /** 期限の箱に添える1〜2文（現地時間での期限と、その時刻に何が起きうるか）。 */
  deadlineNote?: Bi;
  timeline: (Sourced & { date: string })[];
  /** ロックアウト中に止まること・止まらないこと（1つの出典にまとめて持つ）。 */
  what: { items: Bi[]; vsStrike: Bi; source: string; sourceName: string };
  issues: (Sourced & { title: Bi })[];
  /** 日本人選手への影響。href はその話の詳しいページ。 */
  japan: (Sourced & { title: Bi; href?: string })[];
  history: (Sourced & { label: Bi; from?: string; to?: string; days?: number })[];
};

let cache: Lockout | null | undefined;

export async function getLockout(): Promise<Lockout | null> {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', 'stove-lockout.json'), 'utf8')) as Lockout;
  } catch {
    cache = null; // 無ければページは 404・入口の札も出ない
  }
  return cache;
}

/** ロックアウトを語っている記事（タグ「ロックアウト」）。新しい順。 */
export function lockoutThreads(threads: Thread[], season: number): Thread[] {
  const from = `${season}-09-01`;
  return threads
    .filter((t) => t.fetchedAt >= from && (t.tags ?? []).includes('ロックアウト'))
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
}

/**
 * よくある質問。答えはページ内の事実（data）の言い換えだけ。
 * 「いつまで続くか」「2027年の開幕は遅れるか」のように誰にも分からない問いは、分からないと書いたうえで
 * 前回の事実（99日間・開幕の遅れ）を添える＝予想を作らない。
 */
export function buildLockoutFaq(lo: Lockout): FaqItem[] {
  const last = lo.history.find((h) => h.days);
  const items: FaqItem[] = [
    {
      q: { ja: 'MLBのロックアウトとは？', en: 'What is an MLB lockout?' },
      a: {
        ja: `球団経営者側が選手を球団の活動から締め出し、契約や移籍の手続きを止める措置。${lo.what.items.map((x) => x.ja).slice(0, 2).join('。')}。${lo.what.vsStrike.ja}`,
        en: `A measure in which owners shut players out of club activity and freeze signings and other transactions. ${lo.what.items.map((x) => x.en).slice(0, 2).join('. ')}. ${lo.what.vsStrike.en}`,
      },
    },
    {
      q: {
        ja: lo.status === 'pending' ? 'ロックアウトはいつから始まる？' : 'ロックアウトはいつ始まった？',
        en: lo.status === 'pending' ? 'When would a lockout start?' : 'When did the lockout start?',
      },
      a: {
        // 期限の日時は headline に入っている（日本時間と米東部時間の両方）＝ここで重ねない。
        ja: `${lo.headline.ja}協定が切れても自動では始まらず、新しい協定がまとまらなかったときに球団経営者側が実施を決める。`,
        en: `${lo.headline.en} It does not start automatically; owners decide to impose it if no new deal is reached.`,
      },
    },
    {
      q: { ja: 'なぜロックアウトになりそうなのか？', en: 'Why is a lockout likely?' },
      a: {
        ja: lo.issues
          .slice(0, 2)
          .map((x) => x.ja)
          .join(''),
        en: lo.issues
          .slice(0, 2)
          .map((x) => x.en)
          .join(' '),
      },
    },
  ];
  if (last) {
    items.push({
      q: { ja: 'ロックアウトはいつまで続く？', en: 'How long would a lockout last?' },
      a: {
        ja: `決まっていない。新しい協定がまとまるまで続く。${last.ja}`,
        en: `Nobody knows; it lasts until a new deal is reached. ${last.en}`,
      },
    });
  }
  if (lo.japan.length) {
    items.push({
      q: { ja: 'ロックアウトになると日本人選手はどうなる？', en: 'What does a lockout mean for Japanese players?' },
      a: {
        ja: lo.japan
          .slice(0, 3)
          .map((x) => `${x.title.ja}：${x.ja}`)
          .join(''),
        en: lo.japan
          .slice(0, 3)
          .map((x) => `${x.title.en}: ${x.en}`)
          .join(' '),
      },
    });
  }
  const strike = lo.history.find((h) => !h.days);
  if (strike) {
    items.push({
      q: { ja: '過去にも同じことはあった？', en: 'Has this happened before?' },
      a: {
        ja: `${lo.history.map((h) => `${h.label.ja}：${h.ja}`).join('')}`,
        en: `${lo.history.map((h) => `${h.label.en}: ${h.en}`).join(' ')}`,
      },
    });
  }
  return items;
}
