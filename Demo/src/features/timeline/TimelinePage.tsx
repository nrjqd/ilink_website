/**
 * I-LINK 首頁時間軸。
 *
 * 首頁資料由後端 CMS 的 /timeline/events 提供；前端只負責載入、呈現與互動，
 * 不再使用本地 timeline fallback 作為內容來源。
 */

import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, BookOpen, Database, MapPinned } from "lucide-react";
import { SiteHeader } from "../../shared/SiteHeader";
import { SiteFooter } from "../../shared/SiteFooter";
import { createTimelineChapters } from "./timeline.data";
import type { TimelineChapter } from "./timeline.types";
import { fetchTimelineEvents } from "./timeline.api";
import { TimelineOverlay } from "./TimelineOverlay";
import { TimelineProgress } from "./TimelineProgress";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { scrollToPageY, useSmoothScroll } from "./hooks/useSmoothScroll";
import { useTimelineAnimation } from "./hooks/useTimelineAnimation";
import { SafeImage } from "../../shared/SafeMedia";

const TimelineScene = lazy(() => import("./TimelineScene").then((module) => ({ default: module.TimelineScene })));

interface TimelinePageProps {
  currentPath?: string;
}

type StoryGuideItem = {
  label: string;
  title: string;
  description: string;
  href: string;
  icon: import("lucide-react").LucideIcon;
  className: string;
};

const guideItems: StoryGuideItem[] = [
  {
    label: "逛地方",
    title: "旗山、美濃、內門有什麼？",
    description: "從老街、藍染、宋江陣到產業現場，快速找到三個場域最值得看的故事。",
    href: "/places",
    icon: MapPinned,
    className: "guide-card--yellow",
  },
  {
    label: "學生作品",
    title: "學生把地方做成了什麼？",
    description: "看見影像、設計、AI 電子書與網站成果，理解地方素材如何被重新轉譯。",
    href: "/works",
    icon: Database,
    className: "guide-card--gray",
  },
  {
    label: "成果總覽",
    title: "這個計畫留下哪些價值？",
    description: "用場域、活動、主題與平台成果，讓長官與民眾一眼看懂 I-LINK 的影響。",
    href: "/impact",
    icon: BookOpen,
    className: "guide-card--pink",
  },
];

function StoryGuide() {
  return (
    <section className="story-guide" aria-label="I-LINK 網站導覽">
      {guideItems.map((item) => {
        const Icon = item.icon;

        return (
          <a key={item.href} href={item.href} className={`guide-card ${item.className}`}>
            <div className="guide-card__icon">
              <Icon size={22} strokeWidth={1.6} />
            </div>
            <span className="guide-card__label">{item.label}</span>
            <h3 className="guide-card__title">{item.title}</h3>
            <p className="guide-card__description">{item.description}</p>
            <span className="guide-card__line" aria-hidden="true" />
          </a>
        );
      })}
    </section>
  );
}

export function TimelinePage({ currentPath = "/" }: TimelinePageProps) {
  const containerRef = useRef<HTMLElement>(null);
  const timelineCanvasRef = useRef<HTMLDivElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const chapterGridRef = useRef<HTMLElement>(null);
  const storyDetailRef = useRef<HTMLElement>(null);
  const shouldScrollToStoryDetailRef = useRef(false);
  const [chapters, setChapters] = useState<TimelineChapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [shouldLoadScene, setShouldLoadScene] = useState(false);
  const [shouldLoadHeroVideo, setShouldLoadHeroVideo] = useState(false);
  const [loadError, setLoadError] = useState("");
  const reducedMotion = useReducedMotion();
  const isMobileTimeline = useMediaQuery("(max-width: 900px)");
  useSmoothScroll(reducedMotion);
  const { progress, activeIndex } = useTimelineAnimation(
    containerRef,
    chapters.length,
    reducedMotion || isMobileTimeline,
  );
  const selectedChapter = chapters.find((chapter) => chapter.id === selectedChapterId) ?? chapters[0];
  const selectedArticleHref = selectedChapter
    ? `/posts/${encodeURIComponent(selectedChapter.slug)}`
    : "";

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");

    fetchTimelineEvents(controller.signal)
      .then((events) => {
        const nextChapters = createTimelineChapters(events);
        setChapters(nextChapters);
        setSelectedChapterId(nextChapters[0]?.id ?? "");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setLoadError("目前無法載入 CMS 時間軸資料，請確認後端 API 已啟動。");
          setChapters([]);
          setSelectedChapterId("");
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isMobileTimeline || chapters.length === 0) return;

    const target = timelineCanvasRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoadScene(true);
        observer.disconnect();
      },
      { rootMargin: "480px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [chapters.length, isMobileTimeline]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShouldLoadHeroVideo(true), 900);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video || !shouldLoadHeroVideo) return;

    video.play().catch(() => {
      // 瀏覽器阻擋 autoplay 時保留 poster 即可。
    });
  }, [shouldLoadHeroVideo]);

  function scrollToStoryDetail() {
    storyDetailRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  useLayoutEffect(() => {
    if (!shouldScrollToStoryDetailRef.current) return;

    shouldScrollToStoryDetailRef.current = false;
    const frame = window.requestAnimationFrame(scrollToStoryDetail);

    return () => window.cancelAnimationFrame(frame);
  }, [selectedChapterId, reducedMotion]);

  function selectChapter(chapterId: string) {
    if (chapterId === selectedChapterId) {
      window.requestAnimationFrame(scrollToStoryDetail);
      return;
    }

    shouldScrollToStoryDetailRef.current = true;
    setSelectedChapterId(chapterId);
  }

  function skipTimeline() {
    const target = chapterGridRef.current;
    if (!target) return;

    const headerHeight = document.querySelector<HTMLElement>(".demo-header")?.offsetHeight ?? 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight;

    scrollToPageY(Math.max(0, targetTop), {
      immediate: reducedMotion,
      onComplete: () => {
        target.focus({ preventScroll: true });
      },
    });
  }

  return (
    <main className="app-shell">
      <SiteHeader currentPath={currentPath} />

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">I-LINK LOCAL STORIES</p>
          <h1>旗美內門，有哪些故事值得被看見？</h1>
          <span>
            從旗山老街、美濃藍染到內門宋江陣，I-LINK 把地方走讀、人物採訪、學生作品與活動成果，
            整理成一個能被分享、被搜尋、也能持續更新的地方內容平台。
          </span>
        </div>
        <video
          ref={heroVideoRef}
          autoPlay
          muted
          loop
          playsInline
          crossOrigin="anonymous"
          preload="none"
          poster="https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/posts/2026/09/thumb/60d4bfc5-2842-4f44-9a95-2d00faf4b49f.webp"
        >
          {shouldLoadHeroVideo ? (
            <source
              src="https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/videos/home/i-link-video.mp4"
              type="video/mp4"
            />
          ) : null}
        </video>
      </section>

      {loadError ? (
        <section className="system-notes">
          <div className="system-notes__content">
            <p className="eyebrow">CMS STATUS</p>
            <h2>{loadError}</h2>
          </div>
        </section>
      ) : null}

      {chapters.length > 0 ? (
        <>
          <section className="timeline-story" id="story" ref={containerRef}>
            <div className="timeline-viewport">
              <div ref={timelineCanvasRef} className="timeline-canvas" aria-hidden="true">
                <Suspense fallback={<div className="canvas-fallback">載入地方故事場景</div>}>
                  {shouldLoadScene && !isMobileTimeline ? <TimelineScene progress={progress} chapters={chapters} /> : null}
                </Suspense>
              </div>
              <TimelineOverlay activeIndex={activeIndex} chapters={chapters} showMobileMedia={isMobileTimeline} />
              <TimelineProgress progress={progress} activeIndex={activeIndex} chapters={chapters} />
              <button
                type="button"
                className="scroll-hint"
                onClick={skipTimeline}
                aria-label="跳過時間軸，前往故事列表"
              >
                <span className="scroll-hint__icon" aria-hidden="true">
                  <ArrowDown size={18} strokeWidth={2.2} />
                </span>
                <span className="scroll-hint__copy">
                  <strong>向下探索</strong>
                  <small>跳過時間軸</small>
                </span>
              </button>
            </div>
          </section>

          <section className="chapter-grid" id="chapters" ref={chapterGridRef} tabIndex={-1} aria-label="I-LINK 時間軸節點">
            {chapters.map((chapter) => (
              <button
                className={`timeline-card ${chapter.id === selectedChapter.id ? "is-selected" : ""}`}
                key={chapter.id}
                type="button"
                onClick={() => selectChapter(chapter.id)}
                aria-pressed={chapter.id === selectedChapter.id}
              >
                <span>{String(chapter.index).padStart(2, "0")}</span>
                <SafeImage src={chapter.panels[0].image} alt={chapter.panels[0].alt} loading="lazy" />
                <div>
                  <p>{chapter.year}</p>
                  <h2>{chapter.title}</h2>
                  <small>{chapter.description}</small>
                </div>
              </button>
            ))}
          </section>

          <section className="story-detail" id="chapter-story" ref={storyDetailRef} aria-live="polite">
            <div className="story-detail__media">
              <a
                className="story-detail__image-link"
                href={selectedArticleHref}
                aria-label={`閱讀完整文章：${selectedChapter.title}`}
              >
                <SafeImage src={selectedChapter.detailImage} alt={selectedChapter.detailAlt} />
              </a>
              <div className="story-detail__palette" aria-label="視覺色票">
                {selectedChapter.palette.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </div>
            </div>
            <article className="story-detail__copy">
              <p className="eyebrow">{selectedChapter.eyebrow}</p>
              <div className="story-detail__title-row">
                <span>{String(selectedChapter.index).padStart(2, "0")}</span>
                <h2>
                  <a href={selectedArticleHref}>{selectedChapter.title}</a>
                </h2>
              </div>
              <strong>{selectedChapter.lead}</strong>
              {selectedChapter.story.map((paragraph, paragraphIndex) => (
                <p key={`${selectedChapter.id}-story-${paragraphIndex}`}>{paragraph}</p>
              ))}
              <a className="story-detail__article-link" href={selectedArticleHref}>
                <span>閱讀完整文章</span>
                <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
              </a>
              <StoryGuide />
            </article>
          </section>
        </>
      ) : null}

      <SiteFooter />
    </main>
  );
}
