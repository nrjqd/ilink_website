import type {
  TimelineChapter,
  TimelinePanel,
  Vec3,
} from "./timeline.types";
import { resolveMediaUrl } from "../../shared/media";

export type TimelineEvent = {
  id: number;
  slug: string;
  dateCode: string;
  dateLabel: string;
  eventDate?: string;
  title: string;
  description?: string;
  content?: string;
  location: string;
  theme?: string;
  images: Array<{
    src: string;
    label: string;
    alt?: string;
  }>;
};

function panelPosition(
  eventIndex: number,
  imageIndex: number,
): Vec3 {
  const x = eventIndex * 3.25;
  const offsets: Vec3[] = [
    [0, 0.8, 0],
    [1.05, -0.58, -1.1],
    [-0.95, -0.68, -1.65],
    [1.65, 0.72, -2.25],
    [-1.55, 0.56, -2.75],
    [0.25, -1.0, -3.15],
  ];
  const offset =
    offsets[imageIndex % offsets.length];

  return [x + offset[0], offset[1], offset[2]];
}

function panelRotation(imageIndex: number): Vec3 {
  const rotations: Vec3[] = [
    [0, -0.12, -0.03],
    [0, 0.18, 0.04],
    [0, -0.22, 0.05],
    [0, 0.14, -0.05],
    [0, -0.16, 0.03],
    [0, 0.2, -0.04],
  ];

  return rotations[imageIndex % rotations.length];
}

function createPanels(
  event: TimelineEvent,
  eventIndex: number,
): TimelinePanel[] {
  const images = event.images.length > 0
    ? event.images
    : [{
        src: "",
        label: "尚未設定圖片",
        alt: `${event.dateLabel} ${event.title}`,
      }];

  return images.map((image, imageIndex) => ({
    id: `${event.dateCode}-${imageIndex + 1}`,
    image: resolveMediaUrl(image.src),
    alt: image.alt ?? `${event.dateLabel} ${event.title}`,
    label: image.label,
    position: panelPosition(eventIndex, imageIndex),
    rotation: panelRotation(imageIndex),
    scale: imageIndex === 0 ? 1.08 : 0.92,
  }));
}

export function createTimelineChapters(
  events: TimelineEvent[],
): TimelineChapter[] {
  return events.map((event, eventIndex) => {
    const x = eventIndex * 3.25;
    const panels = createPanels(event, eventIndex);
    const theme = event.theme ?? "Timeline";
    const description =
      event.description ??
      `${event.dateLabel} ${event.title}`;
    const story = event.content
      ?.split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean) ?? [];

    return {
      id: `event-${event.id ?? event.dateCode}`,
      postId: event.id,
      slug: event.slug,
      index: eventIndex + 1,
      year: event.dateLabel,
      date: event.eventDate ?? "",
      eyebrow: theme,
      title: event.title,
      description,
      content: event.content ?? "",
      location: event.location,
      lead: description,
      story,
      detailImage: panels[0].image,
      detailAlt: panels[0].alt,
      palette: ["#d0b947", "#35444c", "#e4d5cc"],
      facts: [
        { label: "Date", value: event.dateLabel },
        { label: "Location", value: event.location },
        {
          label: "Media",
          value: event.images.length > 0 ? `${event.images.length} images` : "No image",
        },
      ],
      camera: {
        position: [x, 0.12, 8],
        target: [x, 0, -0.4],
      },
      panels,
    };
  });
}
