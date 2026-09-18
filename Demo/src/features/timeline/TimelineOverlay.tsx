/**
 * 時間軸前端模組，呈現 I-LINK 空間敘事、3D 場景、進度與故事面板。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：時間軸浮層，顯示目前事件摘要與互動提示。

import { memo } from "react";
import type { TimelineChapter } from "./timeline.types";
import { SafeImage } from "../../shared/SafeMedia";

// 詳細註解：TimelineOverlayProps 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
interface TimelineOverlayProps {
  activeIndex: number;
  chapters: TimelineChapter[];
  showMobileMedia?: boolean;
}

// 詳細註解：TimelineOverlayComponent 是 React 元件，負責組合資料、互動狀態與畫面結構。
function TimelineOverlayComponent({ activeIndex, chapters, showMobileMedia = false }: TimelineOverlayProps) {
  return (
    <div className="timeline-overlay">
      {chapters.map((chapter, index) => (
        <article
          key={chapter.id}
          className={`chapter-copy ${index === activeIndex ? "is-active" : ""}`}
          aria-hidden={index !== activeIndex}
        >
          {showMobileMedia ? (
            <div className="chapter-copy__mobile-media" aria-hidden="true">
              {chapter.panels.map((panel) => (
                <figure key={panel.id}>
                  <SafeImage
                    src={panel.image}
                    alt=""
                    fallbackLabel={panel.image ? undefined : "尚未設定圖片"}
                    disableAutoCrossOrigin
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>{panel.label}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          <p>{chapter.eyebrow}</p>
          <span>{chapter.year}</span>
          <h2>{chapter.title}</h2>
          <strong>{chapter.location}</strong>
          <small>{chapter.description}</small>
        </article>
      ))}
    </div>
  );
}

export const TimelineOverlay = memo(TimelineOverlayComponent);
