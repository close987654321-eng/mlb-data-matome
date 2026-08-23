import { createEventRoute } from '@/components/EventHubPage';

// RIZIN 大晦日 2026 名古屋大会（仮）（2026-12-31 バンテリンドーム ナゴヤ）のイベントページ。
// カード発表は11〜12月に小出しで来るので、発表前からこのURLを立てて育てる（/rizin5 と同じ賭け）。
// tier は festival だが、カードが揃うまでは量産型で回す＝発表が進んだ時点で手組みの特設ハブへ差し替える。
// 中身は events.ts のレジストリが正。
const route = createEventRoute('rizin-newyear2026');
export const generateMetadata = route.generateMetadata;
export default route.Page;
