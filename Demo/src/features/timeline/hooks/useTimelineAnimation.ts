import { RefObject, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const SCROLL_DISTANCE_PER_CHAPTER = 360;
const TIMELINE_TRIGGER_ID = "timeline-story";

declare global {
  interface Window {
    ScrollTrigger?: typeof ScrollTrigger;
  }
}

function findPinSpacer(viewport: HTMLElement) {
  return viewport.parentElement?.classList.contains("pin-spacer")
    ? viewport.parentElement
    : viewport.closest(".pin-spacer");
}

function clearTimelinePinState(container: HTMLElement) {
  ScrollTrigger.getAll()
    .filter(
      (item) =>
        item.vars.id === TIMELINE_TRIGGER_ID ||
        item.trigger === container,
    )
    .forEach((item) => item.kill(true));

  const viewport =
    container.querySelector<HTMLElement>(
      ".timeline-viewport",
    );
  const pinSpacer = viewport
    ? findPinSpacer(viewport)
    : null;

  if (
    viewport &&
    pinSpacer instanceof HTMLElement &&
    pinSpacer.parentNode
  ) {
    pinSpacer.parentNode.insertBefore(viewport, pinSpacer);
    pinSpacer.remove();
    viewport.removeAttribute("style");
  }

  ScrollTrigger.refresh();
}

function logTimelineScrollDiagnostics(
  phase: string,
  container: HTMLElement,
  viewport: HTMLElement,
  chapterCount: number,
  trigger: ScrollTrigger | undefined,
) {
  if (!import.meta.env.DEV) return;

  const pinSpacer = findPinSpacer(viewport);
  const nextSection =
    container.nextElementSibling instanceof HTMLElement
      ? container.nextElementSibling
      : null;
  const containerRect = container.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const nextRect = nextSection?.getBoundingClientRect();
  const cssMinHeight = parseFloat(
    getComputedStyle(container).minHeight,
  );
  const requiredPinHeight =
    viewport.offsetHeight +
    chapterCount * SCROLL_DISTANCE_PER_CHAPTER;
  const pinSpacers = Array.from(
    container.querySelectorAll(".pin-spacer"),
  );

  console.groupCollapsed(
    `[Timeline Scroll Diagnostics] ${phase}`,
  );
  console.table({
    chapterCount,
    scrollDistanceConfigured:
      chapterCount * SCROLL_DISTANCE_PER_CHAPTER,
    triggerStart: trigger?.start,
    triggerEnd: trigger?.end,
    viewportHeight: window.innerHeight,
    containerOffsetHeight: container.offsetHeight,
    containerScrollHeight: container.scrollHeight,
    viewportOffsetHeight: viewport.offsetHeight,
    nextSectionTop: nextSection
      ? nextSection.getBoundingClientRect().top + window.scrollY
      : null,
  });
  console.table({
    pinSpacerHeight:
      pinSpacer instanceof HTMLElement
        ? pinSpacer.offsetHeight
        : null,
    pinSpacerPaddingBottom:
      pinSpacer instanceof HTMLElement
        ? getComputedStyle(pinSpacer).paddingBottom
        : null,
    pinSpacerMarginBottom:
      pinSpacer instanceof HTMLElement
        ? getComputedStyle(pinSpacer).marginBottom
        : null,
    timelineStoryMinHeight:
      getComputedStyle(container).minHeight,
    timelineStoryHeight: getComputedStyle(container).height,
    viewportHeightCSS: getComputedStyle(viewport).height,
    nestedPinSpacerCount: pinSpacers.length,
  });
  console.table({
    containerBottom: containerRect.bottom,
    viewportBottom: viewportRect.bottom,
    nextSectionTop: nextRect?.top,
    gapFromViewportToContainerBottom:
      containerRect.bottom - viewportRect.bottom,
    gapFromContainerToNextSection: nextRect
      ? nextRect.top - containerRect.bottom
      : null,
  });
  console.table({
    cssMinHeight,
    requiredPinHeight,
    difference:
      container.offsetHeight - requiredPinHeight,
  });
  console.table(
    ScrollTrigger.getAll().map((item) => ({
      id: item.vars.id,
      trigger: (item.trigger as HTMLElement | undefined)
        ?.className,
      start: item.start,
      end: item.end,
      pin: (item.pin as HTMLElement | undefined)?.className,
    })),
  );
  console.groupEnd();
}

export function useTimelineAnimation(
  containerRef: RefObject<HTMLElement>,
  chapterCount: number,
  disabled: boolean,
) {
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container) return;

      if (import.meta.env.DEV) {
        window.ScrollTrigger = ScrollTrigger;
      }

      if (disabled || chapterCount === 0) {
        clearTimelinePinState(container);
        progressRef.current = 0;
        setProgress(0);
        setActiveIndex(0);
        return;
      }

      const viewport =
        container.querySelector<HTMLElement>(
          ".timeline-viewport",
        );
      const labels = gsap.utils.toArray<HTMLElement>(
        container.querySelectorAll(".chapter-copy"),
      );
      const pageRoot =
        container.closest(".app-shell") ?? document;
      const panels = gsap.utils.toArray<HTMLElement>(
        pageRoot.querySelectorAll(".timeline-card"),
      );

      if (!viewport || labels.length === 0) {
        progressRef.current = 0;
        setProgress(0);
        setActiveIndex(0);
        return;
      }

      gsap.set(panels, {
        autoAlpha: 0,
        y: 70,
        rotate: -3,
      });
      gsap.set(labels, { autoAlpha: 0, y: 36 });
      gsap.set(labels[0], { autoAlpha: 1, y: 0 });

      const master = gsap.timeline({
        scrollTrigger: {
          id: TIMELINE_TRIGGER_ID,
          trigger: container,
          start: "top top",
          end: `+=${
            chapterCount * SCROLL_DISTANCE_PER_CHAPTER
          }`,
          pin: viewport,
          pinSpacing: true,
          scrub: 1,
          onUpdate: (self) => {
            const nextProgress = self.progress;
            const nextActiveIndex = Math.min(
              chapterCount - 1,
              Math.floor(nextProgress * chapterCount),
            );

            setActiveIndex((current) =>
              current === nextActiveIndex
                ? current
                : nextActiveIndex,
            );

            if (
              Math.abs(
                nextProgress - progressRef.current,
              ) < 0.0015
            ) {
              return;
            }

            progressRef.current = nextProgress;

            if (rafRef.current !== null) return;
            rafRef.current =
              window.requestAnimationFrame(() => {
                rafRef.current = null;
                setProgress(progressRef.current);
              });
          },
        },
      });
      const trigger = master.scrollTrigger;

      labels.forEach((label, index) => {
        master.to(
          label,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.28,
            ease: "power3.out",
          },
          index,
        );
        master.to(
          label,
          {
            autoAlpha:
              index === labels.length - 1 ? 1 : 0,
            y: -28,
            duration: 0.24,
          },
          index + 0.68,
        );
      });

      panels.forEach((panel, index) => {
        master.to(
          panel,
          {
            autoAlpha: 1,
            y: 0,
            rotate: 0,
            duration: 0.44,
            ease: "power3.out",
          },
          index * 0.34,
        );
      });

      window.requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        logTimelineScrollDiagnostics(
          "after-refresh",
          container,
          viewport,
          chapterCount,
          trigger,
        );
      });

      return () => {
        logTimelineScrollDiagnostics(
          "before-cleanup",
          container,
          viewport,
          chapterCount,
          trigger,
        );

        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

        master.scrollTrigger?.kill(true);
        master.kill();
      };
    },
    {
      scope: containerRef.current ? containerRef : undefined,
      dependencies: [chapterCount, disabled],
    },
  );

  return { progress, activeIndex };
}
