const DEFAULT_SITE_URL = "https://usckh.com";
const DEFAULT_OG_IMAGE =
  "https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev/assets/img/1020/1020iLink%E7%BE%8E%E6%BF%83%E8%97%8D%E6%9F%93%E6%96%87%E5%89%B5%E8%A8%AD%E8%A8%88%E5%B7%A5%E5%9D%8A_001.webp";

const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim().replace(/\/+$/, "") || DEFAULT_SITE_URL;

export const siteUrl = configuredSiteUrl === DEFAULT_SITE_URL ? configuredSiteUrl : DEFAULT_SITE_URL;

export type JsonLdValue = Record<string, unknown> | null;

export type SeoMetadata = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  robots?: string;
  jsonLd?: JsonLdValue;
};

function normalizePath(path: string) {
  const [pathname] = path.split(/[?#]/);
  const normalized = (pathname && pathname.startsWith("/") ? pathname : `/${pathname || ""}`).replace(/\/{2,}/g, "/");
  if (normalized === "/") return "/";
  return normalized.replace(/\/+$/, "");
}

export function absoluteSiteUrl(path: string) {
  const normalizedPath = normalizePath(path);
  return normalizedPath === "/" ? `${siteUrl}/` : `${siteUrl}${normalizedPath}`;
}

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  const elements = Array.from(document.querySelectorAll<HTMLMetaElement>(selector));
  let element = elements[0];
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  elements.slice(1).forEach((duplicate) => duplicate.remove());
  element.content = content;
}

function upsertCanonical(href: string) {
  const canonicals = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel='canonical']"));
  let canonical = canonicals[0];
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonicals.slice(1).forEach((duplicate) => duplicate.remove());
  canonical.href = href;
}

function updateJsonLd(jsonLd: JsonLdValue) {
  const id = "seo-jsonld";
  const existing = document.getElementById(id);
  if (!jsonLd) {
    existing?.remove();
    return;
  }

  const script = (existing ?? document.createElement("script")) as HTMLScriptElement;
  script.id = id;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(jsonLd);
  if (!existing) document.head.appendChild(script);
}

export function updateSeo(metadata: SeoMetadata) {
  const canonical = absoluteSiteUrl(metadata.path);
  const type = metadata.type ?? "website";

  document.title = metadata.title;
  upsertMeta("meta[name='description']", () => {
    const meta = document.createElement("meta");
    meta.name = "description";
    return meta;
  }, metadata.description);
  upsertMeta("meta[property='og:title']", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "og:title");
    return meta;
  }, metadata.title);
  upsertMeta("meta[property='og:description']", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "og:description");
    return meta;
  }, metadata.description);
  upsertMeta("meta[property='og:url']", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "og:url");
    return meta;
  }, canonical);
  upsertMeta("meta[property='og:type']", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "og:type");
    return meta;
  }, type);
  upsertMeta("meta[name='robots']", () => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    return meta;
  }, metadata.robots ?? "index,follow");

  upsertMeta("meta[property='og:image']", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "og:image");
    return meta;
  }, metadata.image ?? DEFAULT_OG_IMAGE);

  upsertCanonical(canonical);
  updateJsonLd(metadata.jsonLd ?? null);
}
