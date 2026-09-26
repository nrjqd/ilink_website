/**
 * SPA 的統一 SEO 管理：所有 <head> metadata（title、description、canonical、Open Graph、
 * Twitter Card、robots、JSON-LD）都只能經由 updateSeo 寫入，避免各頁面自行操作 document.head
 * 造成重複 tag、路由切換後殘留舊 canonical / JSON-LD / noindex。
 */

const PRODUCTION_SITE_URL = "https://usckh.com";

const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim().replace(/\/+$/, "") || PRODUCTION_SITE_URL;

// canonical 一律指向正式網域；即使環境變數被設成預覽網域（pages.dev）也不會外洩到 canonical。
export const SITE_URL = configuredSiteUrl === PRODUCTION_SITE_URL ? configuredSiteUrl : PRODUCTION_SITE_URL;
export const SITE_NAME = "I-LINK";
export const SITE_LOCALE = "zh_TW";
export const DEFAULT_DESCRIPTION =
  "I-LINK 走進高雄旗山、美濃、內門，整理地方故事、學生作品、活動現場與成果，記錄地方文化、產業與教育行動。";
export const DEFAULT_OG_IMAGE =
  "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/assets/img/1020/1020iLink%E7%BE%8E%E6%BF%83%E8%97%8D%E6%9F%93%E6%96%87%E5%89%B5%E8%A8%AD%E8%A8%88%E5%B7%A5%E5%9D%8A_001.webp";
export const DEFAULT_OG_IMAGE_ALT = "I-LINK 美濃藍染文創設計工坊現場";
export const SITE_LOGO =
  "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/branding/favicon/i-link-logo-header-small.png";


export type JsonLdNode = Record<string, unknown>;

export type SeoMetadata = {
  title: string;
  description: string;
  /** 站內路徑；query string 與 hash 會被移除，避免篩選參數產生重複 canonical。 */
  path: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
  robots?: string;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  /** 一或多個 schema.org 節點，輸出為單一 @graph，路由切換時整段取代。 */
  jsonLd?: JsonLdNode | JsonLdNode[] | null;
};

export const INDEXABLE_ROBOTS = "index,follow,max-image-preview:large";
export const NOINDEX_ROBOTS = "noindex,nofollow";

function normalizePath(path: string) {
  const [pathname] = path.split(/[?#]/);
  const normalized = (pathname && pathname.startsWith("/") ? pathname : `/${pathname || ""}`).replace(/\/{2,}/g, "/");
  if (normalized === "/") return "/";
  return normalized.replace(/\/+$/, "");
}

export function absoluteSiteUrl(path: string) {
  const normalizedPath = normalizePath(path);
  return normalizedPath === "/" ? `${SITE_URL}/` : `${SITE_URL}${normalizedPath}`;
}

/** 組合頁面 title；已含品牌名稱時不重複加後綴。 */
export function formatPageTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return SITE_NAME;
  return trimmed.includes(SITE_NAME) ? trimmed : `${trimmed}｜${SITE_NAME}`;
}

type MetaKey = { attribute: "name" | "property"; key: string };

function setMeta({ attribute, key }: MetaKey, content: string | null | undefined) {
  const selector = `meta[${attribute}='${key}']`;
  const elements = Array.from(document.head.querySelectorAll<HTMLMetaElement>(selector));
  if (!content) {
    elements.forEach((element) => element.remove());
    return;
  }
  let element = elements[0];
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  elements.slice(1).forEach((duplicate) => duplicate.remove());
  element.content = content;
}

function setCanonical(href: string) {
  const canonicals = Array.from(document.head.querySelectorAll<HTMLLinkElement>("link[rel='canonical']"));
  let canonical = canonicals[0];
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonicals.slice(1).forEach((duplicate) => duplicate.remove());
  canonical.href = href;
}

const JSON_LD_ID = "seo-jsonld";

function setJsonLd(jsonLd: SeoMetadata["jsonLd"]) {
  // 移除任何非本模組建立的 JSON-LD，確保同一時間只有一份結構化資料。
  document.head
    .querySelectorAll<HTMLScriptElement>("script[type='application/ld+json']")
    .forEach((script) => {
      if (script.id !== JSON_LD_ID) script.remove();
    });

  const existing = document.getElementById(JSON_LD_ID);
  const nodes = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  if (nodes.length === 0) {
    existing?.remove();
    return;
  }

  const script = (existing ?? document.createElement("script")) as HTMLScriptElement;
  script.id = JSON_LD_ID;
  script.type = "application/ld+json";
  // 轉義 "<"，避免 CMS 文字中的 </script> 提前結束標籤。
  script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
  if (!existing) document.head.appendChild(script);
}

export function updateSeo(metadata: SeoMetadata) {
  const canonical = absoluteSiteUrl(metadata.path);
  const type = metadata.type ?? "website";
  const image = metadata.image || DEFAULT_OG_IMAGE;
  const imageAlt = metadata.image ? metadata.imageAlt || metadata.title : DEFAULT_OG_IMAGE_ALT;
  const isArticle = type === "article";

  document.title = metadata.title;
  setMeta({ attribute: "name", key: "description" }, metadata.description);
  setMeta({ attribute: "name", key: "robots" }, metadata.robots ?? INDEXABLE_ROBOTS);
  setCanonical(canonical);

  setMeta({ attribute: "property", key: "og:site_name" }, SITE_NAME);
  setMeta({ attribute: "property", key: "og:locale" }, SITE_LOCALE);
  setMeta({ attribute: "property", key: "og:type" }, type);
  setMeta({ attribute: "property", key: "og:title" }, metadata.title);
  setMeta({ attribute: "property", key: "og:description" }, metadata.description);
  setMeta({ attribute: "property", key: "og:url" }, canonical);
  setMeta({ attribute: "property", key: "og:image" }, image);
  setMeta({ attribute: "property", key: "og:image:alt" }, imageAlt);
  setMeta({ attribute: "property", key: "article:published_time" }, isArticle ? metadata.publishedTime : null);
  setMeta({ attribute: "property", key: "article:modified_time" }, isArticle ? metadata.modifiedTime : null);

  setMeta({ attribute: "name", key: "twitter:card" }, "summary_large_image");
  setMeta({ attribute: "name", key: "twitter:title" }, metadata.title);
  setMeta({ attribute: "name", key: "twitter:description" }, metadata.description);
  setMeta({ attribute: "name", key: "twitter:image" }, image);
  setMeta({ attribute: "name", key: "twitter:image:alt" }, imageAlt);

  setJsonLd(metadata.jsonLd ?? null);
}
