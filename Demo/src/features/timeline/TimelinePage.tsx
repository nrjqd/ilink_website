/**
 * I-LINK 首頁時間軸。
 *
 * 首頁資料由後端 CMS 的 /timeline/events 提供；前端只負責載入、呈現與互動，
 * 不再使用本地 timeline fallback 作為內容來源。
 *
 * 版面依裝置分兩條路徑（同一份 TimelineChapter[]）：
 * - 沉浸式（Desktop ≥1024 + 精準指標 + 未要求減少動態）：Hero → WebGL pinned 時間軸 → 所有故事 → 導覽
 * - 內容版（Mobile / Tablet / reduced-motion）：Hero + CTA → 最新故事 → 年度時間軸 → 導覽
 *   內容版不掛載 TimelineScene / TimelineOverlay / TimelineProgress，three.js chunk 也不會被載入。
 */

import { Suspense, lazy, useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowDown, BookOpen, Database, MapPinned } from "lucide-react";
import { SiteHeader } from "../../shared/SiteHeader";
import { SiteFooter } from "../../shared/SiteFooter";
import { createTimelineChapters } from "./timeline.data";
import type { TimelineChapter } from "./timeline.types";
import { fetchTimelineEvents } from "./timeline.api";
import { TimelineOverlay } from "./TimelineOverlay";
import { TimelineProgress } from "./TimelineProgress";
import { StoryFeed } from "./StoryFeed";
import { TimelineRail } from "./TimelineRail";
import { formatStoryDate } from "./storyDates";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { scrollToPageY, useSmoothScroll } from "./hooks/useSmoothScroll";
import { useTimelineAnimation } from "./hooks/useTimelineAnimation";
import { SafeImage } from "../../shared/SafeMedia";
import { IMMERSIVE_QUERY } from "../../shared/breakpoints";

const TimelineScene = lazy(() => import("./TimelineScene").then((module) => ({ default: module.TimelineScene })));

const HERO_POSTER =
  "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/posts/2026/09/18/5004b26a-180d-449f-bd89-9cb68470142b/large.webp";
const HERO_VIDEO = "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/videos/home/i-link-video.mp4";

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
    <section className="story-guide-section" aria-labelledby="story-guide-title">
      <div className="section-heading-block">
        <p className="eyebrow">EXPLORE</p>
        <h2 id="story-guide-title">接著看什麼？</h2>
      </div>
      <div className="story-guide">
        {guideItems.map((item) => {
          const Icon = item.icon;

          return (
            <a key={item.href} href={item.href} className={`guide-card ${item.className}`}>
              <div className="guide-card__icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.6} />
              </div>
              <span className="guide-card__label">{item.label}</span>
              <h3 className="guide-card__title">{item.title}</h3>
              <p className="guide-card__description">{item.description}</p>
              <span className="guide-card__line" aria-hidden="true" />
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function TimelinePage({ currentPath = "/" }: TimelinePageProps) {
  const containerRef = useRef<HTMLElement>(null);
  const timelineCanvasRef = useRef<HTMLDivElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const chapterGridRef = useRef<HTMLElement>(null);
  const [chapters, setChapters] = useState<TimelineChapter[]>([]);
  const [shouldLoadScene, setShouldLoadScene] = useState(false);
  const [shouldLoadHeroVideo, setShouldLoadHeroVideo] = useState(false);
  const [loadError, setLoadError] = useState("");
  const reducedMotion = useReducedMotion();
  const supportsImmersive = useMediaQuery(IMMERSIVE_QUERY);
  const isImmersive = supportsImmersive && !reducedMotion;
  useSmoothScroll(!isImmersive);
  const { progress, activeIndex } = useTimelineAnimation(containerRef, chapters.length, !isImmersive);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");

    fetchTimelineEvents(controller.signal)
      .then((events) => {
        setChapters(createTimelineChapters(events));
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setLoadError("目前無法載入 CMS 時間軸資料，請確認後端 API 已啟動。");
          setChapters([]);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isImmersive || chapters.length === 0) return;

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
  }, [chapters.length, isImmersive]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShouldLoadHeroVideo(true), 900);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video || !shouldLoadHeroVideo || reducedMotion) return;

    video.play().catch(() => {
      // 瀏覽器阻擋 autoplay 時保留 poster 即可。
    });
  }, [shouldLoadHeroVideo, reducedMotion]);

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

  function jumpToStories(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById("latest-stories");
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
  }

  return (
    <main className={`app-shell ${isImmersive ? "is-immersive" : "is-content-layout"}`}>
      <SiteHeader currentPath={currentPath} />

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">I-LINK LOCAL STORIES</p>
          <h1>旗美內門，有哪些故事值得被看見？</h1>
          <span>
            從旗山老街、美濃藍染到內門宋江陣，I-LINK 把地方走讀、人物採訪、學生作品與活動成果，
            整理成一個能被分享、被搜尋、也能持續更新的地方內容平台。
          </span>
          {!isImmersive ? (
            <div className="intro__actions">
              <a className="button button--primary" href="#latest-stories" onClick={jumpToStories}>
                開始看故事
              </a>
              <nav className="intro__links" aria-label="快速前往">
                <a href="/places">逛地方 →</a>
                <a href="/works">學生作品 →</a>
              </nav>
            </div>
          ) : null}
        </div>
        <video
          ref={heroVideoRef}
          autoPlay={!reducedMotion}
          muted
          loop
          playsInline
          preload="none"
          poster={HERO_POSTER}
          aria-hidden="true"
        >
          {shouldLoadHeroVideo && !reducedMotion ? <source src={HERO_VIDEO} type="video/mp4" /> : null}
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

      {chapters.length > 0 && isImmersive ? (
        <>
          <section className="timeline-story" id="story" ref={containerRef}>
            <div className="timeline-viewport">
              <div ref={timelineCanvasRef} className="timeline-canvas" aria-hidden="true">
                <Suspense fallback={<div className="canvas-fallback">載入地方故事場景</div>}>
                  {shouldLoadScene ? <TimelineScene progress={progress} chapters={chapters} /> : null}
                </Suspense>
              </div>
              <TimelineOverlay activeIndex={activeIndex} chapters={chapters} />
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

          <section className="all-stories" id="chapters" ref={chapterGridRef} tabIndex={-1} aria-labelledby="all-stories-title">
            <div className="section-heading-block">
              <p className="eyebrow">ALL STORIES</p>
              <h2 id="all-stories-title">所有故事</h2>
            </div>
            <ol className="chapter-grid">
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  <a className="timeline-card" href={`/posts/${encodeURIComponent(chapter.slug)}`}>
                    <span className="timeline-card__index">{String(chapter.index).padStart(2, "0")}</span>
                    <SafeImage
                      ratio="poster"
                      frameClassName="timeline-card__media"
                      src={chapter.panels[0].image}
                      alt=""
                      fallbackLabel="尚未設定圖片"
                      loading="lazy"
                      decoding="async"
                    />
                    <div>
                      <p>
                        {chapter.date ? formatStoryDate(chapter.date) : chapter.year}
                        {chapter.location ? ` · ${chapter.location}` : ""}
                      </p>
                      <h3>{chapter.title}</h3>
                      <small>{chapter.description}</small>
                    </div>
                  </a>
                </li>
              ))}
            </ol>
          </section>

          <StoryGuide />
        </>
      ) : null}

      {chapters.length > 0 && !isImmersive ? (
        <>
          <section className="home-section" id="latest-stories" tabIndex={-1} aria-labelledby="latest-stories-title">
            <div className="section-heading-block">
              <p className="eyebrow">LATEST STORIES</p>
              <h2 id="latest-stories-title">最新故事</h2>
            </div>
            <StoryFeed chapters={chapters} />
          </section>

          <section className="home-section" id="timeline" aria-labelledby="timeline-rail-title">
            <div className="section-heading-block">
              <p className="eyebrow">TIMELINE</p>
              <h2 id="timeline-rail-title">一年走過的 {chapters.length} 個現場</h2>
              <p>依活動日期排列，點任一則直接閱讀文章。</p>
            </div>
            <TimelineRail chapters={chapters} />
          </section>

          <StoryGuide />
        </>
      ) : null}

      <SiteFooter />
    </main>
  );
}
