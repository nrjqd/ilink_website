/**
 * 時間軸互動使用的 React hook，封裝媒體查詢、捲動或動畫相關的副作用。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：平滑捲動 Hook，集中處理捲動監聽與進度計算。

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// 詳細註解：useSmoothScroll 是自訂 Hook，集中管理副作用或可重用狀態，避免各元件重複處理。
export function useSmoothScroll(disabled: boolean) {
  useEffect(() => {
    if (disabled) return;

    const lenis = new Lenis({
      lerp: 0.08,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.1,
    });

    // 詳細註解：scrollToHash 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
    const scrollToHash = (hash: string, immediate = false) => {
      if (!hash) return;
      const target = document.querySelector(hash);
      if (target) {
        lenis.scrollTo(target as HTMLElement, { offset: -88, immediate });
      }
    };

    // 詳細註解：onAnchorClick 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
    const onAnchorClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute("href");
      if (!hash || hash === "#") return;
      event.preventDefault();
      history.pushState(null, "", hash);
      scrollToHash(hash);
    };

    // 詳細註解：update 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
    const update = (time: number) => {
      lenis.raf(time * 1000);
    };

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    // 詳細註解：alignInitialHash 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
    const alignInitialHash = () => {
      scrollToHash(window.location.hash, true);
    };

    document.addEventListener("click", onAnchorClick);
    window.addEventListener("load", alignInitialHash);
    requestAnimationFrame(alignInitialHash);
    window.setTimeout(alignInitialHash, 180);
    window.setTimeout(alignInitialHash, 720);
    window.setTimeout(alignInitialHash, 1500);
    window.setTimeout(alignInitialHash, 2600);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      window.removeEventListener("load", alignInitialHash);
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, [disabled]);
}
