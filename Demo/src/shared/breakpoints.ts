/**
 * 全站 responsive 斷點（與 styles.css 的 --bp-* 註解保持一致）。
 *
 * Mobile  < 640
 * Tablet  640–1023
 * Desktop ≥ 1024
 *
 * 沉浸式體驗（WebGL 時間軸、ScrollTrigger pin、Lenis）只在 Desktop 且為滑鼠等精準指標裝置、
 * 未要求減少動態效果時啟用；觸控平板與手機一律使用原生捲動的內容版面。
 */

export const BP_TABLET_MIN = 640;
export const BP_DESKTOP_MIN = 1024;

export const IMMERSIVE_QUERY = `(min-width: ${BP_DESKTOP_MIN}px) and (hover: hover) and (pointer: fine)`;
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function matchesQuery(query: string) {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}
