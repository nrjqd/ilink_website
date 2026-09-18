/**
 * 時間軸互動使用的 React hook，封裝媒體查詢、捲動或動畫相關的副作用。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：媒體查詢 Hook，讓元件可依視窗條件切換狀態。

import { useEffect, useState } from "react";

// 詳細註解：useMediaQuery 是自訂 Hook，集中管理副作用或可重用狀態，避免各元件重複處理。
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    // 詳細註解：update 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}
