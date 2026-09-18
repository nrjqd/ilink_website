import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, FileText, Gauge, Images, LogOut, Plus, RefreshCw, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import {
  archivePost,
  createPost,
  deleteAdminMedia,
  deletePost,
  fetchAdminPosts,
  fetchAdminCmsHealth,
  fetchAdminCmsSnapshot,
  fetchAdminDashboard,
  fetchAdminMedia,
  fetchTrashPosts,
  fetchCurrentUser,
  loginAdmin,
  permanentlyDeletePost,
  publishPost,
  restorePost,
  type AdminCmsHealth,
  type AdminDashboard,
  type AdminUser,
  type MediaResponse,
  type PostCategory,
  type PostCreatePayload,
  type PostGalleryPayload,
  type PostRegion,
  type PostResponse,
  type PostStatus,
  type PostUpdatePayload,
  unpublishPost,
  updateAdminMedia,
  updatePost,
  uploadMediaFile,
} from "./admin.api";
import { SafeImage, SafeVideo } from "../../shared/SafeMedia";
import { CATEGORY_OPTIONS, REGION_OPTIONS, formatPostCategory, formatPostRegion } from "../../shared/contentLabels";

interface AdminTimelinePageProps {
  currentPath?: string;
}

type AdminTab = "dashboard" | "posts" | "media";
type PostListFilter = "all" | PostStatus | "trash";

type PostFormState = {
  title: string;
  summary: string;
  content: string;
  category: PostCategory | "";
  region: PostRegion | "";
  event_date: string;
  cover_media_id: number | null;
  gallery_media: PostGalleryPayload[];
};

const tokenStorageKey = "ilink-admin-token";
const mediaUploadAccept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const allowedMediaUploadTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedMediaUploadExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const categoryOptions: PostCategory[] = [...CATEGORY_OPTIONS];
const postListFilters: Array<{ id: PostListFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "draft", label: "草稿" },
  { id: "published", label: "已發布" },
  { id: "archived", label: "已封存" },
  { id: "trash", label: "垃圾桶" },
];

const emptyPostForm: PostFormState = {
  title: "",
  summary: "",
  content: "",
  category: "",
  region: "",
  event_date: "",
  cover_media_id: null,
  gallery_media: [],
};

const adminTabs: Array<{ id: AdminTab; label: string; icon: typeof Gauge }> = [
  { id: "dashboard", label: "總覽", icon: Gauge },
  { id: "posts", label: "文章", icon: FileText },
  { id: "media", label: "媒體", icon: Images },
];

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function isVideoMedia(item: MediaResponse) {
  return item.mime_type.startsWith("video/");
}

function mediaPreviewUrl(item: MediaResponse) {
  return item.thumbnail_url || item.large_url || item.original_url;
}

function isAllowedMediaUpload(file: File) {
  const lowerName = file.name.toLowerCase();
  return allowedMediaUploadTypes.has(file.type) || allowedMediaUploadExtensions.some((extension) => lowerName.endsWith(extension));
}

function formatPostStatus(status: PostStatus) {
  if (status === "published") return "已發布";
  if (status === "archived") return "已封存";
  return "草稿";
}

function formatRegion(region: PostResponse["region"]) {
  return formatPostRegion(region);
}

function formatCategory(category: PostCategory | "" | null | undefined) {
  return formatPostCategory(category);
}

function postToForm(post: PostResponse): PostFormState {
  return {
    title: post.title,
    summary: post.summary ?? "",
    content: post.content ?? "",
    category: post.category ?? "",
    region: post.region ?? "",
    event_date: post.event_date ?? "",
    cover_media_id: post.cover_media_id ?? null,
    gallery_media: (post.gallery_links ?? []).map((link, index) => ({
      media_id: link.media_id,
      sort_order: link.sort_order ?? index,
      caption: link.caption ?? "",
    })),
  };
}

function cleanPostForm(form: PostFormState): PostCreatePayload {
  return {
    title: form.title.trim(),
    summary: normalizeText(form.summary),
    content: form.content.trim(),
    category: form.category as PostCategory,
    region: form.region || null,
    event_date: normalizeText(form.event_date),
    cover_media_id: form.cover_media_id ?? null,
    gallery_media: form.gallery_media.map((item, index) => ({
      media_id: item.media_id,
      sort_order: index,
      caption: normalizeText(item.caption),
    })),
  };
}

function galleryChanged(left: PostFormState["gallery_media"], right: PostFormState["gallery_media"]) {
  if (left.length !== right.length) return true;
  return left.some((item, index) => {
    const other = right[index];
    return item.media_id !== other.media_id || item.sort_order !== other.sort_order || (item.caption ?? null) !== (other.caption ?? null);
  });
}

function buildPostUpdatePayload(form: PostFormState, original: PostResponse | null): PostUpdatePayload {
  const clean = cleanPostForm(form);
  if (!original) return clean;

  const previous = cleanPostForm(postToForm(original));
  const payload: PostUpdatePayload = {};
  if (clean.title !== previous.title) payload.title = clean.title;
  if ((clean.summary ?? null) !== (previous.summary ?? null)) payload.summary = clean.summary;
  if (clean.content !== previous.content) payload.content = clean.content;
  if (clean.category !== previous.category) payload.category = clean.category;
  if ((clean.region ?? null) !== (previous.region ?? null)) payload.region = clean.region;
  if ((clean.event_date ?? null) !== (previous.event_date ?? null)) payload.event_date = clean.event_date;
  if ((clean.cover_media_id ?? null) !== (previous.cover_media_id ?? null)) payload.cover_media_id = clean.cover_media_id;
  if (galleryChanged(clean.gallery_media ?? [], previous.gallery_media ?? [])) payload.gallery_media = clean.gallery_media ?? [];
  return payload;
}

function countFailedChecks(health: AdminCmsHealth | null) {
  if (!health) return 0;
  return [...health.tables, ...health.columns, ...health.foreign_keys].filter((check) => !check.ok).length;
}

function countPassedChecks(health: AdminCmsHealth | null) {
  if (!health) return 0;
  return [...health.tables, ...health.columns, ...health.foreign_keys].filter((check) => check.ok).length;
}

export function AdminTimelinePage({ currentPath = "/admin" }: AdminTimelinePageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey) ?? "");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [cmsHealth, setCmsHealth] = useState<AdminCmsHealth | null>(null);
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [trashPosts, setTrashPosts] = useState<PostResponse[]>([]);
  const [media, setMedia] = useState<MediaResponse[]>([]);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [postForm, setPostForm] = useState<PostFormState>(emptyPostForm);
  const [mediaSearch, setMediaSearch] = useState("");
  const [postSearch, setPostSearch] = useState("");
  const [postListFilter, setPostListFilter] = useState<PostListFilter>("all");
  const [loginEmail, setLoginEmail] = useState("admin@example.com");
  const [loginPassword, setLoginPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visiblePosts = useMemo(() => {
    if (postListFilter === "trash") return trashPosts;
    if (postListFilter === "all") return posts;
    return posts.filter((post) => post.status === postListFilter);
  }, [postListFilter, posts, trashPosts]);
  const selectedPost = useMemo(() => visiblePosts.find((post) => post.id === selectedPostId) ?? null, [visiblePosts, selectedPostId]);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);

  async function loadAdminData(nextToken = token) {
    if (!nextToken) return;
    setLoading(true);
    setError(null);
    try {
      const [nextUser, nextDashboard, nextCmsHealth, snapshot, trashSnapshot] = await Promise.all([
        fetchCurrentUser(nextToken),
        fetchAdminDashboard(nextToken),
        fetchAdminCmsHealth(nextToken),
        fetchAdminCmsSnapshot(nextToken),
        fetchTrashPosts(nextToken, { limit: 100 }),
      ]);
      setUser(nextUser);
      setDashboard(nextDashboard);
      setCmsHealth(nextCmsHealth);
      setPosts(snapshot.posts);
      setTrashPosts(trashSnapshot.items);
      setMedia(snapshot.media);
      setMediaTotal(snapshot.totals.media);

      const sourcePosts = postListFilter === "trash" ? trashSnapshot.items : snapshot.posts;
      const selected = selectedPostId ? sourcePosts.find((post) => post.id === selectedPostId) : sourcePosts[0];
      if (selected) {
        setSelectedPostId(selected.id);
        setPostForm(postToForm(selected));
      } else {
        setSelectedPostId(null);
        setPostForm({ ...emptyPostForm, gallery_media: [] });
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "資料載入失敗");
      localStorage.removeItem(tokenStorageKey);
      setToken("");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void loadAdminData(token);
  }, [token]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const nextToken = await loginAdmin(loginEmail.trim(), loginPassword);
      localStorage.setItem(tokenStorageKey, nextToken);
      setToken(nextToken);
      await loadAdminData(nextToken);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(tokenStorageKey);
    setToken("");
    setUser(null);
    setDashboard(null);
    setCmsHealth(null);
    setPosts([]);
    setTrashPosts([]);
    setMedia([]);
  }

  function selectPost(post: PostResponse) {
    setSelectedPostId(post.id);
    setPostForm(postToForm(post));
    setActiveTab("posts");
  }

  function newPost() {
    setPostListFilter("all");
    setSelectedPostId(null);
    setPostForm({ ...emptyPostForm, gallery_media: [] });
    setActiveTab("posts");
  }

  async function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (postListFilter === "trash") return;
    if (!postForm.category) {
      setError("請選擇分類");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = selectedPostId
        ? await updatePost(token, selectedPostId, buildPostUpdatePayload(postForm, selectedPost))
        : await createPost(token, cleanPostForm(postForm));
      setSelectedPostId(saved.id);
      setPostForm(postToForm(saved));
      setNotice("文章已儲存");
      await loadAdminData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "文章儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function changePostStatus(post: PostResponse, nextStatus: PostStatus) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      if (nextStatus === "published") {
        await publishPost(token, post.id);
      } else if (nextStatus === "draft") {
        await unpublishPost(token, post.id);
      } else {
        await archivePost(token, post.id);
      }
      setNotice("文章狀態已更新");
      await loadAdminData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "文章狀態更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedPost() {
    if (!token || !selectedPostId) return;
    setSaving(true);
    setError(null);
    try {
      await deletePost(token, selectedPostId);
      setNotice("文章已刪除");
      newPost();
      await loadAdminData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "文章刪除失敗");
    } finally {
      setSaving(false);
    }
  }

  function applyMediaAsCover(item: MediaResponse) {
    if (isVideoMedia(item)) return;
    setPostForm((current) => ({ ...current, cover_media_id: item.id }));
    setActiveTab("posts");
  }

  function clearCoverMedia() {
    setPostForm((current) => ({ ...current, cover_media_id: null }));
  }

  function addMediaToGallery(item: MediaResponse) {
    if (isVideoMedia(item)) return;
    setPostForm((current) => {
      if (current.gallery_media.some((link) => link.media_id === item.id)) return current;
      return {
        ...current,
        gallery_media: [
          ...current.gallery_media,
          { media_id: item.id, sort_order: current.gallery_media.length, caption: item.original_filename },
        ],
      };
    });
    setActiveTab("posts");
  }

  function removeGalleryImage(index: number) {
    setPostForm((current) => ({
      ...current,
      gallery_media: current.gallery_media.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function deleteGalleryImage(index: number) {
    if (!token) return;
    const item = postForm.gallery_media[index];
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      const nextGallery = postForm.gallery_media.filter((_, itemIndex) => itemIndex !== index);
      const nextCoverId = postForm.cover_media_id === item.media_id ? null : postForm.cover_media_id;
      if (selectedPostId) {
        const saved = await updatePost(token, selectedPostId, { gallery_media: nextGallery, cover_media_id: nextCoverId });
        setPostForm(postToForm(saved));
      } else {
        setPostForm((current) => ({ ...current, cover_media_id: nextCoverId, gallery_media: nextGallery }));
      }
      setNotice("文章圖片已從文章移除");
      await loadAdminData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "文章圖片刪除失敗");
    } finally {
      setSaving(false);
    }
  }

  async function refreshMedia() {
    if (!token) return;
    const payload = await fetchAdminMedia(token, { limit: 60, search: mediaSearch.trim() || undefined });
    setMedia(payload.items);
    setMediaTotal(payload.total);
  }

  async function searchMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await refreshMedia();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "媒體搜尋失敗");
    } finally {
      setLoading(false);
    }
  }

  async function searchPosts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (postListFilter === "trash") {
        const payload = await fetchTrashPosts(token, { limit: 100, search: postSearch.trim() || undefined });
        setTrashPosts(payload.items);
      } else {
        const payload = await fetchAdminPosts(token, {
          limit: 100,
          search: postSearch.trim() || undefined,
          status: postListFilter === "all" ? "all" : postListFilter,
        });
        setPosts(payload.items);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "文章搜尋失敗");
    } finally {
      setLoading(false);
    }
  }

  async function restoreSelectedPost() {
    if (!token || !selectedPostId) return;
    setSaving(true);
    setError(null);
    try {
      await restorePost(token, selectedPostId);
      setNotice("文章已還原為草稿");
      setPostListFilter("all");
      await loadAdminData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "文章還原失敗");
    } finally {
      setSaving(false);
    }
  }

  async function permanentlyDeleteSelectedPost() {
    if (!token || !selectedPostId || !selectedPost) return;
    const confirmed = window.confirm(`確定要永久刪除「${selectedPost.title}」嗎？\n此操作無法復原。`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    try {
      await permanentlyDeletePost(token, selectedPostId);
      setNotice("文章已永久刪除");
      setSelectedPostId(null);
      setPostForm({ ...emptyPostForm, gallery_media: [] });
      await loadAdminData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "文章永久刪除失敗");
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(file: File | null, options: { setAsCover?: boolean } = {}) {
    if (!token || !file) return;
    if (!isAllowedMediaUpload(file)) {
      setError("僅支援 JPG、PNG、WebP 圖片");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const item = await uploadMediaFile(token, file);
      setNotice("媒體已上傳");
      setMedia((current) => [item, ...current]);
      setMediaTotal((current) => current + 1);
      if (options.setAsCover && !isVideoMedia(item)) {
        setPostForm((current) => ({ ...current, cover_media_id: item.id }));
        setActiveTab("posts");
        setNotice("媒體已上傳並設為封面，請儲存文章");
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "媒體上傳失敗");
    } finally {
      setSaving(false);
    }
  }

  function updateMediaLocal(mediaId: number, patch: Partial<MediaResponse>) {
    setMedia((current) => current.map((item) => (item.id === mediaId ? { ...item, ...patch } : item)));
  }

  async function saveMediaMetadata(item: MediaResponse) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await updateAdminMedia(token, item.id, {
        original_filename: normalizeText(item.original_filename),
      });
      setNotice("媒體資料已儲存");
      await refreshMedia();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "媒體資料儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMedia(mediaId: number) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAdminMedia(token, mediaId);
      setNotice("媒體已刪除");
      await refreshMedia();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "媒體刪除失敗");
    } finally {
      setSaving(false);
    }
  }

  if (!token || !user) {
    return (
      <main className="admin-shell admin-login-shell" data-current-path={currentPath}>
        <form className="admin-login-card" onSubmit={handleLogin}>
          <span className="admin-kicker">CMS</span>
          <h1>管理登入</h1>
          <label>
            Email
            <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="admin-error">{error}</p> : null}
          <button className="admin-primary-button" type="submit" disabled={loading}>
            {loading ? "登入中" : "登入"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell" data-current-path={currentPath}>
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <span>CMS</span>
          <strong>I-LINK 管理後台</strong>
        </a>
        <nav className="admin-nav" aria-label="CMS 管理導覽">
          {adminTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "is-active" : ""}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="admin-secondary-button" type="button" onClick={() => void loadAdminData()} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          重新整理
        </button>
        <button className="admin-secondary-button" type="button" onClick={logout}>
          <LogOut size={16} aria-hidden="true" />
          登出
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-kicker">登入身分</span>
            <h1>{adminTabs.find((tab) => tab.id === activeTab)?.label}</h1>
          </div>
          <p>{user.display_name || user.email}</p>
        </header>

        {error ? <p className="admin-error">{error}</p> : null}
        {notice ? <p className="admin-notice">{notice}</p> : null}

        {activeTab === "dashboard" ? renderDashboard() : null}
        {activeTab === "posts" ? renderPosts() : null}
        {activeTab === "media" ? renderMedia() : null}
      </section>
    </main>
  );

  function renderDashboard() {
    const failedChecks = countFailedChecks(cmsHealth);
    return (
      <div className="admin-grid">
        <article className="admin-panel">
          <span className="admin-kicker">文章</span>
          <h2>{dashboard?.posts.total ?? posts.length} 篇文章</h2>
          <p>
            已發布 {dashboard?.posts.published ?? 0}，草稿 {dashboard?.posts.draft ?? 0}，封存{" "}
            {dashboard?.posts.archived ?? 0}
          </p>
          <button className="admin-primary-button" type="button" onClick={newPost}>
            <Plus size={16} aria-hidden="true" />
            新增文章
          </button>
        </article>

        <article className="admin-panel">
          <span className="admin-kicker">自動時間軸</span>
          <h2>{dashboard?.timeline_events.total ?? 0} 個活動文章</h2>
          <p>時間軸依已發布文章的活動日期自動排序，不在後台手動編輯。</p>
        </article>

        <article className="admin-panel">
          <span className="admin-kicker">媒體庫</span>
          <h2>{mediaTotal} 個檔案</h2>
          <p>使用容量 {formatBytes(dashboard?.media_total_bytes ?? 0)}</p>
          <button className="admin-secondary-button" type="button" onClick={() => setActiveTab("media")}>
            <Images size={16} aria-hidden="true" />
            管理媒體
          </button>
        </article>

        <article className="admin-panel">
          <span className="admin-kicker">系統檢查</span>
          <h2>{cmsHealth?.ok ? "正常" : "需檢查"}</h2>
          <p>
            通過 {countPassedChecks(cmsHealth)}，失敗 {failedChecks}，資料庫 {cmsHealth?.database_dialect ?? "-"}
          </p>
          <p>R2：{cmsHealth?.r2_enabled ? "啟用" : "未啟用"}</p>
        </article>
      </div>
    );
  }

  function renderPosts() {
    const cover = postForm.cover_media_id ? mediaById.get(postForm.cover_media_id) ?? selectedPost?.cover_media : null;
    return (
      <div className="admin-editor-grid">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <span className="admin-kicker">文章清單</span>
              <h2>{dashboard?.posts.total ?? posts.length} 篇文章</h2>
            </div>
            <button className="admin-icon-button" type="button" onClick={newPost} aria-label="新增文章">
              <Plus size={18} />
            </button>
          </div>
          <form className="admin-inline-form" onSubmit={searchPosts}>
            <input value={postSearch} onChange={(event) => setPostSearch(event.target.value)} placeholder="搜尋標題或內容" />
            <button className="admin-secondary-button" type="submit" disabled={loading}>
              搜尋
            </button>
          </form>
          <div className="admin-card-actions">
            {postListFilters.map((filter) => (
              <button
                key={filter.id}
                className={postListFilter === filter.id ? "admin-primary-button" : "admin-secondary-button"}
                type="button"
                onClick={() => {
                  setPostListFilter(filter.id);
                  setSelectedPostId(null);
                  setPostForm({ ...emptyPostForm, gallery_media: [] });
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="admin-record-list">
            {visiblePosts.map((post) => (
              <button
                key={post.id}
                className={selectedPostId === post.id ? "is-selected" : ""}
                type="button"
                onClick={() => selectPost(post)}
              >
                <span>{postListFilter === "trash" ? post.deleted_at ?? "已刪除" : post.event_date ?? "未設定日期"}</span>
                <strong>{post.title}</strong>
                <small className={`admin-status-badge is-${post.status}`}>{formatPostStatus(post.status)}</small>
              </button>
            ))}
          </div>
        </section>

        <form className="admin-panel admin-form" onSubmit={savePost}>
          <div className="admin-panel-header">
            <div>
              <span className="admin-kicker">{selectedPost ? `#${selectedPost.id}` : "新增"}</span>
              <h2>文章內容</h2>
            </div>
            <button className="admin-primary-button" type="submit" disabled={saving || postListFilter === "trash"}>
              <Save size={16} aria-hidden="true" />
              儲存
            </button>
          </div>

          <label>
            標題
            <input
              value={postForm.title}
              onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </label>
          <label>
            Slug
            <input
              value={selectedPost?.slug ?? "儲存後自動產生"}
              readOnly
              placeholder="留空會自動產生"
            />
          </label>
          <label>
            摘要
            <textarea
              value={postForm.summary ?? ""}
              onChange={(event) => setPostForm((current) => ({ ...current, summary: event.target.value }))}
              rows={3}
            />
          </label>
          <label>
            內容
            <textarea
              value={postForm.content}
              onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))}
              rows={8}
              required
            />
          </label>

          <div className="admin-form-grid">
            <label>
              區域
              <select
                value={postForm.region}
                onChange={(event) =>
                  setPostForm((current) => ({ ...current, region: event.target.value as PostRegion | "" }))
                }
              >
                <option value="">未設定地區</option>
                {REGION_OPTIONS.map((region) => (
                  <option key={region} value={region}>
                    {formatRegion(region)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              分類
              <select
                value={postForm.category}
                onChange={(event) =>
                  setPostForm((current) => ({ ...current, category: event.target.value as PostCategory | "" }))
                }
                required
              >
                <option value="">未設定</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {formatCategory(category)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              活動日期
              <input
                type="date"
                value={postForm.event_date ?? ""}
                onChange={(event) => setPostForm((current) => ({ ...current, event_date: event.target.value }))}
              />
            </label>
            <label>
              狀態
              <select
                value={selectedPost?.status ?? "draft"}
                disabled
              >
                <option value={selectedPost?.status ?? "draft"}>{formatPostStatus(selectedPost?.status ?? "draft")}</option>
              </select>
            </label>
          </div>

          <div className="admin-nested-panel">
            <div className="admin-panel-header">
              <h3>封面圖片</h3>
              <div className="admin-card-actions">
                <label className="admin-upload-button">
                  <Upload size={16} aria-hidden="true" />
                  上傳並設為封面
                  <input
                    type="file"
                    accept={mediaUploadAccept}
                    onChange={(event) => void uploadMedia(event.target.files?.[0] ?? null, { setAsCover: true })}
                  />
                </label>
                <button className="admin-secondary-button" type="button" onClick={() => setActiveTab("media")}>
                  <Images size={16} aria-hidden="true" />
                  選擇媒體
                </button>
                <button className="admin-secondary-button" type="button" onClick={clearCoverMedia} disabled={!postForm.cover_media_id}>
                  移除封面
                </button>
              </div>
            </div>
            {cover ? <SafeImage src={mediaPreviewUrl(cover)} alt={cover.original_filename} /> : <p>尚未選擇封面圖片</p>}
          </div>

          <div className="admin-nested-panel">
            <div className="admin-panel-header">
              <h3>文章圖片</h3>
              <button className="admin-secondary-button" type="button" onClick={() => setActiveTab("media")}>
                <Plus size={16} aria-hidden="true" />
                加入圖片
              </button>
            </div>
            {postForm.gallery_media.map((link, index) => {
              const item = mediaById.get(link.media_id) ?? selectedPost?.gallery_links?.find((gallery) => gallery.media_id === link.media_id)?.media;
              return (
                <div className="admin-media-row" key={`${link.media_id}-${index}`}>
                  {item ? <SafeImage src={mediaPreviewUrl(item)} alt={item.original_filename} /> : <div />}
                  <label>
                    圖說
                    <input
                      value={link.caption ?? ""}
                      onChange={(event) =>
                        setPostForm((current) => ({
                          ...current,
                          gallery_media: current.gallery_media.map((gallery, galleryIndex) =>
                            galleryIndex === index ? { ...gallery, caption: event.target.value } : gallery,
                          ),
                        }))
                      }
                    />
                  </label>
                  <button className="admin-secondary-button" type="button" onClick={() => removeGalleryImage(index)}>
                    解除套用
                  </button>
                  <button className="admin-danger-button" type="button" onClick={() => void deleteGalleryImage(index)} disabled={saving}>
                    刪除圖片
                  </button>
                </div>
              );
            })}
          </div>

          {selectedPost && postListFilter === "trash" ? (
            <div className="admin-card-actions">
              <button className="admin-secondary-button" type="button" onClick={() => void restoreSelectedPost()} disabled={saving}>
                <RotateCcw size={16} aria-hidden="true" />
                還原
              </button>
              <button className="admin-danger-button" type="button" onClick={() => void permanentlyDeleteSelectedPost()} disabled={saving}>
                <Trash2 size={16} aria-hidden="true" />
                永久刪除
              </button>
            </div>
          ) : selectedPost ? (
            <div className="admin-card-actions">
              {selectedPost.status !== "published" ? (
                <button
                  className="admin-secondary-button"
                  type="button"
                  onClick={() => void changePostStatus(selectedPost, "published")}
                  disabled={saving}
                >
                  發布
                </button>
              ) : (
                <button
                  className="admin-secondary-button"
                  type="button"
                  onClick={() => void changePostStatus(selectedPost, "draft")}
                  disabled={saving}
                >
                  轉草稿
                </button>
              )}
              {selectedPost.status !== "archived" ? (
                <button
                  className="admin-secondary-button"
                  type="button"
                  onClick={() => void changePostStatus(selectedPost, "archived")}
                  disabled={saving}
                >
                  <Archive size={16} aria-hidden="true" />
                  封存
                </button>
              ) : null}
              <button className="admin-danger-button" type="button" onClick={() => void deleteSelectedPost()} disabled={saving}>
                <Trash2 size={16} aria-hidden="true" />
                刪除文章
              </button>
            </div>
          ) : null}
        </form>
      </div>
    );
  }

  function renderMedia() {
    return (
      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <span className="admin-kicker">媒體庫</span>
            <h2>{mediaTotal} 個檔案</h2>
          </div>
          <label className="admin-upload-button">
            <Upload size={16} aria-hidden="true" />
            上傳媒體
            <input type="file" accept={mediaUploadAccept} onChange={(event) => void uploadMedia(event.target.files?.[0] ?? null)} />
          </label>
        </div>

        <form className="admin-inline-form" onSubmit={searchMedia}>
          <input value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} placeholder="搜尋檔名或 R2 key" />
          <button className="admin-secondary-button" type="submit" disabled={loading}>
            搜尋
          </button>
        </form>

        <div className="admin-media-grid">
          {media.map((item) => (
            <article className="admin-media-card" key={item.id}>
              <div className="admin-media-preview">
                {isVideoMedia(item) ? (
                  <SafeVideo src={item.large_url || item.original_url} controls />
                ) : (
                  <SafeImage src={mediaPreviewUrl(item)} alt={item.original_filename} />
                )}
              </div>
              <h3>{item.original_filename}</h3>
              <p>{formatBytes(item.file_size)}</p>
              <label>
                Filename
                <input
                  value={item.original_filename}
                  onChange={(event) => updateMediaLocal(item.id, { original_filename: event.target.value })}
                />
              </label>
              <div className="admin-card-actions">
                <button className="admin-secondary-button" type="button" onClick={() => void saveMediaMetadata(item)} disabled={saving}>
                  <Save size={16} aria-hidden="true" />
                  儲存
                </button>
                {!isVideoMedia(item) ? (
                  <>
                    <button className="admin-secondary-button" type="button" onClick={() => applyMediaAsCover(item)}>
                      設為封面
                    </button>
                    <button className="admin-secondary-button" type="button" onClick={() => addMediaToGallery(item)}>
                      加入文章
                    </button>
                  </>
                ) : null}
                <button className="admin-danger-button" type="button" onClick={() => void deleteMedia(item.id)} disabled={saving}>
                  刪除
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }
}
