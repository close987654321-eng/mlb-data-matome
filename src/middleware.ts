import createMiddleware from 'next-intl/middleware';
import { defaultLocale, locales } from './lib/i18n';

export default createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'as-needed',
});

export const config = {
  // ドットを含むパスを一律で外すと、タグ名にドットが入るLP（/tag/RIZIN.54・
  // /tag/ボビー・ウィットJr. など17タグ）まで静的ファイル扱いになり、デフォルト
  // ロケールのリライトが走らず本番で404になる（2026-08-20 GSC実測で発覚）。
  // 実在する拡張子だけを除外して、それ以外のドットはパスの一部として通す。
  matcher: [
    '/((?!api|_next|_vercel|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|txt|xml|json|html|pdf|webmanifest|js|css|map|mp4|webm|woff|woff2|ttf|otf)$).*)',
  ],
};
