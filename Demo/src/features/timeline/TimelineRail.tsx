/**
 * Mobile / Tablet 年度時間軸（取代手機上的 WebGL 時間軸、overlay 列表與 chapter grid）。
 *
 * 資料已由 TimelinePage 取得；這裡只控制 render 數量：先顯示 initialCount 則，
 * 「顯示其餘 N 則」後渲染全部，不另外發 API。
 */

import { useState } from "react";
import type { TimelineChapter } from "./timeline.types";
import { SafeImage } from "../../shared/SafeMedia";

interface TimelineRailProps {
  chapters: TimelineChapter[];
  initialCount?: number;
}

function splitDate(date: string) {
  const [year = "", month = "", day = ""] = date.split("-");
  return { year, monthDay: month && day ? `${month}.${day}` : "" };
}

export function TimelineRail({ chapters, initialCount = 8 }: TimelineRailProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? chapters : chapters.slice(0, initialCount);
  const remaining = chapters.length - visible.length;

  return (
    <div className="timeline-rail">
      <ol className="timeline-rail__list" id="timeline-rail-list">
        {visible.map((chapter, index) => {
          const { year, monthDay } = splitDate(chapter.date);
          const previousYear = index > 0 ? splitDate(visible[index - 1].date).year : "";

          return (
            <li key={chapter.id} className="timeline-rail__item">
              {year && year !== previousYear ? <span className="timeline-rail__year">{year}</span> : null}
              <a className="timeline-rail__link" href={`/posts/${encodeURIComponent(chapter.slug)}`}>
                <span className="timeline-rail__date">
                  {chapter.date ? (
                    <time dateTime={chapter.date}>
                      <b>{monthDay || chapter.year}</b>
                      <small>{year}</small>
                    </time>
                  ) : (
                    <b>{chapter.year}</b>
                  )}
                </span>
                <span className="timeline-rail__dot" aria-hidden="true" />
                <span className="timeline-rail__card">
                  <SafeImage
                    ratio="poster"
                    frameClassName="timeline-rail__thumb"
                    src={chapter.panels[0]?.image}
                    alt=""
                    fallbackLabel="無圖片"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="timeline-rail__copy">
                    <strong>{chapter.title}</strong>
                    <span className="timeline-rail__tags">
                      {chapter.location ? <span>{chapter.location}</span> : null}
                      {chapter.eyebrow ? <span>{chapter.eyebrow}</span> : null}
                    </span>
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {remaining > 0 ? (
        <button
          type="button"
          className="button button--secondary timeline-rail__more"
          aria-controls="timeline-rail-list"
          aria-expanded={expanded}
          onClick={() => setExpanded(true)}
        >
          顯示其餘 {remaining} 則
        </button>
      ) : null}
    </div>
  );
}
