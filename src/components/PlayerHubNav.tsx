import { useTranslations } from 'next-intl';
import NavLink from '@/components/NavLink';
import { ALLSTAR } from '@/lib/allstar';

/**
 * 日本人選手クラスタ（選手成績 / 賞レースボード / ランキング / オールスター / NEXT MLB）の横断タブ。
 * グローバルヘッダーには「選手成績」だけを置き、子ハブへの導線はこのタブが受け持つ
 * ＝ヘッダーの MLB 項目肥大を解消しつつ、クラスタ内の相互リンク（トピッククラスタ）を
 * コンテンツ上部で明示する（SEO/AEO）。オールスターは会期フラグ（ALLSTAR.enabled）で
 * 自動的に消えるので、会期後にナビを手で外す作業は不要。
 */
export default function PlayerHubNav() {
  const t = useTranslations();
  const item = 'inline-flex min-h-[44px] items-center whitespace-nowrap';
  return (
    <nav
      aria-label={t('nav.playersHub')}
      className="flex items-center gap-5 overflow-x-auto border-y border-line text-sm"
    >
      <NavLink href="/player" className={item}>
        {t('nav.players')}
      </NavLink>
      <NavLink href="/daily" className={item}>
        {t('nav.daily')}
      </NavLink>
      <NavLink href="/mvp" className={item}>
        {t('nav.mvp')}
      </NavLink>
      <NavLink href="/cy-young" className={item}>
        {t('nav.cyYoung')}
      </NavLink>
      <NavLink href="/roy" className={item}>
        {t('nav.roy')}
      </NavLink>
      {ALLSTAR.enabled && (
        <NavLink href="/allstar" className={item}>
          {t('nav.allstar')}
        </NavLink>
      )}
      <NavLink href="/ranking" className={item}>
        {t('nav.ranking')}
      </NavLink>
      <NavLink href="/prospects" className={item}>
        {t('nav.prospects')}
      </NavLink>
    </nav>
  );
}
