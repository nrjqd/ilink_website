/**
 * 公開路由表：集中判斷目前路徑對應哪個頁面，以及固定頁面的 SEO metadata。
 * 動態頁（/posts/:slug）與 404 由頁面元件自己在取得資料後設定 metadata。
 */

import { DEFAULT_DESCRIPTION, NOINDEX_ROBOTS, type SeoMetadata } from "./seo";
import { breadcrumbJsonLd, collectionPageJsonLd, organizationJsonLd, websiteJsonLd } from "./structuredData";

export type RouteKey = "home" | "places" | "works" | "events" | "impact" | "about" | "admin" | "post" | "notFound";

/** 去掉結尾斜線；"/about/" 與 "/about" 視為同一頁。 */
export function normalizeRoutePath(pathname: string) {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  if (collapsed === "" || collapsed === "/" || collapsed === "/index.html") return "/";
  return collapsed.replace(/\/+$/, "");
}

export function resolveRoute(pathname: string): RouteKey {
  const path = normalizeRoutePath(pathname);
  if (path === "/") return "home";
  if (path === "/places" || path.startsWith("/places/")) return "places";
  if (path === "/works" || path.startsWith("/works/")) return "works";
  if (path === "/events") return "events";
  if (path === "/impact") return "impact";
  if (path === "/about") return "about";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (/^\/posts\/[^/]+$/.test(path)) return "post";
  return "notFound";
}

/** 公開區塊名稱與路徑，供 breadcrumb、sitemap 與內部連結共用。 */
export const SECTION_LINKS = {
  home: { name: "首頁", path: "/" },
  places: { name: "逛地方", path: "/places" },
  works: { name: "學生作品", path: "/works" },
  events: { name: "活動現場", path: "/events" },
  impact: { name: "成果總覽", path: "/impact" },
  about: { name: "關於 I-LINK", path: "/about" },
} as const;

function sectionMetadata(
  section: Exclude<keyof typeof SECTION_LINKS, "home">,
  title: string,
  description: string,
): SeoMetadata {
  const link = SECTION_LINKS[section];
  return {
    title,
    description,
    path: link.path,
    jsonLd: [
      collectionPageJsonLd({ name: link.name, description, path: link.path }),
      breadcrumbJsonLd([SECTION_LINKS.home, link]),
    ],
  };
}

const staticRouteMetadata: Partial<Record<RouteKey, SeoMetadata>> = {
  home: {
    title: "I-LINK｜旗山、美濃、內門的地方文化與學習行動",
    description: DEFAULT_DESCRIPTION,
    path: "/",
    jsonLd: [organizationJsonLd(), websiteJsonLd()],
  },
  places: sectionMetadata(
    "places",
    "逛地方｜旗山、美濃、內門地方文化探索｜I-LINK",
    "從旗山老街與在地產業、美濃客家文化與藍染工藝，到內門宋江陣，探索高雄旗美地區的地方文化、產業與人物故事。",
  ),
  works: sectionMetadata(
    "works",
    "學生作品｜地方研究、工藝設計與 AI 應用成果｜I-LINK",
    "瀏覽學生以旗山、美濃、內門地方採集為素材完成的作品，涵蓋地方研究、工藝設計、產業紀錄、AI 應用與永續故事。",
  ),
  events: sectionMetadata(
    "events",
    "活動現場｜旗美內門走讀、工作坊與地方活動紀錄｜I-LINK",
    "依時間整理 I-LINK 在旗山、美濃、內門的走讀、產業分享、AI 課程、共創工作坊與成果發表等地方活動紀錄。",
  ),
  impact: sectionMetadata(
    "impact",
    "成果總覽｜I-LINK 地方文化行動成果",
    "以場域、活動內容與傳播主題，整理 I-LINK 在旗山、美濃、內門累積的地方文化與教育行動成果。",
  ),
  about: sectionMetadata(
    "about",
    "關於 I-LINK｜連結地方、學校與創作者的地方文化計畫",
    "I-LINK 與實踐大學高雄校區等合作單位，連結旗山、美濃、內門的地方場域、學生與創作者，透過田野踏查、地方採集與內容編輯推動地方文化傳播。",
  ),
  admin: {
    title: "I-LINK CMS 管理後台",
    description: "I-LINK 內容管理系統。",
    path: "/admin",
    robots: NOINDEX_ROBOTS,
  },
};

/** 固定頁面的 metadata；post 與 notFound 回傳 null，由頁面元件負責。 */
export function getStaticRouteMetadata(route: RouteKey): SeoMetadata | null {
  return staticRouteMetadata[route] ?? null;
}
