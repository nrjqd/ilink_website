/**
 * 手機用 bottom sheet（原生 <dialog>）。
 *
 * showModal() 讓瀏覽器處理 focus trap、Esc 關閉與背景 inert；另外鎖定頁面捲動，
 * 並在點擊遮罩（dialog 本身）時關閉。
 */

import { useEffect, useId, useRef, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({ open, title, onClose, children, footer }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add("is-scroll-locked");
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => () => document.documentElement.classList.remove("is-scroll-locked"), []);

  return (
    <dialog
      ref={dialogRef}
      className="bottom-sheet"
      aria-labelledby={titleId}
      onClose={() => {
        document.documentElement.classList.remove("is-scroll-locked");
        onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bottom-sheet__panel">
        <span className="bottom-sheet__handle" aria-hidden="true" />
        <header className="bottom-sheet__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="bottom-sheet__close" aria-label="關閉" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="bottom-sheet__body">{children}</div>
        {footer ? <footer className="bottom-sheet__footer">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
