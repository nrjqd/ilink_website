import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_SITE_URL = "https://usckh.com";
const STATIC_ROUTES = ["/", "/places", "/works", "/events", "/impact", "/about"];

function loadLocalEnv(name) {
  try {
    const file = readFileSync(resolve(process.cwd(), name), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    // Local env files are optional for CI/Cloudflare Pages builds.
  }
}

loadLocalEnv(".env.local");
loadLocalEnv(".env.docker");
loadLocalEnv(".env.docker.example");

const siteUrl = (process.env.VITE_SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, "");
const apiBaseUrl = (process.env.SITEMAP_POSTS_API_URL || process.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

function absoluteUrl(path) {
  return path === "/" ? `${siteUrl}/` : `${siteUrl}${path}`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isValidSlug(slug) {
  return typeof slug === "string" && slug.trim() !== "" && !/[/?#\\\s]/.test(slug);
}

async function fetchPublishedPosts() {
  if (!apiBaseUrl) return [];

  const posts = [];
  const limit = 100;
  let page = 1;
  let total = 0;

  do {
    const url = new URL(`${apiBaseUrl}/posts`);
    url.searchParams.set("status", "published");
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Posts API returned ${response.status}`);

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    total = Number(payload.total || items.length);
    posts.push(...items);

    if (items.length === 0) break;
    page += 1;
  } while (posts.length < total);

  return posts
    .filter((post) => post?.status === "published" && isValidSlug(post.slug))
    .map((post) => ({
      loc: absoluteUrl(`/posts/${encodeURIComponent(post.slug)}`),
      lastmod: post.updated_at || post.published_at || undefined,
    }));
}

function buildXml(urls) {
  const body = urls
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const staticUrls = STATIC_ROUTES.map((route) => ({ loc: absoluteUrl(route) }));
let postUrls = [];

try {
  postUrls = await fetchPublishedPosts();
  console.log(`Generated sitemap with ${postUrls.length} published CMS posts.`);
} catch (error) {
  console.warn(`Could not fetch CMS posts for sitemap: ${error instanceof Error ? error.message : String(error)}`);
  console.warn("Continuing with static public routes only.");
}

const seen = new Set();
const urls = [...staticUrls, ...postUrls].filter((entry) => {
  if (seen.has(entry.loc)) return false;
  seen.add(entry.loc);
  return true;
});

writeFileSync(resolve(process.cwd(), "public", "sitemap.xml"), buildXml(urls), "utf8");

