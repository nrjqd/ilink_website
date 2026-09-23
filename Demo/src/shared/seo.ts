const DEFAULT_SITE_URL = "https://usckh.com";

const rawSiteUrl = import.meta.env.VITE_SITE_URL?.trim() || DEFAULT_SITE_URL;

export const siteUrl = rawSiteUrl.replace(/\/+$/, "");

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
  const normalized = pathname && pathname.startsWith("/") ? pathname : `/${pathname || ""}`;
  if (normalized === "/") return "/";
  return normalized.replace(/\/+$/, "");
}

export function absoluteSiteUrl(path: string) {
  const normalizedPath = normalizePath(path);
  return normalizedPath === "/" ? `${siteUrl}/` : `${siteUrl}${normalizedPath}`;
}

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  let element = document.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertCanonical(href: string) {
  let canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
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

  const ogImage = document.querySelector<HTMLMetaElement>("meta[property='og:image']");
  if (metadata.image) {
    upsertMeta("meta[property='og:image']", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      return meta;
    }, metadata.image);
  } else {
    ogImage?.remove();
  }

  upsertCanonical(canonical);
  updateJsonLd(metadata.jsonLd ?? null);
}
