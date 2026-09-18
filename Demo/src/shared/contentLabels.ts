export type PostCategory =
  | "local_research"
  | "craft_design"
  | "industry_record"
  | "ai_application"
  | "sustainability";
export type PostRegion = "qishan" | "meinong" | "neimen";

export const CATEGORY_LABELS: Record<PostCategory, string> = {
  local_research: "地方研究",
  craft_design: "工藝設計",
  industry_record: "產業紀錄",
  ai_application: "AI 應用",
  sustainability: "永續故事",
};

export const REGION_LABELS: Record<PostRegion, string> = {
  qishan: "旗山",
  meinong: "美濃",
  neimen: "內門",
};

export const REGION_OPTIONS: PostRegion[] = ["qishan", "meinong", "neimen"];
export const CATEGORY_OPTIONS: PostCategory[] = [
  "local_research",
  "craft_design",
  "industry_record",
  "ai_application",
  "sustainability",
];

export function formatPostCategory(category: string | null | undefined) {
  return category && category in CATEGORY_LABELS ? CATEGORY_LABELS[category as PostCategory] : "未設定分類";
}

export function formatPostRegion(region: string | null | undefined) {
  return region && region in REGION_LABELS ? REGION_LABELS[region as PostRegion] : "未設定地區";
}
