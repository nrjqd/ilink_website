/**
 * 媒體共用元件：上傳區（拖放 / 選擇檔案）、分頁媒體清單 hook、文章編輯器用的媒體選擇對話框。
 */

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Check, ImagePlus, Search, UploadCloud } from "lucide-react";
import { SafeImage } from "../../shared/SafeMedia";
import { fetchAdminMedia, uploadMediaFile, type MediaResponse } from "./admin.api";
import { AdminButton, AdminDialog, EmptyState, LoadingState, describeError, formatBytes, isAuthError } from "./adminUi";
import { mediaThumbUrl, type AdminContext } from "./adminContext";

export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const PAGE_SIZE = 48;

export function validateUpload(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  const allowed = ALLOWED_TYPES.has(file.type) || ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  if (!allowed) return "僅支援 JPEG、PNG、WebP 圖片。";
  if (file.size > MAX_UPLOAD_BYTES) return `檔案 ${formatBytes(file.size)}，超過 15 MB 上限。`;
  return null;
}

export function isVideoMedia(item: MediaResponse) {
  return item.mime_type?.startsWith("video/");
}

/* ------------------------------------------------------------------ */

type UploadState = { status: "idle" } | { status: "uploading"; name: string } | { status: "error"; message: string };

type UploadZoneProps = {
  ctx: AdminContext;
  onUploaded: (item: MediaResponse) => void;
  compact?: boolean;
};

/** 一次上傳一張（後端 /admin/uploads 為單檔 API）。 */
export function UploadZone({ ctx, onUploaded, compact }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useRef(`adm-upload-${Math.random().toString(36).slice(2)}`).current;
  const uploading = state.status === "uploading";

  async function upload(file: File | null | undefined) {
    if (!file || uploading) return;
    const invalid = validateUpload(file);
    if (invalid) {
      setState({ status: "error", message: invalid });
      return;
    }
    setState({ status: "uploading", name: file.name });
    try {
      const item = await uploadMediaFile(ctx.token, file);
      setState({ status: "idle" });
      ctx.notify("success", `已上傳「${item.original_filename}」`);
      onUploaded(item);
      void ctx.refreshDashboard().catch(() => undefined);
    } catch (error) {
      setState({ status: "error", message: describeError(error, "上傳失敗") });
      // 一般錯誤已顯示在上傳區內；登入逾時交給殼層登出。
      if (isAuthError(error)) ctx.reportError(error, "上傳失敗");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer.files;
    if (files.length > 1) ctx.notify("info", "一次只能上傳一張，已上傳第一個檔案。");
    void upload(files[0]);
  }

  return (
    <div
      className={["adm-upload", compact ? "adm-upload--compact" : "", dragging ? "is-dragging" : "", uploading ? "is-busy" : ""]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <UploadCloud size={compact ? 20 : 28} aria-hidden="true" className="adm-upload__icon" />
      <div className="adm-upload__text">
        {uploading ? (
          <strong role="status">正在上傳「{state.name}」…</strong>
        ) : (
          <strong>拖曳圖片到這裡，或</strong>
        )}
        <span>JPEG / PNG / WebP，單檔最大 15 MB。系統會轉成 WebP 並產生大圖（長邊 1600px）與縮圖，不保留原始 JPG / PNG 檔。</span>
        {state.status === "error" ? (
          <span className="adm-form-error" role="alert">
            {state.message}
          </span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        className="adm-sr-only adm-upload__input"
        type="file"
        accept={MEDIA_ACCEPT}
        disabled={uploading}
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <label htmlFor={inputId} className={`adm-btn adm-btn--primary ${uploading ? "is-disabled" : ""}`}>
        {uploading ? <span className="adm-spinner" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
        選擇檔案
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export type MediaListState = {
  items: MediaResponse[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  search: string;
};

/** 媒體分頁清單（伺服器端搜尋檔名 / R2 key）。 */
export function useMediaList(ctx: AdminContext, enabled = true) {
  const [state, setState] = useState<MediaListState>({
    items: [],
    total: 0,
    loading: true,
    loadingMore: false,
    error: null,
    search: "",
  });
  const pageRef = useRef(1);
  const { token, reportError } = ctx;

  const load = useCallback(
    async (search: string) => {
      pageRef.current = 1;
      setState((current) => ({ ...current, loading: true, error: null, search }));
      try {
        const payload = await fetchAdminMedia(token, { page: 1, limit: PAGE_SIZE, search: search.trim() || undefined });
        setState((current) => ({ ...current, items: payload.items, total: payload.total, loading: false }));
      } catch (error) {
        setState((current) => ({ ...current, loading: false, error: describeError(error, "媒體載入失敗") }));
        if (isAuthError(error)) reportError(error, "媒體載入失敗");
      }
    },
    [token, reportError],
  );

  const loadMore = useCallback(async () => {
    const nextPage = pageRef.current + 1;
    setState((current) => ({ ...current, loadingMore: true }));
    try {
      const payload = await fetchAdminMedia(token, { page: nextPage, limit: PAGE_SIZE, search: state.search.trim() || undefined });
      pageRef.current = nextPage;
      setState((current) => {
        const known = new Set(current.items.map((item) => item.id));
        return {
          ...current,
          items: [...current.items, ...payload.items.filter((item) => !known.has(item.id))],
          total: payload.total,
          loadingMore: false,
        };
      });
    } catch (error) {
      setState((current) => ({ ...current, loadingMore: false }));
      reportError(error, "載入更多媒體失敗");
    }
  }, [token, reportError, state.search]);

  useEffect(() => {
    if (enabled) void load("");
  }, [enabled, load]);

  const prepend = useCallback((item: MediaResponse) => {
    setState((current) => ({ ...current, items: [item, ...current.items.filter((other) => other.id !== item.id)], total: current.total + 1 }));
  }, []);

  const replace = useCallback((item: MediaResponse) => {
    setState((current) => ({ ...current, items: current.items.map((other) => (other.id === item.id ? item : other)) }));
  }, []);

  const remove = useCallback((id: number) => {
    setState((current) => ({ ...current, items: current.items.filter((item) => item.id !== id), total: Math.max(0, current.total - 1) }));
  }, []);

  return { state, load, loadMore, prepend, replace, remove };
}

export function MediaSearchForm({ initial, onSearch, busy }: { initial: string; onSearch: (value: string) => void; busy: boolean }) {
  const [value, setValue] = useState(initial);
  const inputId = useRef(`adm-media-search-${Math.random().toString(36).slice(2)}`).current;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(value);
  }

  return (
    <form className="adm-search adm-search--form" role="search" onSubmit={submit}>
      <Search size={16} aria-hidden="true" />
      <label className="adm-sr-only" htmlFor={inputId}>
        搜尋媒體
      </label>
      <input
        id={inputId}
        type="search"
        placeholder="搜尋檔名"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (event.target.value === "" && initial !== "") onSearch("");
        }}
      />
      <AdminButton size="sm" type="submit" busy={busy}>
        搜尋
      </AdminButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */

type MediaPickerDialogProps = {
  ctx: AdminContext;
  open: boolean;
  mode: "cover" | "gallery";
  selectedIds: number[];
  onPick: (item: MediaResponse) => void;
  onClose: () => void;
};

export function MediaPickerDialog({ ctx, open, mode, selectedIds, onPick, onClose }: MediaPickerDialogProps) {
  const list = useMediaList(ctx, open);
  const { state } = list;
  const images = state.items.filter((item) => !isVideoMedia(item));
  const selected = new Set(selectedIds);

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === "cover" ? "選擇封面圖片" : "加入相簿圖片"}
      footer={
        <AdminButton variant={mode === "gallery" ? "primary" : "secondary"} onClick={onClose}>
          {mode === "gallery" ? "完成" : "取消"}
        </AdminButton>
      }
    >
      <div className="adm-picker">
        <UploadZone
          ctx={ctx}
          compact
          onUploaded={(item) => {
            list.prepend(item);
            onPick(item);
            if (mode === "cover") onClose();
          }}
        />
        <div className="adm-picker__toolbar">
          <MediaSearchForm initial={state.search} busy={state.loading} onSearch={(value) => void list.load(value)} />
          <span className="adm-muted">{mode === "gallery" ? "點選圖片加入相簿，可連續選取。" : "點選一張圖片設為封面。"}</span>
        </div>
        {state.loading ? (
          <LoadingState label="媒體載入中…" />
        ) : state.error ? (
          <EmptyState
            title="媒體暫時無法載入"
            description={state.error}
            action={
              <AdminButton size="sm" onClick={() => void list.load(state.search)}>
                重試
              </AdminButton>
            }
          />
        ) : images.length === 0 ? (
          <EmptyState title={state.search ? "找不到符合的圖片" : "目前還沒有媒體"} description="可以直接在上方上傳新圖片。" />
        ) : (
          <ul className="adm-picker__grid">
            {images.map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`adm-picker__item ${isSelected ? "is-selected" : ""}`}
                    aria-pressed={mode === "gallery" ? isSelected : undefined}
                    disabled={mode === "gallery" && isSelected}
                    onClick={() => {
                      onPick(item);
                      if (mode === "cover") onClose();
                    }}
                  >
                    <SafeImage src={mediaThumbUrl(item)} alt="" loading="lazy" decoding="async" fallbackLabel="無法載入" />
                    <span className="adm-picker__name">{item.original_filename}</span>
                    {isSelected ? (
                      <span className="adm-picker__check" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    ) : null}
                    <span className="adm-sr-only">{isSelected ? "（已加入）" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!state.loading && state.items.length < state.total ? (
          <div className="adm-center">
            <AdminButton busy={state.loadingMore} onClick={() => void list.loadMore()}>
              載入更多（{state.items.length} / {state.total}）
            </AdminButton>
          </div>
        ) : null}
      </div>
    </AdminDialog>
  );
}
