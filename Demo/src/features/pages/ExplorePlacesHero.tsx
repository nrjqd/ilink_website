/**
 * 公開內容頁前端模組，組合 CMS 資料、靜態備援內容與頁面視覺區塊。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：地點探索頁首區塊，處理地方分類導覽與主視覺內容。

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { places, type PlaceChapter } from "./pages.data";
import { resolveMediaUrl } from "../../shared/media";
import { SafeImage } from "../../shared/SafeMedia";
import { apiBaseUrl } from "../../shared/api";

// 詳細註解：PlacesHeroContent 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
type PlacesHeroContent = {
  title: string;
  summary: string;
  hero_image_url?: string | null;
  hero_image_alt?: string | null;
};

const placesHeroFallback: PlacesHeroContent = {
  title: "地方場域",
  summary: "從旗山、美濃到內門，整理地方文化、產業與故事現場。",
};

// resolveExistingPlaceImage 封裝 resolve Existing Place Image 流程，集中處理輸入資料、狀態轉換或外部副作用。
function resolveExistingPlaceImage(src: string, fallbackImage: string) {
  return resolveMediaUrl(src.startsWith("/images/") ? fallbackImage : src);
}

// normalizePlaceCards 封裝 normalize Place Cards 流程，集中處理輸入資料、狀態轉換或外部副作用。
function normalizePlaceCards(items: PlaceChapter[]) {
  return items.map((place) => ({
    ...place,
    coverImage: resolveExistingPlaceImage(place.coverImage, place.fallbackImage),
    fallbackImage: resolveMediaUrl(place.fallbackImage),
  }));
}

// 詳細註解：ExplorePlacesHero 是 React 元件，負責組合資料、互動狀態與畫面結構。
export function ExplorePlacesHero() {
  const rootRef = useRef<HTMLElement | null>(null);
  const routeRef = useRef<SVGPathElement | null>(null);
  const fallbackHero = useMemo(
    () => ({
      ...placesHeroFallback,
      hero_image_url: resolveMediaUrl(placesHeroFallback.hero_image_url),
    }),
    [],
  );
  const fallbackPlaces = useMemo(() => normalizePlaceCards(places), []);
  const [hero, setHero] = useState(fallbackHero);

  useEffect(() => {
    const root = rootRef.current;
    const route = routeRef.current;
    if (!root || !route) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compactLayout = window.matchMedia("(max-width: 900px)").matches;
    if (reduceMotion || compactLayout) {
      gsap.set(route, { strokeDashoffset: 0 });
      gsap.set(root.querySelectorAll(".place-node"), { autoAlpha: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(route, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.out" });
      gsap.fromTo(
        ".place-node",
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.72, stagger: 0.18, ease: "power2.out" },
      );
    }, root);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/pages/places`, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : fallbackHero))
      .then((payload: Partial<PlacesHeroContent>) => {
        setHero({
          title: payload.title || fallbackHero.title,
          summary: payload.summary || fallbackHero.summary,
          hero_image_url: resolveMediaUrl(payload.hero_image_url || fallbackHero.hero_image_url),
          hero_image_alt: payload.hero_image_alt || fallbackHero.hero_image_alt,
        });
      })
      .catch(() => setHero(fallbackHero));

    return () => controller.abort();
  }, [fallbackHero]);

  // 詳細註解：scrollToContent 封裝此檔案中的一段資料轉換或互動流程，方便多處重用。
  function scrollToContent() {
    document.querySelector("#place-journey")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section ref={rootRef} className="explore-places-hero" aria-labelledby="places-title">
      <aside className="explore-rail" aria-label="地方探索章節">
        <span>02</span>
        <i />
        <span>06</span>
      </aside>

      <div className="explore-copy">
        <p className="explore-kicker">PLACE DISCOVERY</p>
        <h1 id="places-title">{hero.title}</h1>
        <b aria-hidden="true">field</b>
        <p>{hero.summary}</p>
        <button type="button" className="explore-cta" onClick={scrollToContent}>
          <span className="explore-cta__icon" aria-hidden="true">↓</span>
          開始逛地方
        </button>
      </div>

      <div className="explore-map" aria-label="旗山、美濃、內門地方文化路線">
        <svg className="explore-route" viewBox="0 0 1040 380" aria-hidden="true">
          <path
            ref={routeRef}
            className="explore-route__path"
            pathLength="1"
            d="
              M 110 325
              C 235 315, 270 245, 390 245
              C 520 245, 570 310, 690 230
              C 810 150, 810 115, 930 45
            "
          />
        </svg>

        {fallbackPlaces.map((place) => (
          <article
            key={place.id}
            className={`place-node place-node--${place.id}`}
            style={{ "--place-x": place.x, "--place-y": place.y } as CSSProperties}
          >
            <h2 className="place-node__name">{place.name}</h2>

            <div className="place-node__visual">
              <span className="place-node__dot" />
              <figure className="place-node__photo">
                <SafeImage
                  src={place.coverImage}
                  alt={`${place.name}地方現場影像`}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = place.fallbackImage;
                  }}
                />
              </figure>
            </div>

            <div className="place-node__annotation">
              <svg className="place-node__arrow" viewBox="0 0 72 42" aria-hidden="true">
                <path d="M4 4 C16 28 30 30 58 31" />
                <path d="M49 24 L59 31 L50 37" />
              </svg>
              <p>
                {place.note.split("\n").map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </p>
            </div>
          </article>
        ))}
      </div>

      <button type="button" className="explore-down" onClick={scrollToContent} aria-label="前往地方故事">
        ↓
      </button>
    </section>
  );
}
