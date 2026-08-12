import { createEventRoute } from '@/components/EventHubPage';

// BreakingDown 21（2026-09-19 札幌）のイベントページ＝BD框の実験1号機
// （2026-08-12 合意: RIZIN先行・BDは次大会で軽量ハブ1本だけ実験）。中身は events.ts が正。
const route = createEventRoute('breakingdown21');
export const generateMetadata = route.generateMetadata;
export default route.Page;
