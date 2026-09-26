/**
 * CMS 後台共用 UI 元件與工具：按鈕、狀態標籤、頁首、空狀態、確認對話框、Toast 與格式化函式。
 * 只給 /admin 使用（隨 admin chunk lazy load），不影響公開網站 bundle。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { ApiError, type PostStatus } from "./admin.api";

/* ------------------------------------------------------------------ */
/* Formatters                                                          */
/* ------------------------------------------------------------------ */

export function formatBytes(size: number | null | undefined) {
  if (!size || !Number.isFinite(size) || size < 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("zh-TW", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  // event_date 是 YYYY-MM-DD（無時區），直接顯示避免時區位移。
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, "/");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: "草稿",
  published: "已發布",
  archived: "已封存",
};

export function formatPostStatus(status: string | null | undefined) {
  return status && status in POST_STATUS_LABELS ? POST_STATUS_LABELS[status as PostStatus] : "草稿";
}

/** 將 API 錯誤轉成給編輯者看的中文訊息。 */
export function describeError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "登入已逾時，請重新登入。";
    if (error.status === 403) return "這個帳號沒有管理權限。";
    if (error.code === "MEDIA_IN_USE") return "這張圖片仍被文章使用（封面或相簿），請先從文章移除後再刪除。";
    if (error.code === "UPLOAD_TOO_LARGE") return "檔案超過 15 MB，請壓縮後再上傳。";
    if (error.status >= 500) return `${fallback}（伺服器錯誤 ${error.status}）`;
    return error.message ? `${fallback}：${error.message}` : fallback;
  }
  if (error instanceof TypeError) return `${fallback}：無法連線到 API，請檢查網路或稍後再試。`;
  return fallback;
}

export function isAuthError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

/* ------------------------------------------------------------------ */
/* Buttons / badges / layout                                           */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: ReactNode;
  busy?: boolean;
};

export function AdminButton({
  variant = "secondary",
  size = "md",
  icon,
  busy,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: AdminButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={["adm-btn", `adm-btn--${variant}`, size === "sm" ? "adm-btn--sm" : "", className].filter(Boolean).join(" ")}
    >
      {busy ? <span className="adm-spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`adm-badge adm-badge--${status}`}>{formatPostStatus(status)}</span>;
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="adm-page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="adm-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="adm-empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function LoadingState({ label = "載入中…" }: { label?: string }) {
  return (
    <div className="adm-loading" role="status">
      <span className="adm-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog (native <dialog>: Esc、focus trap、top layer 由瀏覽器處理)   */
/* ------------------------------------------------------------------ */

type AdminDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** 開啟時優先聚焦的元素 selector；預設聚焦對話框內第一個可聚焦元素。 */
  initialFocus?: string;
};

export function AdminDialog({ open, title, onClose, children, footer, size = "md", initialFocus }: AdminDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useRef(`adm-dialog-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      const target = initialFocus ? dialog.querySelector<HTMLElement>(initialFocus) : null;
      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      returnFocusRef.current?.focus?.();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`adm-dialog adm-dialog--${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // 點擊背景（dialog 本身，而非內容）關閉。
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open ? (
        <div className="adm-dialog__inner">
          <header className="adm-dialog__header">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="關閉對話框">
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="adm-dialog__body">{children}</div>
          {footer ? <footer className="adm-dialog__footer">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

export type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type ConfirmState = ConfirmOptions & { resolve: (value: boolean) => void };

/** Promise 版確認對話框，取代 window.confirm()。 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
      }),
    [],
  );

  function settle(value: boolean) {
    state?.resolve(value);
    setState(null);
  }

  const element = (
    <AdminDialog
      open={state !== null}
      title={state?.title ?? ""}
      size="sm"
      onClose={() => settle(false)}
      // 危險操作預設聚焦「取消」，避免誤按 Enter 直接刪除。
      initialFocus={state?.tone === "danger" ? "[data-confirm-cancel]" : "[data-confirm-ok]"}
      footer={
        <>
          <AdminButton variant="secondary" data-confirm-cancel onClick={() => settle(false)}>
            {state?.cancelLabel ?? "取消"}
          </AdminButton>
          <AdminButton variant={state?.tone === "danger" ? "danger" : "primary"} data-confirm-ok onClick={() => settle(true)}>
            {state?.confirmLabel ?? "確定"}
          </AdminButton>
        </>
      }
    >
      <div className="adm-confirm-message">{state?.message}</div>
    </AdminDialog>
  );

  return { confirm, confirmElement: element };
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, kind, message }]);
      // 錯誤訊息保留到使用者關閉；成功 / 提示 5 秒後自動消失。
      if (kind !== "error") window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const element = (
    <div className="adm-toasts" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`adm-toast adm-toast--${toast.kind}`}
          role={toast.kind === "error" ? "alert" : undefined}
        >
          {toast.kind === "error" ? (
            <AlertCircle size={18} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          <span>{toast.message}</span>
          <button type="button" className="adm-icon-btn" onClick={() => dismiss(toast.id)} aria-label="關閉通知">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );

  return { notify: push, toastElement: element };
}
