import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SiteHeader } from "../../shared/SiteHeader";
import { SiteFooter } from "../../shared/SiteFooter";
import { SafeImage } from "../../shared/SafeMedia";
import { getPostDisplayImage } from "../../shared/media";
import { fetchPaginatedPosts, type PaginatedPosts, type PostListItem } from "../../shared/posts";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  REGION_LABELS,
  REGION_OPTIONS,
  formatPostCategory,
  formatPostRegion,
  type PostRegion,
  type PostCategory,
} from "../../shared/contentLabels";

gsap.registerPlugin(Flip);

type WorkLayout = "feature" | "portrait" | "landscape" | "standard";
type RegionFilter = "all" | PostRegion;
type CategoryFilter = "all" | PostCategory;

type WorksArchivePageProps = {
  currentPath: string;
};

const worksPerPage = 4;
const layoutSequence: WorkLayout[] = ["feature", "portrait", "landscape", "standard"];

const emptyPage: PaginatedPosts = {
  items: [],
  page: 1,
  limit: worksPerPage,
  total: 0,
};

function parsePageSearch(): { page: number; region: RegionFilter; category: CategoryFilter } {
  const params = new URLSearchParams(window.location.search);
  const parsedPage = Number(params.get("page") || "1");
  const parsedRegion = params.get("region");
  const parsedCategory = params.get("category");

  return {
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1,
    region: REGION_OPTIONS.includes(parsedRegion as PostRegion) ? (parsedRegion as PostRegion) : "all",
    category: CATEGORY_OPTIONS.includes(parsedCategory as PostCategory) ? (parsedCategory as PostCategory) : "all",
  };
}

function syncWorksUrl(page: number, region: RegionFilter, category: CategoryFilter) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (region !== "all") params.set("region", region);
  if (category !== "all") params.set("category", category);
  const nextUrl = `/works${params.toString() ? `?${params.toString()}` : ""}`;
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.pushState({}, "", nextUrl);
  }
}

function summarizePost(post: PostListItem) {
  const summary = post.summary?.trim();
  if (summary) return summary;
  return post.content.replace(/\s+/g, " ").trim().slice(0, 120);
}

export function WorksArchivePage({ currentPath }: WorksArchivePageProps) {
  const initialSearch = useMemo(parsePageSearch, []);
  const [activeRegion, setActiveRegion] = useState<RegionFilter>(initialSearch.region);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>(initialSearch.category);
  const [currentPage, setCurrentPage] = useState(initialSearch.page);
  const [postsPage, setPostsPage] = useState<PaginatedPosts>(emptyPage);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const gridRef = useRef<HTMLElement>(null);
  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null);

  const pageCount = Math.max(1, Math.ceil(postsPage.total / worksPerPage));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const showingStart = postsPage.total === 0 ? 0 : (safeCurrentPage - 1) * worksPerPage + 1;
  const showingEnd = Math.min(safeCurrentPage * worksPerPage, postsPage.total);
  const shouldShowPagination = postsPage.total > worksPerPage;

  useEffect(() => {
    function handlePopState() {
      const nextSearch = parsePageSearch();
      setActiveRegion(nextSearch.region);
      setActiveCategory(nextSearch.category);
      setCurrentPage(nextSearch.page);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError("");

    fetchPaginatedPosts(
      {
        status: "published",
        page: currentPage,
        limit: worksPerPage,
        region: activeRegion === "all" ? undefined : activeRegion,
        category: activeCategory === "all" ? undefined : activeCategory,
      },
      controller.signal,
    )
      .then((payload) => {
          setPostsPage(payload);
          if (payload.total > 0 && payload.items.length === 0 && currentPage > 1) {
            setCurrentPage(1);
          syncWorksUrl(1, activeRegion, activeCategory);
        }
      })
      .catch((nextError) => {
        if (nextError.name !== "AbortError") {
          setPostsPage(emptyPage);
          setError("學生作品暫時無法載入");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [activeCategory, activeRegion, currentPage]);

  useLayoutEffect(() => {
    if (!flipStateRef.current) return;

    Flip.from(flipStateRef.current, {
      absolute: true,
      duration: 0.55,
      ease: "power3.inOut",
      stagger: 0.035,
      onEnter: (elements) =>
        gsap.fromTo(elements, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.32, ease: "power2.out" }),
      onLeave: (elements) => gsap.to(elements, { opacity: 0, y: -12, duration: 0.2, ease: "power2.in" }),
    });

    flipStateRef.current = null;
  }, [postsPage.items]);

  function captureGridState() {
    const cards = gridRef.current?.querySelectorAll(".work-card");
    if (!cards?.length) return;
    flipStateRef.current = Flip.getState(cards);
  }

  function changeRegion(nextRegion: RegionFilter) {
    if (nextRegion === activeRegion) return;
    captureGridState();
    setActiveRegion(nextRegion);
    setCurrentPage(1);
    syncWorksUrl(1, nextRegion, activeCategory);
  }

  function changeCategory(nextCategory: CategoryFilter) {
    if (nextCategory === activeCategory) return;
    captureGridState();
    setActiveCategory(nextCategory);
    setCurrentPage(1);
    syncWorksUrl(1, activeRegion, nextCategory);
  }

  function goToPage(nextPage: number) {
    const clampedPage = Math.min(Math.max(nextPage, 1), pageCount);
    if (clampedPage === safeCurrentPage) return;
    captureGridState();
    setCurrentPage(clampedPage);
    syncWorksUrl(clampedPage, activeRegion, activeCategory);
    window.setTimeout(() => {
      gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <main className="app-shell content-shell">
      <SiteHeader currentPath={currentPath} />

      <section className="works-archive" aria-labelledby="works-title">
        <header className="works-archive__header">
          <p className="eyebrow">STUDENT WORKS</p>
          <div className="works-archive__title-row">
            <h1 id="works-title">學生作品</h1>
            <p>
              從地方研究到創意實作，這裡集結學生參與 I-LINK 的學習成果。探索不同主題，看見地方知識如何一步步轉化成作品。
            </p>
          </div>
        </header>

        <div className="works-filter" aria-label="學生作品篩選">
          <div className="works-filter__group" aria-label="地區篩選">
            <button
              type="button"
              className={activeRegion === "all" ? "is-active" : ""}
              aria-pressed={activeRegion === "all"}
              onClick={() => changeRegion("all")}
            >
              全部
            </button>
            {REGION_OPTIONS.map((region) => (
              <button
                key={region}
                type="button"
                className={activeRegion === region ? "is-active" : ""}
                aria-pressed={activeRegion === region}
                onClick={() => changeRegion(region)}
              >
                {REGION_LABELS[region]}
              </button>
            ))}
          </div>
          <span className="works-filter__divider" aria-hidden="true" />
          <div className="works-filter__group" aria-label="分類篩選">
            <button
              type="button"
              className={activeCategory === "all" ? "is-active" : ""}
              aria-pressed={activeCategory === "all"}
              onClick={() => changeCategory("all")}
            >
              全部
            </button>
            {CATEGORY_OPTIONS.map((category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? "is-active" : ""}
                aria-pressed={activeCategory === category}
                onClick={() => changeCategory(category)}
              >
                {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? <p className="works-state">學生作品載入中...</p> : null}
        {!isLoading && error ? <p className="works-state works-state--error">{error}</p> : null}
        {!isLoading && !error && postsPage.total === 0 ? <p className="works-state">目前尚無學生作品</p> : null}

        {!isLoading && !error && postsPage.items.length > 0 ? (
          <section ref={gridRef} className="works-grid" aria-label="學生作品列表">
            {postsPage.items.map((post, index) => (
              <WorkCard
                key={post.id}
                post={post}
                displayNumber={(safeCurrentPage - 1) * worksPerPage + index + 1}
                layout={layoutSequence[index % layoutSequence.length]}
              />
            ))}
          </section>
        ) : null}

        {!isLoading && !error && postsPage.total > 0 ? (
          <footer className="works-bottom">
            <p>
              Showing <strong>{String(showingStart).padStart(2, "0")}-{String(showingEnd).padStart(2, "0")}</strong> of{" "}
              {String(postsPage.total).padStart(2, "0")}
            </p>
            {shouldShowPagination ? (
              <div className="works-pagination" aria-label="學生作品分頁">
                <button
                  type="button"
                  aria-label="上一頁"
                  disabled={safeCurrentPage === 1}
                  onClick={() => goToPage(safeCurrentPage - 1)}
                >
                  <ChevronLeft size={16} strokeWidth={2} />
                </button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={pageNumber === safeCurrentPage ? "is-active" : ""}
                    aria-label={`第 ${pageNumber} 頁`}
                    aria-current={pageNumber === safeCurrentPage ? "page" : undefined}
                    onClick={() => goToPage(pageNumber)}
                  >
                    {String(pageNumber).padStart(2, "0")}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="下一頁"
                  disabled={safeCurrentPage === pageCount}
                  onClick={() => goToPage(safeCurrentPage + 1)}
                >
                  <ChevronRight size={16} strokeWidth={2} />
                </button>
              </div>
            ) : null}
          </footer>
        ) : null}
      </section>
      <SiteFooter />
    </main>
  );
}

type WorkCardProps = {
  post: PostListItem;
  displayNumber: number;
  layout: WorkLayout;
};

function WorkCard({ post, displayNumber, layout }: WorkCardProps) {
  const number = String(displayNumber).padStart(2, "0");
  const image = getPostDisplayImage(post);
  const regionLabel = post.region ? formatPostRegion(post.region) : "未設定地區";
  const categoryLabel = formatPostCategory(post.category);

  return (
    <article className={`work-card work-card--${layout}`}>
      <a href={`/posts/${encodeURIComponent(post.slug)}`} className="work-card-link" aria-label={`查看作品：${post.title}`}>
        {image ? (
          <SafeImage src={image} alt={post.cover_media?.original_filename ?? post.title} loading={displayNumber > 2 ? "lazy" : "eager"} />
        ) : (
          <span className="work-card-placeholder">尚未設定圖片</span>
        )}
        <div className="work-card-shade" />
        <span className="work-card-number">{number}</span>
        <div className="work-card-content">
          <p className="work-card-meta">
            {regionLabel} / {categoryLabel}
          </p>
          <h2>{post.title}</h2>
          <p className="work-card-description">{summarizePost(post)}</p>
        </div>
        {layout === "feature" ? (
          <div className="work-card-arrow">
            <span>{number}</span>
            <span className="arrow-line" />
            <span>查看</span>
          </div>
        ) : null}
      </a>
    </article>
  );
}
