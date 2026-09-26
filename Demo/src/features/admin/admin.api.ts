import type { PostCategory, PostRegion } from "../../shared/contentLabels";
import { apiBaseUrl } from "../../shared/api";

export type AdminUser = {
  id: number;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
};

export type PostStatus = "draft" | "published" | "archived";
export type { PostCategory, PostRegion };

export type MediaResponse = {
  id: number;
  uuid: string;
  original_filename: string;
  storage_provider: string;
  bucket: string;
  original_object_key: string;
  large_object_key: string;
  thumbnail_object_key: string;
  original_url: string;
  large_url: string;
  thumbnail_url: string;
  mime_type: string;
  file_size: number;
  width?: number | null;
  height?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type PostGalleryPayload = {
  media_id: number;
  sort_order: number;
  caption?: string | null;
};

export type PostGalleryResponse = PostGalleryPayload & {
  id: number;
  post_id: number;
  media: MediaResponse;
  created_at: string;
};

export type PostCreatePayload = {
  title: string;
  summary?: string | null;
  content: string;
  category: PostCategory;
  region?: PostRegion | null;
  event_date?: string | null;
  cover_media_id?: number | null;
  gallery_media?: PostGalleryPayload[];
};

export type PostUpdatePayload = {
  title?: string;
  summary?: string | null;
  content?: string;
  category?: PostCategory;
  region?: PostRegion | null;
  event_date?: string | null;
  cover_media_id?: number | null;
  gallery_media?: PostGalleryPayload[];
};

export type PostResponse = {
  id: number;
  title: string;
  slug: string;
  region?: PostRegion | null;
  status: PostStatus;
  summary?: string | null;
  content: string;
  category: PostCategory | null;
  event_date?: string | null;
  cover_media_id?: number | null;
  cover_media?: MediaResponse | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  gallery_links?: PostGalleryResponse[];
};

type TokenResponse = {
  access_token: string;
};

type StatusCounts = {
  draft: number;
  published: number;
  archived: number;
  total: number;
};

export type AdminDashboard = {
  posts: StatusCounts;
  timeline_events: StatusCounts;
  media_total: number;
  media_total_bytes: number;
  recent_media: MediaResponse[];
  editable_areas: Array<{
    key: string;
    title: string;
    status: "managed" | "partial" | "static" | string;
    admin_tab?: string | null;
    public_path: string;
    notes: string[];
  }>;
};

export type CmsSchemaCheck = {
  name: string;
  ok: boolean;
  detail?: string | null;
};

export type AdminCmsHealth = {
  ok: boolean;
  database_dialect: string;
  alembic_version?: string | null;
  expected_alembic_head: string;
  r2_enabled: boolean;
  tables: CmsSchemaCheck[];
  columns: CmsSchemaCheck[];
  foreign_keys: CmsSchemaCheck[];
};

export type AdminCmsSnapshot = {
  posts: PostResponse[];
  timeline_events: PostResponse[];
  media: MediaResponse[];
  totals: {
    posts: number;
    timeline_events: number;
    media: number;
  };
};

type MediaListResponse = {
  items: MediaResponse[];
  page: number;
  limit: number;
  total: number;
};

type PostsResponse = {
  items: PostResponse[];
  page: number;
  limit: number;
  total: number;
};

export type MediaUpdatePayload = {
  original_filename?: string | null;
};

type ValidationErrorDetail = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
};

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function normalizeRequiredText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value?.trim() ?? "";
}

function normalizeMediaId(value: number | null | undefined) {
  if (value === undefined) return undefined;
  return value && value > 0 ? value : null;
}

function cleanPostPayload(payload: PostUpdatePayload): PostUpdatePayload {
  const clean: PostUpdatePayload = {};
  const title = normalizeRequiredText(payload.title);
  const content = normalizeRequiredText(payload.content);
  const summary = normalizeNullableText(payload.summary);
  const eventDate = normalizeNullableText(payload.event_date);
  const coverMediaId = normalizeMediaId(payload.cover_media_id);

  if (title !== undefined) clean.title = title;
  if (summary !== undefined) clean.summary = summary;
  if (content !== undefined) clean.content = content;
  if (payload.category !== undefined) clean.category = payload.category;
  if (payload.region !== undefined) clean.region = payload.region;
  if (eventDate !== undefined) clean.event_date = eventDate;
  if (coverMediaId !== undefined) clean.cover_media_id = coverMediaId;
  if (payload.gallery_media !== undefined) {
    clean.gallery_media = payload.gallery_media.map((item, index) => ({
      media_id: item.media_id,
      sort_order: index,
      caption: normalizeNullableText(item.caption) ?? null,
    }));
  }

  return clean;
}

function cleanMediaPayload(payload: MediaUpdatePayload): MediaUpdatePayload {
  const clean: MediaUpdatePayload = {};
  const originalFilename = normalizeRequiredText(payload.original_filename);
  if (originalFilename !== undefined) clean.original_filename = originalFilename;
  return clean;
}

function formatValidationDetails(details: ValidationErrorDetail[]) {
  return details
    .map((detail) => {
      const field = detail.loc?.filter((part) => part !== "body").join(".");
      return field ? `${field}: ${detail.msg ?? "Invalid value"}` : detail.msg;
    })
    .filter(Boolean)
    .join("; ");
}

/** API 錯誤：保留 HTTP status 與後端 error.code，讓 UI 能區分登入逾時、資源衝突等情況。 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = `Request failed with ${response.status}`;
  let code: string | null = null;
  try {
    const body = (await response.json()) as {
      detail?: string | ValidationErrorDetail[];
      error?: { code?: string; message?: string; details?: ValidationErrorDetail[] };
    };
    code = body.error?.code ?? null;
    if (Array.isArray(body.error?.details)) {
      message = formatValidationDetails(body.error.details) || body.error.message || message;
    } else if (body.error?.message) {
      message = body.error.message;
    } else if (Array.isArray(body.detail)) {
      message = formatValidationDetails(body.detail) || message;
    } else if (typeof body.detail === "string") {
      message = body.detail;
    }
  } catch {
    // Keep the status message when the server does not return JSON.
  }
  throw new ApiError(message, response.status, code);
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchAdminDashboard(token: string): Promise<AdminDashboard> {
  const response = await fetch(`${apiBaseUrl}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<AdminDashboard>(response);
}

export async function fetchAdminCmsSnapshot(token: string): Promise<AdminCmsSnapshot> {
  const response = await fetch(`${apiBaseUrl}/admin/cms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<AdminCmsSnapshot>(response);
}

export async function fetchAdminCmsHealth(token: string): Promise<AdminCmsHealth> {
  const response = await fetch(`${apiBaseUrl}/admin/cms/health`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<AdminCmsHealth>(response);
}

export async function loginAdmin(email: string, password: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseJsonResponse<TokenResponse>(response);
  return payload.access_token;
}

export async function fetchCurrentUser(token: string): Promise<AdminUser> {
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<AdminUser>(response);
}

export async function fetchAdminPosts(
  token: string,
  params: { page?: number; limit?: number; search?: string; status?: PostStatus | "all" } = {},
): Promise<PostsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") query.set("status", params.status);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  const response = await fetch(`${apiBaseUrl}/admin/posts${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<PostsResponse>(response);
}

export async function fetchAdminPost(token: string, postId: number): Promise<PostResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/posts/${postId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<PostResponse>(response);
}

export async function fetchTrashPosts(
  token: string,
  params: { page?: number; limit?: number; search?: string } = {},
): Promise<PostsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  const response = await fetch(`${apiBaseUrl}/admin/posts/trash${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<PostsResponse>(response);
}

export async function createPost(token: string, payload: PostCreatePayload): Promise<PostResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/posts`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(cleanPostPayload(payload)),
  });
  return parseJsonResponse<PostResponse>(response);
}

export async function updatePost(token: string, postId: number, payload: PostUpdatePayload): Promise<PostResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/posts/${postId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(cleanPostPayload(payload)),
  });
  return parseJsonResponse<PostResponse>(response);
}

export async function publishPost(token: string, postId: number): Promise<PostResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/posts/${postId}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<PostResponse>(response);
}

export async function unpublishPost(token: string, postId: number): Promise<PostResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/posts/${postId}/unpublish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<PostResponse>(response);
}

export async function archivePost(token: string, postId: number): Promise<PostResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/posts/${postId}/archive`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<PostResponse>(response);
}

export async function deletePost(token: string, postId: number): Promise<PostResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/posts/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<PostResponse>(response);
}

export async function restorePost(token: string, postId: number): Promise<PostResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/posts/${postId}/restore`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<PostResponse>(response);
}

export async function permanentlyDeletePost(token: string, postId: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/admin/posts/${postId}/permanent`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    await parseJsonResponse<unknown>(response);
  }
}

export async function uploadMediaFile(token: string, file: File): Promise<MediaResponse> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${apiBaseUrl}/admin/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return parseJsonResponse<MediaResponse>(response);
}

export async function fetchAdminMedia(
  token: string,
  params: { page?: number; limit?: number; search?: string } = {},
): Promise<MediaListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  const response = await fetch(`${apiBaseUrl}/admin/media${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<MediaListResponse>(response);
}

export async function deleteAdminMedia(token: string, mediaId: number): Promise<MediaResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/media/${mediaId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse<MediaResponse>(response);
}

export async function updateAdminMedia(token: string, mediaId: number, payload: MediaUpdatePayload): Promise<MediaResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/media/${mediaId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(cleanMediaPayload(payload)),
  });
  return parseJsonResponse<MediaResponse>(response);
}
