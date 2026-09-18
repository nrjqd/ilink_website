/**
 * 時間軸前端模組，呈現 I-LINK 空間敘事、3D 場景、進度與故事面板。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：時間軸進度列，將目前捲動位置轉成視覺進度。

import { memo } from "react";
import type { TimelineChapter } from "./timeline.types";

// 詳細註解：TimelineProgressProps 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
interface TimelineProgressProps {
  progress: number;
  activeIndex: number;
  chapters: TimelineChapter[];
}

// 詳細註解：TimelineProgressComponent 是 React 元件，負責組合資料、互動狀態與畫面結構。
function TimelineProgressComponent({ progress, activeIndex, chapters }: TimelineProgressProps) {
  return (
    <aside className="timeline-progress" aria-label="Timeline progress">
      <div className="timeline-progress__count">
        <span>{String(activeIndex + 1).padStart(2, "0")}</span>
        <small>/ {String(chapters.length).padStart(2, "0")}</small>
      </div>
      <div className="timeline-progress__bar">
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <ol>
        {chapters.map((chapter, index) => (
          <li key={chapter.id} className={index === activeIndex ? "is-active" : ""}>
            <span>{String(chapter.index).padStart(2, "0")}</span>
            <b>{chapter.year}</b>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export const TimelineProgress = memo(TimelineProgressComponent);
