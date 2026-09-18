/**
 * 時間軸互動使用的 React hook，封裝媒體查詢、捲動或動畫相關的副作用。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：偏好減少動態效果 Hook，用於尊重使用者的系統動效設定。

import { useEffect, useState } from "react";

// 詳細註解：useReducedMotion 是自訂 Hook，集中管理副作用或可重用狀態，避免各元件重複處理。
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // 詳細註解：update 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
