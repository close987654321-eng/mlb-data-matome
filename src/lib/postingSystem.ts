import type { Locale } from './i18n';

/**
 * ポスティング制度そのものの解説（/prospects ハブに置く）。
 *
 * なぜLPとは別に要るか: 「{選手名} ポスティング」で着地した読者の半分は、制度自体を知らないまま来る
 * （譲渡金は誰が払うのか／45日で決まらなかったらどうなるのか／海外FAと何が違うのか）。選手LPに
 * 毎回同じ説明を重ねると重複コンテンツになるので、制度はハブに1か所だけ置いて各LPから送る。
 *
 * 数値は日米間選手契約に関する協定の実務としてMLB Trade Rumors が記した内容に合わせる＝
 * 編集部が要約した制度解説であり、条文の転載ではない。
 */
export type PostingFact = {
  q: { ja: string; en: string };
  a: { ja: string; en: string };
};

export const POSTING_SOURCE = {
  url: 'https://www.mlbtraderumors.com/2026/03/hiromi-itoh-teruaki-sato-expected-to-be-posted-for-mlb-teams-next-winter.html',
  name: 'MLB Trade Rumors',
};

export const POSTING_FACTS: PostingFact[] = [
  {
    q: { ja: 'ポスティングとは？', en: 'What is the posting system?' },
    a: {
      ja: '海外FA権を持たないNPB選手が、所属球団の承認を得てMLB球団と交渉できるようにする仕組み。申請するかどうかは球団の判断で、選手が望んでも認められないことがある（阪神・才木浩人は2025年オフに認められなかった）。',
      en: 'A route that lets an NPB player who has not yet earned international free agency negotiate with MLB clubs, provided his team agrees to post him. Filing is the club’s decision, and a player can want it and be refused: Hanshin turned down Hiroto Saiki after the 2025 season.',
    },
  },
  {
    q: { ja: '交渉期間はどれくらい？', en: 'How long is the negotiating window?' },
    a: {
      ja: '申請が全30球団に通知されてから45日間。この間に契約が決まらなければ、選手は日本の球団に残る。',
      en: 'Forty-five days from the moment all 30 MLB clubs are notified. If no deal is struck in that window, the player stays with his Japanese club.',
    },
  },
  {
    q: { ja: '譲渡金は誰がいくら払う？', en: 'Who pays the release fee, and how much?' },
    a: {
      ja: '契約したMLB球団が日本の球団に払う。保証額の最初の2500万ドルに20%、次の2500万ドルに17.5%、5000万ドルを超える部分に15%。選手の年俸とは別勘定になる。',
      en: 'The signing MLB club pays the Japanese club: 20% of the first $25MM of guaranteed money, 17.5% of the next $25MM and 15% of anything above $50MM. It sits on top of the player’s salary.',
    },
  },
  {
    q: { ja: '海外FAとの違いは？', en: 'How is international free agency different?' },
    a: {
      ja: '海外FA権は9年の出場登録日数で選手自身が得る権利で、球団の承認も譲渡金も45日の期限もない。西武・髙橋光成は2026年5月にこの権利を取得しており、今オフはポスティングではなくこちらの道を通れる。',
      en: 'International free agency is a right the player earns with nine years of service. It needs no club approval, carries no release fee and has no 45-day clock. Seibu’s Kona Takahashi qualified in May 2026, so his path this winter is free agency rather than a posting.',
    },
  },
  {
    q: { ja: '2026年オフの日程は？', en: 'What is the 2026-27 timetable?' },
    a: {
      ja: 'NPB球団の申請は通常11月中旬だが、今オフはESPNのジェフ・パッサン記者が「11月上旬」と報じている。MLBの労使協定が12月1日に切れてロックアウトに入れば取引が凍結されるため、それより前に決着させたい事情が双方にある。',
      en: 'NPB clubs usually post in mid-November, but ESPN’s Jeff Passan reports early November this winter. MLB’s CBA expires on December 1, and a lockout would freeze transactions, so both sides have reason to finish before then.',
    },
  },
];

export function postingFactText(f: PostingFact, locale: Locale): { q: string; a: string } {
  const en = locale === 'en';
  return { q: en ? f.q.en : f.q.ja, a: en ? f.a.en : f.a.ja };
}
