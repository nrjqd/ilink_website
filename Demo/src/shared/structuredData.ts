/**
 * schema.org 結構化資料建構器。
 *
 * 只使用網站或 CMS 真正存在的資料；缺少的欄位直接省略，不補假資料
 * （例如文章沒有個人作者時，author 使用發布單位 I-LINK）。
 */

import { DEFAULT_DESCRIPTION, SITE_LOGO, SITE_NAME, SITE_URL, absoluteSiteUrl, type JsonLdNode } from "./seo";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function organizationJsonLd(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: {
      "@type": "ImageObject",
      url: SITE_LOGO,
    },
    description: DEFAULT_DESCRIPTION,
    areaServed: ["旗山", "美濃", "內門"].map((name) => ({ "@type": "Place", name })),
  };
}

export function websiteJsonLd(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: "I-LINK 旗美內門地方內容平台",
    url: `${SITE_URL}/`,
    inLanguage: "zh-Hant-TW",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteSiteUrl(item.path),
    })),
  };
}

export function collectionPageJsonLd(options: { name: string; description: string; path: string }): JsonLdNode {
  return {
    "@type": "CollectionPage",
    name: options.name,
    description: options.description,
    url: absoluteSiteUrl(options.path),
    inLanguage: "zh-Hant-TW",
    isPartOf: { "@id": WEBSITE_ID },
  };
}

export type ArticleJsonLdInput = {
  headline: string;
  description: string;
  path: string;
  images: string[];
  datePublished?: string | null;
  dateModified?: string | null;
  section?: string | null;
  keywords?: string[];
  locationName?: string | null;
};

export function articleJsonLd(input: ArticleJsonLdInput): JsonLdNode {
  const url = absoluteSiteUrl(input.path);
  const keywords = (input.keywords ?? []).filter(Boolean);
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.headline.slice(0, 110),
    description: input.description,
    ...(input.images.length > 0 ? { image: input.images } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified || input.datePublished ? { dateModified: input.dateModified || input.datePublished } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
    ...(keywords.length > 0 ? { keywords: keywords.join(", ") } : {}),
    ...(input.locationName ? { contentLocation: { "@type": "Place", name: input.locationName } } : {}),
    inLanguage: "zh-Hant-TW",
    // CMS 沒有個人作者欄位，作者與發布者都使用網站營運單位，不虛構個人。
    author: { "@id": ORGANIZATION_ID, "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
    publisher: {
      "@id": ORGANIZATION_ID,
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: SITE_LOGO },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@id": WEBSITE_ID },
  };
}
