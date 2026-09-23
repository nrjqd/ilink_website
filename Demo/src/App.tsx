/**
 * React 單頁應用入口殼層。
 *
 * 這裡只負責路由分派、lazy loading 與基礎 SEO metadata。實際頁面文字、
 * 圖片與列表內容由 CMS API 提供，避免前端保存本地業務資料。
 */

import { Suspense, lazy, useEffect, useState } from "react";
import { updateSeo, type SeoMetadata } from "./shared/seo";

const AdminTimelinePage = lazy(() =>
  import("./features/admin/AdminTimelinePage").then((module) => ({ default: module.AdminTimelinePage })),
);
const AboutPage = lazy(() => import("./features/pages/ContentPages").then((module) => ({ default: module.AboutPage })));
const EventsPage = lazy(() => import("./features/pages/ContentPages").then((module) => ({ default: module.EventsPage })));
const ImpactPage = lazy(() => import("./features/pages/ContentPages").then((module) => ({ default: module.ImpactPage })));
const PlacesPage = lazy(() => import("./features/pages/ContentPages").then((module) => ({ default: module.PlacesPage })));
const WorksPage = lazy(() => import("./features/pages/ContentPages").then((module) => ({ default: module.WorksPage })));
const TimelinePage = lazy(() =>
  import("./features/timeline/TimelinePage").then((module) => ({ default: module.TimelinePage })),
);
const PostPage = lazy(() => import("./features/posts/PostPage").then((module) => ({ default: module.PostPage })));

const pageMetadata: Record<string, SeoMetadata> = {
  "/": {
    title: "I-LINK｜旗美內門地方故事與成果平台",
    description: "看見旗山、美濃、內門的地方故事、學生作品、活動現場與年度成果。",
    path: "/",
  },
  "/places": {
    title: "逛地方｜旗山、美濃、內門地方探索",
    description: "從旗山老街、美濃藍染到內門宋江陣，探索 I-LINK 年度場域的文化、產業與人物故事。",
    path: "/places",
  },
  "/works": {
    title: "學生作品｜I-LINK 影像、設計、AI 與網站成果",
    description: "收錄學生以地方採集資料完成的影像、文創設計、AI 電子書與永續網站作品。",
    path: "/works",
  },
  "/events": {
    title: "活動現場｜I-LINK 年度走讀與工作坊紀錄",
    description: "用時間軸整理 I-LINK 的走讀、產業分享、AI 課程、共創工作坊與成果發布。",
    path: "/events",
  },
  "/impact": {
    title: "成果總覽｜I-LINK 年度成果與影響",
    description: "以數據、案例與內容主題整理 I-LINK 如何把地方活動轉成可持續傳播的文化成果。",
    path: "/impact",
  },
  "/about": {
    title: "關於 I-LINK｜地方文化內容共創計畫",
    description: "認識 I-LINK 如何連結地方、教育、創作與 AI 工具，推動旗美內門地方內容共創。",
    path: "/about",
  },
  "/admin": {
    title: "I-LINK CMS 管理後台",
    description: "管理 I-LINK CMS 總覽、時間軸、媒體素材與操作紀錄。",
    path: "/admin",
    robots: "noindex,nofollow",
  },
};

function getCurrentPath() {
  return window.location.pathname === "" ? "/" : window.location.pathname;
}

function getMetadata(path: string): SeoMetadata {
  if (path.startsWith("/places/")) return pageMetadata["/places"];
  if (path.startsWith("/works/")) return pageMetadata["/works"];
  if (path.startsWith("/admin/")) return { ...pageMetadata["/admin"], path };
  if (path.startsWith("/posts/")) return { ...pageMetadata["/works"], path, type: "article" };
  return pageMetadata[path] ?? pageMetadata["/"];
}

export function App() {
  const [path, setPath] = useState(getCurrentPath);

  useEffect(() => {
    const metadata = getMetadata(path);
    updateSeo(metadata);
  }, [path]);

  useEffect(() => {
    function onPopState() {
      setPath(getCurrentPath());
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='/']");
      if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const nextUrl = new URL(link.href);
      if (nextUrl.origin !== window.location.origin) return;
      event.preventDefault();
      window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      setPath(getCurrentPath());
      if (nextUrl.hash) {
        window.requestAnimationFrame(() => document.querySelector(nextUrl.hash)?.scrollIntoView());
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }

    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {path === "/places" || path.startsWith("/places/") ? (
        <PlacesPage currentPath="/places" />
      ) : path === "/works" || path.startsWith("/works/") ? (
        <WorksPage currentPath="/works" />
      ) : path === "/events" ? (
        <EventsPage currentPath={path} />
      ) : path === "/impact" ? (
        <ImpactPage currentPath={path} />
      ) : path === "/about" ? (
        <AboutPage currentPath={path} />
      ) : path === "/admin" || path.startsWith("/admin/") ? (
        <AdminTimelinePage currentPath={path} />
      ) : path.startsWith("/posts/") ? (
        <PostPage currentPath={path} />
      ) : (
        <TimelinePage currentPath="/" />
      )}
    </Suspense>
  );
}
