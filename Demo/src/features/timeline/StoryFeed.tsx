/**
 * Mobile / Tablet 首頁「最新故事」。
 *
 * 資料與桌機時間軸相同（TimelineChapter[]），只取最新 6 則。
 * Mobile 以 CSS scroll-snap 橫向滑動、Tablet 為兩欄；不使用 JS drag。
 */

import type { TimelineChapter } from "./timeline.types";
import { SafeImage } from "../../shared/SafeMedia";
import { formatStoryDate, sortByNewest } from "./storyDates";

interface StoryFeedProps {
  chapters: TimelineChapter[];
  limit?: number;
}

export function StoryFeed({ chapters, limit = 6 }: StoryFeedProps) {
  const stories = sortByNewest(chapters).slice(0, limit);

  if (stories.length === 0) return null;

  return (
    <ul className="story-feed" aria-label="最新故事">
      {stories.map((chapter, index) => (
        <li key={chapter.id} className="story-feed__item">
          <a className="story-card" href={`/posts/${encodeURIComponent(chapter.slug)}`}>
            <SafeImage
              ratio="poster"
              frameClassName="story-card__media"
              src={chapter.panels[0]?.image}
              alt=""
              fallbackLabel="尚未設定圖片"
              loading={index < 2 ? "eager" : "lazy"}
              decoding="async"
            />
            <span className="story-card__body">
              <span className="story-card__meta">
                {chapter.date ? <time dateTime={chapter.date}>{formatStoryDate(chapter.date)}</time> : null}
                {chapter.location ? <span>{chapter.location}</span> : null}
                {chapter.eyebrow ? <span>{chapter.eyebrow}</span> : null}
              </span>
              <strong className="story-card__title">{chapter.title}</strong>
              <span className="story-card__cta" aria-hidden="true">
                閱讀故事 →
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
