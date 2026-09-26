/**
 * 文章編輯器：主欄（標題、摘要、內文、相簿）＋側欄（發布狀態、分類 / 地區 / 活動日期、封面）。
 * 內容格式維持原本的純文字（空行分段、# / ## 標題），不引入 rich text editor。
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Archive, ExternalLink, ImagePlus, Save, Send, Trash2, Undo2, X } from "lucide-react";
import { SafeImage } from "../../shared/SafeMedia";
import { CATEGORY_LABELS, CATEGORY_OPTIONS, REGION_LABELS, REGION_OPTIONS } from "../../shared/contentLabels";
import {
  ApiError,
  archivePost,
  createPost,
  deletePost,
  fetchAdminPost,
  permanentlyDeletePost,
  publishPost,
  restorePost,
  unpublishPost,
  updatePost,
  type MediaResponse,
  type PostCategory,
  type PostCreatePayload,
  type PostGalleryPayload,
  type PostRegion,
  type PostResponse,
  type PostUpdatePayload,
} from "./admin.api";
import { AdminButton, EmptyState, LoadingState, StatusBadge, describeError, formatDateTime } from "./adminUi";
import { ADMIN_PATHS, mediaThumbUrl, type AdminContext } from "./adminContext";
import { MediaPickerDialog } from "./adminMedia";

type Props = { ctx: AdminContext; postId: number | null };

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

type FieldErrors = Partial<Record<"title" | "content" | "category", string>>;

const emptyForm: PostFormState = {
  title: "",
  summary: "",
  content: "",
  category: "",
  region: "",
  event_date: "",
  cover_media_id: null,
  gallery_media: [],
};

const SUMMARY_RECOMMENDED = 160;

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
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
    gallery_media: [...(post.gallery_links ?? [])]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((link, index) => ({ media_id: link.media_id, sort_order: index, caption: link.caption ?? "" })),
  };
}

function cleanForm(form: PostFormState): PostCreatePayload {
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

function galleryChanged(left: PostGalleryPayload[], right: PostGalleryPayload[]) {
  if (left.length !== right.length) return true;
  return left.some((item, index) => {
    const other = right[index];
    return item.media_id !== other.media_id || (item.caption ?? null) !== (other.caption ?? null);
  });
}

/** 只送出有變更的欄位（PATCH）。 */
function buildUpdatePayload(form: PostFormState, original: PostResponse): PostUpdatePayload {
  const next = cleanForm(form);
  const previous = cleanForm(postToForm(original));
  const payload: PostUpdatePayload = {};
  if (next.title !== previous.title) payload.title = next.title;
  if ((next.summary ?? null) !== (previous.summary ?? null)) payload.summary = next.summary;
  if (next.content !== previous.content) payload.content = next.content;
  if (next.category !== previous.category) payload.category = next.category;
  if ((next.region ?? null) !== (previous.region ?? null)) payload.region = next.region;
  if ((next.event_date ?? null) !== (previous.event_date ?? null)) payload.event_date = next.event_date;
  if ((next.cover_media_id ?? null) !== (previous.cover_media_id ?? null)) payload.cover_media_id = next.cover_media_id;
  if (galleryChanged(next.gallery_media ?? [], previous.gallery_media ?? [])) payload.gallery_media = next.gallery_media ?? [];
  return payload;
}

function validate(form: PostFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.title.trim()) errors.title = "請輸入文章標題";
  if (!form.content.trim()) errors.content = "請輸入正文";
  if (!form.category) errors.category = "請選擇分類";
  return errors;
}

type LoadState = { status: "loading" } | { status: "ready" } | { status: "notFound" } | { status: "error"; message: string };

export function AdminPostEditor({ ctx, postId }: Props) {
  const isNew = postId === null;
  const localPost = useMemo(
    () => (postId ? ctx.posts.find((post) => post.id === postId) ?? ctx.trashPosts.find((post) => post.id === postId) ?? null : null),
    [ctx.posts, ctx.trashPosts, postId],
  );
  const [post, setPost] = useState<PostResponse | null>(localPost);
  const [loadState, setLoadState] = useState<LoadState>(isNew || localPost ? { status: "ready" } : { status: "loading" });
  const [form, setForm] = useState<PostFormState>(() => (localPost ? postToForm(localPost) : emptyForm));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<null | "save" | "publish" | "unpublish" | "archive" | "delete" | "restore" | "destroy">(null);
  const [picker, setPicker] = useState<null | "cover" | "gallery">(null);
  // 新選取但尚未儲存的媒體，用於預覽。
  const [pickedMedia, setPickedMedia] = useState<Map<number, MediaResponse>>(() => new Map());
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);

  const isTrashed = Boolean(post?.deleted_at);
  const readOnly = isTrashed;

  // 本地清單沒有這篇（例如超過 100 篇或直接開網址）時向 API 取得。
  useEffect(() => {
    if (isNew || localPost) return;
    let cancelled = false;
    fetchAdminPost(ctx.token, postId)
      .then((fetched) => {
        if (cancelled) return;
        setPost(fetched);
        setForm(postToForm(fetched));
        setLoadState({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          setLoadState({ status: "notFound" });
        } else {
          setLoadState({ status: "error", message: describeError(error, "文章載入失敗") });
        }
      });
    return () => {
      cancelled = true;
    };
    // 只在進入頁面時決定是否需要遠端讀取（editor 以 postId 為 key 重新掛載）。
  }, [postId]);

  const payload = post ? buildUpdatePayload(form, post) : null;
  const dirty = isNew
    ? Boolean(form.title.trim() || form.content.trim() || form.summary.trim() || form.cover_media_id || form.gallery_media.length)
    : Boolean(payload && Object.keys(payload).length > 0);

  const { setEditorDirty } = ctx;
  useEffect(() => {
    setEditorDirty(dirty && !readOnly);
  }, [dirty, readOnly, setEditorDirty]);

  useEffect(() => () => setEditorDirty(false), [setEditorDirty]);

  const mediaLookup = useMemo(() => {
    const map = new Map<number, MediaResponse>();
    if (post?.cover_media) map.set(post.cover_media.id, post.cover_media);
    post?.gallery_links?.forEach((link) => link.media && map.set(link.media_id, link.media));
    pickedMedia.forEach((item, id) => map.set(id, item));
    return map;
  }, [post, pickedMedia]);

  function patch(next: Partial<PostFormState>) {
    setForm((current) => ({ ...current, ...next }));
    const keys = Object.keys(next) as Array<keyof FieldErrors>;
    if (keys.some((key) => errors[key])) setErrors((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, undefined])) }));
  }

  function rememberMedia(item: MediaResponse) {
    setPickedMedia((current) => new Map(current).set(item.id, item));
  }

  function applySaved(saved: PostResponse) {
    setPost(saved);
    setForm(postToForm(saved));
    ctx.upsertPost(saved);
    void ctx.refreshDashboard().catch(() => undefined);
  }

  /** 驗證並儲存；回傳最新文章，失敗回傳 null。 */
  async function save(): Promise<PostResponse | null> {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (nextErrors.title) {
      titleRef.current?.focus();
      return null;
    }
    if (nextErrors.content) {
      contentRef.current?.focus();
      return null;
    }
    if (nextErrors.category) {
      categoryRef.current?.focus();
      return null;
    }
    try {
      if (isNew) {
        const created = await createPost(ctx.token, cleanForm(form));
        ctx.setEditorDirty(false);
        applySaved(created);
        ctx.notify("success", "文章已建立（草稿）");
        ctx.navigate(ADMIN_PATHS.post(created.id), { replace: true });
        return created;
      }
      if (!post) return null;
      if (!payload || Object.keys(payload).length === 0) return post;
      const saved = await updatePost(ctx.token, post.id, payload);
      applySaved(saved);
      ctx.notify("success", "變更已儲存");
      return saved;
    } catch (error) {
      ctx.reportError(error, "文章儲存失敗");
      return null;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    setBusy("save");
    await save();
    setBusy(null);
  }

  async function publish() {
    if (!post) return;
    setBusy("publish");
    try {
      const current = dirty ? await save() : post;
      if (!current) return;
      const published = await publishPost(ctx.token, current.id);
      applySaved(published);
      ctx.notify("success", dirty ? "已儲存並發布，文章已公開在網站上" : "已發布，文章已公開在網站上");
    } catch (error) {
      ctx.reportError(error, "發布失敗");
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(kind: "unpublish" | "archive") {
    if (!post) return;
    const ok = await ctx.confirm(
      kind === "unpublish"
        ? {
            title: "取消發布",
            message: `「${post.title}」會改回草稿，並從公開網站移除。`,
            confirmLabel: "取消發布",
          }
        : {
            title: "封存文章",
            message: `「${post.title}」會被封存並從公開網站移除，之後仍可重新發布。`,
            confirmLabel: "封存",
          },
    );
    if (!ok) return;
    setBusy(kind);
    try {
      const updated = kind === "unpublish" ? await unpublishPost(ctx.token, post.id) : await archivePost(ctx.token, post.id);
      applySaved(updated);
      ctx.notify("success", kind === "unpublish" ? "已取消發布，文章改為草稿" : "文章已封存");
    } catch (error) {
      ctx.reportError(error, kind === "unpublish" ? "取消發布失敗" : "封存失敗");
    } finally {
      setBusy(null);
    }
  }

  async function moveToTrash() {
    if (!post) return;
    const ok = await ctx.confirm({
      title: "移到垃圾桶",
      message: (
        <>
          <p>
            確定刪除「<strong>{post.title}</strong>」？
          </p>
          <p>文章會移到垃圾桶並從網站移除，之後可以在「文章管理 → 垃圾桶」還原。</p>
        </>
      ),
      confirmLabel: "移到垃圾桶",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("delete");
    try {
      const deleted = await deletePost(ctx.token, post.id);
      ctx.movePostToTrash(deleted);
      ctx.setEditorDirty(false);
      ctx.notify("success", `「${post.title}」已移到垃圾桶`);
      void ctx.refreshDashboard().catch(() => undefined);
      ctx.navigate(ADMIN_PATHS.posts);
    } catch (error) {
      ctx.reportError(error, "刪除失敗");
      setBusy(null);
    }
  }

  async function restore() {
    if (!post) return;
    setBusy("restore");
    try {
      const restored = await restorePost(ctx.token, post.id);
      applySaved(restored);
      ctx.notify("success", "文章已還原為草稿");
    } catch (error) {
      ctx.reportError(error, "還原失敗");
    } finally {
      setBusy(null);
    }
  }

  async function destroy() {
    if (!post) return;
    const ok = await ctx.confirm({
      title: "永久刪除文章",
      message: (
        <>
          <p>
            確定永久刪除「<strong>{post.title}</strong>」？
          </p>
          <p>此操作無法復原。</p>
        </>
      ),
      confirmLabel: "永久刪除",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("destroy");
    try {
      await permanentlyDeletePost(ctx.token, post.id);
      ctx.removePost(post.id);
      ctx.notify("success", `已永久刪除「${post.title}」`);
      ctx.navigate(`${ADMIN_PATHS.posts}?status=trash`);
    } catch (error) {
      ctx.reportError(error, "永久刪除失敗");
      setBusy(null);
    }
  }

  function moveGallery(index: number, delta: number) {
    setForm((current) => {
      const next = [...current.gallery_media];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, gallery_media: next.map((item, order) => ({ ...item, sort_order: order })) };
    });
  }

  function back() {
    ctx.navigate(isTrashed ? `${ADMIN_PATHS.posts}?status=trash` : ADMIN_PATHS.posts);
  }

  if (loadState.status === "loading") return <LoadingState label="文章載入中…" />;
  if (loadState.status === "notFound" || loadState.status === "error") {
    return (
      <div className="adm-card">
        <EmptyState
          title={loadState.status === "notFound" ? "找不到這篇文章" : "文章載入失敗"}
          description={loadState.status === "error" ? loadState.message : "文章可能已被永久刪除。"}
          action={
            <AdminButton size="sm" onClick={back}>
              回文章列表
            </AdminButton>
          }
        />
      </div>
    );
  }

  const cover = form.cover_media_id ? mediaLookup.get(form.cover_media_id) ?? null : null;
  const status = post?.status ?? "draft";
  const publicUrl = post && status === "published" ? `/posts/${encodeURIComponent(post.slug)}` : null;
  const summaryLength = form.summary.trim().length;

  return (
    <form className="adm-editor" onSubmit={handleSubmit} noValidate aria-labelledby="adm-editor-title">
      <div className="adm-editor__bar">
        <button type="button" className="adm-link adm-editor__back" onClick={back}>
          <ArrowLeft size={16} aria-hidden="true" />
          文章列表
        </button>
        <div className="adm-editor__heading">
          <h1 id="adm-editor-title">{isNew ? "新增文章" : "編輯文章"}</h1>
          {!isNew ? <StatusBadge status={status} /> : null}
          {isTrashed ? <span className="adm-badge adm-badge--trash">垃圾桶</span> : null}
          {dirty && !readOnly ? (
            <span className="adm-dirty" role="status">
              尚未儲存
            </span>
          ) : null}
        </div>
        {!readOnly ? (
          <AdminButton type="submit" variant="primary" icon={<Save size={16} aria-hidden="true" />} busy={busy === "save"} disabled={busy !== null || (!dirty && !isNew)}>
            {isNew ? "建立草稿" : "儲存變更"}
          </AdminButton>
        ) : null}
      </div>

      {isTrashed ? (
        <div className="adm-banner adm-banner--warn" role="note">
          <span>這篇文章在垃圾桶中，內容無法編輯。還原後會成為草稿。</span>
          <div className="adm-row">
            <AdminButton size="sm" icon={<Undo2 size={14} aria-hidden="true" />} busy={busy === "restore"} disabled={busy !== null} onClick={() => void restore()}>
              還原
            </AdminButton>
            <AdminButton
              size="sm"
              variant="danger"
              icon={<Trash2 size={14} aria-hidden="true" />}
              busy={busy === "destroy"}
              disabled={busy !== null}
              onClick={() => void destroy()}
            >
              永久刪除
            </AdminButton>
          </div>
        </div>
      ) : null}

      <div className="adm-editor__layout">
        <fieldset className="adm-editor__main" disabled={readOnly}>
          <legend className="adm-sr-only">文章內容</legend>
          <section className="adm-card adm-stack">
            <div className="adm-field">
              <label htmlFor="adm-post-title">
                標題 <span className="adm-required">必填</span>
              </label>
              <input
                ref={titleRef}
                id="adm-post-title"
                className="adm-input--title"
                value={form.title}
                maxLength={220}
                onChange={(event) => patch({ title: event.target.value })}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "adm-post-title-error" : undefined}
              />
              {errors.title ? (
                <span id="adm-post-title-error" className="adm-field-error">
                  {errors.title}
                </span>
              ) : null}
              <span className="adm-hint">
                網址：{post ? `/posts/${post.slug}` : "儲存後依標題自動產生"}
              </span>
            </div>

            <div className="adm-field">
              <label htmlFor="adm-post-summary">摘要</label>
              <textarea
                id="adm-post-summary"
                rows={3}
                value={form.summary}
                onChange={(event) => patch({ summary: event.target.value })}
                aria-describedby="adm-post-summary-hint"
              />
              <span id="adm-post-summary-hint" className={`adm-hint ${summaryLength > SUMMARY_RECOMMENDED ? "adm-text-warn" : ""}`}>
                {summaryLength} 字 · 會顯示在列表卡片，也是搜尋結果與社群分享的描述，建議 {SUMMARY_RECOMMENDED} 字以內。
              </span>
            </div>

            <div className="adm-field">
              <label htmlFor="adm-post-content">
                正文 <span className="adm-required">必填</span>
              </label>
              <textarea
                ref={contentRef}
                id="adm-post-content"
                className="adm-textarea--content"
                rows={16}
                value={form.content}
                onChange={(event) => patch({ content: event.target.value })}
                aria-invalid={errors.content ? true : undefined}
                aria-describedby={`adm-post-content-hint${errors.content ? " adm-post-content-error" : ""}`}
              />
              {errors.content ? (
                <span id="adm-post-content-error" className="adm-field-error">
                  {errors.content}
                </span>
              ) : null}
              <span id="adm-post-content-hint" className="adm-hint">
                段落之間空一行；以「# 」開頭為段落標題、「## 」為小標題。
              </span>
            </div>
          </section>

          <section className="adm-card adm-stack" aria-labelledby="adm-gallery-title">
            <header className="adm-card__header">
              <h2 id="adm-gallery-title">相簿</h2>
              <AdminButton size="sm" icon={<ImagePlus size={14} aria-hidden="true" />} onClick={() => setPicker("gallery")}>
                加入圖片
              </AdminButton>
            </header>
            {form.gallery_media.length === 0 ? (
              <p className="adm-muted">尚未加入相簿圖片。相簿會顯示在文章頁的「活動相簿」。</p>
            ) : (
              <>
                <p className="adm-hint">圖說會顯示在圖片下方，也作為圖片的替代文字（有助於搜尋與無障礙閱讀）。</p>
                <ol className="adm-gallery">
                  {form.gallery_media.map((link, index) => {
                    const item = mediaLookup.get(link.media_id);
                    const captionId = `adm-caption-${link.media_id}`;
                    return (
                      <li key={link.media_id} className="adm-gallery__item">
                        <span className="adm-gallery__thumb">
                          {item ? <SafeImage src={mediaThumbUrl(item)} alt="" loading="lazy" decoding="async" fallbackLabel="" /> : null}
                        </span>
                        <div className="adm-field adm-gallery__caption">
                          <label htmlFor={captionId}>圖說 {index + 1}</label>
                          <input
                            id={captionId}
                            value={link.caption ?? ""}
                            maxLength={500}
                            placeholder="描述照片內容，例如：學生在美濃藍染工坊體驗染布"
                            onChange={(event) =>
                              patch({
                                gallery_media: form.gallery_media.map((gallery, galleryIndex) =>
                                  galleryIndex === index ? { ...gallery, caption: event.target.value } : gallery,
                                ),
                              })
                            }
                          />
                        </div>
                        <div className="adm-gallery__actions">
                          <button
                            type="button"
                            className="adm-icon-btn"
                            onClick={() => moveGallery(index, -1)}
                            disabled={index === 0}
                            aria-label={`將圖片 ${index + 1} 往前移`}
                          >
                            <ArrowUp size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="adm-icon-btn"
                            onClick={() => moveGallery(index, 1)}
                            disabled={index === form.gallery_media.length - 1}
                            aria-label={`將圖片 ${index + 1} 往後移`}
                          >
                            <ArrowDown size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="adm-icon-btn adm-icon-btn--danger"
                            onClick={() =>
                              patch({ gallery_media: form.gallery_media.filter((_, galleryIndex) => galleryIndex !== index) })
                            }
                            aria-label={`從相簿移除圖片 ${index + 1}（不會刪除媒體庫中的檔案）`}
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </section>
        </fieldset>

        <aside className="adm-editor__side" aria-label="發布設定">
          <section className="adm-card adm-stack" aria-labelledby="adm-publish-title">
            <h2 id="adm-publish-title" className="adm-card__title">
              發布
            </h2>
            <dl className="adm-dl adm-dl--compact">
              <div>
                <dt>狀態</dt>
                <dd>{isNew ? "尚未建立" : <StatusBadge status={status} />}</dd>
              </div>
              {post?.published_at ? (
                <div>
                  <dt>發布時間</dt>
                  <dd>{formatDateTime(post.published_at)}</dd>
                </div>
              ) : null}
              {post?.updated_at ? (
                <div>
                  <dt>最後更新</dt>
                  <dd>{formatDateTime(post.updated_at)}</dd>
                </div>
              ) : null}
            </dl>
            {publicUrl ? (
              <a className="adm-link" href={publicUrl} target="_blank" rel="noopener">
                <ExternalLink size={14} aria-hidden="true" />
                在網站查看
              </a>
            ) : null}

            {isNew ? (
              <p className="adm-hint">新文章會先儲存為草稿，建立後即可發布。</p>
            ) : !readOnly ? (
              <div className="adm-stack adm-stack--tight">
                {status !== "published" ? (
                  <AdminButton
                    variant="primary"
                    icon={<Send size={16} aria-hidden="true" />}
                    busy={busy === "publish"}
                    disabled={busy !== null}
                    onClick={() => void publish()}
                  >
                    {dirty ? "儲存並發布" : "發布"}
                  </AdminButton>
                ) : (
                  <AdminButton busy={busy === "unpublish"} disabled={busy !== null || dirty} onClick={() => void changeStatus("unpublish")}>
                    取消發布（改回草稿）
                  </AdminButton>
                )}
                {status !== "archived" ? (
                  <AdminButton
                    variant="ghost"
                    icon={<Archive size={16} aria-hidden="true" />}
                    busy={busy === "archive"}
                    disabled={busy !== null || dirty}
                    onClick={() => void changeStatus("archive")}
                  >
                    封存
                  </AdminButton>
                ) : null}
                {dirty ? <p className="adm-hint">封存或取消發布前，請先儲存變更。</p> : null}
              </div>
            ) : null}
          </section>

          <fieldset className="adm-card adm-stack" disabled={readOnly}>
            <legend className="adm-card__title">分類與地區</legend>
            <div className="adm-field">
              <label htmlFor="adm-post-category">
                分類 <span className="adm-required">必填</span>
              </label>
              <select
                ref={categoryRef}
                id="adm-post-category"
                value={form.category}
                onChange={(event) => patch({ category: event.target.value as PostCategory | "" })}
                aria-invalid={errors.category ? true : undefined}
                aria-describedby={errors.category ? "adm-post-category-error" : undefined}
              >
                <option value="">請選擇分類</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              {errors.category ? (
                <span id="adm-post-category-error" className="adm-field-error">
                  {errors.category}
                </span>
              ) : null}
            </div>
            <div className="adm-field">
              <label htmlFor="adm-post-region">地區</label>
              <select id="adm-post-region" value={form.region} onChange={(event) => patch({ region: event.target.value as PostRegion | "" })}>
                <option value="">未設定地區</option>
                {REGION_OPTIONS.map((region) => (
                  <option key={region} value={region}>
                    {REGION_LABELS[region]}
                  </option>
                ))}
              </select>
            </div>
            <div className="adm-field">
              <label htmlFor="adm-post-date">活動日期</label>
              <input
                id="adm-post-date"
                type="date"
                value={form.event_date}
                onChange={(event) => patch({ event_date: event.target.value })}
                aria-describedby="adm-post-date-hint"
              />
              <span id="adm-post-date-hint" className="adm-hint">
                有活動日期的已發布文章，會自動排入首頁時間軸與「活動現場」。
              </span>
            </div>
          </fieldset>

          <fieldset className="adm-card adm-stack" disabled={readOnly}>
            <legend className="adm-card__title">封面圖片</legend>
            <div className="adm-cover">
              {cover ? (
                <SafeImage src={cover.large_url || mediaThumbUrl(cover)} alt={`封面：${cover.original_filename}`} decoding="async" />
              ) : form.cover_media_id ? (
                <span className="adm-muted">已設定封面（#{form.cover_media_id}）</span>
              ) : (
                <span className="adm-muted">尚未設定封面。沒有封面時，網站會使用相簿第一張圖片。</span>
              )}
            </div>
            <div className="adm-row">
              <AdminButton size="sm" icon={<ImagePlus size={14} aria-hidden="true" />} onClick={() => setPicker("cover")}>
                {form.cover_media_id ? "更換封面" : "選擇封面"}
              </AdminButton>
              {form.cover_media_id ? (
                <AdminButton size="sm" variant="ghost" onClick={() => patch({ cover_media_id: null })}>
                  移除封面
                </AdminButton>
              ) : null}
            </div>
          </fieldset>

          {!isNew && !readOnly ? (
            <section className="adm-card adm-danger-zone" aria-labelledby="adm-danger-title">
              <h2 id="adm-danger-title" className="adm-card__title">
                刪除
              </h2>
              <p className="adm-hint">文章會移到垃圾桶並從網站移除，可以再還原。</p>
              <AdminButton
                variant="danger-ghost"
                icon={<Trash2 size={16} aria-hidden="true" />}
                busy={busy === "delete"}
                disabled={busy !== null}
                onClick={() => void moveToTrash()}
              >
                移到垃圾桶
              </AdminButton>
            </section>
          ) : null}
        </aside>
      </div>

      <MediaPickerDialog
        ctx={ctx}
        open={picker !== null}
        mode={picker ?? "cover"}
        selectedIds={picker === "gallery" ? form.gallery_media.map((item) => item.media_id) : form.cover_media_id ? [form.cover_media_id] : []}
        onClose={() => setPicker(null)}
        onPick={(item) => {
          rememberMedia(item);
          if (picker === "cover") {
            patch({ cover_media_id: item.id });
          } else {
            setForm((current) =>
              current.gallery_media.some((link) => link.media_id === item.id)
                ? current
                : {
                    ...current,
                    gallery_media: [...current.gallery_media, { media_id: item.id, sort_order: current.gallery_media.length, caption: "" }],
                  },
            );
          }
        }}
      />
    </form>
  );
}
