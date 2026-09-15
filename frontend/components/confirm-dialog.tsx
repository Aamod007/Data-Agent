"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  /** Extra advisory line, e.g. "This action cannot be undone." */
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visually mark the confirm button as destructive. Defaults to true. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  warning,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the cancel button by default — destructive actions should require intent.
    confirmRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      } else if (event.key === "Enter" && !busy) {
        event.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, busy, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="app-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div className="app-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <span className="danger-mark">
            <AlertTriangle size={15} aria-hidden="true" />
          </span>
          <h3 id="confirm-dialog-title">{title}</h3>
          <button
            type="button"
            className="topbar-collapse-btn"
            style={{ marginLeft: "auto" }}
            onClick={onCancel}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X size={14} />
          </button>
        </div>
        <div className="app-modal-body">{body}</div>
        {warning && (
          <div className="app-modal-warning" role="note">
            <AlertTriangle size={12} aria-hidden="true" />
            <span>{warning}</span>
          </div>
        )}
        <div className="app-modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
            disabled={busy}
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`button ${destructive ? "danger" : "primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <LoaderCircle className="spin" size={13} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
