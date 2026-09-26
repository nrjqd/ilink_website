/**
 * 公開內容頁前端模組，組合 CMS 資料、靜態備援內容與頁面視覺區塊。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：地點章節元件，呈現地方故事與章節式內容。

import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { places, type PlaceChapter } from "./pages.data";
import { CATEGORY_LABELS, REGION_LABELS, type PostCategory } from "../../shared/contentLabels";
import { fetchPaginatedPosts, type PostListItem } from "../../shared/posts";
import { getPostDisplayImage, resolveMediaUrl } from "../../shared/media";
import { SafeImage } from "../../shared/SafeMedia";

type PlaceRegion = PlaceChapter["id"];

// resolveExistingPlaceImage 封裝 resolve Existing Place Image 流程，集中處理輸入資料、狀態轉換或外部副作用。
function resolveExistingPlaceImage(src: string, fallbackImage: string) {
  return resolveMediaUrl(src.startsWith("/images/") ? fallbackImage : src);
}

// normalizePlaceFallbacks 封裝 normalize Place Fallbacks 流程，集中處理輸入資料、狀態轉換或外部副作用。
function normalizePlaceFallbacks(items: PlaceChapter[]) {
  return items.map((place) => ({
    ...place,
    coverImage: resolveExistingPlaceImage(place.coverImage, place.fallbackImage),
    fallbackImage: resolveMediaUrl(place.fallbackImage),
  }));
}

// 詳細註解：imageFallback 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
function imageFallback(event: SyntheticEvent<HTMLImageElement>, fallbackImage: string) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = resolveMediaUrl(fallbackImage);
}

function shufflePosts(items: PostListItem[]): PostListItem[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function getPostMeta(post: PostListItem, region: PlaceRegion) {
  const regionLabel = REGION_LABELS[region];
  const categoryLabel = post.category && post.category in CATEGORY_LABELS ? CATEGORY_LABELS[post.category as PostCategory] : "";

  return [regionLabel, categoryLabel].filter(Boolean).join(" / ");
}

function PlaceRecommendations({ place }: { place: PlaceChapter }) {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setPosts([]);
    setError("");
    setIsLoading(true);

    fetchPaginatedPosts(
      {
        status: "published",
        region: place.id,
        page: 1,
        limit: 20,
      },
      controller.signal,
    )
      .then((payload) => {
        setPosts(shufflePosts(payload.items).slice(0, 3));
      })
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setPosts([]);
          setError("推薦文章暫時無法載入");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [place.id]);

  if (isLoading) {
    return <div className="place-spots" aria-label={`${place.name}推薦文章`} />;
  }

  if (error) {
    return (
      <div className="place-spots" aria-label={`${place.name}推薦文章`}>
        <p className="place-spots-state">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="place-spots" aria-label={`${place.name}推薦文章`}>
        <p className="place-spots-state">目前尚無相關文章</p>
      </div>
    );
  }

  return (
    <div className="place-spots" aria-label={`${place.name}推薦文章`}>
      {posts.map((post) => {
        const image = getPostDisplayImage(post);

        return (
          <a
            className="place-spot"
            href={`/posts/${encodeURIComponent(post.slug)}`}
            key={post.id}
            aria-label={`查看文章：${post.title}`}
          >
            <span className="place-spot-image">
              {image ? (
                <SafeImage src={image} alt={post.title} loading="lazy" />
              ) : (
                <span className="place-spot-image__empty" role="note">尚未設定圖片</span>
              )}
            </span>
            <span className="place-spot-copy">
              <h4>{post.title}</h4>
              <p>{getPostMeta(post, place.id)}</p>
            </span>
            <span className="place-spot-arrow" aria-hidden="true">→</span>
          </a>
        );
      })}
    </div>
  );
}

// 詳細註解：PlaceChapterCard 是 React 元件，負責組合資料、互動狀態與畫面結構。
function PlaceChapterCard({ place }: { place: PlaceChapter }) {
  return (
    <article className="place-chapter" id={place.id}>
      <div className="place-chapter__number" aria-hidden="true">
        {place.number}
      </div>

      <a className="place-feature" href={place.href} aria-label={`查看${place.name}場域`}>
        <SafeImage
          src={place.coverImage}
          alt={place.coverAlt}
          onError={(event) => imageFallback(event, place.fallbackImage)}
        />
        <div className="place-feature__copy">
          <span>{place.number}</span>
          <h3>{place.name}</h3>
          <p>{place.subtitle}</p>
          <div className="place-feature__tags" aria-label={`${place.name}主題標籤`}>
            {place.tags.map((tag) => (
              <small key={tag}>{tag}</small>
            ))}
          </div>
        </div>
      </a>

      <PlaceRecommendations place={place} />
    </article>
  );
}

// 詳細註解：ExploreMore 是 React 元件，負責組合資料、互動狀態與畫面結構。
function ExploreMore() {
  const [recommendedPosts, setRecommendedPosts] = useState<PostListItem[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [recommendationError, setRecommendationError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetchPaginatedPosts(
      {
        status: "published",
        page: 1,
        limit: 20,
      },
      controller.signal,
    )
      .then((payload) => {
        setRecommendedPosts(shufflePosts(payload.items).slice(0, 3));
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setRecommendedPosts([]);
          setRecommendationError("文章暫時無法載入");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingRecommendations(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <section className="explore-more">
      <div className="explore-more-copy">
        <span className="explore-more-icon" aria-hidden="true">＋</span>

        <div>
          <p className="explore-more-label">KEEP EXPLORING</p>
          <h2>
            看完地方
            <br />
            接著看現場
          </h2>
          <p>每一場走讀、採訪與工作坊，都是故事被發現的起點。往下看活動現場，理解素材如何變成作品與成果。</p>
        </div>
      </div>

      <a href="/events" className="explore-more-button">
        查看活動現場
        <span aria-hidden="true">→</span>
      </a>

      <div className="explore-more-photos" aria-label="推薦文章">
        {!isLoadingRecommendations && recommendationError ? (
          <p className="explore-more-state">{recommendationError}</p>
        ) : null}
        {!isLoadingRecommendations && !recommendationError && recommendedPosts.length === 0 ? (
          <p className="explore-more-state">目前尚無推薦文章</p>
        ) : null}
        {recommendedPosts.map((post) => {
          const image = getPostDisplayImage(post);

          return (
            <a
              className="explore-more-card"
              href={`/posts/${encodeURIComponent(post.slug)}`}
              key={post.id}
              aria-label={`查看文章：${post.title}`}
            >
              {image ? (
                <SafeImage src={image} alt={post.title} loading="lazy" />
              ) : (
                <span className="explore-more-card__empty" role="note">尚未設定圖片</span>
              )}
              <span className="explore-more-card__shade" aria-hidden="true" />
              <strong>{post.title}</strong>
            </a>
          );
        })}
      </div>

      <span className="explore-more-script" aria-hidden="true">
        Explore More!
      </span>
    </section>
  );
}

// 詳細註解：PlaceChapters 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function PlaceChapters() {
  const rootRef = useRef<HTMLElement | null>(null);
  const fallbackPlaces = useMemo(() => normalizePlaceFallbacks(places), []);
  const cmsPlaces = fallbackPlaces;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set(root.querySelectorAll(".place-chapter__number, .place-feature, .place-feature__copy, .place-spot"), {
        clearProps: "all",
      });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".place-chapter").forEach((chapter) => {
        const number = chapter.querySelector(".place-chapter__number");
        const feature = chapter.querySelector(".place-feature");
        const copy = chapter.querySelector(".place-feature__copy");
        const spots = chapter.querySelectorAll(".place-spot");

        ScrollTrigger.create({
          trigger: chapter,
          start: "top 72%",
          once: true,
          onEnter: () => {
            const timeline = gsap.timeline();

            // 推薦文章是非同步載入，觸發時可能還沒有 .place-spot；只對存在的目標建立動畫，避免 GSAP 警告。
            if (number) timeline.fromTo(number, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out" });
            if (feature) {
              timeline.fromTo(
                feature,
                { clipPath: "inset(0 100% 0 0)" },
                { clipPath: "inset(0 0% 0 0)", duration: 0.62, ease: "power3.out" },
                "-=0.06",
              );
            }
            if (copy) timeline.fromTo(copy, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: "power2.out" }, "-=0.18");
            if (spots.length) {
              timeline.fromTo(
                spots,
                { autoAlpha: 0, x: 26 },
                { autoAlpha: 1, x: 0, duration: 0.36, stagger: 0.1, ease: "power2.out" },
                "-=0.14",
              );
            }
          },
        });
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={rootRef} id="place-journey" className="place-journey" aria-labelledby="place-journey-title">
      <div className="place-journey__intro">
        <p className="eyebrow">LOCAL JOURNEY</p>
        <h2 id="place-journey-title">
          三個場域
          <br />
          組成一條年度內容路線
        </h2>
        <p>
          I-LINK 的活動安排由地方出發，再導入 AI、影音、電子書與網站等內容工具。
          旗山提供產業與街區脈絡，美濃深化文化記憶與工藝轉譯，內門補足民俗傳承的現場厚度。
        </p>
      </div>

      <div className="place-chapter-list">
        {cmsPlaces.map((place) => (
          <PlaceChapterCard place={place} key={place.id} />
        ))}
      </div>

      <ExploreMore />
    </section>
  );
}
