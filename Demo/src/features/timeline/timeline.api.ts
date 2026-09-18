import type { TimelineEvent } from "./timeline.data";
import { getPostDisplayImage, getPostDisplayMedia } from "../../shared/media";
import { apiBaseUrl } from "../../shared/api";

type MediaDto = {
  original_filename?: string | null;
  original_url?: string | null;
  large_url?: string | null;
  thumbnail_url?: string | null;
};

type PostGalleryDto = {
  sort_order?: number;
  caption?: string | null;
  media: MediaDto;
};

type TimelinePostDto = {
  id: number;
  slug: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  region?: string | null;
  category?: string | null;
  event_date?: string | null;
  cover_media?: MediaDto | null;
  gallery_links?: PostGalleryDto[];
};

type PostsResponseDto = {
  items: TimelinePostDto[];
};

function dateLabel(value: string | null | undefined) {
  if (!value) return "";
  const [, month, day] = value.split("-");
  return month && day ? `${month}/${day}` : value;
}

function dateCode(value: string | null | undefined, fallbackId: number) {
  if (!value) return String(fallbackId);
  const [, month, day] = value.split("-");
  return month && day ? `${month}${day}` : value.replace(/\D/g, "") || String(fallbackId);
}

function postImages(post: TimelinePostDto) {
  const images: TimelineEvent["images"] = [];
  const media = getPostDisplayMedia(post) as MediaDto | null;
  const imageUrl = getPostDisplayImage(post);

  if (imageUrl) {
    images.push({
      src: imageUrl,
      label: media?.original_filename || post.title,
      alt: media?.original_filename || post.title,
    });
  }

  return images;
}

function postToTimelineEvent(post: TimelinePostDto): TimelineEvent {
  return {
    id: post.id,
    dateCode: dateCode(post.event_date, post.id),
    dateLabel: dateLabel(post.event_date),
    title: post.title,
    description: post.summary ?? undefined,
    content: post.content ?? undefined,
    location: post.region ?? post.category ?? "",
    theme: post.category ?? "",
    images: postImages(post),
  };
}

export async function fetchTimelineEvents(signal?: AbortSignal): Promise<TimelineEvent[]> {
  const response = await fetch(`${apiBaseUrl}/posts?timeline=true&status=published&limit=100`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Timeline posts API failed with ${response.status}`);
  }

  const payload = (await response.json()) as PostsResponseDto;
  return payload.items.map(postToTimelineEvent);
}
