const rawR2PublicBaseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL?.trim();

if (!rawR2PublicBaseUrl) {
  throw new Error("VITE_R2_PUBLIC_BASE_URL is required.");
}

const r2PublicBaseUrl = rawR2PublicBaseUrl.replace(/\/$/, "");

function r2UrlFromObjectKey(key: string): string {
  const objectKey = key.trim().replace(/^\/+/, "");
  if (!objectKey || !r2PublicBaseUrl) return "";
  return `${r2PublicBaseUrl}/${objectKey}`;
}

export function resolveStaticAssetUrl(src: string | null | undefined): string {
  const value = src?.trim() ?? "";
  if (!value) return "";
  if (/^(https?:|data:|blob:)/.test(value)) return value;
  return r2UrlFromObjectKey(value);
}

export function resolveMediaUrl(src: string | null | undefined): string {
  const value = src?.trim() ?? "";
  if (!value) return "";
  if (/^(https?:|data:|blob:)/.test(value)) return value;
  if (value.startsWith("/uploads/")) {
    return r2UrlFromObjectKey(value.replace(/^\/uploads\/+/, ""));
  }
  return r2UrlFromObjectKey(value);
}

export type PostDisplayMedia = {
  original_url?: string | null;
  large_url?: string | null;
  thumbnail_url?: string | null;
};

export type PostDisplayGalleryLink = {
  sort_order?: number | null;
  media?: PostDisplayMedia | null;
};

export type PostDisplayImageSource = {
  cover_media?: PostDisplayMedia | null;
  gallery_links?: PostDisplayGalleryLink[] | null;
};

export function getMediaDisplayImage(media: PostDisplayMedia | null | undefined): string {
  return resolveMediaUrl(
    media?.thumbnail_url ||
      media?.large_url ||
      media?.original_url ||
      "",
  );
}

export function getPostDisplayMedia(post: PostDisplayImageSource): PostDisplayMedia | null {
  if (post.cover_media) return post.cover_media;

  const firstGalleryLink = [...(post.gallery_links ?? [])]
    .filter((link) => link.media)
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))[0];

  return firstGalleryLink?.media ?? null;
}

export function getPostDisplayImage(post: PostDisplayImageSource): string {
  return getMediaDisplayImage(getPostDisplayMedia(post));
}
