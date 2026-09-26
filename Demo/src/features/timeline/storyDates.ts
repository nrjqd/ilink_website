import type { TimelineChapter } from "./timeline.types";

/** 2025-03-17 → 2025.03.17；沒有日期時回傳空字串。 */
export function formatStoryDate(date: string) {
  return date ? date.replace(/-/g, ".") : "";
}

/** 依 event_date 由新到舊；沒有日期的放最後並維持原順序。 */
export function sortByNewest(chapters: TimelineChapter[]) {
  return [...chapters].sort((left, right) => {
    if (!left.date && !right.date) return 0;
    if (!left.date) return 1;
    if (!right.date) return -1;
    return right.date.localeCompare(left.date);
  });
}
