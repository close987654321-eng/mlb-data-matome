import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { getTeam, teamLogoUrl, teamAbbr } from '@/lib/teams';
import { playerLabel, type PlayerLabel } from '@/lib/playerNames';
import { divisionRankShort } from '@/lib/standings';
import { teamHubOf, TEAM_HUB_MIN_ARTICLES } from '@/lib/teamHub';
import { getAllTags } from '@/lib/tags';
import SectionHeading from '@/components/SectionHeading';
import type { ThreadGame, ThreadGameSide } from '@/types/thread';
import type { Locale } from '@/lib/i18n';

/**
 * 試合結果ボックス。記事の要約直下・注目選手の成績（StatBox）の上に置く。
 *
 * なぜここに置くか: 「◯◯ 対 ◯◯」で来た読者が最初に知りたいのは勝敗とスコアで、
 * 海外の反応（コメント）はその次。結論を先に出して、そのまま反応へ流す。
 *
 * データは thread.game（scripts/fetch-mlb-stats.mjs が編集時に取得した公知の数値だけ）。
 * サイト本体は API を叩かない。順位・勝敗は**その試合終了時点の値**を記事に焼き込んであるので、
 * 何ヶ月後に読んでも表示が狂わない（data/standings.json＝常に最新 は使わない）。
 *
 * 段階的に描く（欠けている要素は黙って省く）＝ backfill が届いていない記事でも壊れない:
 *   スコアだけ → ＋線スコア（innings）→ ＋順位/勝敗（rank・record）→ ＋勝敗投手（decisions）
 */
export default async function GameBox({
  game,
  dateLabel,
  locale,
  children,
  heading,
  className,
  lpTags,
}: {
  game: ThreadGame;
  /** 試合日の表示（例: 2026.7.30）。記事の series.date / id 由来＝JST */
  dateLabel: string;
  locale: Locale;
  /** 記事のタグ。名前がここにある選手は選手LP（/tag）へ、無い選手だけ成績ハブへリンク。 */
  lpTags?: string[];
  /** ボックス下端に置くアクション（試合結果カードの生成ボタン）。関心が一番高い位置で押せる。 */
  children?: React.ReactNode;
  /** 見出しの差し替え。null＝見出しを出さない（日次ダイジェストは選手名が見出しで、その下に置くため）。 */
  heading?: React.ReactNode | null;
  /** 外側の余白の差し替え（既定 mt-8）。 */
  className?: string;
}) {
  const t = await getTranslations();
  const { away, home } = game;
  // 延長戦は 10 回以上。両チームで長い方に合わせる（ホームが最終回を打たない試合があるため）。
  const innCount = Math.max(away.innings?.length ?? 0, home.innings?.length ?? 0);
  const hasLine = innCount > 0;

  // チーム名は LP 昇格済み（記事3件以上）のときだけリンク化する＝薄いタグページへ送らない
  // （isTagIndexable / TeamStandings と同じ規律）。
  const tags = await getAllTags();
  const linkable = new Set(
    tags
      .filter(({ tag, count }) => count >= TEAM_HUB_MIN_ARTICLES && teamHubOf(tag))
      .map(({ tag }) => tag),
  );

  const sides: { side: ThreadGameSide; isWinner: boolean }[] = [
    { side: away, isWinner: away.score > home.score },
    { side: home, isWinner: home.score > away.score },
  ];

  // 選手名（本塁打・勝敗投手）は日本語表記に当ててから描く。JSX の中では await できないので先に解決する。
  // 解決の正は playerNames.ts（カタログ＝日本人選手 → カタカナ表 → 英語表記のまま）。
  const homerLabels = new Map<number, PlayerLabel>();
  for (const { side } of sides) {
    for (const h of side.homers ?? []) {
      homerLabels.set(h.id, await playerLabel(h.name, { locale, mlbId: h.id }));
    }
  }
  const dec = game.decisions;
  const decisions = dec
    ? {
        winner: dec.winner ? await playerLabel(dec.winner, { locale }) : undefined,
        loser: dec.loser ? await playerLabel(dec.loser, { locale }) : undefined,
        save: dec.save ? await playerLabel(dec.save, { locale }) : undefined,
      }
    : undefined;

  return (
    <section className={className ?? 'mt-8'} aria-label={t('game.heading')}>
      {heading !== null && <SectionHeading label={heading ?? t('game.heading')} />}

      <div className={`${heading === null ? '' : 'mt-4 '}rounded-xl border border-line bg-surface`}>
        {/* ① スコア＝主役。ロゴ・チーム名・（あれば）試合時点の順位と勝敗・得点 */}
        <div className="divide-y divide-line/70">
          {sides.map(({ side, isWinner }) => {
            const info = getTeam(side.ja);
            const name =
              locale === 'ja' ? side.ja : (info?.nameEn ?? side.en);
            return (
              <div key={side.en} className="flex items-center gap-3 px-5 py-4">
                {info && (
                  // eslint-disable-next-line @next/next/no-img-element -- MLB公式ロゴSVGを直リンク（再ホストしない）
                  <img
                    src={teamLogoUrl(info.id)}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`flex items-center gap-2 truncate text-[15px] ${isWinner ? 'font-bold text-ink' : 'text-ink-soft'}`}
                  >
                    {linkable.has(side.ja) ? (
                      <Link
                        href={`/tag/${encodeURIComponent(side.ja)}`}
                        className="truncate underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="truncate">{name}</span>
                    )}
                    {isWinner && (
                      <span className="shrink-0 rounded-[2px] border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                        {t('game.win')}
                      </span>
                    )}
                  </p>
                  {/* 試合時点の地区順位と勝敗（焼き込み値。無ければ行ごと省く） */}
                  {(side.rank && side.league && side.division) || side.record ? (
                    <p className="mt-0.5 truncate text-xs tabular-nums text-ink-mute">
                      {side.rank && side.league && side.division && (
                        <span>
                          {divisionRankShort(side.league, side.division, side.rank, locale)}
                        </span>
                      )}
                      {side.rank && side.record && <span className="mx-1.5">·</span>}
                      {side.record && (
                        <span>
                          {t('game.record', { w: side.record.w, l: side.record.l })}
                        </span>
                      )}
                    </p>
                  ) : null}
                </div>
                <p
                  className={`shrink-0 text-3xl tabular-nums ${isWinner ? 'font-bold text-ink' : 'font-medium text-ink-soft'}`}
                >
                  {side.score}
                </p>
              </div>
            );
          })}
        </div>

        {/* ② 線スコア。9回＋R/H/E/残＝最大14列なので、本文を横スクロールさせず表だけを流す */}
        {hasLine && (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[27rem] border-collapse text-center text-xs">
              <caption className="sr-only">{t('game.lineCaption')}</caption>
              <thead>
                <tr className="text-ink-mute">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    <span className="sr-only">{t('standings.team')}</span>
                  </th>
                  {Array.from({ length: innCount }, (_, i) => (
                    <th key={i} scope="col" className="w-7 px-1 py-2 font-medium tabular-nums">
                      {i + 1}
                    </th>
                  ))}
                  <th scope="col" className="w-8 border-l border-line px-1 py-2 font-semibold">
                    {t('game.r')}
                  </th>
                  <th scope="col" className="w-8 px-1 py-2 font-medium">
                    {t('game.h')}
                  </th>
                  <th scope="col" className="w-8 px-1 py-2 font-medium">
                    {t('game.e')}
                  </th>
                  <th scope="col" className="w-8 px-1 py-2 font-medium">
                    {t('game.lob')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sides.map(({ side, isWinner }) => {
                  const info = getTeam(side.ja);
                  const label = teamAbbr(info?.id) ?? side.ja;
                  return (
                    <tr
                      key={side.en}
                      className={`border-t border-line ${isWinner ? 'font-semibold text-ink' : 'text-ink-soft'}`}
                    >
                      <th
                        scope="row"
                        className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold"
                      >
                        {label}
                      </th>
                      {Array.from({ length: innCount }, (_, i) => {
                        const v = side.innings?.[i];
                        return (
                          <td key={i} className="px-1 py-2 tabular-nums">
                            {/* その回を打たなかった（サヨナラ・9回裏不要）は「−」 */}
                            {v == null ? <span className="text-ink-mute">−</span> : v}
                          </td>
                        );
                      })}
                      <td className="border-l border-line px-1 py-2 font-bold tabular-nums text-ink">
                        {side.score}
                      </td>
                      <td className="px-1 py-2 tabular-nums">{side.hits ?? '−'}</td>
                      <td className="px-1 py-2 tabular-nums">{side.errors ?? '−'}</td>
                      <td className="px-1 py-2 tabular-nums">{side.lob ?? '−'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ③ 本塁打＝「誰が打ったか」。名前は日本語表記、カタログにある選手は選手ハブへリンク */}
        {sides.some(({ side }) => side.homers?.length) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-5 py-3 text-xs">
            <span className="text-ink-mute">{t('game.hr')}</span>
            {sides
              .filter(({ side }) => side.homers?.length)
              .map(({ side }) => {
                const info = getTeam(side.ja);
                return (
                  <span key={side.en} className="text-ink-soft">
                    <span className="mr-1.5 font-semibold text-ink-mute">
                      {teamAbbr(info?.id) ?? side.ja}
                    </span>
                    {side.homers!.map((h, i) => {
                      const { label, slug } = homerLabels.get(h.id) ?? { label: h.name };
                      return (
                        <span key={h.id}>
                          {i > 0 && '、'}
                          {slug ? (
                            <Link
                              href={playerHref(homerLabels.get(h.id)!, lpTags)}
                              className="font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
                            >
                              {label}
                            </Link>
                          ) : (
                            label
                          )}
                          {/* 1試合2本以上はその本数、それ以外は今季通算の号数 */}
                          {h.hr && h.hr > 1
                            ? `（${t('game.hrMulti', { n: h.hr })}）`
                            : h.no != null && `（${t('game.hrNo', { n: h.no })}）`}
                        </span>
                      );
                    })}
                  </span>
                );
              })}
          </div>
        )}

        {/* ④ 勝敗投手・セーブ。本塁打と同じく日本語表記＋カタログ選手はハブへリンク */}
        {decisions && (decisions.winner || decisions.loser) && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-xs text-ink-soft">
            {decisions.winner && (
              <span>
                <span className="text-ink-mute">{t('game.wp')}</span>{' '}
                <PitcherName player={decisions.winner} strong lpTags={lpTags} />
              </span>
            )}
            {decisions.loser && (
              <span>
                <span className="text-ink-mute">{t('game.lp')}</span>{' '}
                <PitcherName player={decisions.loser} lpTags={lpTags} />
              </span>
            )}
            {decisions.save && (
              <span>
                <span className="text-ink-mute">{t('game.sv')}</span>{' '}
                <PitcherName player={decisions.save} lpTags={lpTags} />
              </span>
            )}
          </p>
        )}
        {/* ⑤ この結果を1枚の画像にして配る導線。結果を読み終えた直後＝関心のピークに置く */}
        {children && <div className="border-t border-line px-5 py-4">{children}</div>}
      </div>

      <p className="mt-2 text-xs text-ink-mute">{t('game.asOf', { date: dateLabel })}</p>
    </section>
  );
}

/** 選手名リンクの行き先。タグにある選手は選手LP（/tag＝存在保証あり）、無い選手は成績ハブへ。 */
function playerHref(p: PlayerLabel, lpTags?: string[]): string {
  return p.nameJa && lpTags?.includes(p.nameJa)
    ? `/tag/${encodeURIComponent(p.nameJa)}`
    : `/player/${p.slug}`;
}

/** 勝敗投手・セーブの名前1つ。カタログにある選手（日本人＋主要ライバル）は選手LP/ハブへ送る。 */
function PitcherName({ player, strong, lpTags }: { player: PlayerLabel; strong?: boolean; lpTags?: string[] }) {
  if (player.slug) {
    return (
      <Link
        href={playerHref(player, lpTags)}
        className="font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
      >
        {player.label}
      </Link>
    );
  }
  return strong ? <span className="font-medium text-ink">{player.label}</span> : <>{player.label}</>;
}
