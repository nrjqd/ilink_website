import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMediaQuery } from "./useMediaQuery";
import { IMMERSIVE_QUERY, REDUCED_MOTION_QUERY } from "../../../shared/breakpoints";

let activeLenis: Lenis | null = null;

function runOnce(callback: (() => void) | undefined) {
  let called = false;

  return () => {
    if (called) return;
    called = true;
    callback?.();
  };
}

function waitForScrollPosition(top: number, callback: (() => void) | undefined) {
  const complete = runOnce(callback);

  if ("onscrollend" in window) {
    window.addEventListener("scrollend", complete, { once: true });
  }

  let frameCount = 0;
  let stableFrames = 0;

  const check = () => {
    frameCount += 1;

    if (Math.abs(window.scrollY - top) <= 2) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
    }

    if (stableFrames >= 2 || frameCount >= 120) {
      complete();
      return;
    }

    window.requestAnimationFrame(check);
  };

  window.requestAnimationFrame(check);
}

export function scrollToPageY(
  top: number,
  options: { immediate?: boolean; onComplete?: () => void } = {},
) {
  const { immediate = false, onComplete } = options;
  const complete = runOnce(onComplete);

  if (activeLenis) {
    activeLenis.resize();
    ScrollTrigger.refresh();
    activeLenis.scrollTo(top, {
      immediate,
      lock: true,
      force: true,
      onComplete: complete,
    });
    return;
  }

  window.scrollTo({
    top,
    behavior: immediate ? "auto" : "smooth",
  });

  if (immediate) {
    window.requestAnimationFrame(complete);
    return;
  }

  waitForScrollPosition(top, complete);
}

// Lenis 只在沉浸式桌機啟用（≥1024、hover + fine pointer、未要求減少動態）；
// 手機與平板一律原生捲動，scrollToPageY 會自動改用 window.scrollTo。
export function useSmoothScroll(disabled: boolean) {
  const supportsSmoothScroll = useMediaQuery(IMMERSIVE_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const enabled = !disabled && supportsSmoothScroll && !reducedMotion;

  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      lerp: 0.08,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.1,
    });
    activeLenis = lenis;

    const scrollToHash = (hash: string, immediate = false) => {
      if (!hash) return;
      const target = document.querySelector(hash);
      if (target) {
        lenis.scrollTo(target as HTMLElement, { offset: -88, immediate });
      }
    };

    const onAnchorClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute("href");
      if (!hash || hash === "#") return;
      event.preventDefault();
      history.pushState(null, "", hash);
      scrollToHash(hash);
    };

    const update = (time: number) => {
      lenis.raf(time * 1000);
    };

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

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
      if (activeLenis === lenis) {
        activeLenis = null;
      }
      lenis.destroy();
    };
  }, [enabled]);
}
