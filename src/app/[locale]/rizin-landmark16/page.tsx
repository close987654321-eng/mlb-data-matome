import { createEventRoute } from '@/components/EventHubPage';

// RIZIN LANDMARK.16 in NAGASAKI（2026-10-03）のイベントページ。中身は events.ts のレジストリが正。
const route = createEventRoute('rizin-landmark16');
export const generateMetadata = route.generateMetadata;
export default route.Page;
