import type { PostCategory, PostRegion } from "./contentLabels";
import { apiBaseUrl } from "./api";

export type MediaItem = {
  id: number;
  original_filename?: string | null;
  original_url?: string;
  large_url?: string;
  thumbnail_url?: string;
};

export type PostGalleryItem = {
  id: number;
  post_id: number;
  media_id: number;
  sort_order: number;
  caption: string | null;
  media: MediaItem | null;
  created_at: string;
};

export type PostListItem = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  cover_media: MediaItem | null;
  gallery_links: PostGalleryItem[];
  category: PostCategory | string | null;
  region: PostRegion | string | null;
  event_date: string | null;
  status: string;
  published_at: string | null;
};

export type PaginatedPosts = {
  items: PostListItem[];
  page: number;
  limit: number;
  total: number;
};

export type PostsQueryParams = Record<string, string | number | boolean | null | undefined>;

function buildPostsUrl(params: PostsQueryParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.set(key, String(value));
    }
  });
  return `${apiBaseUrl}/posts?${searchParams.toString()}`;
}

export async function fetchPaginatedPosts(params: PostsQueryParams, signal?: AbortSignal): Promise<PaginatedPosts> {
  const response = await fetch(buildPostsUrl(params), {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Posts API failed with ${response.status}`);
  }
  return (await response.json()) as PaginatedPosts;
}

export async function fetchPosts(params: PostsQueryParams, signal?: AbortSignal): Promise<PostListItem[]> {
  const payload = await fetchPaginatedPosts(params, signal);
  return payload.items;
}
