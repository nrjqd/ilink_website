/**
 * 前端 404 頁。SPA 由 Cloudflare Pages 以 200 回傳 index.html，無法送出真正的 HTTP 404；
 * 這裡至少設定 noindex 與明確標題，並不輸出任何 JSON-LD，避免被當成正常內容頁收錄。
 */

import { Seo } from "./SeoHead";
import { NOINDEX_ROBOTS } from "./seo";
import { SECTION_LINKS } from "./routes";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

type NotFoundPageProps = {
  currentPath: string;
  title?: string;
  message?: string;
};

export const NOT_FOUND_TITLE = "找不到頁面｜I-LINK";

export function NotFoundContent({ title = "找不到這個頁面", message }: Pick<NotFoundPageProps, "title" | "message">) {
  const links = [SECTION_LINKS.home, SECTION_LINKS.places, SECTION_LINKS.works, SECTION_LINKS.events];
  return (
    <section className="post-page__empty not-found" aria-labelledby="not-found-title">
      <h1 id="not-found-title">{title}</h1>
      <p>{message ?? "網址可能已變更，或內容已下架。可以從下面的入口繼續瀏覽。"}</p>
      <nav aria-label="繼續瀏覽">
        <ul className="not-found__links">
          {links.map((link) => (
            <li key={link.path}>
              <a href={link.path}>{link.name}</a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

export function NotFoundPage({ currentPath }: NotFoundPageProps) {
  return (
    <>
      <Seo
        title={NOT_FOUND_TITLE}
        description="找不到這個頁面，請回到 I-LINK 首頁繼續瀏覽旗山、美濃、內門的地方故事。"
        path={currentPath}
        robots={NOINDEX_ROBOTS}
      />
      <SiteHeader currentPath={currentPath} />
      <main className="post-page" id="main-content">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </>
  );
}
