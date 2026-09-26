/**
 * 時間軸互動使用的 React hook，封裝媒體查詢、捲動或動畫相關的副作用。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：偏好減少動態效果 Hook，用於尊重使用者的系統動效設定。

import { useMediaQuery } from "./useMediaQuery";
import { REDUCED_MOTION_QUERY } from "../../../shared/breakpoints";

// 詳細註解：初始值同步讀取 matchMedia，避免第一次 render 先以「有動畫」狀態載入 WebGL 再切換。
export function useReducedMotion() {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}
