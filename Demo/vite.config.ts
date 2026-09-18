/**
 * Vite 開發與建置入口設定，載入 React 外掛並集中管理前端打包流程。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：Vite 設定檔，載入 React plugin 並使用預設建置流程。
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
