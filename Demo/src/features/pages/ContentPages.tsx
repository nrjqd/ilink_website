/**
 * 公開內容頁前端模組，組合 CMS 資料、靜態備援內容與頁面視覺區塊。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：一般內容頁集合，負責活動、影響力、地點與作品等頁面的資料載入與呈現。

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SiteHeader } from "../../shared/SiteHeader";
import { SiteFooter } from "../../shared/SiteFooter";
import { ExplorePlacesHero } from "./ExplorePlacesHero";
import { PlaceChapters } from "./PlaceChapters";
import { WorksArchivePage } from "./WorksArchivePage";
import { AboutILink } from "./AboutILink";
import { PAGE_HERO_IMAGES } from "./pageAssets";
import { fetchPaginatedPosts, fetchPosts, type PostListItem } from "../../shared/posts";
import { formatPostCategory, formatPostRegion } from "../../shared/contentLabels";
import { getPostDisplayImage, resolveMediaUrl } from "../../shared/media";
import { SafeImage } from "../../shared/SafeMedia";
import { apiBaseUrl } from "../../shared/api";

gsap.registerPlugin(Flip);
gsap.registerPlugin(ScrollTrigger);

// 詳細註解：PageProps 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
interface PageProps {
  currentPath: string;
}

// 詳細註解：PageMediaHeroProps 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
type PageMediaHeroProps = {
  titleId: string;
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt?: string;
};

// 詳細註解：SitePageContent 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
type SitePageContent = {
  title: string;
  summary: string;
  hero_image_url?: string | null;
  hero_image_alt?: string | null;
};

// 詳細註解：EventListItem 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
type EventListItem = {
  id: string;
  date: string;
  place: string;
  type: string;
  title: string;
  name: string;
  description: string;
  image: string;
};

type EventListState = {
  items: EventListItem[];
  isLoading: boolean;
  error: string | null;
};

type ImpactStat = {
  value: number | null;
  digits?: number;
  label: string;
  detail: string;
};

const eventPageFallback: SitePageContent = {
  title: "活動現場",
  summary: "從走讀、採訪到 AI 工作坊，帶你看見 I-LINK 如何把一次次地方現場，轉成能被分享與延伸的內容素材。",
  hero_image_url: "/assets/img/0317/計畫啟動說明會暨旗山宗教文化探訪.jpg",
};

const impactPageFallback: SitePageContent = {
  title: "成果總覽",
  summary: "用數據、作品、案例與公開平台，讓長官與民眾快速看懂 I-LINK 這一年留下的地方文化價值。",
  hero_image_url: "/assets/img/1128/1128敘事跨域與再創：AI 時代下的俗文學與 SDGs 故事力_001.webp",
};

const aboutPageFallback: SitePageContent = {
  title: "關於 I-LINK",
  summary: "我們連結地方、學校與創作者，讓旗山、美濃、內門的文化故事被整理、被發布，也被更多人看見。",
  hero_image_url: "/assets/img/1020/1020iLink美濃藍染文創設計工坊_001.webp",
};

// 詳細註解：useSitePageContent 是自訂 Hook，集中管理副作用或可重用狀態，避免各元件重複處理。
function useSitePageContent(key: string, fallback: SitePageContent) {
  const fallbackPage = useMemo(
    () => ({
      ...fallback,
      hero_image_url: resolveMediaUrl(fallback.hero_image_url),
    }),
    [fallback],
  );
  const [page, setPage] = useState(fallbackPage);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/pages/${key}`, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : fallbackPage))
      .then((payload: Partial<SitePageContent>) => {
        setPage({
          title: payload.title || fallbackPage.title,
          summary: payload.summary || fallbackPage.summary,
          hero_image_url: resolveMediaUrl(payload.hero_image_url || fallbackPage.hero_image_url),
          hero_image_alt: payload.hero_image_alt || fallbackPage.hero_image_alt,
        });
      })
      .catch(() => setPage(fallbackPage));
    return () => controller.abort();
  }, [key, fallbackPage]);

  return page;
}

// 詳細註解：postsToEvents 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
function formatEventDate(value: string) {
  return value.replace(/-/g, ".");
}

function toEventDescription(item: PostListItem) {
  const source = item.summary?.trim() || item.content?.trim() || "";
  if (source.length <= 150) return source;
  return `${source.slice(0, 150).trim()}...`;
}

function postsToEvents(items: PostListItem[]): EventListItem[] {
  return items.flatMap((item) => {
    if (!item.event_date) return [];

    return [{
      id: item.slug,
      date: formatEventDate(item.event_date),
      place: item.region ? formatPostRegion(item.region) : "",
      type: item.category ? formatPostCategory(item.category) : "",
      title: item.title,
      name: item.title,
      description: toEventDescription(item),
      image: getPostDisplayImage(item),
    }];
  });
}

type EventMonthGroup = { month: string; items: EventListItem[] };
type EventYearGroup = { year: string; months: EventMonthGroup[] };

// 依 event_date（YYYY.MM.DD）在前端分組：年 → 月；維持 API 回傳的順序，不改後端。
function groupEventsByDate(items: EventListItem[]): EventYearGroup[] {
  const years: EventYearGroup[] = [];
  for (const item of items) {
    const [year = "", month = ""] = item.date.split(".");
    let yearGroup = years.find((group) => group.year === year);
    if (!yearGroup) {
      yearGroup = { year, months: [] };
      years.push(yearGroup);
    }
    let monthGroup = yearGroup.months.find((group) => group.month === month);
    if (!monthGroup) {
      monthGroup = { month, items: [] };
      yearGroup.months.push(monthGroup);
    }
    monthGroup.items.push(item);
  }
  return years;
}

// 詳細註解：useEventList 是自訂 Hook，集中管理副作用或可重用狀態，避免各元件重複處理。
function useEventList() {
  const [state, setState] = useState<EventListState>({
    items: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    setState({ items: [], isLoading: true, error: null });

    fetchPosts({ status: "published", timeline: true, limit: 100 }, controller.signal)
      .then((nextItems) => {
        setState({
          items: postsToEvents(nextItems),
          isLoading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          items: [],
          isLoading: false,
          error: "活動資料暫時無法載入",
        });
      });

    return () => controller.abort();
  }, []);

  return state;
}

function usePublishedPostCount() {
  const [publishedPostCount, setPublishedPostCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchPaginatedPosts({ status: "published", page: 1, limit: 1 }, controller.signal)
      .then((payload) => setPublishedPostCount(payload.total))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPublishedPostCount(null);
      });

    return () => controller.abort();
  }, []);

  return publishedPostCount;
}

function formatCountValue(value: number, digits = 0) {
  return String(value).padStart(digits, "0");
}

function ImpactCounter({ value, digits = 0 }: { value: number | null; digits?: number }) {
  const counterRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const counter = counterRef.current;
    if (!counter || value === null) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const target = Number(counter.dataset.countTarget ?? value);
      const countDigits = Number(counter.dataset.countDigits ?? digits);
      counter.textContent = formatCountValue(target, countDigits);

      if (reduceMotion) return;

      gsap.fromTo(counter, {
        y: 12,
        opacity: 0.72,
      }, {
        y: 0,
        opacity: 1,
        duration: 1.45,
        ease: "power2.out",
        scrollTrigger: {
          trigger: counter,
          start: "top 82%",
          once: true,
        },
      });
    }, counter);

    return () => ctx.revert();
  }, [value, digits]);

  if (value === null) {
    return <strong className="impact-stat__number">--</strong>;
  }

  return (
    <strong
      ref={counterRef}
      className="impact-stat__number"
      data-count-target={value}
      data-count-digits={digits}
    >
      {formatCountValue(value, digits)}
    </strong>
  );
}

const impactStats: ImpactStat[] = [
  { value: 3, digits: 2, label: "可探索場域", detail: "旗山、美濃、內門各自形成清楚入口，讓民眾從地點開始進入故事。" },
  { value: null, digits: 2, label: "活動內容節點", detail: "從啟動、走讀、採訪、AI 課程到成果網站，累積可持續發布的素材。" },
  { value: 6, label: "可傳播主題", detail: "人物、產業、文化、飲食、工藝與 AI 應用，讓內容能切成多種自媒體角度。" },
  { value: 1, label: "公開成果平台", detail: "把影像、文字、活動歷程與學生作品集中展示，形成計畫成果的長期入口。" },
];

const yearlyProgress = [
  { year: "03-05", progress: 34, label: "建立內容方法與受眾入口" },
  { year: "10-11", progress: 78, label: "擴充地方素材與學生作品" },
  { year: "12", progress: 100, label: "整合成果並公開發布" },
];

// 詳細註解：PageFrame 是 React 元件，負責組合資料、互動狀態與畫面結構。
function PageFrame({ currentPath, children }: PageProps & { children: ReactNode }) {
  return (
    <main className="app-shell content-shell">
      <SiteHeader currentPath={currentPath} />
      {children}
      <SiteFooter />
    </main>
  );
}

// 詳細註解：PageMediaHero 是 React 元件，負責組合資料、互動狀態與畫面結構。
function PageMediaHero({ titleId, eyebrow, title, description, image, imageAlt = "" }: PageMediaHeroProps) {
  return (
    <section className="events-page-hero" aria-labelledby={titleId}>
      <SafeImage
        className="events-page-hero__image"
        src={image}
        alt={imageAlt}
        aria-hidden={imageAlt ? undefined : "true"}
      />

      <div className="events-page-hero__overlay" aria-hidden="true" />

      <div className="events-page-hero__copy">
        <p className="events-page-hero__eyebrow">{eyebrow}</p>
        <h1 id={titleId}>{title}</h1>
        <p className="events-page-hero__description">{description}</p>
      </div>
    </section>
  );
}

// 詳細註解：PlacesPage 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function PlacesPage({ currentPath }: PageProps) {
  return (
    <PageFrame currentPath={currentPath}>
      <ExplorePlacesHero />
      <PlaceChapters />
    </PageFrame>
  );
}

// 詳細註解：WorksPage 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function WorksPage({ currentPath }: PageProps) {
  return <WorksArchivePage currentPath={currentPath} />;
}

// 詳細註解：EventsPage 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function EventsPage({ currentPath }: PageProps) {
  const page = useSitePageContent("events", eventPageFallback);
  const { items: eventItems, isLoading, error } = useEventList();

  return (
    <PageFrame currentPath={currentPath}>
      <PageMediaHero
        titleId="events-title"
        eyebrow="EVENT CHRONOLOGY"
        title={page.title}
        description={page.summary}
        image={PAGE_HERO_IMAGES.events}
        imageAlt={page.hero_image_alt || ""}
      />

      <section className="events-chronology" aria-labelledby="events-timeline-title">
        <div className="events-chronology__inner">
          <div className="events-section-heading">
            <p className="eyebrow">FIELD SESSIONS</p>
          <h2 id="events-timeline-title">活動如何變成內容</h2>
          </div>

          <div className="events-timeline">
            {isLoading ? (
              <div className="events-timeline__state" role="status" aria-live="polite">
                <strong>活動資料載入中…</strong>
              </div>
            ) : error ? (
              <div className="events-timeline__state events-timeline__state--error" role="status" aria-live="polite">
                <strong>{error}</strong>
                <p>請稍後再試。</p>
              </div>
            ) : eventItems.length === 0 ? (
              <div className="events-timeline__state" role="status" aria-live="polite">
                <strong>目前尚無活動內容</strong>
                <p>新的活動發布後，會顯示在這裡。</p>
              </div>
            ) : (
              <EventGroups items={eventItems} />
            )}
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

// 整張卡是一個連結（不再另外放「查看活動」按鈕）；海報以 contain 呈現。
function EventGroups({ items }: { items: EventListItem[] }) {
  const years = groupEventsByDate(items);

  return (
    <>
      {years.length > 1 ? (
        <nav className="events-year-nav" aria-label="依年份跳轉">
          {years.map((group) => (
            <a key={group.year} className="filter-chip" href={`#events-${group.year}`}>
              {group.year}
            </a>
          ))}
        </nav>
      ) : null}
      {years.map((yearGroup) => (
        <section key={yearGroup.year} className="events-year" id={`events-${yearGroup.year}`} aria-labelledby={`events-year-${yearGroup.year}`}>
          <h3 className="events-year__title" id={`events-year-${yearGroup.year}`}>
            {yearGroup.year}
          </h3>
          {yearGroup.months.map((monthGroup) => (
            <section key={monthGroup.month} className="events-month">
              <h4 className="events-month__title">{Number(monthGroup.month)} 月</h4>
              <ol className="events-month__list">
                {monthGroup.items.map((event) => (
                  <li key={event.id}>
                    <a className="event-tile" href={`/posts/${encodeURIComponent(event.id)}`}>
                      <SafeImage
                        ratio="poster"
                        frameClassName="event-tile__media"
                        src={event.image}
                        alt=""
                        fallbackLabel="尚未設定圖片"
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="event-tile__body">
                        <span className="event-tile__meta">
                          <time dateTime={event.date.replace(/\./g, "-")}>{event.date.slice(5)}</time>
                          {event.place ? <span>{event.place}</span> : null}
                          {event.type ? <span>{event.type}</span> : null}
                        </span>
                        <strong className="event-tile__title">{event.title}</strong>
                        {event.description ? <span className="event-tile__desc">{event.description}</span> : null}
                        <span className="event-tile__cta" aria-hidden="true">
                          查看活動 →
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </section>
      ))}
    </>
  );
}

// 詳細註解：ImpactPage 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function ImpactPage({ currentPath }: PageProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const page = useSitePageContent("impact", impactPageFallback);
  const publishedPostCount = usePublishedPostCount();
  const resolvedImpactStats = useMemo(
    () => impactStats.map((stat, index) => (index === 1 ? { ...stat, value: publishedPostCount } : stat)),
    [publishedPostCount],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const bars = gsap.utils.toArray<HTMLElement>("[data-progress-bar]");
      const values = gsap.utils.toArray<HTMLElement>("[data-progress-value]");

      if (reduceMotion) {
        bars.forEach((bar) => {
          bar.style.width = `${Number(bar.dataset.progress ?? 0)}%`;
        });

        values.forEach((value) => {
          value.textContent = `${Number(value.dataset.progress ?? 0)}%`;
        });

        return;
      }

      gsap.utils.toArray<HTMLElement>(".annual-progress__row").forEach((row) => {
        const bar = row.querySelector<HTMLElement>("[data-progress-bar]");
        const percentage = row.querySelector<HTMLElement>("[data-progress-value]");
        if (!bar || !percentage) return;

        const target = Number(bar.dataset.progress ?? 0);
        const progress = { current: 0 };

        gsap.timeline({
          scrollTrigger: {
            trigger: row,
            start: "top 84%",
            once: true,
          },
        })
          .fromTo(bar, { width: "0%" }, { width: `${target}%`, duration: 1.5, ease: "power2.out" }, 0)
          .to(progress, {
            current: target,
            duration: 1.5,
            ease: "power2.out",
            onUpdate: () => {
              percentage.textContent = `${Math.round(progress.current)}%`;
            },
          }, 0);
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <PageFrame currentPath={currentPath}>
      <div ref={rootRef}>
        <PageMediaHero
          titleId="impact-title"
          eyebrow="THE IMPACT"
          title={page.title}
          description={page.summary}
          image={PAGE_HERO_IMAGES.impact}
          imageAlt={page.hero_image_alt || ""}
        />

        <section className="impact-stats" aria-label="影響數據">
          <div className="impact-stats__inner">
            {resolvedImpactStats.map((stat) => (
              <article className="impact-stat" key={stat.label}>
                <ImpactCounter value={stat.value} digits={stat.digits ?? 0} />
                <h2>{stat.label}</h2>
                <p>{stat.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="annual-progress" aria-labelledby="annual-progress-title">
          <div className="annual-progress__heading">
            <div>
              <p className="eyebrow">ANNUAL ROADMAP</p>
              <h2 id="annual-progress-title">年度進度</h2>
              <p>
                以時間軸呈現 I-LINK 如何從現場採集、內容製作，
                推進到成果整理與公開發布。
              </p>
            </div>

            <span className="annual-progress__legend">
              <i />
              目前進度
            </span>
          </div>

          <div className="annual-progress__list" aria-label="年度計畫進度">
            {yearlyProgress.map((item) => (
              <div className="annual-progress__row" key={item.year}>
                <strong className="annual-progress__year">{item.year}</strong>

                <div className="annual-progress__progress">
                  <div className="annual-progress__track">
                    <span
                      className="annual-progress__bar"
                      data-progress-bar
                      data-progress={item.progress}
                    />
                  </div>

                  <span
                    className="annual-progress__percentage"
                    data-progress-value
                    data-progress={item.progress}
                  >
                    {item.progress}%
                  </span>
                </div>

                <strong className="annual-progress__label">{item.label}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageFrame>
  );
}

// 詳細註解：AboutPage 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function AboutPage({ currentPath }: PageProps) {
  const page = useSitePageContent("about", aboutPageFallback);

  return (
    <PageFrame currentPath={currentPath}>
      <PageMediaHero
        titleId="about-title"
        eyebrow="ABOUT I-LINK"
        title={page.title}
        description={page.summary}
        image={PAGE_HERO_IMAGES.about}
        imageAlt={page.hero_image_alt || ""}
      />
      <AboutILink />
    </PageFrame>
  );
}
