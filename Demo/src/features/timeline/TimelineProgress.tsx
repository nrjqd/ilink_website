/**
 * 時間軸前端模組，呈現 I-LINK 空間敘事、3D 場景、進度與故事面板。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：時間軸進度列，將目前捲動位置轉成視覺進度；點擊章節會捲到該章節在 pin 區段中的位置。

import { memo } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { TimelineChapter } from "./timeline.types";
import { scrollToPageY } from "./hooks/useSmoothScroll";

// 詳細註解：TimelineProgressProps 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
interface TimelineProgressProps {
  progress: number;
  activeIndex: number;
  chapters: TimelineChapter[];
}

// 與 useTimelineAnimation 的 TIMELINE_TRIGGER_ID 相同；label 在每段的 0–0.68 之間完整顯示，取 0.35 落在中間。
function scrollToChapter(index: number, count: number) {
  const trigger = ScrollTrigger.getById("timeline-story");
  if (!trigger || count === 0) return;
  const target = trigger.start + ((index + 0.35) / count) * (trigger.end - trigger.start);
  scrollToPageY(target);
}

// 詳細註解：TimelineProgressComponent 是 React 元件，負責組合資料、互動狀態與畫面結構。
function TimelineProgressComponent({ progress, activeIndex, chapters }: TimelineProgressProps) {
  return (
    <nav className="timeline-progress" aria-label="時間軸章節">
      <div className="timeline-progress__count" aria-live="polite">
        <span>{String(activeIndex + 1).padStart(2, "0")}</span>
        <small>/ {String(chapters.length).padStart(2, "0")}</small>
      </div>
      <div className="timeline-progress__bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <ol data-lenis-prevent>
        {chapters.map((chapter, index) => (
          <li key={chapter.id} className={index === activeIndex ? "is-active" : ""}>
            <button
              type="button"
              aria-current={index === activeIndex ? "step" : undefined}
              aria-label={`第 ${index + 1} 則：${chapter.title}`}
              onClick={() => scrollToChapter(index, chapters.length)}
            >
              <span>{String(chapter.index).padStart(2, "0")}</span>
              <b>{chapter.year}</b>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const TimelineProgress = memo(TimelineProgressComponent);
