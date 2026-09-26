/**
 * 媒體庫：上傳、搜尋、格線瀏覽、預覽詳細資訊、重新命名與刪除。
 * 使用狀態由已載入的文章清單計算（清單不完整時不顯示，避免誤導）。
 */

import { useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { ExternalLink, Save, Trash2 } from "lucide-react";
import { SafeImage, SafeVideo } from "../../shared/SafeMedia";
import { deleteAdminMedia, updateAdminMedia, type MediaResponse } from "./admin.api";
import { AdminButton, AdminDialog, AdminPageHeader, EmptyState, LoadingState, formatBytes, formatDateTime } from "./adminUi";
import { ADMIN_PATHS, computeMediaUsage, mediaThumbUrl, type AdminContext, type MediaUsage } from "./adminContext";
import { MediaSearchForm, UploadZone, isVideoMedia, useMediaList } from "./adminMedia";

type Props = { ctx: AdminContext };

function formatDimensions(item: MediaResponse) {
  return item.width && item.height ? `${item.width} × ${item.height}` : "尺寸未知";
}

export function AdminMediaView({ ctx }: Props) {
  const list = useMediaList(ctx);
  const { state } = list;
  const [previewId, setPreviewId] = useState<number | null>(null);
  const usage = useMemo(
    () => (ctx.postsComplete ? computeMediaUsage(ctx.posts, ctx.trashPosts) : null),
    [ctx.posts, ctx.trashPosts, ctx.postsComplete],
  );
  const preview = previewId ? state.items.find((item) => item.id === previewId) ?? null : null;

  return (
    <>
      <AdminPageHeader
        title="媒體庫"
        description={
          ctx.dashboard
            ? `共 ${ctx.dashboard.media_total} 個檔案 · 使用容量 ${formatBytes(ctx.dashboard.media_total_bytes)}`
            : undefined
        }
      />

      <UploadZone ctx={ctx} onUploaded={(item) => list.prepend(item)} />

      <div className="adm-filterbar">
        <MediaSearchForm initial={state.search} busy={state.loading} onSearch={(value) => void list.load(value)} />
        <p className="adm-filterbar__count" aria-live="polite">
          {state.loading ? "" : `${state.total} 個檔案${state.search ? `符合「${state.search}」` : ""}`}
        </p>
      </div>

      {state.loading ? (
        <div className="adm-card">
          <LoadingState label="媒體載入中…" />
        </div>
      ) : state.error ? (
        <div className="adm-card">
          <EmptyState
            title="媒體暫時無法載入"
            description={state.error}
            action={
              <AdminButton size="sm" onClick={() => void list.load(state.search)}>
                重試
              </AdminButton>
            }
          />
        </div>
      ) : state.items.length === 0 ? (
        <div className="adm-card">
          {state.search ? (
            <EmptyState
              title="找不到符合的媒體"
              action={
                <AdminButton size="sm" onClick={() => void list.load("")}>
                  清除搜尋
                </AdminButton>
              }
            />
          ) : (
            <EmptyState title="目前還沒有媒體" description="使用上方的上傳區上傳第一張圖片。" />
          )}
        </div>
      ) : (
        <ul className="adm-media-grid">
          {state.items.map((item) => {
            const used = usage?.get(item.id)?.length ?? 0;
            return (
              <li key={item.id}>
                <button type="button" className="adm-media-card" onClick={() => setPreviewId(item.id)}>
                  <span className="adm-media-card__thumb">
                    {isVideoMedia(item) ? (
                      <span className="adm-media-card__video">影片</span>
                    ) : (
                      <SafeImage src={mediaThumbUrl(item)} alt="" loading="lazy" decoding="async" fallbackLabel="無法載入" />
                    )}
                  </span>
                  <span className="adm-media-card__body">
                    <strong title={item.original_filename}>{item.original_filename}</strong>
                    <span>
                      {formatDimensions(item)} · {formatBytes(item.file_size)}
                    </span>
                    <span>{formatDateTime(item.created_at)}</span>
                    {usage ? (
                      <span className={`adm-usage ${used ? "is-used" : ""}`}>{used ? `用於 ${used} 處` : "未使用"}</span>
                    ) : null}
                  </span>
                  <span className="adm-sr-only">，開啟詳細資訊</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!state.loading && state.items.length > 0 && state.items.length < state.total ? (
        <div className="adm-center">
          <AdminButton busy={state.loadingMore} onClick={() => void list.loadMore()}>
            載入更多（{state.items.length} / {state.total}）
          </AdminButton>
        </div>
      ) : null}

      <MediaPreviewDialog
        ctx={ctx}
        item={preview}
        usage={usage}
        onClose={() => setPreviewId(null)}
        onUpdated={(item) => list.replace(item)}
        onDeleted={(id) => {
          list.remove(id);
          setPreviewId(null);
        }}
      />
    </>
  );
}

type PreviewProps = {
  ctx: AdminContext;
  item: MediaResponse | null;
  usage: MediaUsage | null;
  onClose: () => void;
  onUpdated: (item: MediaResponse) => void;
  onDeleted: (id: number) => void;
};

function MediaPreviewDialog({ ctx, item, usage, onClose, onUpdated, onDeleted }: PreviewProps) {
  return (
    <AdminDialog open={item !== null} onClose={onClose} title="媒體詳細資訊" size="lg">
      {item ? <MediaPreviewBody key={item.id} ctx={ctx} item={item} usage={usage} onUpdated={onUpdated} onDeleted={onDeleted} /> : null}
    </AdminDialog>
  );
}

function MediaPreviewBody({
  ctx,
  item,
  usage,
  onUpdated,
  onDeleted,
}: Omit<PreviewProps, "item" | "onClose"> & { item: MediaResponse }) {
  const [filename, setFilename] = useState(item.original_filename);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const usedBy = usage?.get(item.id) ?? [];
  const inUse = usedBy.length > 0;
  const dirty = filename.trim() !== item.original_filename;

  async function saveFilename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filename.trim()) return;
    setSaving(true);
    try {
      const updated = await updateAdminMedia(ctx.token, item.id, { original_filename: filename });
      onUpdated(updated);
      ctx.notify("success", "檔名已更新");
    } catch (error) {
      ctx.reportError(error, "檔名更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await ctx.confirm({
      title: "刪除媒體",
      message: (
        <>
          <p>
            確定刪除「<strong>{item.original_filename}</strong>」？
          </p>
          <p>圖片檔（原圖、大圖、縮圖）會從儲存空間移除，此操作無法復原。</p>
        </>
      ),
      confirmLabel: "刪除圖片",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAdminMedia(ctx.token, item.id);
      onDeleted(item.id);
      ctx.notify("success", `已刪除「${item.original_filename}」`);
      void ctx.refreshDashboard().catch(() => undefined);
    } catch (error) {
      ctx.reportError(error, "媒體刪除失敗");
    } finally {
      setDeleting(false);
    }
  }

  function openPost(event: MouseEvent<HTMLAnchorElement>, id: number) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    ctx.navigate(ADMIN_PATHS.post(id));
  }

  const largeUrl = item.large_url || item.original_url;

  return (
    <div className="adm-preview">
      <div className="adm-preview__media">
        {isVideoMedia(item) ? (
          <SafeVideo src={largeUrl} controls />
        ) : (
          <SafeImage
            src={largeUrl}
            alt={item.original_filename}
            decoding="async"
            {...(item.width && item.height ? { width: item.width, height: item.height } : {})}
          />
        )}
      </div>

      <div className="adm-preview__info">
        <form className="adm-field" onSubmit={saveFilename}>
          <label htmlFor="adm-media-filename">檔名</label>
          <div className="adm-row">
            <input id="adm-media-filename" value={filename} onChange={(event) => setFilename(event.target.value)} maxLength={255} />
            <AdminButton type="submit" size="sm" icon={<Save size={14} aria-hidden="true" />} busy={saving} disabled={!dirty || !filename.trim()}>
              儲存
            </AdminButton>
          </div>
          <span className="adm-hint">僅供後台辨識；網站上的圖片說明請在文章相簿的「圖說」填寫。</span>
        </form>

        <dl className="adm-dl">
          <div>
            <dt>尺寸</dt>
            <dd>{formatDimensions(item)}</dd>
          </div>
          <div>
            <dt>檔案大小</dt>
            <dd>{formatBytes(item.file_size)}</dd>
          </div>
          <div>
            <dt>格式</dt>
            <dd>{item.mime_type}</dd>
          </div>
          <div>
            <dt>上傳時間</dt>
            <dd>{formatDateTime(item.created_at)}</dd>
          </div>
          <div>
            <dt>使用狀態</dt>
            <dd>
              {usage === null ? (
                "無法確認（文章數量超過一次載入上限）"
              ) : inUse ? (
                <ul className="adm-usage-list">
                  {usedBy.map((entry) => (
                    <li key={`${entry.id}-${entry.role}`}>
                      <a href={ADMIN_PATHS.post(entry.id)} onClick={(event) => openPost(event, entry.id)}>
                        {entry.title}
                      </a>
                      <span className="adm-muted">（{entry.role}）</span>
                    </li>
                  ))}
                </ul>
              ) : (
                "未被任何文章使用"
              )}
            </dd>
          </div>
        </dl>

        <details className="adm-details">
          <summary>技術資訊</summary>
          <dl className="adm-dl adm-dl--mono">
            <div>
              <dt>ID / UUID</dt>
              <dd>
                #{item.id} · {item.uuid}
              </dd>
            </div>
            <div>
              <dt>儲存位置</dt>
              <dd>
                {item.storage_provider} / {item.bucket}
              </dd>
            </div>
            <div>
              <dt>原圖 key</dt>
              <dd>{item.original_object_key}</dd>
            </div>
            <div>
              <dt>大圖 key</dt>
              <dd>{item.large_object_key}</dd>
            </div>
            <div>
              <dt>縮圖 key</dt>
              <dd>{item.thumbnail_object_key}</dd>
            </div>
          </dl>
        </details>

        <div className="adm-preview__actions">
          <a className="adm-btn adm-btn--secondary adm-btn--sm" href={item.original_url} target="_blank" rel="noopener">
            <ExternalLink size={14} aria-hidden="true" />
            開啟原圖
          </a>
          <AdminButton
            size="sm"
            variant="danger-ghost"
            icon={<Trash2 size={14} aria-hidden="true" />}
            busy={deleting}
            disabled={inUse}
            aria-describedby={inUse ? "adm-media-inuse" : undefined}
            onClick={() => void remove()}
          >
            刪除圖片
          </AdminButton>
          {inUse ? (
            <span id="adm-media-inuse" className="adm-hint">
              仍被文章使用，需先從文章移除才能刪除。
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
