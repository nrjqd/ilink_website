/**
 * 後台各頁共用的狀態與動作。由 AdminTimelinePage（殼層）建立並以 props 傳給各 view，
 * view 本身不直接處理登入、Toast 或路由。
 */

import type { ConfirmOptions, ToastKind } from "./adminUi";
import type { AdminCmsHealth, AdminDashboard, MediaResponse, PostResponse } from "./admin.api";

export type AdminView =
  | { name: "dashboard" }
  | { name: "posts" }
  | { name: "postEditor"; postId: number | null }
  | { name: "media" };

export const ADMIN_PATHS = {
  dashboard: "/admin",
  posts: "/admin/posts",
  newPost: "/admin/posts/new",
  media: "/admin/media",
  post: (id: number) => `/admin/posts/${id}`,
} as const;

export function parseAdminPath(pathname: string): AdminView {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/admin/media") return { name: "media" };
  if (path === "/admin/posts") return { name: "posts" };
  if (path === "/admin/posts/new") return { name: "postEditor", postId: null };
  const match = path.match(/^\/admin\/posts\/(\d+)$/);
  if (match) return { name: "postEditor", postId: Number(match[1]) };
  if (path.startsWith("/admin/posts")) return { name: "posts" };
  return { name: "dashboard" };
}

export type AdminContext = {
  token: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  notify: (kind: ToastKind, message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** 顯示錯誤 Toast；登入逾時會自動登出。 */
  reportError: (error: unknown, fallback: string) => void;
  dashboard: AdminDashboard | null;
  health: AdminCmsHealth | null;
  posts: PostResponse[];
  trashPosts: PostResponse[];
  /** posts / trashPosts 是否為完整清單（總數 ≤ 100），決定能否在前端計算媒體使用狀態。 */
  postsComplete: boolean;
  postsTotal: number;
  refreshPosts: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  upsertPost: (post: PostResponse) => void;
  movePostToTrash: (post: PostResponse) => void;
  removePost: (postId: number) => void;
  setEditorDirty: (dirty: boolean) => void;
};

export type MediaUsage = Map<number, Array<{ id: number; title: string; role: "封面" | "相簿" }>>;

/** 以目前載入的文章計算每張媒體被哪些文章使用（與後端刪除檢查規則一致）。 */
export function computeMediaUsage(posts: PostResponse[], trashPosts: PostResponse[]): MediaUsage {
  const usage: MediaUsage = new Map();
  function add(mediaId: number | null | undefined, post: PostResponse, role: "封面" | "相簿") {
    if (!mediaId) return;
    const list = usage.get(mediaId) ?? [];
    if (!list.some((entry) => entry.id === post.id && entry.role === role)) list.push({ id: post.id, title: post.title, role });
    usage.set(mediaId, list);
  }
  posts.forEach((post) => add(post.cover_media_id, post, "封面"));
  [...posts, ...trashPosts].forEach((post) => post.gallery_links?.forEach((link) => add(link.media_id, post, "相簿")));
  return usage;
}

export function mediaThumbUrl(item: Pick<MediaResponse, "thumbnail_url" | "large_url" | "original_url">) {
  return item.thumbnail_url || item.large_url || item.original_url;
}
