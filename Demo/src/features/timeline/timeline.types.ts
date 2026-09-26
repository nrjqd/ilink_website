/**
 * 時間軸前端模組，呈現 I-LINK 空間敘事、3D 場景、進度與故事面板。
 *
 * 維護重點：註解聚焦在模組責任、資料來源與副作用，讓元件和 API 呼叫的邊界保持清楚。
 */

// 中文註解：時間軸資料型別，統一事件、圖片與動畫狀態結構。

// 詳細註解：Vec3 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
export type Vec3 = [number, number, number];

export interface TimelinePanel {
  id: string;
  image: string;
  alt: string;
  label: string;
  position: Vec3;
  rotation?: Vec3;
  scale?: number;
}

// 詳細註解：TimelineChapter 定義此模組使用的資料形狀，調整欄位時需要同步檢查 API 與元件引用。
export interface TimelineChapter {
  id: string;
  postId: number;
  slug: string;
  index: number;
  year: string;
  /** CMS event_date（YYYY-MM-DD），供 mobile/tablet 列表排序與分組；可能為空字串。 */
  date: string;
  eyebrow: string;
  title: string;
  description: string;
  content: string;
  location: string;
  lead: string;
  story: string[];
  detailImage: string;
  detailAlt: string;
  palette: string[];
  facts: Array<{
    label: string;
    value: string;
    description?: string;
    href?: string;
  }>;
  camera: {
    position: Vec3;
    target: Vec3;
  };
  panels: TimelinePanel[];
}
