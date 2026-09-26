/**
 * 時間軸前端模組，呈現 I-LINK 空間敘事、3D 場景、進度與故事面板。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：桌機沉浸式時間軸浮層，只顯示目前章節（其餘章節視覺上透明，因此 aria-hidden）。
// Mobile / Tablet 改用 StoryFeed + TimelineRail，不再渲染這個元件。

import { memo } from "react";
import type { TimelineChapter } from "./timeline.types";
import { formatStoryDate } from "./storyDates";

// 詳細註解：TimelineOverlayProps 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
interface TimelineOverlayProps {
  activeIndex: number;
  chapters: TimelineChapter[];
}

// 詳細註解：TimelineOverlayComponent 是 React 元件，負責組合資料、互動狀態與畫面結構。
function TimelineOverlayComponent({ activeIndex, chapters }: TimelineOverlayProps) {
  return (
    <div className="timeline-overlay">
      {chapters.map((chapter, index) => (
        <article
          key={chapter.id}
          className={`chapter-copy ${index === activeIndex ? "is-active" : ""}`}
          aria-hidden={index !== activeIndex}
        >
          <div className="chapter-copy__meta">
            <span className="chapter-copy__count">
              {String(index + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}
            </span>
            <span className="chapter-copy__date">{chapter.date ? formatStoryDate(chapter.date) : chapter.year}</span>
            {chapter.eyebrow ? <p>{chapter.eyebrow}</p> : null}
          </div>
          <h2>{chapter.title}</h2>
          <strong>{chapter.location}</strong>
          <small>{chapter.description}</small>
          <a
            className="chapter-copy__link"
            href={`/posts/${encodeURIComponent(chapter.slug)}`}
            tabIndex={index === activeIndex ? undefined : -1}
          >
            閱讀完整文章 →
          </a>
        </article>
      ))}
    </div>
  );
}

export const TimelineOverlay = memo(TimelineOverlayComponent);
