/**
 * React 單頁應用入口殼層。
 *
 * 這裡只負責路由分派、lazy loading 與固定頁 SEO metadata。實際頁面文字、
 * 圖片與列表內容由 CMS API 提供，避免前端保存本地業務資料。
 * 文章頁與 404 由頁面元件自行渲染 <Seo>，App 不在這些路由輸出 metadata，
 * 避免父子 effect 順序互相覆蓋。
 */

import { Suspense, lazy, useEffect, useState } from "react";
import { Seo } from "./shared/SeoHead";
import { getStaticRouteMetadata, resolveRoute } from "./shared/routes";

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
const NotFoundPage = lazy(() => import("./shared/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

function getCurrentPath() {
  return window.location.pathname === "" ? "/" : window.location.pathname;
}

export function App() {
  const [path, setPath] = useState(getCurrentPath);
  const route = resolveRoute(path);
  const routeMetadata = getStaticRouteMetadata(route);

  useEffect(() => {
    function onPopState() {
      setPath(getCurrentPath());
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='/']");
      if (!link || link.target || link.hasAttribute("download") || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
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
    <>
      {routeMetadata ? <Seo {...routeMetadata} /> : null}
      <Suspense fallback={null}>
        {route === "places" ? (
          <PlacesPage currentPath="/places" />
        ) : route === "works" ? (
          <WorksPage currentPath="/works" />
        ) : route === "events" ? (
          <EventsPage currentPath="/events" />
        ) : route === "impact" ? (
          <ImpactPage currentPath="/impact" />
        ) : route === "about" ? (
          <AboutPage currentPath="/about" />
        ) : route === "admin" ? (
          <AdminTimelinePage currentPath={path} />
        ) : route === "post" ? (
          <PostPage currentPath={path} />
        ) : route === "home" ? (
          <TimelinePage currentPath="/" />
        ) : (
          <NotFoundPage currentPath={path} />
        )}
      </Suspense>
    </>
  );
}
